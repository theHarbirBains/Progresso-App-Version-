import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { Avatar } from '../design/Avatar';
import { PrimaryButton } from '../design/Button';
import { SectionHeader } from '../design/SectionHeader';
import { SegmentedControl } from '../design/SegmentedControl';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing } from '../design/theme';
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
    <>
      <View style={styles.section}>
        <SectionHeader label="Account Information" />
        <Text style={styles.cardSubtitle}>Manage your profile details.</Text>
        <AppCard>
          <View style={accountAvatarStyles.row}>
            <View style={[accountAvatarStyles.avatar, { backgroundColor: accentColor }]}>
              <Avatar
                uri={avatarUrl}
                initial={avatarInitial}
                size={48}
                iconSize={20}
                iconColor={onAccentColor}
                initialStyle={[accountAvatarStyles.avatarInitial, { color: onAccentColor }]}
              />
            </View>
            <View style={styles.rowBody}>
              <Text testID="account-email" style={styles.rowTitle}>
                {email}
              </Text>
              <Text style={styles.rowSubtitle}>Your account email</Text>
            </View>
          </View>

          <View style={styles.fieldSpacer} />

          <TextInput
            testID="account-display-name"
            label="Display name"
            placeholder="Display name"
            value={displayName}
            onChangeText={onChangeDisplayName}
          />

          <View style={styles.fieldSpacer} />

          <TextInput
            testID="account-username"
            label="Username"
            placeholder="username"
            autoCapitalize="none"
            value={username}
            onChangeText={(text) => onChangeUsername(text.toLowerCase())}
          />

          <View style={styles.fieldSpacer} />

          <Text style={[styles.rowTitle, { marginBottom: spacing.sm }]}>Weight unit</Text>
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

          {saveError ? (
            <Text testID="account-save-error" style={[styles.errorText, { marginTop: spacing.lg }]}>
              {saveError}
            </Text>
          ) : null}
          {savedMessage ? (
            <Text testID="account-saved" style={[styles.rowSubtitle, { marginTop: spacing.lg }]}>
              {savedMessage}
            </Text>
          ) : null}

          <View style={styles.fieldSpacer} />
          <PrimaryButton
            testID="account-save"
            label={saving ? 'Saving…' : 'Save Changes'}
            onPress={onSave}
            disabled={saving}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </AppCard>
      </View>

      <View style={styles.section}>
        <SectionHeader label="Account Actions" />
        <AppCard>
          <TouchableOpacity
            testID="account-change-password"
            style={styles.row}
            onPress={() => handleNotYetAvailable('Change Password')}
            accessibilityRole="button"
          >
            <View style={styles.rowIconWrap}>
              <Feather name="lock" size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Change Password</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="sign-out-button"
            style={[styles.row, styles.rowDivider]}
            onPress={onSignOut}
            accessibilityRole="button"
          >
            <View style={styles.rowIconWrap}>
              <Feather name="log-out" size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Sign Out</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="account-delete-account"
            style={[styles.row, styles.rowDivider]}
            onPress={handleDeleteAccount}
            accessibilityRole="button"
          >
            <View style={[styles.rowIconWrap, { backgroundColor: colors.destructiveBorder }]}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, styles.rowTitleDestructive]}>Delete Account</Text>
            </View>
          </TouchableOpacity>
        </AppCard>
      </View>
    </>
  );
}

const accountAvatarStyles = StyleSheet.create({
  row: {
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
    fontSize: 20,
    fontWeight: '700',
  },
});
