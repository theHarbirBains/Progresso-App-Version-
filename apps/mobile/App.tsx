import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AppShellScreen } from './src/screens/AppShellScreen';
import { AuthLoadingScreen } from './src/screens/AuthLoadingScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';

type AuthMode = 'signIn' | 'signUp';

function Root() {
  const { status } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'signedIn') {
    return <AppShellScreen />;
  }

  return mode === 'signIn' ? (
    <SignInScreen onSwitchToSignUp={() => setMode('signUp')} />
  ) : (
    <SignUpScreen onSwitchToSignIn={() => setMode('signIn')} />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
