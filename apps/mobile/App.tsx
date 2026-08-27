import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { wrapApp } from './src/lib/sentry';
import type { RootStackParamList } from './src/navigation/types';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
import { AuthLoadingScreen } from './src/screens/AuthLoadingScreen';
import { ExerciseLibraryScreen } from './src/screens/ExerciseLibraryScreen';
import { ExerciseProgressScreen } from './src/screens/ExerciseProgressScreen';
import { FoodLibraryScreen } from './src/screens/FoodLibraryScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { NewWorkoutScreen } from './src/screens/NewWorkoutScreen';
import { NutritionGoalsScreen } from './src/screens/NutritionGoalsScreen';
import { NutritionTodayScreen } from './src/screens/NutritionTodayScreen';
import { PRHistoryScreen } from './src/screens/PRHistoryScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { WorkoutDetailScreen } from './src/screens/WorkoutDetailScreen';
import { WorkoutHistoryScreen } from './src/screens/WorkoutHistoryScreen';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Sign-in/up/forgot-password/reset-password stay on the pre-existing local
// screen-state pattern (untouched by Phase 3) -- only the signed-in app
// graduates to a real navigator, since that's the part that actually needs
// back-stack semantics now.
function Root() {
  const { status } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'passwordRecovery') {
    return <ResetPasswordScreen />;
  }

  if (status === 'signedIn') {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
          <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
          <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
          <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
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

function App() {
  return (
    <AuthProvider>
      <Root />
      <StatusBar style="light" />
    </AuthProvider>
  );
}

export default wrapApp(App);
