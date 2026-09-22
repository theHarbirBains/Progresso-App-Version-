import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { Text } from '../design/Text';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { getFoodByBarcode, getMyProfile, type FoodSearchResult } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { FoodFacts } from '../nutrition/FoodFacts';
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
//
// States: live camera (full-bleed, header floating over it), camera-permission
// prompt, the found product (shared FoodFacts widgets + one filled Log Food),
// not found and lookup error. Every state but the live camera is a stack of
// widgets. Not found tells the user which code it was and makes **Enter
// Manually** the one filled button: it opens the custom-food form already
// carrying the scanned barcode, then goes straight on to logging it (see
// FoodLibraryScreen), and the next scan of that code finds the user's own entry.
// Scan Again and Search Food are outlined.
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

  const scanHeader = (
    <AppHeader
      title="Scan Barcode"
      onBack={() => navigation.goBack()}
      testID="barcode-scanner-header"
    />
  );

  if (!permission.granted) {
    return (
      <Screen scroll={false} header={scanHeader} contentContainerStyle={styles.centered}>
        <AppCard hero>
          <EmptyState
            testID="barcode-scanner-permission-denied"
            title={
              permission.canAskAgain
                ? 'Progresso needs camera access to scan barcodes'
                : 'Camera access is off for Progresso -- turn it on in Settings to scan barcodes'
            }
          />
        </AppCard>
        <AppCard style={styles.actions}>
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
        </AppCard>
      </Screen>
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
          imageUrl: state.product.imageUrl,
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
      <Screen
        header={
          <AppHeader
            title={product.name}
            subtitle={product.brand ?? undefined}
            onBack={resetToScanning}
            testID="barcode-scanner-found-header"
          />
        }
      >
        <FoodFacts
          name={product.name}
          imageUrl={product.imageUrl}
          servingSize={product.servingSize}
          servingUnit={product.servingUnit}
          calories={product.calories}
          proteinG={product.proteinG}
          carbsG={product.carbsG}
          fatG={product.fatG}
          showAttribution={product.provider === 'open_food_facts'}
          accentColor={theme.accent}
          testIDs={{
            serving: 'barcode-scanner-serving',
            calories: 'barcode-scanner-calories',
            attribution: 'barcode-scanner-attribution',
          }}
        />
        <View style={styles.foundButtonWrap}>
          <PrimaryButton
            testID="barcode-scanner-log-button"
            label="Log Food"
            onPress={() => setState({ status: 'logging', product })}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </Screen>
    );
  }

  if (state.status === 'not-found') {
    return (
      <Screen scroll={false} header={scanHeader} contentContainerStyle={styles.centered}>
        <AppCard hero testID="barcode-scanner-not-found-card">
          <EmptyState
            testID="barcode-scanner-not-found"
            title="Product not found"
            description="We couldn't find a match for that barcode in our database."
          />
          <Text testID="barcode-scanner-not-found-code" style={styles.scannedCode}>
            {state.barcode}
          </Text>
          <Text style={styles.manualHint}>
            You can add it yourself: enter its details once and log it straight away.
          </Text>
        </AppCard>
        <AppCard style={styles.actions}>
          <PrimaryButton
            testID="barcode-scanner-create-custom"
            label="Enter Manually"
            onPress={() =>
              navigation.navigate('FoodLibrary', { openCreate: true, barcode: state.barcode })
            }
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
          <SecondaryButton
            testID="barcode-scanner-scan-again"
            label="Scan Again"
            onPress={resetToScanning}
          />
          <SecondaryButton
            testID="barcode-scanner-search-food"
            label="Search Food"
            onPress={() => navigation.navigate('FoodSearch')}
          />
        </AppCard>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen scroll={false} header={scanHeader} contentContainerStyle={styles.centered}>
        <AppCard hero>
          <ErrorState
            testID="barcode-scanner-error"
            message={state.message}
            onRetry={() => void lookUp(state.barcode)}
          />
        </AppCard>
        <AppCard style={styles.actions}>
          <SecondaryButton
            testID="barcode-scanner-search-food"
            label="Search Food"
            onPress={() => navigation.navigate('FoodSearch')}
          />
        </AppCard>
      </Screen>
    );
  }

  // status === 'scanning' | 'looking-up'
  // The live camera is the one genuinely full-bleed screen in the app: the
  // preview fills everything and the header floats over it.
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
        {scanHeader}
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={[styles.frame, { borderColor: theme.accent }]} />
          <View style={styles.hintPill}>
            <Text style={styles.frameHint}>
              {state.status === 'looking-up'
                ? 'Looking up product…'
                : 'Point your camera at a barcode'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
