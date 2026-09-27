import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';

interface Props {
  /** Calories logged so far today. */
  consumed: number;
  /** The user's daily calorie goal, or null if none is set yet. */
  goal: number | null;
  /** The Nutrition accent -- the ring fills in this colour. */
  accentColor: string;
  size?: number;
  strokeWidth?: number;
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
export function CalorieRing({
  consumed,
  goal,
  accentColor,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  testID,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = goal !== null && goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const dashOffset = circumference * (1 - fraction);

  return (
    <View
      testID={testID}
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={
        goal !== null
          ? `${consumed} of ${goal} calories logged today`
          : `${consumed} calories logged today, no goal set`
      }
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceRaised}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
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
      <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
        <View style={styles.center}>
          <Text testID={testID ? `${testID}-value` : undefined} style={styles.value}>
            {consumed}
          </Text>
          <Text style={styles.unit}>{goal !== null ? `of ${goal} cal` : 'cal'}</Text>
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
