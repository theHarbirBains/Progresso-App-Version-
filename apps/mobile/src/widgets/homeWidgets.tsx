import type { LiveActivity } from 'expo-widgets';
import type { HomeWidgets } from './homeWidgetsTypes';
import type { WorkoutActivityProps } from './widgetProps';

// Widgets and the Lock Screen workout card are iPhone only (homeWidgets.ios.tsx). Elsewhere the
// same function exists so the app can call it anywhere, and what it hands back does nothing. It
// never calls expo-widgets: handed anything but the iPhone file's layouts, iOS refuses it and the
// app crashes.
//
// This file must stay .tsx, like the iPhone one: Metro tries every platform for .ts before any
// .tsx, so a homeWidgets.ts here would be picked over homeWidgets.ios.tsx even on iPhone -- builds
// 28 to 30 shipped exactly that (platformFiles.test.ts now checks for it).

const noCard = {
  getId: () => '',
  update: async () => undefined,
  end: async () => undefined,
  getPushToken: async () => null,
  addPushTokenListener: () => ({ remove: () => undefined }),
} as unknown as LiveActivity<WorkoutActivityProps>;

const nothing = () => undefined;

const none: HomeWidgets = {
  nutritionWidget: { updateTimeline: nothing, updateSnapshot: nothing },
  nextWorkoutWidget: { updateTimeline: nothing, updateSnapshot: nothing },
  stepsWidget: { updateTimeline: nothing, updateSnapshot: nothing },
  workoutActivity: { start: () => noCard, getInstances: () => [] },
};

export function homeWidgets(): HomeWidgets {
  return none;
}
