import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { Avatar } from '../design/Avatar';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Section } from '../design/Section';
import { SegmentedControl } from '../design/SegmentedControl';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { settingsStyles as styles } from './settingsStyles';

interface Props {
  email: string;
  avatarUrl: string | null;
  displayName: string;
  onChangeDisplayName: (value: string) => void;
  username: string;
  onChangeUsername: (value: string) => void;
  weightUnit: 'kg' | 'lb';
  onChangeWeightUnit: (value: 'kg' | 'lb') => void;
  saving: boolean;
  saveError: string | null;
  savedMessage: string | null;
  onSave: () => void;
  onSignOut: () => void;
  accentColor: string;
  onAccentColor: string;
}

/** Account category: the existing profile form (unchanged behavior/API) plus Account Actions -- Change Password and Delete Account are visible but not yet backed by real functionality (see the completion report), Sign Out reuses the existing signOut() exactly as before. */
export function AccountCategory({
  email,
  avatarUrl,
  displayName,
  onChangeDisplayName,
  username,
  onChangeUsername,
  weightUnit,
  onChangeWeightUnit,
  saving,
  saveError,
  savedMessage,
  onSave,
  onSignOut,
  accentColor,
  onAccentColor,
}: Props) {
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : null;

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
    <View style={styles.categoryGap}>
      <Section title="Account Information">
        <View style={localStyles.form}>
          <View style={localStyles.identity}>
            <View style={[localStyles.avatar, { backgroundColor: accentColor }]}>
              <Avatar
                uri={avatarUrl}
                initial={avatarInitial}
                size={48}
                iconSize={20}
                iconColor={onAccentColor}
                initialStyle={[localStyles.avatarInitial, { color: onAccentColor }]}
              />
            </View>
            <View style={localStyles.identityBody}>
              <Text testID="account-email" style={styles.rowTitle}>
                {email}
              </Text>
              <Text style={styles.rowSubtitle}>Your account email</Text>
            </View>
          </View>

          <TextInput
            testID="account-display-name"
            label="Display name"
            placeholder="Display name"
            value={displayName}
            onChangeText={onChangeDisplayName}
          />

          <TextInput
            testID="account-username"
            label="Username"
            placeholder="username"
            autoCapitalize="none"
            value={username}
            onChangeText={(text) => onChangeUsername(text.toLowerCase())}
          />

          <View>
            <Text style={localStyles.fieldLabel}>Weight unit</Text>
            <SegmentedControl
              testID="account-unit"
              options={[
                { label: 'KG', value: 'kg' as const },
                { label: 'LB', value: 'lb' as const },
              ]}
              value={weightUnit}
              onChange={onChangeWeightUnit}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          </View>

          {saveError ? (
            <Text testID="account-save-error" style={styles.errorText}>
              {saveError}
            </Text>
          ) : null}
          {savedMessage ? (
            <Text testID="account-saved" style={styles.rowSubtitle}>
              {savedMessage}
            </Text>
          ) : null}

          <PrimaryButton
            testID="account-save"
            label="Save Changes"
            onPress={onSave}
            loading={saving}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
      </Section>

      <Section title="Account Actions">
        <ListRow
          testID="account-change-password"
          icon="lock"
          title="Change Password"
          onPress={() => handleNotYetAvailable('Change Password')}
        />
        <ListRow
          testID="sign-out-button"
          icon="log-out"
          title="Sign Out"
          chevron={false}
          divider
          onPress={onSignOut}
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
    </View>
  );
}

const localStyles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    ...typeScale.cardTitle,
  },
  identityBody: {
    flex: 1,
  },
  fieldLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});
