import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassBackground } from './GlassBackground';
import { colors, radii, spacing } from './theme';

export type AppMode = 'workout' | 'nutrition';

interface ModeTheme {
  accent: string;
  onAccent: string;
}

interface Props {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
  workoutTheme: ModeTheme;
  nutritionTheme: ModeTheme;
  /** testID prefix -- e.g. "dashboard" produces "dashboard-mode-workout"/"dashboard-mode-nutrition". */
  testIDPrefix: string;
}

// The single Workout/Nutrition mode switch, shown on every primary/root
// screen (Dashboard, Workouts/Food, Progress, Profile) -- extracted from
// Dashboard's original implementation verbatim (same visual output, same
// 260ms crossfade animation) so every root screen shares one component and
// one animation implementation instead of a hand-rolled copy each. See
// DESIGN.md's navigation section for exactly which screens render this and
// why (root/primary screens only -- deeper task screens don't).
export function ModeToggle({ mode, onChange, workoutTheme, nutritionTheme, testIDPrefix }: Props) {
  const themeAnim = useRef(new Animated.Value(mode === 'workout' ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(themeAnim, {
      toValue: mode === 'workout' ? 0 : 1,
      duration: 260,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [mode, themeAnim]);
  const workoutFillOpacity = themeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const nutritionFillOpacity = themeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.modeToggle}>
      <GlassBackground bordered={false} />
      <TouchableOpacity
        testID={`${testIDPrefix}-mode-workout`}
        style={styles.modeSegment}
        onPress={() => onChange('workout')}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.modeSegmentFill,
            { backgroundColor: workoutTheme.accent, opacity: workoutFillOpacity },
          ]}
        />
        <Feather
          name="activity"
          size={16}
          color={mode === 'workout' ? workoutTheme.onAccent : colors.textSecondary}
        />
        <Text
          style={[
            styles.modeSegmentText,
            mode === 'workout' && { color: workoutTheme.onAccent, fontWeight: '700' },
          ]}
        >
          Workout
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`${testIDPrefix}-mode-nutrition`}
        style={styles.modeSegment}
        onPress={() => onChange('nutrition')}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.modeSegmentFill,
            { backgroundColor: nutritionTheme.accent, opacity: nutritionFillOpacity },
          ]}
        />
        <Feather
          name="pie-chart"
          size={16}
          color={mode === 'nutrition' ? nutritionTheme.onAccent : colors.textSecondary}
        />
        <Text
          style={[
            styles.modeSegmentText,
            mode === 'nutrition' && { color: nutritionTheme.onAccent, fontWeight: '700' },
          ]}
        >
          Nutrition
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  modeToggle: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: 4,
    overflow: 'hidden',
  },
  modeSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  // Absolute-filled behind the segment's icon/text; its opacity is animated
  // between 0 and 1 (per mode theme) to crossfade the active highlight
  // smoothly instead of snapping between modes.
  modeSegmentFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.md,
  },
  modeSegmentText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
