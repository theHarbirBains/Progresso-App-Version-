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
// - `animation: 'default'` -- each platform's own native push/pop transition
//   (iOS slide+parallax, Android's Material motion), not a custom one. This
//   is deliberate: a "premium, native-feeling" transition for a cross-
//   platform app *is* the platform's own transition, not a bespoke one
//   layered on top. (react-native-screens' custom animations like
//   'slide_from_right' are largely Android-only and fall back to this same
//   default on iOS anyway, so there is nothing to gain by naming one
//   explicitly.)
// - `animationMatchesGesture` + `fullScreenGestureEnabled` -- lets an
//   in-progress iOS swipe-back gesture visually drive the same transition
//   used for a tap-triggered pop, and lets that swipe start from anywhere
//   on screen (not just the left edge), which is what most polished iOS
//   apps do today. Both are additive: they don't change Android at all
//   (iOS-only options) and don't disable the gesture, they extend it.
// - Reduced motion: native-stack has no built-in Reduce Motion handling, so
//   this reads `AccessibilityInfo.isReduceMotionEnabled()` once (the same
//   one-shot pattern WelcomeScreen.tsx already uses for its own entrance
//   animation) and swaps to `animation: 'none'` when it's on, rather than
//   forcing a transition the OS has been told to minimize.
export function getDefaultScreenOptions(reduceMotion: boolean): NativeStackNavigationOptions {
  if (reduceMotion) {
    return {
      animation: 'none',
      gestureEnabled: true,
    };
  }

  return {
    animation: 'default',
    animationMatchesGesture: true,
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
