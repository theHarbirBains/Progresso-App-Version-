import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles as styles } from '../settings/settingsStyles';

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
    </Screen>
  );
}
