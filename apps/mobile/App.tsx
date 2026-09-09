import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AppSideMenu } from './src/design/AppSideMenu';
import { LoadingState } from './src/design/LoadingState';
import { getMyProfile } from './src/lib/api';
import { wrapApp } from './src/lib/sentry';
import { AppMenuContext } from './src/navigation/AppMenuContext';
import type { AppMenuRoute } from './src/navigation/appMenuSections';
import {
  getDefaultScreenOptions,
  useReduceMotionPreference,
} from './src/navigation/navigationTransitions';
import type { RootStackParamList } from './src/navigation/types';
import { useProgressTheme } from './src/progress/useProgressTheme';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
import { ChooseWorkoutSplitScreen } from './src/screens/ChooseWorkoutSplitScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ExerciseLibraryScreen } from './src/screens/ExerciseLibraryScreen';
import { ExerciseProgressScreen } from './src/screens/ExerciseProgressScreen';
import { FoodLibraryScreen } from './src/screens/FoodLibraryScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { NewWorkoutScreen } from './src/screens/NewWorkoutScreen';
import { NutritionColorScreen } from './src/screens/NutritionColorScreen';
import { NutritionGoalsScreen } from './src/screens/NutritionGoalsScreen';
import { NutritionTodayScreen } from './src/screens/NutritionTodayScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PRHistoryScreen } from './src/screens/PRHistoryScreen';
import { ProgressExerciseDetailScreen } from './src/screens/ProgressExerciseDetailScreen';
import { ProgressOverviewScreen } from './src/screens/ProgressOverviewScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { ShareWorkoutScreen } from './src/screens/ShareWorkoutScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { SocialScreen } from './src/screens/SocialScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { WorkoutColorScreen } from './src/screens/WorkoutColorScreen';
import { WorkoutDetailScreen } from './src/screens/WorkoutDetailScreen';
import { WorkoutHistoryScreen } from './src/screens/WorkoutHistoryScreen';
import { WorkoutSplitFormScreen } from './src/screens/WorkoutSplitFormScreen';
import { WorkoutSplitsScreen } from './src/screens/WorkoutSplitsScreen';
import { WorkoutSplitViewScreen } from './src/screens/WorkoutSplitViewScreen';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
function Root() {
  const { status, session } = useAuth();
  const accessToken = session?.access_token;
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [justCreatedAccount, setJustCreatedAccount] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'needed' | 'done'>(
    'checking',
  );
  const reduceMotion = useReduceMotionPreference();
  // The app-level side menu (AppSideMenu) is mounted here, as a sibling of
  // the navigator, rather than inside any individual screen -- that's what
  // lets it render above the ENTIRE app (header, content, bottom nav) on
  // every screen, instead of being clipped to whatever z-index games one
  // screen's own fixed header happens to play. navigationRef is how it
  // navigates/highlights the current route without being inside the
  // navigator itself; AppMenuContext is how a screen (Dashboard today) asks
  // it to open.
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const { theme: menuTheme } = useProgressTheme();
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

    return (
      <AppMenuContext.Provider value={{ openMenu: () => setMenuOpen(true) }}>
        <View style={styles.navigatorShell}>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
              initialRouteName={onboardingStatus === 'needed' ? 'Onboarding' : 'Dashboard'}
              screenOptions={{ headerShown: false, ...getDefaultScreenOptions(reduceMotion) }}
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
              <Stack.Screen name="NutritionGoals" component={NutritionGoalsScreen} />
              <Stack.Screen name="WorkoutColorSettings" component={WorkoutColorScreen} />
              <Stack.Screen name="NutritionColorSettings" component={NutritionColorScreen} />
              <Stack.Screen name="ProgressOverview" component={ProgressOverviewScreen} />
              <Stack.Screen
                name="ProgressExerciseDetail"
                component={ProgressExerciseDetailScreen}
              />
              <Stack.Screen name="WorkoutSplits" component={WorkoutSplitsScreen} />
              <Stack.Screen name="WorkoutSplitView" component={WorkoutSplitViewScreen} />
              <Stack.Screen name="WorkoutSplitForm" component={WorkoutSplitFormScreen} />
              <Stack.Screen name="ChooseWorkoutSplit" component={ChooseWorkoutSplitScreen} />
              <Stack.Screen name="Social" component={SocialScreen} />
            </Stack.Navigator>
          </NavigationContainer>

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
            accentColor={menuTheme.accent}
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
  const ready = fontsLoaded && status !== 'loading';

  return (
    <View style={styles.shell}>
      {ready ? <Root /> : null}
      <LaunchScreen ready={ready} />
    </View>
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppShell fontsLoaded={fontsLoaded} />
        <StatusBar style="light" />
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
});

export default wrapApp(App);
