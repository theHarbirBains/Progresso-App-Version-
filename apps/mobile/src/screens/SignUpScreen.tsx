import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { signUpStyles as styles } from './signUpStyles';

const logo = require('../../assets/progresso-mark.png');

interface Props {
  onSwitchToSignIn: () => void;
  /** Called once, right after a successful signup (error === null) -- lets
   * the app show a one-time Welcome screen without SignUpScreen knowing
   * anything about that flow itself. */
  onAccountCreated?: () => void;
}

type FocusedField = 'email' | 'password' | 'confirmPassword' | null;

export function SignUpScreen({ onSwitchToSignIn, onAccountCreated }: Props) {
  const { signUpWithPassword } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        contentOpacity.setValue(1);
        contentTranslateY.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(contentTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    });
  }, [contentOpacity, contentTranslateY]);

  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const canSubmit =
    email.trim().length > 0 && password.length >= 6 && confirmPassword === password && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    // Confirm Password is a client-side safety check only -- the same two
    // arguments (email, password) that have always gone to Supabase.
    const result = await signUpWithPassword(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onAccountCreated?.();
    if (result.requiresEmailConfirmation) {
      setConfirmationSent(true);
    }
    // If confirmation isn't required, the project auto-confirms and
    // onAuthStateChange in AuthProvider moves the app into the signed-in
    // state on its own.
  }

  if (confirmationSent) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Image
            source={logo}
            style={[styles.logo, { alignSelf: 'center' }]}
            resizeMode="contain"
          />
          <Text style={styles.confirmationTitle}>Check your email</Text>
          <Text testID="sign-up-confirmation" style={styles.confirmationText}>
            We sent a confirmation link to {email.trim()}. Confirm your email, then sign in.
          </Text>
          <TouchableOpacity testID="sign-up-switch" onPress={onSwitchToSignIn}>
            <Text style={[styles.footerLink, { textAlign: 'center' }]}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }}
        >
          <View style={styles.header}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start tracking your progress.</Text>
          </View>

          {error ? (
            <Text testID="sign-up-error" style={styles.formError}>
              {error}
            </Text>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputRow, focusedField === 'email' && styles.inputRowFocused]}>
              <TextInput
                testID="sign-up-email"
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#6B6B75"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputRow, focusedField === 'password' && styles.inputRowFocused]}>
              <TextInput
                ref={passwordRef}
                testID="sign-up-password"
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor="#6B6B75"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoComplete="password-new"
                returnKeyType="next"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <TouchableOpacity
                testID="sign-up-password-toggle"
                style={styles.visibilityToggle}
                onPress={() => setPasswordVisible((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              >
                <Feather name={passwordVisible ? 'eye-off' : 'eye'} size={20} color="#9A9AA5" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <View
              style={[
                styles.inputRow,
                focusedField === 'confirmPassword' && styles.inputRowFocused,
                passwordsMismatch && styles.inputRowError,
              ]}
            >
              <TextInput
                ref={confirmRef}
                testID="sign-up-confirm-password"
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor="#6B6B75"
                secureTextEntry={!confirmVisible}
                autoCapitalize="none"
                autoComplete="password-new"
                returnKeyType="done"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                testID="sign-up-confirm-password-toggle"
                style={styles.visibilityToggle}
                onPress={() => setConfirmVisible((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={confirmVisible ? 'Hide password' : 'Show password'}
              >
                <Feather name={confirmVisible ? 'eye-off' : 'eye'} size={20} color="#9A9AA5" />
              </TouchableOpacity>
            </View>
            {passwordsMismatch ? (
              <Text testID="sign-up-password-mismatch" style={styles.fieldError}>
                Passwords don&apos;t match
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            testID="sign-up-submit"
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.buttonText}>
              {submitting ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity testID="sign-up-switch" onPress={onSwitchToSignIn}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
