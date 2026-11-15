import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { socialSignInEnabled } from '../auth/socialSignIn';
import { Text } from '../design/Text';
import { PasswordVisibilityToggle } from '../design/PasswordVisibilityToggle';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import { phoneCountry, toE164 } from '../lib/phoneNumbers';

// Mirrors the backend's own username rule exactly (update-user.dto.ts /
// 20260825100001_username.sql): lowercase letters, digits, underscores,
// 3-20 characters. Client-side validation is a UX nicety only -- the
// backend PATCH is still the single source of truth.
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export interface CreateAccountFields {
  /** Their first name. */
  displayName: string;
  lastName: string;
  username: string;
  /** E.164 (lib/phoneNumbers.ts). */
  phoneNumber: string;
  email: string;
  password: string;
}

export interface GoogleSignUpFields {
  displayName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
}

interface Props {
  testID: string;
  /** Their country from onboarding: a phone number typed without its +code is read as one from it. */
  country: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (fields: CreateAccountFields) => void;
  /** Continue with Google instead of email/password -- still needs Display Name/Username from this same step (Google doesn't supply a Progresso username), so it shares this step's fields rather than being a separate one. */
  onGoogleSignUp: (fields: GoogleSignUpFields) => void;
  /** Independent of `submitting`: the two are different actions on this one screen, and pressing one shouldn't show the other's button as busy. */
  googleSubmitting: boolean;
}

// The final onboarding step: create the account with everything answered
// so far ready to submit right behind it (see onboardingDraft.ts). First
// Name and Last Name (each required -- users.display_name and
// users.last_name; their profile shows both), Username, Email, Phone Number
// (required -- a real number for their country, kept in E.164 form, so
// friends with it in their contacts can find them; never shown to anyone),
// and Password.
// Google is the one alternative to typing an email/password (see
// SignInScreen's own equivalent) -- the names and Username are still
// required either way, since the username is Progresso-specific, not
// something Google's own profile supplies.
export function CreateAccountStep({
  testID,
  country,
  submitting,
  error,
  onSubmit,
  onGoogleSignUp,
  googleSubmitting,
}: Props) {
  const [displayName, setDisplayName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Said to be wrong only once they've left the field.
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const lastNameRef = useRef<TextInputInstance>(null);
  const usernameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const phoneRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const phoneNumber = toE164(phone, phoneCountry(country));
  const anySubmitting = submitting || googleSubmitting;
  const canSubmit =
    displayName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    phoneNumber !== null &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword === password &&
    !anySubmitting;
  const canSubmitGoogle =
    displayName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    USERNAME_PATTERN.test(username.trim().toLowerCase()) &&
    phoneNumber !== null &&
    !anySubmitting;

  function validateNameAndUsername(): GoogleSignUpFields | null {
    const trimmedDisplayName = displayName.trim();
    const trimmedLastName = lastName.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!trimmedDisplayName) {
      setLocalError('First name is required.');
      return null;
    }
    if (!trimmedLastName) {
      setLocalError('Last name is required.');
      return null;
    }
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setLocalError(
        'Username may only contain lowercase letters, numbers, and underscores, and be 3-20 characters.',
      );
      return null;
    }
    if (!phoneNumber) {
      setLocalError('Enter a valid phone number.');
      return null;
    }
    return {
      displayName: trimmedDisplayName,
      lastName: trimmedLastName,
      username: normalizedUsername,
      phoneNumber,
    };
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
    <View testID={testID} style={formStyles.root}>
      {displayError ? (
        <Text testID="onboarding-create-account-error" style={formStyles.errorText}>
          {displayError}
        </Text>
      ) : null}

      <TextInput
        testID="onboarding-create-account-display-name"
        label="First Name"
        placeholder="Enter your first name"
        autoComplete="name-given"
        returnKeyType="next"
        maxLength={50}
        value={displayName}
        onChangeText={setDisplayName}
        onSubmitEditing={() => lastNameRef.current?.focus()}
      />
      <TextInput
        inputRef={lastNameRef}
        testID="onboarding-create-account-last-name"
        label="Last Name"
        placeholder="Enter your last name"
        autoComplete="name-family"
        returnKeyType="next"
        maxLength={50}
        value={lastName}
        onChangeText={setLastName}
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
        onSubmitEditing={() => phoneRef.current?.focus()}
      />
      <TextInput
        inputRef={phoneRef}
        testID="onboarding-create-account-phone"
        label="Phone Number"
        placeholder="Your mobile number"
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="next"
        value={phone}
        onChangeText={setPhone}
        onSubmitEditing={() => passwordRef.current?.focus()}
        helperText="So friends with your number in their contacts can find you. Never shown to anyone."
        error={
          phoneTouched && phone.trim().length > 0 && phoneNumber === null
            ? 'Enter a valid phone number'
            : undefined
        }
        errorTestID="onboarding-create-account-phone-error"
        onBlur={() => setPhoneTouched(true)}
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
          <PasswordVisibilityToggle
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
          <PasswordVisibilityToggle
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

      {socialSignInEnabled() ? (
        <>
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
        </>
      ) : null}
    </View>
  );
}

const formStyles = StyleSheet.create({
  // Matches authStyles.ts's own `frame` gap (SignInScreen's equivalent
  // multi-field form) -- TextInput has no external margin of its own (see
  // design/TextInput.tsx), so without this every field/button/divider here
  // sits flush against the next with no breathing room at all.
  root: {
    gap: spacing.xl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});

const dividerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
