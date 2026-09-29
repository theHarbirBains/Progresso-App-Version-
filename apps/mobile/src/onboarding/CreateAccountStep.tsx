import { useRef, useState } from 'react';
import { StyleSheet, TextInput as RNTextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';

// Mirrors the backend's own username rule exactly (update-user.dto.ts /
// 20260825100001_username.sql): lowercase letters, digits, underscores,
// 3-20 characters. Client-side validation is a UX nicety only -- the
// backend PATCH is still the single source of truth.
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export interface CreateAccountFields {
  displayName: string;
  username: string;
  email: string;
  password: string;
}

export interface GoogleSignUpFields {
  displayName: string;
  username: string;
}

interface Props {
  testID: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (fields: CreateAccountFields) => void;
  /** Continue with Google instead of email/password -- still needs Display Name/Username from this same step (Google doesn't supply a Progresso username), so it shares this step's fields rather than being a separate one. */
  onGoogleSignUp: (fields: GoogleSignUpFields) => void;
  /** Independent of `submitting`: the two are different actions on this one screen, and pressing one shouldn't show the other's button as busy. */
  googleSubmitting: boolean;
}

// The final onboarding step: create the account with everything answered
// so far ready to submit right behind it (see onboardingDraft.ts). Only
// Display Name, Username, Email, and Password -- unlike the old, separate
// SignUpScreen this replaces, there's no First/Last Name here: those
// fields were collected there but never actually persisted anywhere (no
// column backed them), so this doesn't carry that dead weight forward.
// Google is the one alternative to typing an email/password (see
// SignInScreen's own equivalent) -- Display Name/Username are still
// required either way, since those are Progresso-specific, not something
// Google's own profile supplies.
export function CreateAccountStep({
  testID,
  submitting,
  error,
  onSubmit,
  onGoogleSignUp,
  googleSubmitting,
}: Props) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const usernameRef = useRef<RNTextInput>(null);
  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);

  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const anySubmitting = submitting || googleSubmitting;
  const canSubmit =
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword === password &&
    !anySubmitting;
  const canSubmitGoogle =
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    !anySubmitting;

  function validateNameAndUsername(): { displayName: string; username: string } | null {
    const trimmedDisplayName = displayName.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!trimmedDisplayName) {
      setLocalError('Display name is required.');
      return null;
    }
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setLocalError(
        'Username may only contain lowercase letters, numbers, and underscores, and be 3-20 characters.',
      );
      return null;
    }
    return { displayName: trimmedDisplayName, username: normalizedUsername };
  }

  function handleSubmit() {
    if (anySubmitting) return;
    const nameFields = validateNameAndUsername();
    if (!nameFields) return;

    if (!email.trim()) {
      setLocalError('Email is required.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (confirmPassword !== password) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLocalError(null);
    onSubmit({ ...nameFields, email: email.trim(), password });
  }

  function handleGoogleSignUp() {
    if (anySubmitting) return;
    const nameFields = validateNameAndUsername();
    if (!nameFields) return;
    setLocalError(null);
    onGoogleSignUp(nameFields);
  }

  const displayError = localError ?? error;

  return (
    <View testID={testID}>
      {displayError ? (
        <Text testID="onboarding-create-account-error" style={{ color: colors.destructive }}>
          {displayError}
        </Text>
      ) : null}

      <TextInput
        testID="onboarding-create-account-display-name"
        label="Display Name"
        placeholder="Enter your display name"
        returnKeyType="next"
        value={displayName}
        onChangeText={setDisplayName}
        onSubmitEditing={() => usernameRef.current?.focus()}
      />
      <TextInput
        inputRef={usernameRef}
        testID="onboarding-create-account-username"
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
        testID="onboarding-create-account-email"
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
        testID="onboarding-create-account-password"
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
            testID="onboarding-create-account-password-toggle"
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
          />
        }
      />
      <TextInput
        inputRef={confirmRef}
        testID="onboarding-create-account-confirm-password"
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
        errorTestID="onboarding-create-account-password-mismatch"
        rightAccessory={
          <VisibilityToggle
            testID="onboarding-create-account-confirm-password-toggle"
            visible={confirmVisible}
            onToggle={() => setConfirmVisible((v) => !v)}
          />
        }
      />

      <PrimaryButton
        testID="onboarding-create-account-submit"
        label={submitting ? 'Creating Account...' : 'Create Account'}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      />

      <View style={dividerStyles.row}>
        <View style={dividerStyles.line} />
        <Text style={dividerStyles.text}>or</Text>
        <View style={dividerStyles.line} />
      </View>

      <SecondaryButton
        testID="onboarding-create-account-google"
        label="Continue with Google"
        onPress={handleGoogleSignUp}
        loading={googleSubmitting}
        disabled={!canSubmitGoogle}
      />
    </View>
  );
}

const dividerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  text: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
});

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
