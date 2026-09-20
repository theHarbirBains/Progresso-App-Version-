import { View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { SectionHeader } from '../design/SectionHeader';
import { Toggle } from '../design/Toggle';
import { colors } from '../design/theme';
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

// Only two settings here are real: push and email opt-in, both the exact
// same profile fields (pushNotificationsOptIn/emailOptIn) already collected
// during onboarding via updateMyProfile -- onboarding's own copy promises
// "You can change this later from Settings," so this is that promise kept,
// not new functionality. The more granular categories the reference
// suggests (workout reminders, PR notifications, weekly summaries, social
// notifications) have no backing preference field or delivery mechanism
// anywhere in the app today, so they show as real "Coming Soon" rows rather
// than toggles that would silently do nothing.
export function NotificationsCategory({
  pushNotificationsOptIn,
  onTogglePush,
  emailOptIn,
  onToggleEmail,
  saving,
  accentColor,
}: Props) {
  return (
    <View style={styles.section}>
      <SectionHeader label="Notifications" />
      <AppCard>
        <View style={styles.row}>
          <View style={styles.rowIconWrap}>
            <Feather name="bell" size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Push Notifications</Text>
            <Text style={styles.rowSubtitle}>General notifications from Progresso.</Text>
          </View>
          <Toggle
            testID="notif-push-toggle"
            value={pushNotificationsOptIn}
            onValueChange={onTogglePush}
            disabled={saving}
            accentColor={accentColor}
            accessibilityLabel="Push Notifications"
          />
        </View>

        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowIconWrap}>
            <Feather name="mail" size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Email Notifications</Text>
            <Text style={styles.rowSubtitle}>Emails from Progresso.</Text>
          </View>
          <Toggle
            testID="notif-email-toggle"
            value={emailOptIn}
            onValueChange={onToggleEmail}
            disabled={saving}
            accentColor={accentColor}
            accessibilityLabel="Email Notifications"
          />
        </View>

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
      </AppCard>
    </View>
  );
}
