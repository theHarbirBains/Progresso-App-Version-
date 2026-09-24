import { View } from 'react-native';
import { ListRow } from '../design/ListRow';
import { Section } from '../design/Section';
import { Toggle } from '../design/Toggle';
import { ComingSoonRow } from './ComingSoonRow';
import { settingsStyles as styles } from './settingsStyles';

interface Props {
  pushNotificationsOptIn: boolean;
  onTogglePush: (value: boolean) => void;
  emailOptIn: boolean;
  onToggleEmail: (value: boolean) => void;
  saving: boolean;
  accentColor: string;
}

/** Notifications category: the two real opt-in preferences as toggle rows, then the not-yet-built kinds as visible "Coming Soon" rows (never a toggle that silently does nothing). */
export function NotificationsCategory({
  pushNotificationsOptIn,
  onTogglePush,
  emailOptIn,
  onToggleEmail,
  saving,
  accentColor,
}: Props) {
  return (
    <View style={styles.categoryGap}>
      <Section title="Notifications">
        <ListRow
          icon="bell"
          title="Push Notifications"
          subtitle="General notifications from Progresso."
          trailing={
            <Toggle
              testID="notif-push-toggle"
              value={pushNotificationsOptIn}
              onValueChange={onTogglePush}
              disabled={saving}
              accentColor={accentColor}
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
              onValueChange={onToggleEmail}
              disabled={saving}
              accentColor={accentColor}
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
    </View>
  );
}
