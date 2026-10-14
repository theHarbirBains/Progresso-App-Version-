import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AppBackgroundLayer, ScreenBackdrop } from './src/design/AppBackgroundLayer';
import { AppSideMenu } from './src/design/AppSideMenu';
import { BottomNavBar } from './src/design/BottomNavBar';
import { colors } from './src/design/theme';
import { wrapApp } from './src/lib/sentry';
import { AppMenuContext } from './src/navigation/AppMenuContext';
import { appMenuSectionsFor, type AppMenuRoute } from './src/navigation/appMenuSections';
import { routeToBottomNavTab } from './src/navigation/bottomNavRouting';
import { useAppLinking } from './src/navigation/linking';
import {
  getScreenTransitionOptions,
  screenTransitionFor,
  useReduceMotionPreference,
} from './src/navigation/navigationTransitions';
import { goToSection } from './src/navigation/sectionNavigation';
import { PageArrival } from './src/navigation/useAfterTransition';
import { forgetShown } from './src/lib/lastShown';
import { isNutritionRoute } from './src/navigation/nutritionMenuSections';
import type { RootStackParamList } from './src/navigation/types';
import { FoodLogProvider } from './src/nutrition/FoodLogProvider';
import { NutritionGoalsProvider } from './src/nutrition/NutritionGoalsProvider';
import { submitOnboardingDraft } from './src/onboarding/onboardingDraft';
import { clearOnboardingDraft, loadOnboardingDraft } from './src/onboarding/onboardingDraftStorage';
import { ProfileProvider, useProfile } from './src/profile/ProfileProvider';
import { AllTimeStatsProvider } from './src/progress/AllTimeStatsProvider';
import { useProgressTheme } from './src/progress/useProgressTheme';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
import { AiFoodSearchScreen } from './src/screens/AiFoodSearchScreen';
import { CalorieEstimationScreen } from './src/screens/CalorieEstimationScreen';
import { ChooseWorkoutSplitScreen } from './src/screens/ChooseWorkoutSplitScreen';
import { BarcodeScannerScreen } from './src/screens/BarcodeScannerScreen';
import { ExerciseLibraryScreen } from './src/screens/ExerciseLibraryScreen';
import { ExerciseProgressScreen } from './src/screens/ExerciseProgressScreen';
import { FeedScreen } from './src/screens/FeedScreen';
import { FindPeopleScreen } from './src/screens/FindPeopleScreen';
import { TrainerAccessScreen } from './src/screens/TrainerAccessScreen';
import { TrainerClaimScreen } from './src/screens/TrainerClaimScreen';
import { GroupsScreen } from './src/screens/GroupsScreen';
import { GroupSessionScreen } from './src/screens/GroupSessionScreen';
import { GroupStartScreen } from './src/screens/GroupStartScreen';
import { TrainerLiveWorkoutScreen } from './src/screens/TrainerLiveWorkoutScreen';
import { TrainerClaimCodeScreen } from './src/screens/TrainerClaimCodeScreen';
import { TrainerClientDetailScreen } from './src/screens/TrainerClientDetailScreen';
import { TrainerClientFormScreen } from './src/screens/TrainerClientFormScreen';
import { TrainerClientsScreen } from './src/screens/TrainerClientsScreen';
import { useTrainerStatus } from './src/trainer/useTrainerStatus';
import { FoodLibraryScreen } from './src/screens/FoodLibraryScreen';
import { FoodSearchScreen } from './src/screens/FoodSearchScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { EditWorkoutScreen } from './src/screens/EditWorkoutScreen';
import { LogPastWorkoutScreen } from './src/screens/LogPastWorkoutScreen';
import { NewWorkoutScreen } from './src/screens/NewWorkoutScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { NutritionGoalsScreen } from './src/screens/NutritionGoalsScreen';
import { NutritionHistoryScreen } from './src/screens/NutritionHistoryScreen';
import { NutritionTodayScreen } from './src/screens/NutritionTodayScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PRHistoryScreen } from './src/screens/PRHistoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ProgressExerciseDetailScreen } from './src/screens/ProgressExerciseDetailScreen';
import { ProgressOverviewScreen } from './src/screens/ProgressOverviewScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { SettingsAccountSecurityScreen } from './src/screens/SettingsAccountSecurityScreen';
import { SettingsChangePasswordScreen } from './src/screens/SettingsChangePasswordScreen';
import { SettingsNotificationsScreen } from './src/screens/SettingsNotificationsScreen';
import { SettingsNutritionScreen } from './src/screens/SettingsNutritionScreen';
import { SettingsPersonalInfoScreen } from './src/screens/SettingsPersonalInfoScreen';
import { SettingsSupportScreen } from './src/screens/SettingsSupportScreen';
import { SettingsWorkoutPreferencesScreen } from './src/screens/SettingsWorkoutPreferencesScreen';
import { ShareWorkoutScreen } from './src/screens/ShareWorkoutScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { WorkoutDetailScreen } from './src/screens/WorkoutDetailScreen';
import { WorkoutHistoryScreen } from './src/screens/WorkoutHistoryScreen';
import { WorkoutSplitFormScreen } from './src/screens/WorkoutSplitFormScreen';
import { WorkoutSplitsScreen } from './src/screens/WorkoutSplitsScreen';
import { WorkoutSplitViewScreen } from './src/screens/WorkoutSplitViewScreen';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const Stack = createNativeStackNavigator<RootStackParamList>();

// The app's mode-agnostic root screens -- Feed, Progress and You (Profile)
// show both Train and Nutrition content (or neither), so their accent/glow
// can't be read off the current route the way every other screen's can (see
// isNutritionRoute). See Root's own `sharedMode` for how this is used.
const MODE_AGNOSTIC_ROUTES = new Set(['Feed', 'ProgressOverview', 'Profile']);

// Sign-in/up/forgot-password/reset-password stay on the pre-existing local
// screen-state pattern -- only the signed-in app graduates to a real
// navigator, since that's the part that actually needs back-stack
// semantics. Root only ever mounts once AppShell's `ready` is true, so
// status is guaranteed resolved -- there is no 'loading' branch to handle
// here.
//
// Account creation is now the LAST step of onboarding (see
// onboarding/onboardingDraft.ts), not the first -- 'signUp' mode renders
// OnboardingScreen itself, pre-auth, and a signed-in session is by
// construction already fully onboarded (there is no other way to get one).
// So unlike before, a signed-in session never needs to be routed to a
// separate Onboarding screen or shown a one-time Welcome screen here.
function Root() {
  const { status, session, user } = useAuth();
  // Trainer status decides whether the side menu lists the trainer's clients.
  const isTrainer = useTrainerStatus();
  const { profile, loading: profileLoading } = useProfile();
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
  // Every page's transition comes from its route (see navigationTransitions.ts);
  // with Reduce Motion on, every page switches instantly instead.
  const reduceMotion = useReduceMotionPreference();
  // The bottom nav and the side menu's section pages go to a section rather
  // than stacking another copy of it (see sectionNavigation.ts).
  const openSection = useCallback(
    (route: keyof RootStackParamList) =>
      goToSection(
        {
          getState: () => navigationRef.current?.getRootState(),
          dispatch: (action) => navigationRef.current?.dispatch(action),
        },
        route,
      ),
    [navigationRef],
  );
  // Links to screens (progresso://workouts/<id> and the rest, see navigation/linking.ts) open
  // only once signed in; one that arrives before then is held until the navigator exists.
  const linking = useAppLinking(status === 'signedIn');
  const { theme: menuTheme, nutritionTheme: nutritionMenuTheme } = useProgressTheme();
  const insets = useSafeAreaInsets();
  // AppSideMenu itself is one universal list now (APP_MENU_SECTIONS) --
  // there's no more per-mode section list to pick, so nothing here needs to
  // track "which mode was the menu opened from" any more. menuTheme drives
  // the global BottomNavBar's Train accent (and, below, a screen's own
  // background glow when its mode is Workout); nutritionMenuTheme is its
  // Nutrition counterpart, for the same per-screen glow purpose. Both are
  // the one fixed amber accent (useProgressTheme).
  // Every screen gets an opaque, themed backdrop that is part of the screen
  // itself, so a push/pop never depends on JS to paint what's behind the
  // incoming page in time (see ScreenBackdrop). Its soft glow follows the
  // mode of the screen it sits under: the mode-agnostic roots (Feed,
  // Progress, You) follow the shared mode, everything else its own route's
  // mode. Memoized (rather than a plain inline function) since it's passed
  // as Stack.Navigator's `screenLayout` prop, which re-wraps every currently
  // mounted screen's children whenever its identity changes -- and this
  // component re-renders on every navigation event (see onStateChange
  // below), so a fresh function each time would do that needlessly.
  const renderScreenLayout = useCallback(
    ({
      route,
      navigation,
      children,
    }: {
      route: { name: string };
      navigation: Parameters<typeof PageArrival>[0]['navigation'];
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
          <PageArrival navigation={navigation}>{children}</PageArrival>
        </ScreenBackdrop>
      );
    },
    [sharedMode, menuTheme.accent, nutritionMenuTheme.accent],
  );
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
  // What pages last showed (lib/lastShown.ts) never outlives the session.
  useEffect(() => {
    if (status !== 'signedIn') forgetShown();
  }, [status]);
  // The same object until the mode actually changes, so the screens that read
  // it (every page with a menu button) don't all redraw on every navigation.
  const appMenu = useMemo(
    () => ({ openMenu: () => setMenuOpen(true), currentMode: backgroundMode }),
    [backgroundMode],
  );
  const screenOptions = useCallback(
    ({ route }: { route: { name: string } }) => ({
      headerShown: false,
      // Transparent so each screen's own (transparent) root
      // container reveals its backdrop -- every screen is wrapped
      // in an opaque ScreenBackdrop by `screenLayout` -- see the
      // warm background in AppBackgroundLayer.tsx.
      contentStyle: { backgroundColor: 'transparent' },
      // A page that isn't in view stops re-rendering until it is
      // again, so the pages underneath never cost anything.
      freezeOnBlur: true,
      ...getScreenTransitionOptions(route.name, reduceMotion),
    }),
    [reduceMotion],
  );
  // Keeps `sharedMode` current automatically as the user navigates, now that
  // there is no Workout/Nutrition toggle to report it explicitly: landing on
  // a route with an unambiguous mode (anything not in MODE_AGNOSTIC_ROUTES)
  // updates the shared fallback, so the next time Feed/Progress/You is
  // visited its accent reflects wherever the user was a moment ago.
  useEffect(() => {
    if (currentRouteName === undefined || MODE_AGNOSTIC_ROUTES.has(currentRouteName)) return;
    setSharedMode(isNutritionRoute(currentRouteName) ? 'nutrition' : 'workout');
  }, [currentRouteName]);
  // Handles exactly one edge case: a project that requires email
  // confirmation returns no session from signUpWithPassword, so
  // OnboardingScreen's own account-creation step can't submit the local
  // draft it collected right there -- there's no access token yet. The
  // draft stays on disk in that case (see onboardingDraftStorage) until a
  // real signed-in session eventually appears (the user confirmed and
  // signed in), which is what this reconciles: submit the pending draft
  // once, then clear it. Guarded by a ref (once per app session) and by
  // the profile's own onboardingCompletedAt, so this never re-applies a
  // stale leftover draft to an already-onboarded account.
  const pendingDraftCheckedRef = useRef(false);
  useEffect(() => {
    if (status !== 'signedIn' || profileLoading) return;
    if (!session?.access_token || !user?.id) return;
    if (pendingDraftCheckedRef.current) return;
    pendingDraftCheckedRef.current = true;

    if (profile?.onboardingCompletedAt) {
      void clearOnboardingDraft();
      return;
    }
    const accessToken = session.access_token;
    const userId = user.id;
    loadOnboardingDraft().then((stored) => {
      if (!stored) return;
      submitOnboardingDraft(accessToken, userId, stored.draft)
        .then(() => clearOnboardingDraft())
        .catch(() => {
          // Leave the draft in place -- retried on the next sign-in.
        });
    });
  }, [status, session, user, profile, profileLoading]);

  if (status === 'passwordRecovery') {
    return <ResetPasswordScreen />;
  }

  if (status === 'signedIn') {
    const showGlobalBottomNav = currentRouteName !== undefined;

    return (
      <AppMenuContext.Provider value={appMenu}>
        <View style={styles.navigatorShell}>
          <View style={styles.navigatorContent}>
            <NavigationContainer
              ref={navigationRef}
              linking={linking}
              onReady={() => setCurrentRouteName(navigationRef.current?.getCurrentRoute()?.name)}
              onStateChange={() =>
                setCurrentRouteName(navigationRef.current?.getCurrentRoute()?.name)
              }
            >
              <Stack.Navigator
                initialRouteName="Feed"
                screenOptions={screenOptions}
                screenLayout={renderScreenLayout}
              >
                <Stack.Screen name="Feed" component={FeedScreen} />
                <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
                <Stack.Screen name="SettingsPersonalInfo" component={SettingsPersonalInfoScreen} />
                <Stack.Screen
                  name="SettingsWorkoutPreferences"
                  component={SettingsWorkoutPreferencesScreen}
                />
                <Stack.Screen name="SettingsNutrition" component={SettingsNutritionScreen} />
                <Stack.Screen
                  name="SettingsNotifications"
                  component={SettingsNotificationsScreen}
                />
                <Stack.Screen
                  name="SettingsAccountSecurity"
                  component={SettingsAccountSecurityScreen}
                />
                <Stack.Screen
                  name="SettingsChangePassword"
                  component={SettingsChangePasswordScreen}
                />
                <Stack.Screen name="SettingsSupport" component={SettingsSupportScreen} />
                <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
                <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
                <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
                <Stack.Screen name="EditWorkout" component={EditWorkoutScreen} />
                <Stack.Screen name="ShareWorkout" component={ShareWorkoutScreen} />
                <Stack.Screen name="NewWorkout" component={NewWorkoutScreen} />
                <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
                <Stack.Screen name="LogPastWorkout" component={LogPastWorkoutScreen} />
                <Stack.Screen name="TrainerLogWorkout" component={LogPastWorkoutScreen} />
                <Stack.Screen name="PRHistory" component={PRHistoryScreen} />
                <Stack.Screen name="ExerciseProgress" component={ExerciseProgressScreen} />
                <Stack.Screen name="Nutrition" component={NutritionTodayScreen} />
                <Stack.Screen name="FoodLibrary" component={FoodLibraryScreen} />
                <Stack.Screen name="FoodSearch" component={FoodSearchScreen} />
                <Stack.Screen name="AiFoodSearch" component={AiFoodSearchScreen} />
                <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
                <Stack.Screen name="NutritionGoals" component={NutritionGoalsScreen} />
                <Stack.Screen name="NutritionHistory" component={NutritionHistoryScreen} />
                <Stack.Screen name="CalorieEstimation" component={CalorieEstimationScreen} />
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
                <Stack.Screen name="TrainerAccess" component={TrainerAccessScreen} />
                <Stack.Screen name="TrainerClaim" component={TrainerClaimScreen} />
                <Stack.Screen name="Groups" component={GroupsScreen} />
                <Stack.Screen name="GroupSession" component={GroupSessionScreen} />
                <Stack.Screen name="GroupStart" component={GroupStartScreen} />
                <Stack.Screen name="TrainerLiveWorkout" component={TrainerLiveWorkoutScreen} />
                <Stack.Screen name="TrainerClaimCode" component={TrainerClaimCodeScreen} />
                <Stack.Screen name="TrainerClients" component={TrainerClientsScreen} />
                <Stack.Screen name="TrainerClientForm" component={TrainerClientFormScreen} />
                <Stack.Screen name="TrainerEditClient" component={TrainerClientFormScreen} />
                <Stack.Screen name="TrainerClientDetail" component={TrainerClientDetailScreen} />
                <Stack.Screen name="FindPeople" component={FindPeopleScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </View>

          {showGlobalBottomNav ? (
            // The strip behind the bar is opaque flat theme colour -- every
            // screen paints its own opaque backdrop now, so nothing behind
            // the bar is ever a photograph.
            <View style={{ backgroundColor: colors.background }}>
              <BottomNavBar
                testID="app-bottom-nav"
                active={routeToBottomNavTab(currentRouteName)}
                workoutAccentColor={menuTheme.accent}
                nutritionAccentColor={nutritionMenuTheme.accent}
                neutralAccentColor={
                  backgroundMode === 'nutrition' ? nutritionMenuTheme.accent : menuTheme.accent
                }
                paddingBottom={Math.max(insets.bottom, 8)}
                onNavigateFeed={() => openSection('Feed')}
                onNavigateTrain={() => openSection('WorkoutHistory')}
                onNavigateNutrition={() => openSection('Nutrition')}
                onNavigateProgress={() => openSection('ProgressOverview')}
                onNavigateYou={() => openSection('Profile')}
              />
            </View>
          ) : null}

          <AppSideMenu
            visible={menuOpen}
            sections={appMenuSectionsFor(isTrainer)}
            activeRoute={
              (navigationRef.current?.getCurrentRoute()?.name as AppMenuRoute | undefined) ?? 'Feed'
            }
            onNavigate={(route) => {
              setMenuOpen(false);
              if (screenTransitionFor(route) === 'section') {
                openSection(route);
                return;
              }
              // Menu routes take no params, which the navigator's typed overloads cannot accept as one union.
              const navigateByName = navigationRef.current?.navigate as
                ((name: AppMenuRoute) => void) | undefined;
              navigateByName?.call(navigationRef.current, route);
            }}
            onClose={() => setMenuOpen(false)}
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
      return <OnboardingScreen onSwitchToSignIn={() => setMode('signIn')} />;
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
  const ready = fontsLoaded && status !== 'loading';

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
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
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
                <AppShell fontsLoaded={fontsLoaded} />
                <StatusBar style="light" />
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
