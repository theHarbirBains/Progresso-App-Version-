import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SegmentedControl } from '../design/SegmentedControl';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { removeAvatarFile, uploadAvatar } from '../lib/avatarUpload';
import type { HeightUnit } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsPersonalInfo'>;

/**
 * Profile & Personal Information: identity (picture, display name,
 * username) and the measurement units that apply across the whole app,
 * plus a link to the existing body-measurements editor -- not a second
 * copy of it. Gender/birthday/height/weight/activity level are already
 * fully editable on CalorieEstimationScreen (reached today only from
 * Nutrition Goals); this links to that *same* screen, reading/writing the
 * same shared profile cache, so there is exactly one place those fields are
 * ever actually edited.
 */
export function SettingsPersonalInfoScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id;
  const { theme, themeLoading } = useProgressTheme();
  const { profile, loading, error: loadError, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('lb');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('ft_in');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Seeds the editable fields from the shared profile cache exactly once,
  // the first time it resolves -- not on every later change to `profile`
  // (e.g. an avatar change just below), which would silently blow away text
  // the user is actively editing in this screen's own form. Same convention
  // the old AccountCategory form used.
  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (!profile || hasSeededRef.current) return;
    hasSeededRef.current = true;
    setDisplayName(profile.displayName ?? '');
    setUsername(profile.username ?? '');
    setWeightUnit(profile.weightUnit);
    setHeightUnit(profile.heightUnit);
  }, [profile]);

  async function handleSave() {
    setSaveError(null);
    setSavedMessage(null);
    setSaving(true);
    try {
      const updated = await updateProfile({
        displayName: displayName.trim(),
        username: username.trim() || undefined,
        weightUnit,
        heightUnit,
      });
      setDisplayName(updated.displayName ?? '');
      setUsername(updated.username ?? '');
      setSavedMessage('Saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleChoosePhoto() {
    setAvatarSheetOpen(false);
    if (!userId) return;
    setAvatarError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError('Photo library permission is required to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setAvatarSaving(true);
    try {
      const publicUrl = await uploadAvatar(userId, result.assets[0].uri);
      await updateProfile({ avatarUrl: publicUrl });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to update profile picture');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleRemovePhoto() {
    setAvatarSheetOpen(false);
    if (!userId) return;
    setAvatarError(null);
    setAvatarSaving(true);
    try {
      await removeAvatarFile(userId);
      await updateProfile({ avatarUrl: null });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove profile picture');
    } finally {
      setAvatarSaving(false);
    }
  }

  if (loading || themeLoading) {
    return <LoadingState testID="settings-personal-info-loading" />;
  }

  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : null;

  return (
    <>
      <Screen
        testID="settings-personal-info-screen"
        scrollTestID="settings-personal-info-scroll"
        contentContainerStyle={styles.categoryGap}
        header={
          <AppHeader
            testID="settings-personal-info-header"
            title="Profile & Personal Information"
            onBack={() => navigation.goBack()}
          />
        }
      >
        {loadError ? (
          <Text testID="settings-personal-info-load-error" style={styles.errorText}>
            {loadError}
          </Text>
        ) : null}

        <Section title="Personal Details">
          <View style={localStyles.form}>
            <TouchableOpacity
              testID="settings-personal-info-avatar"
              style={localStyles.identity}
              onPress={() => setAvatarSheetOpen(true)}
              disabled={avatarSaving}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              <View style={[localStyles.avatar, { backgroundColor: theme.accentBg }]}>
                {avatarSaving ? (
                  <ActivityIndicator
                    testID="settings-personal-info-avatar-saving"
                    color={theme.accent}
                  />
                ) : (
                  <Avatar
                    uri={profile?.avatarUrl}
                    initial={avatarInitial}
                    size={48}
                    iconSize={20}
                    iconColor={theme.accent}
                    initialStyle={[localStyles.avatarInitial, { color: theme.accent }]}
                  />
                )}
              </View>
              <View style={localStyles.identityBody}>
                <Text testID="settings-personal-info-avatar-label" style={styles.rowTitle}>
                  Profile Picture
                </Text>
                <Text style={styles.rowSubtitle}>Tap to change it</Text>
              </View>
            </TouchableOpacity>

            {avatarError ? (
              <Text testID="settings-personal-info-avatar-error" style={styles.errorText}>
                {avatarError}
              </Text>
            ) : null}

            <TextInput
              testID="account-display-name"
              label="Display name"
              placeholder="Display name"
              value={displayName}
              onChangeText={setDisplayName}
            />

            <TextInput
              testID="account-username"
              label="Username"
              placeholder="username"
              autoCapitalize="none"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
            />
          </View>
        </Section>

        <Section title="Body Measurements">
          <ListRow
            testID="open-body-measurements"
            icon="user"
            title="Gender, Age, Height & Weight"
            subtitle="Used for your personalized calorie targets"
            onPress={() => navigation.navigate('CalorieEstimation')}
          />
        </Section>

        <Section title="Measurement Units">
          <View style={localStyles.form}>
            <View>
              <Text style={localStyles.fieldLabel}>Weight</Text>
              <SegmentedControl
                testID="account-unit"
                options={[
                  { label: 'KG', value: 'kg' as const },
                  { label: 'LB', value: 'lb' as const },
                ]}
                value={weightUnit}
                onChange={setWeightUnit}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
              />
            </View>
            <View>
              <Text style={localStyles.fieldLabel}>Height</Text>
              <SegmentedControl
                testID="account-height-unit"
                options={[
                  { label: 'CM', value: 'cm' as const },
                  { label: 'FT/IN', value: 'ft_in' as const },
                ]}
                value={heightUnit}
                onChange={setHeightUnit}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
              />
            </View>
          </View>
        </Section>

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
          onPress={handleSave}
          loading={saving}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
      </Screen>

      <BottomSheet
        visible={avatarSheetOpen}
        onClose={() => setAvatarSheetOpen(false)}
        testID="settings-personal-info-avatar-sheet"
      >
        <Text style={localStyles.avatarSheetTitle}>Profile Picture</Text>
        <ListRow
          testID="settings-personal-info-choose-photo"
          icon="image"
          title="Choose Photo"
          onPress={handleChoosePhoto}
        />
        {profile?.avatarUrl ? (
          <ListRow
            testID="settings-personal-info-remove-photo"
            icon="trash-2"
            title="Remove Photo"
            destructive
            divider
            onPress={handleRemovePhoto}
          />
        ) : null}
      </BottomSheet>
    </>
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
  avatarSheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
});
