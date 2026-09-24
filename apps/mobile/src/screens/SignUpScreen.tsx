import { useRef, useState } from 'react';
import { TextInput as RNTextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { PrimaryButton, TextButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { updateMyProfile } from '../lib/api';
import { AuthFrame } from './AuthFrame';
import { authStyles as styles } from './authStyles';

interface Props {
  onSwitchToSignIn: () => void;
  /** Called once, right after a successful signup (error === null) -- lets
   * the app show a one-time Welcome screen without SignUpScreen knowing
   * anything about that flow itself. */
  onAccountCreated?: () => void;
}

// Mirrors the backend's own username rule exactly (update-user.dto.ts /
// 20260825100001_username.sql): lowercase letters, digits, underscores,
// 3-20 characters. Client-side validation is a UX nicety only -- the
// backend PATCH is still the single source of truth (and the only place
// that can know whether a given username is actually taken).
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// Every field is the shared labelled TextInput, in the order the user fills
// them (Return moves to the next); Create Account is the one filled button.
export function SignUpScreen({ onSwitchToSignIn, onAccountCreated }: Props) {
  const { signUpWithPassword } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lastNameRef = useRef<RNTextInput>(null);
  const displayNameRef = useRef<RNTextInput>(null);
  const usernameRef = useRef<RNTextInput>(null);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);

  // Set once the Supabase Auth account itself exists, so a retry after a
  // profile-save failure (e.g. a taken username) re-attempts only the
  // profile PATCH -- calling signUp a second time for the same email would
  // just fail with "already exists".
  const accountCreatedRef = useRef(false);
  const accessTokenRef = useRef<string | null>(null);

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
      <AuthFrame showLogo title="Check your email">
        <Text testID="sign-up-confirmation" style={styles.info}>
          We sent a confirmation link to {email.trim()}. Confirm your email, then sign in.
        </Text>
        <TextButton testID="sign-up-switch" label="Back to sign in" onPress={onSwitchToSignIn} />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame showLogo title="Create your account" subtitle="Start tracking your progress.">
      {error ? (
        <Text testID="sign-up-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <TextInput
        testID="sign-up-first-name"
        label="First Name"
        placeholder="Enter your first name"
        autoComplete="given-name"
        returnKeyType="next"
        value={firstName}
        onChangeText={setFirstName}
        onSubmitEditing={() => lastNameRef.current?.focus()}
      />
      <TextInput
        inputRef={lastNameRef}
        testID="sign-up-last-name"
        label="Last Name"
        placeholder="Enter your last name"
        autoComplete="family-name"
        returnKeyType="next"
        value={lastName}
        onChangeText={setLastName}
        onSubmitEditing={() => displayNameRef.current?.focus()}
      />
      <TextInput
        inputRef={displayNameRef}
        testID="sign-up-display-name"
        label="Display Name"
        placeholder="Enter your display name"
        returnKeyType="next"
        value={displayName}
        onChangeText={setDisplayName}
        onSubmitEditing={() => usernameRef.current?.focus()}
      />
      <TextInput
        inputRef={usernameRef}
        testID="sign-up-username"
        label="Username"
        placeholder="@username"
        autoCapitalize="none"
        autoComplete="username-new"
        returnKeyType="next"
        value={username}
        onChangeText={(text) => setUsername(text.toLowerCase())}
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextInput
        inputRef={emailRef}
        testID="sign-up-email"
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextInput
        inputRef={passwordRef}
        testID="sign-up-password"
        label="Password"
        placeholder="At least 6 characters"
        secureTextEntry={!passwordVisible}
        autoCapitalize="none"
        autoComplete="password-new"
        returnKeyType="next"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => confirmRef.current?.focus()}
        rightAccessory={
          <VisibilityToggle
            testID="sign-up-password-toggle"
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
          />
        }
      />
      <TextInput
        inputRef={confirmRef}
        testID="sign-up-confirm-password"
        label="Confirm Password"
        placeholder="Re-enter your password"
        secureTextEntry={!confirmVisible}
        autoCapitalize="none"
        autoComplete="password-new"
        returnKeyType="done"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        onSubmitEditing={handleSubmit}
        error={passwordsMismatch ? "Passwords don't match" : undefined}
        errorTestID="sign-up-password-mismatch"
        rightAccessory={
          <VisibilityToggle
            testID="sign-up-confirm-password-toggle"
            visible={confirmVisible}
            onToggle={() => setConfirmVisible((v) => !v)}
          />
        }
      />

      <PrimaryButton
        testID="sign-up-submit"
        label={submitting ? 'Creating Account...' : 'Create Account'}
        onPress={handleSubmit}
        disabled={!canSubmit}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TextButton testID="sign-up-switch" label="Sign In" onPress={onSwitchToSignIn} />
      </View>
    </AuthFrame>
  );
}

// The show/hide eye on a password field: a 44pt target, named for what it will do.
function VisibilityToggle({
  testID,
  visible,
  onToggle,
}: {
  testID: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    >
      <Feather name={visible ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}
