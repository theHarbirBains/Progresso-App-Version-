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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AppBackgroundLayer, ScreenBackdrop } from './src/design/AppBackgroundLayer';
import { AppSideMenu } from './src/design/AppSideMenu';
import { BackgroundThemeProvider, useBackgroundTheme } from './src/design/BackgroundThemeContext';
import { BottomNavBar } from './src/design/BottomNavBar';
import { LoadingState } from './src/design/LoadingState';
import { getMyProfile } from './src/lib/api';
import { wrapApp } from './src/lib/sentry';
import { AppMenuContext } from './src/navigation/AppMenuContext';
import type { AppMenuRoute } from './src/navigation/appMenuSections';
import { routeToBottomNavTab } from './src/navigation/bottomNavRouting';
import { getDefaultScreenOptions } from './src/navigation/navigationTransitions';
import { isNutritionRoute } from './src/navigation/nutritionMenuSections';
import type { RootStackParamList } from './src/navigation/types';
import { FoodLogProvider } from './src/nutrition/FoodLogProvider';
import { NutritionGoalsProvider } from './src/nutrition/NutritionGoalsProvider';
import { ProfileProvider } from './src/profile/ProfileProvider';
import { AllTimeStatsProvider } from './src/progress/AllTimeStatsProvider';
import { useProgressTheme } from './src/progress/useProgressTheme';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
import { BackgroundThemeScreen } from './src/screens/BackgroundThemeScreen';
import { CalorieEstimationScreen } from './src/screens/CalorieEstimationScreen';
import { ChooseWorkoutSplitScreen } from './src/screens/ChooseWorkoutSplitScreen';
import { BarcodeScannerScreen } from './src/screens/BarcodeScannerScreen';
import { ExerciseLibraryScreen } from './src/screens/ExerciseLibraryScreen';
import { ExerciseProgressScreen } from './src/screens/ExerciseProgressScreen';
import { FeedScreen } from './src/screens/FeedScreen';
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
import { DEFAULT_NUTRITION_THEME, type AccentTheme } from './src/theme/accentColor';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const Stack = createNativeStackNavigator<RootStackParamList>();

// The app's mode-agnostic root screens -- Feed, Progress and You (Profile)
// show both Train and Nutrition content (or neither), so their accent/glow
// can't be read off the current route the way every other screen's can (see
// isNutritionRoute). See Root's own `sharedMode` for how this is used.
const MODE_AGNOSTIC_ROUTES = new Set(['Feed', 'ProgressOverview', 'Profile']);

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
// rather than Feed, which a purely in-memory flag could never capture.
function Root() {
  const { status, session } = useAuth();
  const { theme: backgroundTheme } = useBackgroundTheme();
  const accessToken = session?.access_token;
  const [mode, setMode] = useState<AuthMode>('signIn');
  // Feed, Progress, and You (Profile) are the app's mode-agnostic root
  // screens -- reachable directly from the bottom nav, not by switching a
  // toggle, so their accent/glow can't be read off the current route the way
  // every other screen's can (see isNutritionRoute). `sharedMode` is the one
  // flag all three fall back to: it updates automatically to whichever of
  // Train/Nutrition the user most recently visited (see the effect below),
  // so the fallback always reflects "wherever you were a moment ago" rather
  // than a fixed default.
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
  // navigator itself; AppMenuContext is how a screen (Feed, Workouts, etc.) asks
  // it to open.
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const { theme: menuTheme } = useProgressTheme();
  const insets = useSafeAreaInsets();
  // AppSideMenu itself is one universal list now (APP_MENU_SECTIONS) --
  // there's no more per-mode section list to pick, so nothing here needs to
  // track "which mode was the menu opened from" any more. menuTheme above
  // stays Workout-only (per useProgressTheme's own scope) and still drives
  // the global BottomNavBar's Train accent (and, below, a screen's own
  // background glow when its mode is Workout). nutritionMenuTheme is its
  // Nutrition counterpart, for the same per-screen glow purpose -- always
  // the fixed default now (the app-wide black-and-white redesign,
  // unconditional regardless of any saved nutritionAccentColor -- see
  // useProgressTheme's own comment), so no longer needs its own profile
  // fetch/effect.
  const nutritionMenuTheme: AccentTheme = DEFAULT_NUTRITION_THEME;
  // The persistent bottom nav (BottomNavBar) is mounted here for the same
  // reason AppSideMenu is: as a sibling of the navigator so it survives
  // every push/pop instead of being owned by (and disappearing with) an
  // individual screen. currentRouteName is tracked via onReady/onStateChange
  // below since navigationRef's own current route doesn't trigger a
  // re-render on its own -- without this the bar would render but never
  // update its active tab as the user navigates.
  const [currentRouteName, setCurrentRouteName] = useState<string | undefined>(undefined);
  // Every screen's glow/accent follows this -- the shared flag when the
  // current route is mode-agnostic, otherwise whichever mode the route
  // belongs to (see isNutritionRoute).
  const backgroundMode: 'workout' | 'nutrition' = MODE_AGNOSTIC_ROUTES.has(currentRouteName ?? '')
    ? sharedMode
    : isNutritionRoute(currentRouteName)
      ? 'nutrition'
      : 'workout';
  // Keeps `sharedMode` current automatically as the user navigates, now that
  // there is no Workout/Nutrition toggle to report it explicitly: landing on
  // a route with an unambiguous mode (anything not in MODE_AGNOSTIC_ROUTES)
  // updates the shared fallback, so the next time Feed/Progress/You is
  // visited its accent reflects wherever the user was a moment ago.
  useEffect(() => {
    if (currentRouteName === undefined || MODE_AGNOSTIC_ROUTES.has(currentRouteName)) return;
    setSharedMode(isNutritionRoute(currentRouteName) ? 'nutrition' : 'workout');
  }, [currentRouteName]);
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

    // Onboarding shows no bottom nav at all -- every other screen gets this
    // one persistent bar for free, with no per-screen wiring, since it's a
    // sibling of the navigator rather than owned by any individual screen.
    const showGlobalBottomNav = currentRouteName !== undefined && currentRouteName !== 'Onboarding';

    // Every screen gets an opaque, themed backdrop that is part of the
    // screen itself, so a push/pop never depends on JS to paint what's
    // behind the incoming page in time (see ScreenBackdrop). Its soft glow
    // follows the mode of the screen it sits under: the mode-agnostic roots
    // (Feed, Progress, You) follow the shared mode, everything else its own
    // route's mode.
    const renderScreenLayout = ({
      route,
      children,
    }: {
      route: { name: string };
      children: ReactNode;
    }) => {
      const screenMode = MODE_AGNOSTIC_ROUTES.has(route.name)
        ? sharedMode
        : isNutritionRoute(route.name)
          ? 'nutrition'
          : 'workout';
      return (
        <ScreenBackdrop
          accentColor={screenMode === 'nutrition' ? nutritionMenuTheme.accent : menuTheme.accent}
        >
          {children}
        </ScreenBackdrop>
      );
    };

    return (
      <AppMenuContext.Provider
        value={{
          openMenu: () => setMenuOpen(true),
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
                initialRouteName={onboardingStatus === 'needed' ? 'Onboarding' : 'Feed'}
                screenOptions={{
                  headerShown: false,
                  // Transparent so each screen's own (transparent) root
                  // container reveals its backdrop -- every screen is wrapped
                  // in an opaque ScreenBackdrop by `screenLayout` -- see the
                  // Background Theme architecture in AppBackgroundLayer.tsx.
                  contentStyle: { backgroundColor: 'transparent' },
                  ...getDefaultScreenOptions(),
                }}
                screenLayout={renderScreenLayout}
              >
                <Stack.Screen name="Feed" component={FeedScreen} />
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
            // The strip behind the bar is opaque flat theme colour -- every
            // screen paints its own opaque backdrop now, so nothing behind
            // the bar is ever a photograph.
            <View style={{ backgroundColor: backgroundTheme.colors.background }}>
              <BottomNavBar
                testID="app-bottom-nav"
                active={routeToBottomNavTab(currentRouteName)}
                workoutAccentColor={menuTheme.accent}
                nutritionAccentColor={nutritionMenuTheme.accent}
                neutralAccentColor={
                  backgroundMode === 'nutrition' ? nutritionMenuTheme.accent : menuTheme.accent
                }
                paddingBottom={Math.max(insets.bottom, 8)}
                onNavigateFeed={() => navigationRef.current?.navigate('Feed')}
                onNavigateTrain={() => navigationRef.current?.navigate('WorkoutHistory')}
                onNavigateNutrition={() => navigationRef.current?.navigate('Nutrition')}
                onNavigateProgress={() => navigationRef.current?.navigate('ProgressOverview')}
                onNavigateYou={() => navigationRef.current?.navigate('Profile')}
              />
            </View>
          ) : null}

          <AppSideMenu
            visible={menuOpen}
            activeRoute={
              (navigationRef.current?.getCurrentRoute()?.name as AppMenuRoute | undefined) ?? 'Feed'
            }
            onNavigate={(route) => {
              setMenuOpen(false);
              navigationRef.current?.navigate(route);
            }}
            onClose={() => setMenuOpen(false)}
            accentColor={backgroundMode === 'nutrition' ? nutritionMenuTheme.accent : menuTheme.accent}
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

  return (
    <View style={styles.shell}>
      {/* Lives here (rather than inside Root) because it needs to keep
          showing something even before Root ever mounts, e.g. during
          sign-in/sign-up, which render outside the Stack.Navigator entirely.
          Every signed-in screen paints its own opaque ScreenBackdrop over
          this now (see Root's screenLayout), so it is only ever actually
          *seen* pre-sign-in -- a plain flat theme fill, no glow, no mode. */}
      <AppBackgroundLayer showAtmosphere={false} />
      {ready ? <Root /> : null}
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
        <ProfileProvider>
          <NutritionGoalsProvider>
            <FoodLogProvider>
              <AllTimeStatsProvider>
                <BackgroundThemeProvider>
                  <AppShell fontsLoaded={fontsLoaded} />
                  <StatusBar style="light" />
                </BackgroundThemeProvider>
              </AllTimeStatsProvider>
            </FoodLogProvider>
          </NutritionGoalsProvider>
        </ProfileProvider>
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
