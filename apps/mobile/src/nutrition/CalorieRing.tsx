import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Skeleton } from '../design/Skeleton';
import { Text } from '../design/Text';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { usePageArrived } from '../navigation/useAfterTransition';
import { colors, spacing, typeScale } from '../design/theme';
import { wholeFigure } from './wholeFigures';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** Calories logged so far today. */
  consumed: number;
  /** The user's daily calorie goal, or null if none is set yet. */
  goal: number | null;
  /** The Nutrition accent -- the ring fills in this colour. */
  accentColor: string;
  size?: number;
  strokeWidth?: number;
  /** Read out after the figure: "logged today" (the default), or "a day on average". */
  spokenPeriod?: string;
  testID?: string;
}

const DEFAULT_SIZE = 168;
const DEFAULT_STROKE_WIDTH = 14;

// A calorie-vs-goal readout drawn as a ring instead of the plain "X / Y"
// text every other macro still uses -- calories is the one number checked
// at a glance throughout the day, so it earns the more prominent, glanceable
// treatment; Protein/Carbs/Fat stay plain rows below it (NutritionTodayScreen
// owns that). Fills clockwise from the top, capped at a full ring past 100%
// of the goal (overeating doesn't draw past the circle). With no goal set,
// renders as an empty (unfilled) track so it never implies false progress.
// When the figure changes -- a food logged, or another day turned to on the
// Nutrition screen -- the ring sweeps to it rather than jumping (instantly
// under Reduce Motion); it's drawn at rest the first time.
export function CalorieRing({
  consumed,
  goal,
  accentColor,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  spokenPeriod = 'logged today',
  testID,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = goal !== null && goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const reduceMotion = useReduceMotionPreference();
  const progress = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(fraction);
      return undefined;
    }
    // The ring's dash can't run on the native driver, so this sweep is a short JS animation.
    const sweep = Animated.timing(progress, {
      toValue: fraction,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    sweep.start();
    return () => sweep.stop();
  }, [fraction, reduceMotion, progress]);
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });
  // The ring is drawn once the page has arrived; its numbers show at once.
  const arrived = usePageArrived();

  return (
    <View
      testID={testID}
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={
        goal !== null
          ? `${wholeFigure(consumed)} of ${wholeFigure(goal)} calories ${spokenPeriod}`
          : `${wholeFigure(consumed)} calories ${spokenPeriod}, no goal set`
      }
    >
      {arrived ? (
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceRaised}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={accentColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        </Svg>
      ) : (
        <Skeleton width={size} height={size} radius={size / 2} />
      )}
      <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
        <View style={styles.center}>
          <Text testID={testID ? `${testID}-value` : undefined} style={styles.value}>
            {wholeFigure(consumed)}
          </Text>
          <Text style={styles.unit}>{goal !== null ? `of ${wholeFigure(goal)} cal` : 'cal'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  value: {
    ...typeScale.statLarge,
    color: colors.textPrimary,
  },
  unit: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
});
