import { useRef, useState } from 'react';
import { TextInput as RNTextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { PrimaryButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';

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

interface Props {
  testID: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (fields: CreateAccountFields) => void;
}

// The final onboarding step: create the account with everything answered
// so far ready to submit right behind it (see onboardingDraft.ts). Only
// Display Name, Username, Email, and Password -- unlike the old, separate
// SignUpScreen this replaces, there's no First/Last Name here: those
// fields were collected there but never actually persisted anywhere (no
// column backed them), so this doesn't carry that dead weight forward.
export function CreateAccountStep({ testID, submitting, error, onSubmit }: Props) {
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
  const canSubmit =
    displayName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword === password &&
    !submitting;

  function handleSubmit() {
    if (submitting) return;
    const trimmedDisplayName = displayName.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!trimmedDisplayName) {
      setLocalError('Display name is required.');
      return;
    }
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setLocalError(
        'Username may only contain lowercase letters, numbers, and underscores, and be 3-20 characters.',
      );
      return;
    }
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
    onSubmit({
      displayName: trimmedDisplayName,
      username: normalizedUsername,
      email: email.trim(),
      password,
    });
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
        disabled={!canSubmit}
      />
    </View>
  );
}

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
