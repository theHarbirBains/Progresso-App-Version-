import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { authStyles as styles } from './authStyles';

interface Props {
  onBackToSignIn: () => void;
}

export function ForgotPasswordScreen({ onBackToSignIn }: Props) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && !submitting;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const errorMessage = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (errorMessage) {
      setError(errorMessage);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text testID="forgot-password-confirmation" style={styles.info}>
          If an account exists for {email.trim()}, we sent a link to reset your password.
        </Text>
        <TouchableOpacity testID="forgot-password-back" onPress={onBackToSignIn}>
          <Text style={styles.link}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.info}>
        Enter your email and we&apos;ll send you a link to reset your password.
      </Text>

      <TextInput
        testID="forgot-password-email"
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B6B75"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {error ? (
        <Text testID="forgot-password-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="forgot-password-submit"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Send Reset Link</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity testID="forgot-password-back" onPress={onBackToSignIn}>
        <Text style={styles.link}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}
