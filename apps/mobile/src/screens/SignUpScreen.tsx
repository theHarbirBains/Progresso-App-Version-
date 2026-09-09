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
import { updateMyProfile } from '../lib/api';
import { colors } from '../design/theme';
import { signUpStyles as styles } from './signUpStyles';

const logo = require('../../assets/progresso-mark.png');

interface Props {
  onSwitchToSignIn: () => void;
  /** Called once, right after a successful signup (error === null) -- lets
   * the app show a one-time Welcome screen without SignUpScreen knowing
   * anything about that flow itself. */
  onAccountCreated?: () => void;
}

type FocusedField =
  | 'firstName'
  | 'lastName'
  | 'displayName'
  | 'username'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | null;

// Mirrors the backend's own username rule exactly (update-user.dto.ts /
// 20260825100001_username.sql): lowercase letters, digits, underscores,
// 3-20 characters. Client-side validation is a UX nicety only -- the
// backend PATCH is still the single source of truth (and the only place
// that can know whether a given username is actually taken).
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function SignUpScreen({ onSwitchToSignIn, onAccountCreated }: Props) {
  const { signUpWithPassword } = useAuth();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lastNameRef = useRef<TextInput>(null);
  const displayNameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Set once the Supabase Auth account itself exists, so a retry after a
  // profile-save failure (e.g. a taken username) re-attempts only the
  // profile PATCH -- calling signUp a second time for the same email would
  // just fail with "already exists".
  const accountCreatedRef = useRef(false);
  const accessTokenRef = useRef<string | null>(null);

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
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword === password &&
    !submitting;

  async function handleSubmit() {
    if (submitting) return;

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedDisplayName = displayName.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!trimmedFirstName) {
      setError('First name is required.');
      return;
    }
    if (!trimmedLastName) {
      setError('Last name is required.');
      return;
    }
    if (!trimmedDisplayName) {
      setError('Display name is required.');
      return;
    }
    if (!normalizedUsername) {
      setError('Username is required.');
      return;
    }
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError(
        'Username may only contain lowercase letters, numbers, and underscores, and be 3-20 characters.',
      );
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (confirmPassword !== password) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setSubmitting(true);

    if (!accountCreatedRef.current) {
      // Confirm Password is a client-side safety check only -- the same two
      // arguments (email, password) that have always gone to Supabase.
      const result = await signUpWithPassword(email.trim(), password);
      if (result.error) {
        setSubmitting(false);
        setError(result.error);
        return;
      }
      accountCreatedRef.current = true;
      accessTokenRef.current = result.accessToken;

      if (result.requiresEmailConfirmation) {
        // No session yet -- there is no access token to persist profile
        // fields with. The account exists, but first/last name and
        // username can only be saved once the user confirms and signs in.
        setSubmitting(false);
        onAccountCreated?.();
        setConfirmationSent(true);
        return;
      }
    }

    if (accessTokenRef.current) {
      try {
        await updateMyProfile(accessTokenRef.current, {
          username: normalizedUsername,
          // A separate, explicit field -- never derived from username or
          // first name. Changeable later from Settings (Account category)
          // like any other display name edit.
          displayName: trimmedDisplayName,
        });
      } catch (err) {
        setSubmitting(false);
        setError(err instanceof Error ? err.message : 'Failed to save profile');
        return;
      }
    }

    setSubmitting(false);
    onAccountCreated?.();
    // If confirmation isn't required, the project auto-confirms and
    // onAuthStateChange in AuthProvider moves the app into the signed-in
    // state (and onward into onboarding) on its own.
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
        showsVerticalScrollIndicator={false}
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
            <Text style={styles.label}>First Name</Text>
            <View style={[styles.inputRow, focusedField === 'firstName' && styles.inputRowFocused]}>
              <TextInput
                testID="sign-up-first-name"
                style={styles.input}
                placeholder="Enter your first name"
                placeholderTextColor={colors.textMuted}
                autoComplete="given-name"
                returnKeyType="next"
                value={firstName}
                onChangeText={setFirstName}
                onFocus={() => setFocusedField('firstName')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => lastNameRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Last Name</Text>
            <View style={[styles.inputRow, focusedField === 'lastName' && styles.inputRowFocused]}>
              <TextInput
                ref={lastNameRef}
                testID="sign-up-last-name"
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor={colors.textMuted}
                autoComplete="family-name"
                returnKeyType="next"
                value={lastName}
                onChangeText={setLastName}
                onFocus={() => setFocusedField('lastName')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => displayNameRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Display Name</Text>
            <View
              style={[styles.inputRow, focusedField === 'displayName' && styles.inputRowFocused]}
            >
              <TextInput
                ref={displayNameRef}
                testID="sign-up-display-name"
                style={styles.input}
                placeholder="Enter your display name"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
                value={displayName}
                onChangeText={setDisplayName}
                onFocus={() => setFocusedField('displayName')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => usernameRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.inputRow, focusedField === 'username' && styles.inputRowFocused]}>
              <TextInput
                ref={usernameRef}
                testID="sign-up-username"
                style={styles.input}
                placeholder="@username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoComplete="username-new"
                returnKeyType="next"
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase())}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputRow, focusedField === 'email' && styles.inputRowFocused]}>
              <TextInput
                ref={emailRef}
                testID="sign-up-email"
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
