import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { AuthFrame } from './AuthFrame';
import { authStyles as styles } from './authStyles';

interface Props {
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
}

type OAuthSubmitting = 'google' | 'apple' | null;

// Email + password, with Google and Apple as the two outlined alternatives
// beneath: Sign In is the one filled button.
export function SignInScreen({ onSwitchToSignUp, onForgotPassword }: Props) {
  const { signInWithPassword, signInWithProvider } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState<OAuthSubmitting>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;
  const oauthDisabled = submitting || oauthSubmitting !== null;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const errorMessage = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (errorMessage) {
      setError(errorMessage);
    }
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null);
    setOauthSubmitting(provider);
    const errorMessage = await signInWithProvider(provider);
    setOauthSubmitting(null);
    if (errorMessage) {
      setError(errorMessage);
    }
  }

  return (
    <AuthFrame title="Sign In">
      <TextInput
        testID="sign-in-email"
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        testID="sign-in-password"
        label="Password"
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {error ? (
        <Text testID="sign-in-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          testID="sign-in-submit"
          label="Sign In"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit && !submitting}
        />
        <TextButton
          testID="sign-in-forgot-password"
          label="Forgot password?"
          onPress={onForgotPassword}
        />
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.actions}>
        <SecondaryButton
          testID="sign-in-google"
          label="Continue with Google"
          onPress={() => handleOAuth('google')}
          loading={oauthSubmitting === 'google'}
          disabled={oauthDisabled && oauthSubmitting !== 'google'}
        />
        <SecondaryButton
          testID="sign-in-apple"
          label="Continue with Apple"
          onPress={() => handleOAuth('apple')}
          loading={oauthSubmitting === 'apple'}
          disabled={oauthDisabled && oauthSubmitting !== 'apple'}
        />
        <TextButton
          testID="sign-in-switch"
          label="Don't have an account? Sign up"
          onPress={onSwitchToSignUp}
        />
      </View>
    </AuthFrame>
  );
}
