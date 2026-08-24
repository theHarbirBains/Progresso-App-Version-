import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { authStyles as styles } from './authStyles';

interface Props {
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
}

type OAuthSubmitting = 'google' | 'apple' | null;

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
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        testID="sign-in-email"
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B6B75"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        testID="sign-in-password"
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6B6B75"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {error ? (
        <Text testID="sign-in-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="sign-in-submit"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity testID="sign-in-forgot-password" onPress={onForgotPassword}>
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      <Text style={styles.divider}>or</Text>

      <TouchableOpacity
        testID="sign-in-google"
        style={styles.oauthButton}
        onPress={() => handleOAuth('google')}
        disabled={oauthDisabled}
      >
        {oauthSubmitting === 'google' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.oauthButtonText}>Continue with Google</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        testID="sign-in-apple"
        style={styles.oauthButton}
        onPress={() => handleOAuth('apple')}
        disabled={oauthDisabled}
      >
        {oauthSubmitting === 'apple' ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.oauthButtonText}>Continue with Apple</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity testID="sign-in-switch" onPress={onSwitchToSignUp}>
        <Text style={styles.link}>Don&apos;t have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}
