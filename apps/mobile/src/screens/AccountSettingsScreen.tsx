import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { LoadingState } from '../design/LoadingState';
import { getMyProfile, updateMyProfile } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AccountCategory } from '../settings/AccountCategory';
import { AppCategory } from '../settings/AppCategory';
import { AppearanceCategory } from '../settings/AppearanceCategory';
import { CategoryTabs } from '../settings/CategoryTabs';
import { HelpCategory } from '../settings/HelpCategory';
import { NotificationsCategory } from '../settings/NotificationsCategory';
import { PrivacyCategory } from '../settings/PrivacyCategory';
import { SETTINGS_CATEGORIES, type SettingsCategory } from '../settings/settingsCategories';
import { settingsStyles as styles } from '../settings/settingsStyles';
import { DEFAULT_NUTRITION_COLOR, DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';

type Props = RootStackScreenProps<'AccountSettings'>;

// The app's global Settings hub, reached from the existing gear/menu
// affordances (Dashboard's avatar button, the side menu's "Settings" item --
// see appMenuSections.ts). Reorganizes the same account/appearance/app-link
// functionality that used to live on one long scroll into six categories;
// no account behavior, API integration, or navigation target changed, only
// how it's grouped and presented. Route name stays `AccountSettings` (an
// internal identifier only) so nothing elsewhere in the navigation needs to
// change.
export function AccountSettingsScreen({ navigation }: Props) {
  const { user, session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const { theme, themeLoading } = useProgressTheme();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('Account');

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [workoutAccentColor, setWorkoutAccentColor] = useState<string | null>(null);
  const [nutritionAccentColor, setNutritionAccentColor] = useState<string | null>(null);
  const [pushNotificationsOptIn, setPushNotificationsOptIn] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const profile = await getMyProfile(accessToken);
      setDisplayName(profile.displayName ?? '');
      setUsername(profile.username ?? '');
      setWeightUnit(profile.weightUnit);
      setWorkoutAccentColor(profile.workoutAccentColor);
      setNutritionAccentColor(profile.nutritionAccentColor);
      setPushNotificationsOptIn(profile.pushNotificationsOptIn ?? false);
      setEmailOptIn(profile.emailOptIn ?? false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
    // Re-load on every focus (not just mount) so Appearance reflects a color
    // just saved from WorkoutColorScreen/NutritionColorScreen.
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  async function handleSave() {
    if (!accessToken) return;
    setSaveError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const profile = await updateMyProfile(accessToken, {
        displayName: displayName.trim(),
        username: username.trim() || undefined,
        weightUnit,
      });
      setDisplayName(profile.displayName ?? '');
      setUsername(profile.username ?? '');
      setSavedMessage('Saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetThemeColors() {
    if (!accessToken) return;
    Alert.alert(
      'Reset Theme Colors',
      'This will restore Workout to Electric Blue and Nutrition to Emerald.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const profile = await updateMyProfile(accessToken, {
                workoutAccentColor: DEFAULT_WORKOUT_COLOR,
                nutritionAccentColor: DEFAULT_NUTRITION_COLOR,
              });
              setWorkoutAccentColor(profile.workoutAccentColor);
              setNutritionAccentColor(profile.nutritionAccentColor);
            } catch (err) {
              setSaveError(err instanceof Error ? err.message : 'Failed to reset theme colors');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  }

  async function handleTogglePush(value: boolean) {
    if (!accessToken) return;
    const previous = pushNotificationsOptIn;
    setPushNotificationsOptIn(value);
    setNotifSaving(true);
    try {
      await updateMyProfile(accessToken, { pushNotificationsOptIn: value });
    } catch {
      setPushNotificationsOptIn(previous);
    } finally {
      setNotifSaving(false);
    }
  }

  async function handleToggleEmail(value: boolean) {
    if (!accessToken) return;
    const previous = emailOptIn;
    setEmailOptIn(value);
    setNotifSaving(true);
    try {
      await updateMyProfile(accessToken, { emailOptIn: value });
    } catch {
      setEmailOptIn(previous);
    } finally {
      setNotifSaving(false);
    }
  }

  if (loading || themeLoading) {
    return <LoadingState testID="account-loading" />;
  }

  return (
    <View style={styles.screen} testID="settings-screen">
      <AppHeader
        testID="settings-header"
        title="Settings"
        subtitle="Customize your experience."
        onBack={() => navigation.goBack()}
      />

      <CategoryTabs
        testID="settings-tabs"
        categories={[...SETTINGS_CATEGORIES]}
        active={activeCategory}
        onSelect={setActiveCategory}
        accentColor={theme.accent}
      />

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="settings-scroll"
      >
        {loadError ? (
          <Text testID="account-load-error" style={styles.errorText}>
            {loadError}
          </Text>
        ) : null}

        {activeCategory === 'Account' ? (
          <AccountCategory
            email={user?.email ?? ''}
            displayName={displayName}
            onChangeDisplayName={setDisplayName}
            username={username}
            onChangeUsername={setUsername}
            weightUnit={weightUnit}
            onChangeWeightUnit={setWeightUnit}
            saving={saving}
            saveError={saveError}
            savedMessage={savedMessage}
            onSave={handleSave}
            onSignOut={() => signOut()}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        ) : null}

        {activeCategory === 'Appearance' ? (
          <AppearanceCategory
            workoutAccentColor={workoutAccentColor}
            nutritionAccentColor={nutritionAccentColor}
            resetting={resetting}
            onNavigateWorkoutColor={() => navigation.navigate('WorkoutColorSettings')}
            onNavigateNutritionColor={() => navigation.navigate('NutritionColorSettings')}
            onResetThemeColors={handleResetThemeColors}
          />
        ) : null}

        {activeCategory === 'App' ? (
          <AppCategory
            onNavigateWorkoutSplits={() => navigation.navigate('WorkoutSplits')}
            onNavigateWorkoutHistory={() => navigation.navigate('WorkoutHistory')}
            onNavigateExerciseLibrary={() => navigation.navigate('ExerciseLibrary')}
            onNavigateNutrition={() => navigation.navigate('Nutrition')}
          />
        ) : null}

        {activeCategory === 'Notifications' ? (
          <NotificationsCategory
            pushNotificationsOptIn={pushNotificationsOptIn}
            onTogglePush={handleTogglePush}
            emailOptIn={emailOptIn}
            onToggleEmail={handleToggleEmail}
            saving={notifSaving}
            accentColor={theme.accent}
          />
        ) : null}

        {activeCategory === 'Privacy' ? <PrivacyCategory /> : null}

        {activeCategory === 'Help' ? <HelpCategory /> : null}
      </ScrollView>
    </View>
  );
}
