import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
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
      <View style={styles.container}>
        <Text style={styles.title}>Password Updated</Text>
        <Text testID="reset-password-success" style={styles.info}>
          Your password has been changed.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set New Password</Text>

      <TextInput
        testID="reset-password-new"
        style={styles.input}
        placeholder="New password"
        placeholderTextColor="#6B6B75"
        secureTextEntry
        autoComplete="password-new"
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        testID="reset-password-confirm"
        style={styles.input}
        placeholder="Confirm new password"
        placeholderTextColor="#6B6B75"
        secureTextEntry
        autoComplete="password-new"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error ? (
        <Text testID="reset-password-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="reset-password-submit"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Update Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
