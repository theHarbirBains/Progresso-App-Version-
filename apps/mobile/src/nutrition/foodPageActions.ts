import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { LoggableFood } from './LogFoodStep';
import { foodSourceText, nutritionReportDraft } from './foodSource';

/**
 * What a food's page offers when its figures look wrong (LogFoodStep's quiet actions): Other
 * Matches -- Search Food on its name, to pick another entry -- and Report a Problem, a bug report
 * filled in with the food, its serving, the figures shown and where they came from. Nothing about
 * the food itself changes: a shared food is only ever corrected by Progresso, and a person's own
 * food through Edit Food.
 */
export function foodPageActions(
  navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'>,
  food: LoggableFood,
  day?: string,
): { onOtherMatches: () => void; onReportProblem: () => void } {
  return {
    onOtherMatches: () => navigation.navigate('FoodSearch', { day, query: food.name }),
    onReportProblem: () =>
      navigation.navigate('FeedbackForm', {
        category: 'bug',
        ...nutritionReportDraft(food, foodSourceText(food)),
      }),
  };
}
