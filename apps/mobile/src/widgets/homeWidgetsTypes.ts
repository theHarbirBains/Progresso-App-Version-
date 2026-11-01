import type { LiveActivityFactory, Widget } from 'expo-widgets';
import type {
  NextWorkoutWidgetProps,
  NutritionWidgetProps,
  StepsWidgetProps,
  WorkoutActivityProps,
} from './widgetProps';

/** A home-screen widget as the app uses it: its timeline, handed over and read back. */
export type HomeWidget<P extends object> = Pick<Widget<P>, 'updateTimeline' | 'getTimeline'>;

/**
 * The home-screen widgets and the Lock Screen card, as the app updates them: the real ones on
 * iPhone (homeWidgets.ios.tsx), ones that do nothing elsewhere (homeWidgets.tsx).
 */
export interface HomeWidgets {
  nutritionWidget: HomeWidget<NutritionWidgetProps>;
  nextWorkoutWidget: HomeWidget<NextWorkoutWidgetProps>;
  stepsWidget: HomeWidget<StepsWidgetProps>;
  workoutActivity: Pick<LiveActivityFactory<WorkoutActivityProps>, 'start' | 'getInstances'>;
}
