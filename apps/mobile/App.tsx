import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AppBackgroundLayer } from './src/design/AppBackgroundLayer';
import { AppSideMenu } from './src/design/AppSideMenu';
import { BackgroundThemeProvider, useBackgroundTheme } from './src/design/BackgroundThemeContext';
import { BottomNavBar } from './src/design/BottomNavBar';
import { LoadingState } from './src/design/LoadingState';
import { QuickActionMenu } from './src/design/QuickActionMenu';
import { getMyProfile } from './src/lib/api';
import { wrapApp } from './src/lib/sentry';
import { AppMenuContext } from './src/navigation/AppMenuContext';
import { APP_MENU_SECTIONS, type AppMenuRoute } from './src/navigation/appMenuSections';
import { routeToBottomNavTab } from './src/navigation/bottomNavRouting';
import { getDefaultScreenOptions } from './src/navigation/navigationTransitions';
import { isNutritionRoute, NUTRITION_MENU_SECTIONS } from './src/navigation/nutritionMenuSections';
import type { RootStackParamList } from './src/navigation/types';
import { useProgressTheme } from './src/progress/useProgressTheme';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
import { BackgroundThemeScreen } from './src/screens/BackgroundThemeScreen';
import { CalorieEstimationScreen } from './src/screens/CalorieEstimationScreen';
import { ChooseWorkoutSplitScreen } from './src/screens/ChooseWorkoutSplitScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { BarcodeScannerScreen } from './src/screens/BarcodeScannerScreen';
import { ExerciseLibraryScreen } from './src/screens/ExerciseLibraryScreen';
import { ExerciseProgressScreen } from './src/screens/ExerciseProgressScreen';
import { FoodLibraryScreen } from './src/screens/FoodLibraryScreen';
import { FoodSearchScreen } from './src/screens/FoodSearchScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { NewWorkoutScreen } from './src/screens/NewWorkoutScreen';
import { NutritionColorScreen } from './src/screens/NutritionColorScreen';
import { NutritionGoalsScreen } from './src/screens/NutritionGoalsScreen';
import { NutritionTodayScreen } from './src/screens/NutritionTodayScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PRHistoryScreen } from './src/screens/PRHistoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProgressExerciseDetailScreen } from './src/screens/ProgressExerciseDetailScreen';
import { ProgressOverviewScreen } from './src/screens/ProgressOverviewScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { ShareWorkoutScreen } from './src/screens/ShareWorkoutScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { WorkoutColorScreen } from './src/screens/WorkoutColorScreen';
import { WorkoutDetailScreen } from './src/screens/WorkoutDetailScreen';
import { WorkoutHistoryScreen } from './src/screens/WorkoutHistoryScreen';
import { WorkoutSplitFormScreen } from './src/screens/WorkoutSplitFormScreen';
import { WorkoutSplitsScreen } from './src/screens/WorkoutSplitsScreen';
import { WorkoutSplitViewScreen } from './src/screens/WorkoutSplitViewScreen';
import {
  buildAccentTheme,
  DEFAULT_NUTRITION_THEME,
  type AccentTheme,
} from './src/theme/accentColor';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const Stack = createNativeStackNavigator<RootStackParamList>();

// The app's mode-agnostic root screens -- none of them navigate when the
// Workout/Nutrition toggle changes, so their mode can't be read off the
// current route the way every other screen's can (see isNutritionRoute).
// See Root's own `sharedMode` for how this is used.
const MODE_AGNOSTIC_ROUTES = new Set(['Dashboard', 'ProgressOverview', 'Profile']);

// Sign-in/up/forgot-password/reset-password stay on the pre-existing local
// screen-state pattern (untouched by Phase 3) -- only the signed-in app
// graduates to a real navigator, since that's the part that actually needs
// back-stack semantics now. Root only ever mounts once AppShell's `ready`
// is true, so status is guaranteed resolved -- there is no 'loading' branch
// to handle here.
//
// `justCreatedAccount` is deliberately plain in-memory state, never
// persisted: it's set true only by SignUpScreen's own success callback in
// this same app session, and cleared the moment Welcome's Get Started is
// pressed -- at which point onboarding is known to be needed without a
// profile fetch (a brand-new account can't have completed it yet).
//
// `onboardingStatus` is the persisted counterpart, backed by
// users.onboarding_completed_at (see the onboarding/sign-up redesign): a
// signed-in session that ISN'T a fresh signup (e.g. the app was closed
// mid-onboarding and reopened later) still needs to land on Onboarding
// rather than Dashboard, which a purely in-memory flag could never capture.
interface RootProps {
  /** Reports the currently-effective Workout/Nutrition mode up to AppShell, so AppBackgroundLayer (mounted outside the navigator) can follow it. */
  onBackgroundModeChange: (mode: 'workout' | 'nutrition') => void;
  /** Reports whether the photographic background should show -- true only while Dashboard is the current route (every other screen sits on the flat theme fill). */
  onBackgroundPhotoChange: (visible: boolean) => void;
}

function Root({ onBackgroundModeChange, onBackgroundPhotoChange }: RootProps) {
  const { status, session } = useAuth();
  const accessToken = session?.access_token;
  const [mode, setMode] = useState<AuthMode>('signIn');
  // Dashboard, Progress, and Profile are the app's mode-agnostic root
  // screens -- none of them navigate when the Workout/Nutrition toggle
  // changes, so their mode can't be read off the current route the way
  // every other screen's can (see isNutritionRoute). Each reports changes
  // here via AppMenuContext's reportMode, and this is the single shared
  // flag all three fall back to. Workouts/Food's own toggle also reports
  // here (even though their own mode IS route-derived) purely to keep this
  // flag current for whichever of the three mode-agnostic screens the user
  // visits next.
  const [sharedMode, setSharedMode] = useState<'workout' | 'nutrition'>('workout');
  const [justCreatedAccount, setJustCreatedAccount] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'needed' | 'done'>(
    'checking',
  );
  // The app-level side menu (AppSideMenu) is mounted here, as a sibling of
  // the navigator, rather than inside any individual screen -- that's what
  // lets it render above the ENTIRE app (header, content, bottom nav) on
  // every screen, instead of being clipped to whatever z-index games one
  // screen's own fixed header happens to play. navigationRef is how it
  // navigates/highlights the current route without being inside the
  // navigator itself; AppMenuContext is how a screen (Dashboard today) asks
  // it to open.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<'workout' | 'nutrition'>('workout');
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const { theme: menuTheme } = useProgressTheme();
  const insets = useSafeAreaInsets();
  // AppSideMenu's own accent/section content follows whichever mode the
  // current screen belongs to (see isNutritionRoute) -- menuTheme above
  // stays Workout-only (per useProgressTheme's own scope) and still drives
  // the global BottomNavBar/QuickActionMenu, unchanged; this is a second,
  // separate theme fetch, following the same pattern FoodSearchScreen/
  // DashboardScreen already use for their own Nutrition accent.
  const [nutritionMenuTheme, setNutritionMenuTheme] =
    useState<AccentTheme>(DEFAULT_NUTRITION_THEME);
  useEffect(() => {
    let mounted = true;
    if (!accessToken) return;
    getMyProfile(accessToken)
      .then((profile) => {
        if (!mounted) return;
        setNutritionMenuTheme(
          profile.nutritionAccentColor
            ? buildAccentTheme(profile.nutritionAccentColor)
            : DEFAULT_NUTRITION_THEME,
        );
      })
      .catch(() => {
        // Keep the default nutrition theme -- non-fatal.
      });
    return () => {
      mounted = false;
    };
  }, [accessToken]);
  // The persistent bottom nav (BottomNavBar) is mounted here for the same
  // reason AppSideMenu is: as a sibling of the navigator so it survives
  // every push/pop instead of being owned by (and disappearing with) an
  // individual screen. currentRouteName is tracked via onReady/onStateChange
  // below since navigationRef's own current route doesn't trigger a
  // re-render on its own -- without this the bar would render but never
  // update its active tab as the user navigates. Dashboard is skipped (see
  // routeToBottomNavTab's comment) since it renders its own bottom bar.
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(undefined);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  // The background image (AppBackgroundLayer, mounted outside the
  // navigator in AppShell) follows this same mode -- the shared flag when
  // the current route is mode-agnostic, otherwise whichever mode the route
  // belongs to (see isNutritionRoute).
  const backgroundMode: 'workout' | 'nutrition' = MODE_AGNOSTIC_ROUTES.has(currentRouteName ?? '')
    ? sharedMode
    : isNutritionRoute(currentRouteName)
      ? 'nutrition'
      : 'workout';
  useEffect(() => {
    onBackgroundModeChange(backgroundMode);
  }, [backgroundMode, onBackgroundModeChange]);
  // The photo is a Dashboard-only atmosphere: it is the one screen designed
  // around it. Every other screen -- including sign-in, onboarding and the
  // Workout/Nutrition sub-screens -- sits on the flat Background Theme fill,
  // so dense, data-heavy content never competes with a photograph.
  // Auth screens render outside the navigator, so currentRouteName is
  // undefined for them and the photo stays off.
  const showBackgroundPhoto = status === 'signedIn' && currentRouteName === 'Dashboard';
  useEffect(() => {
    onBackgroundPhotoChange(showBackgroundPhoto);
  }, [showBackgroundPhoto, onBackgroundPhotoChange]);
  // Set right before clearing justCreatedAccount (a fresh account obviously
  // needs onboarding, no fetch required) so the generic profile-check effect
  // below -- which also re-runs on that same justCreatedAccount transition --
  // doesn't immediately overwrite that known-correct 'needed' status with a
  // stale fetch result.
  const skipNextOnboardingCheckRef = useRef(false);

  useEffect(() => {
    if (status !== 'signedIn' || justCreatedAccount || !accessToken) return;
    if (skipNextOnboardingCheckRef.current) {
      skipNextOnboardingCheckRef.current = false;
      return;
    }
    let mounted = true;
    setOnboardingStatus('checking');
    getMyProfile(accessToken)
      .then((profile) => {
        if (mounted) setOnboardingStatus(profile.onboardingCompletedAt ? 'done' : 'needed');
      })
      .catch(() => {
        if (mounted) setOnboardingStatus('done');
      });
    return () => {
      mounted = false;
    };
  }, [status, justCreatedAccount, accessToken]);

  if (status === 'passwordRecovery') {
    return <ResetPasswordScreen />;
  }

  if (status === 'signedIn') {
    if (justCreatedAccount) {
      return (
        <WelcomeScreen
          onGetStarted={() => {
            skipNextOnboardingCheckRef.current = true;
            setJustCreatedAccount(false);
            setOnboardingStatus('needed');
          }}
        />
      );
    }

    if (onboardingStatus === 'checking') {
      return <LoadingState testID="onboarding-status-loading" />;
    }

    // Onboarding shows no bottom nav at all -- every other screen, Dashboard
    // included, gets this one persistent bar for free, with no per-screen
    // wiring, since it's a sibling of the navigator rather than owned by any
    // individual screen. (Dashboard used to render its own second copy; there
    // is now exactly one bottom navigation in the app.)
    const showGlobalBottomNav = currentRouteName !== undefined && currentRouteName !== 'Onboarding';

    return (
      <AppMenuContext.Provider
        value={{
          openMenu: (mode) => {
            setMenuMode(mode ?? backgroundMode);
            setMenuOpen(true);
          },
          // Calls onBackgroundModeChange directly, in the same tick as
          // setSharedMode, instead of only setting state and waiting for
          // the backgroundMode useEffect below to notice on Root's next
          // render -- that extra render+effect round trip was the visible
          // one-beat delay between tapping the Workout/Nutrition toggle and
          // the background image actually swapping. The effect below stays,
          // since it's still what keeps AppShell in sync when currentRouteName
          // changes (plain navigation, not this toggle).
          reportMode: (nextMode) => {
            setSharedMode(nextMode);
            onBackgroundModeChange(
              MODE_AGNOSTIC_ROUTES.has(currentRouteName ?? '')
                ? nextMode
                : isNutritionRoute(currentRouteName)
                  ? 'nutrition'
                  : 'workout',
            );
          },
          currentMode: backgroundMode,
        }}
      >
        <View style={styles.navigatorShell}>
          <View style={styles.navigatorContent}>
            <NavigationContainer
              ref={navigationRef}
              onReady={() => setCurrentRouteName(navigationRef.current?.getCurrentRoute()?.name)}
              onStateChange={() =>
                setCurrentRouteName(navigationRef.current?.getCurrentRoute()?.name)
              }
            >
              <Stack.Navigator
                initialRouteName={onboardingStatus === 'needed' ? 'Onboarding' : 'Dashboard'}
                screenOptions={{
                  headerShown: false,
                  // Transparent so each screen's own (now-transparent) root
                  // container reveals AppBackgroundLayer, mounted once behind
                  // the whole navigator, instead of each screen fighting over
                  // its own opaque background -- see the Background Theme
                  // architecture in AppBackgroundLayer.tsx.
                  contentStyle: { backgroundColor: 'transparent' },
                  ...getDefaultScreenOptions(),
                }}
              >
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
                <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
                <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
                <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
                <Stack.Screen name="ShareWorkout" component={ShareWorkoutScreen} />
                <Stack.Screen name="NewWorkout" component={NewWorkoutScreen} />
                <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
                <Stack.Screen name="PRHistory" component={PRHistoryScreen} />
                <Stack.Screen name="ExerciseProgress" component={ExerciseProgressScreen} />
                <Stack.Screen name="Nutrition" component={NutritionTodayScreen} />
                <Stack.Screen name="FoodLibrary" component={FoodLibraryScreen} />
                <Stack.Screen name="FoodSearch" component={FoodSearchScreen} />
                <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
                <Stack.Screen name="NutritionGoals" component={NutritionGoalsScreen} />
                <Stack.Screen name="CalorieEstimation" component={CalorieEstimationScreen} />
                <Stack.Screen name="WorkoutColorSettings" component={WorkoutColorScreen} />
                <Stack.Screen name="NutritionColorSettings" component={NutritionColorScreen} />
                <Stack.Screen name="BackgroundThemeSettings" component={BackgroundThemeScreen} />
                <Stack.Screen name="ProgressOverview" component={ProgressOverviewScreen} />
                <Stack.Screen
                  name="ProgressExerciseDetail"
                  component={ProgressExerciseDetailScreen}
                />
                <Stack.Screen name="WorkoutSplits" component={WorkoutSplitsScreen} />
                <Stack.Screen name="WorkoutSplitView" component={WorkoutSplitViewScreen} />
                <Stack.Screen name="WorkoutSplitForm" component={WorkoutSplitFormScreen} />
                <Stack.Screen name="ChooseWorkoutSplit" component={ChooseWorkoutSplitScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </View>

          {showGlobalBottomNav ? (
            <BottomNavBar
              testID="app-bottom-nav"
              active={routeToBottomNavTab(currentRouteName)}
              mode={backgroundMode}
              accentColor={
                backgroundMode === 'nutrition' ? nutritionMenuTheme.accent : menuTheme.accent
              }
              onAccentColor={
                backgroundMode === 'nutrition' ? nutritionMenuTheme.onAccent : menuTheme.onAccent
              }
              paddingBottom={Math.max(insets.bottom, 8)}
              onNavigateHome={() => navigationRef.current?.navigate('Dashboard')}
              onNavigateWorkouts={() =>
                navigationRef.current?.navigate(
                  backgroundMode === 'nutrition' ? 'FoodLibrary' : 'WorkoutHistory',
                )
              }
              onNavigateProgress={() => navigationRef.current?.navigate('ProgressOverview')}
              onNavigateProfile={() => navigationRef.current?.navigate('Profile')}
              onPressPlus={() => setQuickActionsOpen(true)}
            />
          ) : null}

          <AppSideMenu
            visible={menuOpen}
            activeRoute={
              (navigationRef.current?.getCurrentRoute()?.name as AppMenuRoute | undefined) ??
              'Dashboard'
            }
            onNavigate={(route) => {
              setMenuOpen(false);
              navigationRef.current?.navigate(route);
            }}
            onClose={() => setMenuOpen(false)}
            accentColor={menuMode === 'nutrition' ? nutritionMenuTheme.accent : menuTheme.accent}
            sections={menuMode === 'nutrition' ? NUTRITION_MENU_SECTIONS : APP_MENU_SECTIONS}
            title={menuMode === 'nutrition' ? 'Progresso · Nutrition' : 'Progresso'}
          />

          <QuickActionMenu
            visible={quickActionsOpen}
            onClose={() => setQuickActionsOpen(false)}
            onStartWorkout={() => {
              setQuickActionsOpen(false);
              navigationRef.current?.navigate('NewWorkout');
            }}
            onLogFood={() => {
              setQuickActionsOpen(false);
              navigationRef.current?.navigate('Nutrition');
            }}
            accentColor={
              backgroundMode === 'nutrition' ? nutritionMenuTheme.accent : menuTheme.accent
            }
          />
        </View>
      </AppMenuContext.Provider>
    );
  }

  switch (mode) {
    case 'signUp':
      return (
        <SignUpScreen
          onSwitchToSignIn={() => setMode('signIn')}
          onAccountCreated={() => setJustCreatedAccount(true)}
        />
      );
    case 'forgotPassword':
      return <ForgotPasswordScreen onBackToSignIn={() => setMode('signIn')} />;
    case 'signIn':
    default:
      return (
        <SignInScreen
          onSwitchToSignUp={() => setMode('signUp')}
          onForgotPassword={() => setMode('forgotPassword')}
        />
      );
  }
}

// Fonts loading and the auth session check happen in parallel; the branded
// LaunchScreen covers both under one screen instead of two separate
// unbranded spinners. Root mounts underneath as soon as `ready` is true --
// in parallel with LaunchScreen's own exit fade, not after it -- so a fast
// resolve isn't padded by animation time, and a slow one just keeps the
// logo up for as long as it actually takes.
function AppShell({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { status } = useAuth();
  const { ready: backgroundThemeReady } = useBackgroundTheme();
  // backgroundThemeReady gates first paint the same way fontsLoaded already
  // does, so the app never briefly shows the default (Obsidian) theme
  // before switching to the user's saved one.
  const ready = fontsLoaded && status !== 'loading' && backgroundThemeReady;
  // Lives here (rather than inside Root) because AppBackgroundLayer is
  // Root's sibling, not its descendant -- it needs to keep showing
  // something (defaulting to 'workout') even before Root ever mounts, e.g.
  // during sign-in/sign-up, which render outside the Stack.Navigator
  // entirely and so never report a mode of their own.
  const [backgroundMode, setBackgroundMode] = useState<'workout' | 'nutrition'>('workout');
  // Off until Dashboard reports itself as the current route -- see Root.
  const [showBackgroundPhoto, setShowBackgroundPhoto] = useState(false);

  return (
    <View style={styles.shell}>
      <AppBackgroundLayer mode={backgroundMode} showImage={showBackgroundPhoto} />
      {ready ? (
        <Root
          onBackgroundModeChange={setBackgroundMode}
          onBackgroundPhotoChange={setShowBackgroundPhoto}
        />
      ) : null}
      <LaunchScreen ready={ready} />
    </View>
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BackgroundThemeProvider>
          <AppShell fontsLoaded={fontsLoaded} />
          <StatusBar style="light" />
        </BackgroundThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  navigatorShell: {
    flex: 1,
  },
  // Above the persistent BottomNavBar (a normal in-flow sibling below this),
  // giving the navigator exactly the remaining space so no screen ever
  // renders underneath the bar and no screen needs its own bottom padding
  // to avoid it.
  navigatorContent: {
    flex: 1,
  },
});

export default wrapApp(App);
