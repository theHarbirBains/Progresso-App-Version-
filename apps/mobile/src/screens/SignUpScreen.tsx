import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { authStyles as styles } from './authStyles';

interface Props {
  onSwitchToSignIn: () => void;
}

export function SignUpScreen({ onSwitchToSignIn }: Props) {
  const { signUpWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !submitting;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const result = await signUpWithPassword(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if (result.requiresEmailConfirmation) {
      setConfirmationSent(true);
    }
    // If neither, the project auto-confirms and onAuthStateChange in
    // AuthProvider will move the app into the signed-in state on its own.
  }

  if (confirmationSent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text testID="sign-up-confirmation" style={styles.info}>
          We sent a confirmation link to {email.trim()}. Confirm your email, then sign in.
        </Text>
        <TouchableOpacity testID="sign-up-switch" onPress={onSwitchToSignIn}>
          <Text style={styles.link}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        testID="sign-up-email"
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
        testID="sign-up-password"
        style={styles.input}
        placeholder="Password (min 6 characters)"
        placeholderTextColor="#6B6B75"
        secureTextEntry
        autoComplete="password-new"
        value={password}
        onChangeText={setPassword}
      />

      {error ? (
        <Text testID="sign-up-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="sign-up-submit"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity testID="sign-up-switch" onPress={onSwitchToSignIn}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}
