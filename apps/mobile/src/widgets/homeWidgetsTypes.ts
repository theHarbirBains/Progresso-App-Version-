import type { LiveActivityFactory, Widget } from 'expo-widgets';
import type {
  NextWorkoutWidgetProps,
  NutritionWidgetProps,
  StepsWidgetProps,
  WorkoutActivityProps,
} from './widgetProps';

/**
 * The home-screen widgets and the Lock Screen card, as the app updates them: the real ones on
 * iPhone (homeWidgets.ios.tsx), ones that do nothing elsewhere (homeWidgets.tsx).
 */
export interface HomeWidgets {
  nutritionWidget: Pick<Widget<NutritionWidgetProps>, 'updateTimeline' | 'updateSnapshot'>;
  nextWorkoutWidget: Pick<Widget<NextWorkoutWidgetProps>, 'updateTimeline' | 'updateSnapshot'>;
  stepsWidget: Pick<Widget<StepsWidgetProps>, 'updateTimeline' | 'updateSnapshot'>;
  workoutActivity: Pick<LiveActivityFactory<WorkoutActivityProps>, 'start' | 'getInstances'>;
}
