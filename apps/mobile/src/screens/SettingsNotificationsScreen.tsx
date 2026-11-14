import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { LoadingState } from '../design/LoadingState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Toggle } from '../design/Toggle';
import { colors, spacing, typeScale } from '../design/theme';
import { registerPushToken, unregisterPushToken } from '../lib/api';
import { requestPushToken } from '../lib/pushNotifications';
import type { RootStackScreenProps } from '../navigation/types';
import { useAuth } from '../auth/AuthProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { ComingSoonRow } from '../settings/ComingSoonRow';
import { settingsStyles as styles } from '../settings/settingsStyles';
import { useMembership } from '../membership/useMembership';
import { useReminders } from '../notifications/remindersContext';
import { daysLabel, timeLabel, type ReminderSettings } from '../notifications/reminderSettings';
import { TimeChoiceSheet } from '../notifications/TimeChoiceSheet';
import { WeekdayChips } from '../notifications/WeekdayChips';

type TimedReminder = 'workout' | 'meals' | 'checkIn' | 'weekly';

const TIME_TITLES: Record<TimedReminder, string> = {
  workout: 'Workout Reminders',
  meals: 'Log Your Meals',
  checkIn: 'Protein & Calorie Check-in',
  weekly: 'Weekly Summary',
};

type Props = RootStackScreenProps<'SettingsNotifications'>;

/**
 * Notifications: the two opt-in preferences as toggle rows, then the reminders -- scheduled on
 * this phone (notifications/RemindersProvider.tsx), each with its own toggle and, where it has
 * one, its time (and the workout reminder's days): Workouts' (workout days, PR cheers, the
 * weekly summary) for everyone, Nutrition's (log your meals, the protein and calorie check-in)
 * only with a membership that includes it. They come only with Push Notifications on, and only
 * once the phone allows them -- if it doesn't, a line says so, with a way to its Settings.
 * Social notifications are still a visible "Coming Soon" row, never a toggle that does nothing.
 */
export function SettingsNotificationsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();
  const { profile, loading, updateProfile } = useProfile();
  const membership = useMembership();
  const reminders = useReminders();
  const [choosingTime, setChoosingTime] = useState<TimedReminder | null>(null);

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
      // Asked just now, perhaps: the reminders start once the phone allows them.
      void reminders.refreshAllowed();
    } catch {
      setPushNotificationsOptIn(previous);
    } finally {
      setSaving(false);
    }
  }

  const settings = reminders.settings;
  const remindersOff = !pushNotificationsOptIn || reminders.allowed === false;

  function change(next: Partial<ReminderSettings>) {
    if (settings) reminders.update({ ...settings, ...next });
  }

  function reminderToggle(kind: keyof ReminderSettings, label: string) {
    return (
      <Toggle
        testID={`notif-${kind}-toggle`}
        value={settings?.[kind].on ?? false}
        onValueChange={(on) => settings && change({ [kind]: { ...settings[kind], on } })}
        disabled={!settings || remindersOff}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        accessibilityLabel={label}
      />
    );
  }

  function timeRow(kind: TimedReminder) {
    if (!settings?.[kind].on) return null;
    return (
      <ListRow
        testID={`notif-${kind}-time`}
        icon="clock"
        title="Time"
        value={timeLabel(settings[kind].time)}
        onPress={() => setChoosingTime(kind)}
        disabled={remindersOff}
        divider
        accessibilityLabel={`${TIME_TITLES[kind]} time, ${timeLabel(settings[kind].time)}`}
      />
    );
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
          testID="notif-social-notifications"
          icon="users"
          title="Social Notifications"
          showDivider
        />
      </Section>

      {!pushNotificationsOptIn ? (
        <Text testID="notif-reminders-need-push" style={styles.intro}>
          Turn on Push Notifications to get the reminders below.
        </Text>
      ) : reminders.allowed === false ? (
        <View testID="notif-reminders-blocked" style={styles.feedback}>
          <Text style={styles.intro}>
            Notifications are turned off for Progresso in your iPhone&apos;s Settings, so reminders
            can&apos;t show.
          </Text>
          <TextButton
            testID="notif-open-settings"
            label="Open iPhone Settings"
            onPress={() => void Linking.openSettings()}
          />
        </View>
      ) : null}

      <Section title="Workout Reminders">
        <ListRow
          testID="notif-workout"
          icon="calendar"
          title="Workout Days"
          subtitle="Your next split day, on the days you train."
          trailing={reminderToggle('workout', 'Workout Reminders')}
        />
        {settings?.workout.on ? (
          <View style={localStyles.days}>
            <WeekdayChips
              testID="notif-workout-days"
              days={settings.workout.days}
              onChange={(days) => change({ workout: { ...settings.workout, days } })}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
              disabled={remindersOff}
            />
            <Text testID="notif-workout-days-label" style={localStyles.daysLabel}>
              {daysLabel(settings.workout.days)}
            </Text>
          </View>
        ) : null}
        {timeRow('workout')}
        <ListRow
          testID="notif-prCheers"
          icon="award"
          title="PR Cheers"
          subtitle="When you finish a workout with a new PR."
          divider
          trailing={reminderToggle('prCheers', 'PR Cheers')}
        />
        <ListRow
          testID="notif-weekly"
          icon="bar-chart-2"
          title="Weekly Summary"
          subtitle="Sundays, when your week's summary is ready."
          divider
          trailing={reminderToggle('weekly', 'Weekly Summary')}
        />
        {timeRow('weekly')}
      </Section>

      {/* Nutrition's reminders only with a membership that includes it. */}
      {membership.nutrition ? (
        <Section title="Nutrition Reminders">
          <ListRow
            testID="notif-meals"
            icon="coffee"
            title="Log Your Meals"
            subtitle="If nothing's logged yet that day."
            trailing={reminderToggle('meals', 'Log Your Meals')}
          />
          {timeRow('meals')}
          <ListRow
            testID="notif-checkIn"
            icon="target"
            title="Protein & Calorie Check-in"
            subtitle="The day's calories and protein against your targets."
            divider
            trailing={reminderToggle('checkIn', 'Protein & Calorie Check-in')}
          />
          {timeRow('checkIn')}
        </Section>
      ) : null}

      <TimeChoiceSheet
        title={choosingTime ? TIME_TITLES[choosingTime] : null}
        value={choosingTime && settings ? settings[choosingTime].time : 0}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onClose={() => setChoosingTime(null)}
        onChoose={(time) => {
          if (choosingTime && settings) {
            change({ [choosingTime]: { ...settings[choosingTime], time } });
          }
        }}
      />
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  days: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  daysLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
});
