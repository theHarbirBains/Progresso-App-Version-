import type { JSX } from 'react';
import {
  createLiveActivity,
  createWidget,
  type LiveActivityFactory,
  type Widget,
} from 'expo-widgets';
import type {
  NextWorkoutWidgetProps,
  NutritionWidgetProps,
  StepsWidgetProps,
  WorkoutActivityProps,
} from './widgetProps';

// Widgets and the Lock Screen workout card are iPhone only (homeWidgets.ios.tsx). Elsewhere the
// same names exist so the app can call them anywhere, and expo-widgets does nothing with them.

const nothing = () => null as unknown as JSX.Element;

export const nutritionWidget: Widget<NutritionWidgetProps> = createWidget(
  'NutritionToday',
  nothing,
);
export const nextWorkoutWidget: Widget<NextWorkoutWidgetProps> = createWidget(
  'NextWorkout',
  nothing,
);
export const stepsWidget: Widget<StepsWidgetProps> = createWidget('StepsToday', nothing);
export const workoutActivity: LiveActivityFactory<WorkoutActivityProps> = createLiveActivity(
  'WorkoutInProgress',
  () => ({ banner: null }),
);
