import { StyleSheet } from 'react-native';
import { colors, spacing, typeScale } from '../design/theme';

// Local to ChooseWorkoutSplitScreen only. The frame (safe area, scroll,
// horizontal padding) is the shared `Screen`; the presets are plain rows, so
// there is very little left to style here.
export const chooseWorkoutSplitStyles = StyleSheet.create({
  // Vertical rhythm between the preset list and "Build your own".
  content: {
    gap: spacing.xxl,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
