import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { spacing } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsChangePassword'>;

// Supabase's default minimum, the same rule sign-up and password reset use.
const MIN_PASSWORD_LENGTH = 6;
const PROVIDER_NAMES: Record<string, string> = { google: 'Google', apple: 'Apple' };

/** The sign-in providers on the account; "email" means it has a Progresso password. */
function signInProviders(user: User | null): string[] {
  const { providers, provider } = user?.app_metadata ?? {};
  if (Array.isArray(providers)) return providers as string[];
  return typeof provider === 'string' ? [provider] : [];
}

/**
 * Change Password: checks the current password by signing in with it again
 * (which also satisfies Supabase's recent-sign-in rule for password changes),
 * then sets the new one. Accounts that only sign in with Google or Apple have
 * no Progresso password, so they get an explanation instead of the form.
 */
export function SettingsChangePasswordScreen({ navigation }: Props) {
  const { user, signInWithPassword, updatePassword } = useAuth();
  const { theme } = useProgressTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [saving, setSaving] = useState(false);

  const providers = signInProviders(user);
  const hasPassword = providers.includes('email');
  const otherProvider = providers.map((p) => PROVIDER_NAMES[p]).find(Boolean) ?? 'another service';

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword.length > 0;

  async function handleSubmit() {
    setError(null);
    setUpdated(false);
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (!user?.email) {
      setError('This account has no email address to check your password against.');
      return;
    }

    setSaving(true);
    const signInError = await signInWithPassword(user.email, currentPassword);
    if (signInError) {
      setSaving(false);
      setError(
        signInError === 'Invalid login credentials'
          ? 'Your current password is incorrect.'
          : signInError,
      );
      return;
    }

    const updateError = await updatePassword(newPassword);
    setSaving(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setUpdated(true);
  }

  return (
    <Screen
      testID="settings-change-password-screen"
      scrollTestID="settings-change-password-scroll"
      contentContainerStyle={styles.categoryGap}
      keyboardAvoiding
      header={
        <AppHeader
          testID="settings-change-password-header"
          title="Change Password"
          onBack={() => navigation.goBack()}
        />
      }
    >
      {hasPassword ? (
        <>
          <Section title="Password">
            <View style={localStyles.form}>
              <TextInput
                testID="change-password-current"
                label="Current password"
                secureTextEntry
                autoComplete="password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TextInput
                testID="change-password-new"
                label="New password"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                secureTextEntry
                autoComplete="password-new"
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TextInput
                testID="change-password-confirm"
                label="Confirm new password"
                placeholder="Re-enter your new password"
                secureTextEntry
                autoComplete="password-new"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
          </Section>

          {error ? (
            <Text testID="change-password-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
          {updated ? (
            <Text testID="change-password-success" style={styles.rowSubtitle}>
              Your password has been updated.
            </Text>
          ) : null}

          <PrimaryButton
            testID="change-password-submit"
            label="Update Password"
            onPress={handleSubmit}
            loading={saving}
            disabled={!canSubmit}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </>
      ) : (
        <Section title="Password">
          <Text testID="change-password-no-password" style={styles.rowSubtitle}>
            {`You sign in with ${otherProvider}, so there's no Progresso password to change.`}
          </Text>
        </Section>
      )}
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
});
