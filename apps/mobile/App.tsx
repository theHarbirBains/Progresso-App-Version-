import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { wrapApp } from './src/lib/sentry';
import type { RootStackParamList } from './src/navigation/types';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ExerciseLibraryScreen } from './src/screens/ExerciseLibraryScreen';
import { ExerciseProgressScreen } from './src/screens/ExerciseProgressScreen';
import { FoodLibraryScreen } from './src/screens/FoodLibraryScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { LaunchScreen } from './src/screens/LaunchScreen';
import { NewWorkoutScreen } from './src/screens/NewWorkoutScreen';
import { NutritionGoalsScreen } from './src/screens/NutritionGoalsScreen';
import { NutritionTodayScreen } from './src/screens/NutritionTodayScreen';
import { PRHistoryScreen } from './src/screens/PRHistoryScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { ShareWorkoutScreen } from './src/screens/ShareWorkoutScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { WorkoutDetailScreen } from './src/screens/WorkoutDetailScreen';
import { WorkoutHistoryScreen } from './src/screens/WorkoutHistoryScreen';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Sign-in/up/forgot-password/reset-password stay on the pre-existing local
// screen-state pattern (untouched by Phase 3) -- only the signed-in app
// graduates to a real navigator, since that's the part that actually needs
// back-stack semantics now. Root only ever mounts once AppShell's `ready`
// is true, so status is guaranteed resolved -- there is no 'loading' branch
// to handle here.
function Root() {
  const { status } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');

  if (status === 'passwordRecovery') {
    return <ResetPasswordScreen />;
  }

  if (status === 'signedIn') {
    return (
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Dashboard" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
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
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  switch (mode) {
    case 'signUp':
      return <SignUpScreen onSwitchToSignIn={() => setMode('signIn')} />;
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
});

export default wrapApp(App);
