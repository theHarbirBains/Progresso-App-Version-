import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

// The single source of truth for Progresso's screen transitions. Applied
// once, at the navigator level, via Stack.Navigator's own `screenOptions` in
// App.tsx -- every `Stack.Screen` registered there gets its transition from
// here, with zero per-screen setup.
//
// A page's transition says what kind of move opening it is:
// - 'section' -- the bottom nav's five tabs and the pages the side menu jumps
//   to (each carries the menu button, never a back arrow). Peers, not
//   "deeper", so they switch instantly, like iOS's own tab bars. A tab tap
//   always pushes its page (React Navigation 7's `navigate` pushes rather
//   than going back to an existing route), so a tab tap from any page,
//   however deep, is instant too.
// - 'deeper' -- every page with a back arrow: the platform's own native push
//   (`animation: 'default'` -- iOS's slide with parallax), so the slide shows
//   where you went and how to get back. `slide_from_right` would be the same
//   thing on iOS (it resolves to 'default' there), so it isn't named.
// - 'task' -- a short tool you open, use and close to land back where you
//   were (the scanner, food search, sharing, picking a split): slides up from
//   the bottom like the app's other pop-ups, with a close (x) button in place
//   of the back arrow.
//
// Swipe-back stays on everywhere. For a 'task' page the swipe is downward,
// and it only starts in the top band of the page (its header) -- a
// full-screen vertical swipe would start before a list underneath gets the
// chance to scroll, so dragging a list down would close the page instead.
//
// Reduce Motion: every page switches instantly (swipe-back still works).

export type ScreenTransition = 'section' | 'deeper' | 'task';

type RouteName = keyof RootStackParamList;

const SECTION_ROUTES: ReadonlySet<RouteName> = new Set<RouteName>([
  // The bottom nav's tabs.
  'Feed',
  'WorkoutHistory',
  'Nutrition',
  'ProgressOverview',
  'Profile',
  // The side menu's section pages (menu button, no back arrow).
  'ExerciseLibrary',
  'WorkoutSplits',
  'FoodLibrary',
  'NutritionGoals',
  'NutritionHistory',
  'CalorieEstimation',
  'LogPastWorkout',
]);

const TASK_ROUTES: ReadonlySet<RouteName> = new Set<RouteName>([
  'BarcodeScanner',
  'FoodSearch',
  'ShareWorkout',
  'ChooseWorkoutSplit',
]);

/** How far down from the top of the screen a 'task' page's swipe-down can start: the status bar and its header. */
export const TASK_SWIPE_BAND = 150;

/** iOS's own push takes about this long; a 'task' slide-up otherwise defaults to a slower 500ms. */
const TASK_ANIMATION_MS = 350;

export function screenTransitionFor(routeName: string): ScreenTransition {
  if (SECTION_ROUTES.has(routeName as RouteName)) return 'section';
  if (TASK_ROUTES.has(routeName as RouteName)) return 'task';
  return 'deeper';
}

export function getScreenTransitionOptions(
  routeName: string,
  reduceMotion: boolean,
): NativeStackNavigationOptions {
  const swipeBack = { gestureEnabled: true, fullScreenGestureEnabled: true };
  if (reduceMotion) {
    return { animation: 'none', ...swipeBack };
  }

  switch (screenTransitionFor(routeName)) {
    case 'section':
      return { animation: 'none', ...swipeBack };
    case 'task':
      return {
        animation: 'slide_from_bottom',
        animationDuration: TASK_ANIMATION_MS,
        // Starting a task from a replaced page (e.g. finishing a workout
        // lands on Share) still reads as moving forward.
        animationTypeForReplace: 'push',
        ...swipeBack,
        gestureDirection: 'vertical',
        // The swipe-down drives the same slide, in reverse.
        animationMatchesGesture: true,
        gestureResponseDistance: { bottom: TASK_SWIPE_BAND },
      };
    case 'deeper':
      return {
        animation: 'default',
        // A replace almost always moves forward (Start → the live workout,
        // a saved past workout → its detail), so it slides in like a push,
        // not back like a pop (native-stack's default).
        animationTypeForReplace: 'push',
        ...swipeBack,
      };
  }
}

/** Mirrors WelcomeScreen.tsx's one-shot reduce-motion check for use in navigator setup. */
export function useReduceMotionPreference(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return reduceMotion;
}
