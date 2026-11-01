import { View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles as styles } from '../settings/settingsStyles';
import { useIsAdmin } from '../feedback/useIsAdmin';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'AccountSettings'>;

/**
 * The app's global Settings hub, reached from the existing gear/menu
 * affordances (Profile's header, the side menu's "Settings" item -- see
 * appMenuSections.ts). A compact, scannable list of category rows -- each
 * one pushes its own focused subpage rather than showing every setting
 * inline, per the current Settings information-architecture pass (see
 * DESIGN.md's own Settings entry for the full reasoning/history).
 *
 * "App" (links to Workout History/Splits/Exercise Library/Nutrition/
 * Trainer Access) is deliberately not a category here any more -- every one
 * of those is already one tap away from the side menu, so a whole Settings
 * category that only re-links them added navigation depth with no new
 * value. "Subscription" isn't a category either: there is no subscription/
 * purchase UI anywhere in the mobile app today (entitlement is checked
 * server-side only, no RevenueCat SDK is even installed on this app) --
 * unlike Notifications/Privacy/Help, CLAUDE.md doesn't list this as an
 * intentionally-incomplete-but-visible area, so adding a placeholder for it
 * would be inventing a feature, not reorganizing an existing one.
 */
export function AccountSettingsScreen({ navigation }: Props) {
  // Only offered to support and full admins; the API enforces it whatever is shown.
  const isAdmin = useIsAdmin();
  const { accent } = useAppTheme();
  return (
    <Screen
      testID="settings-screen"
      scrollTestID="settings-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-header"
          title="Settings"
          subtitle="Customize your experience."
          onBack={() => navigation.goBack()}
        />
      }
    >
      {/* First, so everyone sees it: sending feedback, and what's happened to what they sent. */}
      <Section title="Feedback & Suggestions" testID="settings-feedback-section">
        <View style={styles.feedback}>
          <Text style={styles.feedbackIntro}>
            Found a bug, or have an idea? Tell us, and follow what happens to it.
          </Text>
          <PrimaryButton
            testID="settings-feedback-send"
            label="Send Feedback"
            icon="edit-3"
            onPress={() => navigation.navigate('FeedbackForm')}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
        </View>
        <ListRow
          testID="settings-feedback"
          icon="message-square"
          title="Your Feedback"
          subtitle="What you've sent, and what's happening with it"
          divider
          onPress={() => navigation.navigate('Feedback')}
        />
      </Section>

      <Section title="Categories">
        <ListRow
          testID="settings-category-personal-info"
          icon="user"
          title="Profile & Personal Information"
          subtitle="Picture, name, username, body measurements"
          onPress={() => navigation.navigate('SettingsPersonalInfo')}
        />
        <ListRow
          testID="settings-category-workout-preferences"
          icon="activity"
          title="Workout Preferences"
          subtitle="Weekly workout goal"
          divider
          onPress={() => navigation.navigate('SettingsWorkoutPreferences')}
        />
        <ListRow
          testID="settings-category-nutrition"
          icon="pie-chart"
          title="Nutrition & Goals"
          subtitle="Calorie and macro targets"
          divider
          onPress={() => navigation.navigate('SettingsNutrition')}
        />
        <ListRow
          testID="settings-category-appearance"
          icon="image"
          title="Appearance"
          subtitle="Theme, and changing with the seasons"
          divider
          onPress={() => navigation.navigate('SettingsAppearance')}
        />
        <ListRow
          testID="settings-category-notifications"
          icon="bell"
          title="Notifications"
          subtitle="Push and email preferences"
          divider
          onPress={() => navigation.navigate('SettingsNotifications')}
        />
        <ListRow
          testID="settings-category-account-security"
          icon="lock"
          title="Account & Security"
          subtitle="Email, password, sign out, delete account"
          divider
          onPress={() => navigation.navigate('SettingsAccountSecurity')}
        />
        <ListRow
          testID="settings-category-support"
          icon="help-circle"
          title="Support & About"
          subtitle="Help, contact, app version"
          divider
          onPress={() => navigation.navigate('SettingsSupport')}
        />
      </Section>

      {isAdmin ? (
        <Section title="Admin">
          <ListRow
            testID="settings-admin-feedback-inbox"
            icon="inbox"
            title="Feedback Inbox"
            subtitle="Review what people have sent"
            onPress={() => navigation.navigate('AdminFeedbackInbox')}
          />
        </Section>
      ) : null}
    </Screen>
  );
}
