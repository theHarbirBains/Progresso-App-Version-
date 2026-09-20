import { TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { dashboardStyles as styles } from '../screens/dashboardStyles';

interface Props {
  testID: string;
  value: string;
  title: string;
  subtitle: string;
  /**
   * `number` (default) sets the value in the mono readout face, for a figure.
   * `text` sets it in the regular UI face, on one truncating line, for a
   * word or name (a workout's name) -- the mono face is reserved for numbers.
   */
  valueKind?: 'number' | 'text';
  /** The value's color. Neutral by default -- pass the mode accent for the one figure that matters most, since accent-colouring every figure makes none of them stand out. */
  valueColor?: string;
  onPress?: () => void;
}

// One block of the Workout Home stat grid (Sets Done / Workouts This Month /
// Steps / Last Workout). The four blocks sit inside the single "activity"
// card, each a quiet raised block separated from its neighbours by exactly
// the 6px `widgetGap` -- individual blocks, but still one cohesive group,
// with no borders or icons of their own. The figure is the hero; title and
// subtitle stay quiet. A block with an `onPress` is announced as one button
// naming its whole content.
export function DashboardStat({
  testID,
  value,
  title,
  subtitle,
  valueKind = 'number',
  valueColor = colors.textPrimary,
  onPress,
}: Props) {
  const content = (
    <>
      <Text
        style={[
          valueKind === 'text' ? styles.statValueText : styles.statValue,
          { color: valueColor },
        ]}
        numberOfLines={valueKind === 'text' ? 1 : undefined}
      >
        {value}
      </Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={styles.statCell}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      testID={testID}
      style={styles.statCell}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}, ${subtitle}`}
    >
      {content}
    </TouchableOpacity>
  );
}
