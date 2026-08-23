import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { authStyles as styles } from './authStyles';

interface Props {
  onSwitchToSignUp: () => void;
}

export function SignInScreen({ onSwitchToSignUp }: Props) {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const errorMessage = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
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

      <TouchableOpacity testID="sign-in-switch" onPress={onSwitchToSignUp}>
        <Text style={styles.link}>Don&apos;t have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}
