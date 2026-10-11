import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsNutrition'>;

/**
 * Nutrition & Goals: links to the existing, already-dedicated Nutrition
 * Goals screen (calorie target, macro targets, the calorie-estimation
 * flow) rather than a second copy of it -- there is no nutrition setting
 * anywhere in the app that isn't already that screen's own. See
 * NutritionGoalsScreen for the real content; this is just Settings' entry
 * point into it, for anyone who looks for nutrition targets under Settings
 * rather than the Nutrition tab's own menu.
 */
export function SettingsNutritionScreen({ navigation }: Props) {
  return (
    <Screen
      testID="settings-nutrition-screen"
      scrollTestID="settings-nutrition-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-nutrition-header"
          title="Nutrition & Goals"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="Goals">
        <ListRow
          testID="open-nutrition-goals"
          icon="target"
          title="Nutrition Goals"
          subtitle="Calorie target, macro targets, and the calorie-estimation calculator"
          onPress={() => navigation.navigate('NutritionGoals')}
        />
      </Section>
    </Screen>
  );
}
