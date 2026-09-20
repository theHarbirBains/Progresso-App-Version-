import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// The single source of truth for Progresso's default screen transition.
// Applied once, at the navigator level, via Stack.Navigator's own
// `screenOptions` in App.tsx -- every `Stack.Screen` registered there
// inherits this automatically, with zero per-screen setup. A screen that
// genuinely needs different behavior (a future modal/sheet, say) overrides
// it locally via that screen's own `options={{ ... }}`, which React
// Navigation always lets take precedence over the navigator-level default --
// no plumbing beyond that override is required.
//
// Choices made here:
// - `animation: 'none'` -- page navigation switches instantly, no slide/push
//   transition in either direction (an explicit product decision, not a
//   Reduce Motion accommodation -- it's unconditional for every user).
//   Reduce Motion is still respected for genuinely-animated UI elsewhere
//   (BottomSheet, AppSideMenu each check useReduceMotionPreference() for
//   their own sheet/drawer animation), which this change doesn't touch.
// - `gestureEnabled` + `fullScreenGestureEnabled` stay on: swipe-back to pop
//   a screen is still expected iOS behavior and is independent of whether
//   the pop itself animates.
export function getDefaultScreenOptions(): NativeStackNavigationOptions {
  return {
    animation: 'none',
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
  };
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
