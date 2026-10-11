import { Alert, View } from 'react-native';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackScreenProps } from '../navigation/types';
import { ComingSoonRow } from '../settings/ComingSoonRow';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsAccountSecurity'>;

/**
 * Account & Security: credentials, sign-out, account deletion, and the two
 * legal links -- grouped together per their shared "account access/privacy
 * action" purpose, rather than split across Account/Privacy the way the old
 * in-screen tabs had them. Change Password/Change Email/Delete Account are
 * visible but not yet backed by real functionality (same "Coming Soon"
 * precedent used throughout Settings); Sign Out reuses the existing
 * signOut() exactly as before.
 */
export function SettingsAccountSecurityScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();

  function handleNotYetAvailable(feature: string) {
    Alert.alert(feature, `${feature} isn't available yet -- check back in a future update.`);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      "Account deletion isn't available yet -- check back in a future update.",
    );
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
          onPress={() => handleNotYetAvailable('Change Password')}
        />
      </Section>

      <Section title="Legal">
        <ComingSoonRow testID="privacy-terms" icon="file-text" title="Terms of Service" />
        <ComingSoonRow testID="privacy-policy" icon="shield" title="Privacy Policy" showDivider />
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
          title="Delete Account"
          destructive
          chevron={false}
          divider
          onPress={handleDeleteAccount}
        />
      </Section>
    </Screen>
  );
}
