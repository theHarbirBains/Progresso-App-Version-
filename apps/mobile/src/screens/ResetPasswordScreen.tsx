import { useState } from 'react';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { PrimaryButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { AuthFrame } from './AuthFrame';
import { authStyles as styles } from './authStyles';

// Shown when AuthProvider's status is 'passwordRecovery' — reached only via
// the deep link in the password-reset email, which establishes a recovery
// session before this screen ever renders.
export function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = password.length >= 6 && confirmPassword.length > 0 && !submitting;

  async function handleSubmit() {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    const errorMessage = await updatePassword(password);
    setSubmitting(false);
    if (errorMessage) {
      setError(errorMessage);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <AuthFrame title="Password Updated">
        <Text testID="reset-password-success" style={styles.info}>
          Your password has been changed.
        </Text>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Set New Password">
      <TextInput
        testID="reset-password-new"
        label="New password"
        placeholder="At least 6 characters"
        secureTextEntry
        autoComplete="password-new"
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        testID="reset-password-confirm"
        label="Confirm new password"
        placeholder="Re-enter your password"
        secureTextEntry
        autoComplete="password-new"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error ? (
        <Text testID="reset-password-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        testID="reset-password-submit"
        label="Update Password"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit && !submitting}
      />
    </AuthFrame>
  );
}
