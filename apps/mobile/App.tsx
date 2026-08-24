import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { wrapApp } from './src/lib/sentry';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { AuthLoadingScreen } from './src/screens/AuthLoadingScreen';
import { ExerciseLibraryScreen } from './src/screens/ExerciseLibraryScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';
type SignedInView = 'account' | 'exercises';

function Root() {
  const { status } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [signedInView, setSignedInView] = useState<SignedInView>('account');

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'passwordRecovery') {
    return <ResetPasswordScreen />;
  }

  if (status === 'signedIn') {
    return signedInView === 'exercises' ? (
      <ExerciseLibraryScreen onBack={() => setSignedInView('account')} />
    ) : (
      <AccountSettingsScreen onOpenExerciseLibrary={() => setSignedInView('exercises')} />
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
