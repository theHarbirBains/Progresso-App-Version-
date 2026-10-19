import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { useAuth } from '../auth/AuthProvider';
import { deleteMyAccount } from '../lib/api';
import { openLegalPage } from '../lib/legalLinks';
import { supabase } from '../lib/supabase';
import type { RootStackScreenProps } from '../navigation/types';
import { ComingSoonRow } from '../settings/ComingSoonRow';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsAccountSecurity'>;

/**
 * Account & Security: credentials, blocked people, sign-out, account deletion,
 * and the two legal links -- grouped together per their shared "account
 * access/privacy action" purpose, rather than split across Account/Privacy the
 * way the old in-screen tabs had them. Terms of Service and Privacy Policy
 * open the pages the API serves. Change Email is visible but not yet
 * backed by real functionality (same "Coming Soon" precedent used throughout
 * Settings); Change Password and Blocked People open their own subpages; Sign
 * Out reuses the existing signOut() exactly as before.
 *
 * Delete Account asks twice, then deletes the account and everything it owns
 * on the server and signs out on this device only (the session it would end
 * on the server is already gone).
 */
export function SettingsAccountSecurityScreen({ navigation }: Props) {
  const { user, session, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  function handleDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This deletes your workouts, records, nutrition logs, photos and everything else in your account, for good. Clients you track without an account can still claim their history for 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: confirmDeleteAccount },
      ],
    );
  }

  function confirmDeleteAccount() {
    Alert.alert('Are you sure?', "Your account can't be recovered once it's deleted.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Account', style: 'destructive', onPress: () => void deleteAccount() },
    ]);
  }

  async function deleteAccount() {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    setDeleting(true);
    try {
      await deleteMyAccount(accessToken);
    } catch (err) {
      setDeleting(false);
      Alert.alert(
        "Couldn't delete your account",
        err instanceof Error ? err.message : 'Please try again.',
      );
      return;
    }
    Alert.alert('Account deleted', 'Your account and its data have been deleted.');
    await supabase.auth.signOut({ scope: 'local' });
  }

  return (
    <Screen
      testID="settings-account-security-screen"
      scrollTestID="settings-account-security-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-account-security-header"
          title="Account & Security"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="Email">
        <View style={styles.row}>
          <View style={styles.rowBody}>
            <Text testID="account-security-email" style={styles.rowTitle}>
              {user?.email ?? ''}
            </Text>
            <Text style={styles.rowSubtitle}>Your account email</Text>
          </View>
        </View>
        <ComingSoonRow testID="account-change-email" icon="mail" title="Change Email" showDivider />
      </Section>

      <Section title="Password">
        <ListRow
          testID="account-change-password"
          icon="lock"
          title="Change Password"
          onPress={() => navigation.navigate('SettingsChangePassword')}
        />
      </Section>

      <Section title="Privacy">
        <ListRow
          testID="account-blocked-people"
          icon="slash"
          title="Blocked People"
          onPress={() => navigation.navigate('SettingsBlockedPeople')}
        />
      </Section>

      <Section title="Legal">
        <ListRow
          testID="privacy-terms"
          icon="file-text"
          title="Terms of Service"
          onPress={() => void openLegalPage('terms')}
        />
        <ListRow
          testID="privacy-policy"
          icon="shield"
          title="Privacy Policy"
          divider
          onPress={() => void openLegalPage('privacy')}
        />
      </Section>

      <Section title="Account Actions">
        <ListRow
          testID="sign-out-button"
          icon="log-out"
          title="Sign Out"
          chevron={false}
          onPress={() => signOut()}
        />
        <ListRow
          testID="account-delete-account"
          icon="trash-2"
          title={deleting ? 'Deleting Account…' : 'Delete Account'}
          destructive
          chevron={false}
          divider
          disabled={deleting}
          onPress={handleDeleteAccount}
        />
      </Section>
    </Screen>
  );
}
