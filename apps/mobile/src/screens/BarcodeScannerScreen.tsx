import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { LoadingState } from '../design/LoadingState';
import { colors } from '../design/theme';
import { getFoodByBarcode, getMyProfile, type FoodSearchResult } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { LogFoodStep } from '../nutrition/LogFoodStep';
import { buildAccentTheme, DEFAULT_NUTRITION_THEME, type AccentTheme } from '../theme/accentColor';
import { barcodeScannerStyles as styles } from './barcodeScannerStyles';

type Props = RootStackScreenProps<'BarcodeScanner'>;

// Barcode types food packaging actually uses -- not expo-camera's full
// symbology list (which also covers QR/PDF417/etc., irrelevant here).
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

type ScanState =
  | { status: 'scanning' }
  | { status: 'looking-up'; barcode: string }
  | { status: 'found'; product: FoodSearchResult }
  | { status: 'logging'; product: FoodSearchResult }
  | { status: 'not-found'; barcode: string }
  | { status: 'error'; barcode: string; message: string };

// Dashboard's "Scan Barcode" quick action's destination -- the third of the
// three ways to find/add food (Search Food, Scan Barcode, Create Custom
// Food), all converging on the same normalized food model and the same
// LogFoodStep every other flow uses (see FoodSearchScreen, FoodLibraryScreen).
// Looks up the scanned barcode via the backend's GET /foods/barcode/:barcode
// (apps/api/src/foods/) -- never talks to Open Food Facts directly, same
// external-provider-orchestration reasoning as food search.
export function BarcodeScannerScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;

  const [theme, setTheme] = useState<AccentTheme>(DEFAULT_NUTRITION_THEME);
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ status: 'scanning' });
  // onBarcodeScanned keeps firing for every frame a barcode is visible in --
  // this guards a single scan from triggering multiple lookups until the
  // user explicitly returns to 'scanning' (Scan Again).
  const hasScannedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function loadTheme() {
      if (!accessToken) return;
      try {
        const profile = await getMyProfile(accessToken);
        if (!mounted) return;
        setTheme(
          profile.nutritionAccentColor
            ? buildAccentTheme(profile.nutritionAccentColor)
            : DEFAULT_NUTRITION_THEME,
        );
      } catch {
        // Keep the default nutrition theme -- non-fatal.
      }
    }
    void loadTheme();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const lookUp = useCallback(
    async (barcode: string) => {
      if (!accessToken) return;
      setState({ status: 'looking-up', barcode });
      try {
        const product = await getFoodByBarcode(accessToken, barcode);
        setState(product ? { status: 'found', product } : { status: 'not-found', barcode });
      } catch (err) {
        setState({
          status: 'error',
          barcode,
          message: err instanceof Error ? err.message : 'Failed to look up product',
        });
      }
    },
    [accessToken],
  );

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    void lookUp(result.data);
  }

  function resetToScanning() {
    hasScannedRef.current = false;
    setState({ status: 'scanning' });
  }

  // Permission states -- see DESIGN.md §9: not requested, granted, denied,
  // previously denied (canAskAgain false -- the OS itself will no longer
  // show its own prompt, so the only path forward is Settings).
  if (!permission) {
    return <LoadingState testID="barcode-scanner-permission-loading" />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <AppHeader
          title="Scan Barcode"
          onBack={() => navigation.goBack()}
          testID="barcode-scanner-header"
        />
        <View style={styles.permissionContent}>
          <EmptyState
            testID="barcode-scanner-permission-denied"
            icon={<Feather name="camera-off" size={28} color={colors.textMuted} />}
            title={
              permission.canAskAgain
                ? 'Progresso needs camera access to scan barcodes'
                : 'Camera access is off for Progresso -- turn it on in Settings to scan barcodes'
            }
          />
          <View style={styles.permissionActions}>
            {permission.canAskAgain ? (
              <PrimaryButton
                testID="barcode-scanner-request-permission"
                label="Enable Camera"
                onPress={() => void requestPermission()}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
              />
            ) : (
              <PrimaryButton
                testID="barcode-scanner-open-settings"
                label="Open Settings"
                onPress={() => void Linking.openSettings()}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
              />
            )}
            <SecondaryButton
              testID="barcode-scanner-search-instead"
              label="Search Food Instead"
              onPress={() => navigation.navigate('FoodSearch')}
            />
          </View>
        </View>
      </View>
    );
  }

  if (state.status === 'logging') {
    return (
      <LogFoodStep
        food={{
          id: state.product.id,
          name: state.product.name,
          servingSize: state.product.servingSize,
          servingUnit: state.product.servingUnit,
          calories: state.product.calories,
          proteinG: state.product.proteinG ?? 0,
          carbsG: state.product.carbsG ?? 0,
          fatG: state.product.fatG ?? 0,
        }}
        userId={userId}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onDone={() => navigation.navigate('Nutrition')}
        onCancel={() => setState({ status: 'found', product: state.product })}
      />
    );
  }

  if (state.status === 'found') {
    const product = state.product;
    return (
      <View style={styles.screen}>
        <AppHeader
          title={product.name}
          subtitle={product.brand ?? undefined}
          onBack={resetToScanning}
          testID="barcode-scanner-found-header"
        />
        <View style={styles.foundContent}>
          <Text testID="barcode-scanner-serving" style={styles.foundServing}>
            Serving: {product.servingSize} {product.servingUnit}
          </Text>
          <Text testID="barcode-scanner-calories" style={styles.foundCalories}>
            {product.calories} cal
          </Text>
          <View style={styles.foundMacroRow}>
            <Text style={styles.foundMacro}>Protein {product.proteinG ?? '—'}</Text>
            <Text style={styles.foundMacro}>Carbs {product.carbsG ?? '—'}</Text>
            <Text style={styles.foundMacro}>Fat {product.fatG ?? '—'}</Text>
          </View>
          {product.provider === 'open_food_facts' ? (
            <Text testID="barcode-scanner-attribution" style={styles.foundAttribution}>
              Data from Open Food Facts
            </Text>
          ) : null}
          <View style={styles.foundButtonWrap}>
            <PrimaryButton
              testID="barcode-scanner-log-button"
              label="Log Food"
              onPress={() => setState({ status: 'logging', product })}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </View>
        </View>
      </View>
    );
  }

  if (state.status === 'not-found') {
    return (
      <View style={styles.screen}>
        <AppHeader
          title="Scan Barcode"
          onBack={() => navigation.goBack()}
          testID="barcode-scanner-header"
        />
        <View style={styles.fallbackContent}>
          <EmptyState
            testID="barcode-scanner-not-found"
            icon={<Feather name="search" size={28} color={colors.textMuted} />}
            title="Product not found"
          />
          <Text style={styles.fallbackSubtitle}>
            {"We couldn't find a match for that barcode in our database."}
          </Text>
          <View style={styles.fallbackActions}>
            <PrimaryButton
              testID="barcode-scanner-scan-again"
              label="Scan Again"
              onPress={resetToScanning}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
            <SecondaryButton
              testID="barcode-scanner-search-food"
              label="Search Food"
              onPress={() => navigation.navigate('FoodSearch')}
            />
            <SecondaryButton
              testID="barcode-scanner-create-custom"
              label="Create Custom Food"
              onPress={() =>
                navigation.navigate('FoodLibrary', { openCreate: true, barcode: state.barcode })
              }
            />
          </View>
        </View>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.screen}>
        <AppHeader
          title="Scan Barcode"
          onBack={() => navigation.goBack()}
          testID="barcode-scanner-header"
        />
        <View style={styles.fallbackContent}>
          <ErrorState
            testID="barcode-scanner-error"
            message={state.message}
            onRetry={() => void lookUp(state.barcode)}
          />
          <View style={styles.fallbackActions}>
            <SecondaryButton
              testID="barcode-scanner-search-food"
              label="Search Food"
              onPress={() => navigation.navigate('FoodSearch')}
            />
          </View>
        </View>
      </View>
    );
  }

  // status === 'scanning' | 'looking-up'
  return (
    <View style={styles.screen}>
      <CameraView
        testID="barcode-scanner-camera"
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={state.status === 'scanning' ? handleBarcodeScanned : undefined}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <AppHeader
          title="Scan Barcode"
          onBack={() => navigation.goBack()}
          testID="barcode-scanner-header"
        />
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={[styles.frame, { borderColor: theme.accent }]} />
          <Text style={styles.frameHint}>
            {state.status === 'looking-up'
              ? 'Looking up product…'
              : 'Point your camera at a barcode'}
          </Text>
        </View>
      </View>
    </View>
  );
}
