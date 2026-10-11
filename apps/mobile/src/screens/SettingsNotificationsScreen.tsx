import { useEffect, useRef, useState } from 'react';
import { AppHeader } from '../design/AppHeader';
import { LoadingState } from '../design/LoadingState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Toggle } from '../design/Toggle';
import { registerPushToken, unregisterPushToken } from '../lib/api';
import { requestPushToken } from '../lib/pushNotifications';
import type { RootStackScreenProps } from '../navigation/types';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ComingSoonRow } from '../settings/ComingSoonRow';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsNotifications'>;

/**
 * Notifications: the two real opt-in preferences as toggle rows, then the
 * not-yet-built kinds as visible "Coming Soon" rows (never a toggle that
 * silently does nothing) -- same content NotificationsCategory (Settings'
 * old in-screen tab) had, now its own pushed subpage. No new behavior: the
 * same registerPushToken/updateProfile calls as before.
 */
export function SettingsNotificationsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();
  const { profile, loading, updateProfile } = useProfile();

  const [pushNotificationsOptIn, setPushNotificationsOptIn] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seeds the toggles from the shared profile cache exactly once, the first
  // time it resolves -- matching every other Settings form's own seeding
  // convention (see SettingsPersonalInfoScreen's own comment).
  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (!profile || hasSeededRef.current) return;
    hasSeededRef.current = true;
    setPushNotificationsOptIn(profile.pushNotificationsOptIn ?? false);
    setEmailOptIn(profile.emailOptIn ?? false);
  }, [profile]);

  async function handleTogglePush(value: boolean) {
    const previous = pushNotificationsOptIn;
    setPushNotificationsOptIn(value);
    setSaving(true);
    try {
      // requestPushToken() is iOS-only and returns the SAME token every call
      // once permission is granted (no new prompt) -- so re-deriving it here
      // rather than holding it in state also works for turning the
      // preference back off, with no separate "remember the token" plumbing.
      if (accessToken) {
        const token = await requestPushToken();
        if (token) {
          if (value) {
            await registerPushToken(accessToken, token, 'ios');
          } else {
            await unregisterPushToken(accessToken, token);
          }
        }
        // A null token (denied permission, or Android for now) just means
        // there's nothing to register/unregister yet -- the preference
        // itself still saves below, same as it always has.
      }
      await updateProfile({ pushNotificationsOptIn: value });
    } catch {
      setPushNotificationsOptIn(previous);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEmail(value: boolean) {
    const previous = emailOptIn;
    setEmailOptIn(value);
    setSaving(true);
    try {
      await updateProfile({ emailOptIn: value });
    } catch {
      setEmailOptIn(previous);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState testID="settings-notifications-loading" />;
  }

  return (
    <Screen
      testID="settings-notifications-screen"
      scrollTestID="settings-notifications-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-notifications-header"
          title="Notifications"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="Notifications">
        <ListRow
          icon="bell"
          title="Push Notifications"
          subtitle="General notifications from Progresso."
          trailing={
            <Toggle
              testID="notif-push-toggle"
              value={pushNotificationsOptIn}
              onValueChange={handleTogglePush}
              disabled={saving}
              accentColor={theme.accent}
              accessibilityLabel="Push Notifications"
            />
          }
        />
        <ListRow
          icon="mail"
          title="Email Notifications"
          subtitle="Emails from Progresso."
          divider
          trailing={
            <Toggle
              testID="notif-email-toggle"
              value={emailOptIn}
              onValueChange={handleToggleEmail}
              disabled={saving}
              accentColor={theme.accent}
              accessibilityLabel="Email Notifications"
            />
          }
        />
        <ComingSoonRow
          testID="notif-workout-reminders"
          icon="clock"
          title="Workout Reminders"
          showDivider
        />
        <ComingSoonRow
          testID="notif-pr-notifications"
          icon="award"
          title="PR Notifications"
          showDivider
        />
        <ComingSoonRow
          testID="notif-weekly-summary"
          icon="bar-chart-2"
          title="Weekly Progress Summaries"
          showDivider
        />
        <ComingSoonRow
          testID="notif-social-notifications"
          icon="users"
          title="Social Notifications"
          showDivider
        />
      </Section>
    </Screen>
  );
}
