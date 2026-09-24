import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { PrimaryButton, TextButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { AuthFrame } from './AuthFrame';
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
      <AuthFrame title="Check your email">
        <Text testID="forgot-password-confirmation" style={styles.info}>
          If an account exists for {email.trim()}, we sent a link to reset your password.
        </Text>
        <TextButton
          testID="forgot-password-back"
          label="Back to sign in"
          onPress={onBackToSignIn}
        />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Reset Password"
      subtitle="Enter your email and we'll send you a link to reset your password."
    >
      <TextInput
        testID="forgot-password-email"
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {error ? (
        <Text testID="forgot-password-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          testID="forgot-password-submit"
          label="Send Reset Link"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit && !submitting}
        />
        <TextButton
          testID="forgot-password-back"
          label="Back to sign in"
          onPress={onBackToSignIn}
        />
      </View>
    </AuthFrame>
  );
}
