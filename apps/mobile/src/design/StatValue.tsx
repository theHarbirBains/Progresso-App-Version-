import { Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, typeScale } from './theme';

interface Props {
  value: string;
  unit?: string;
  size?: 'large' | 'medium';
  /** Defaults to the brand accent -- pass colors.textPrimary for a neutral stat. */
  color?: string;
  testID?: string;
  style?: StyleProp<TextStyle>;
}

// The "readout" number treatment: JetBrains Mono, tabular by nature, reused
// for every performance/nutrition number the app wants to feel important
// (top set weight, calories, PRs) per the approved Concept B direction.
export function StatValue({
  value,
  unit,
  size = 'large',
  color = colors.accent,
  testID,
  style,
}: Props) {
  const base = size === 'large' ? typeScale.statLarge : typeScale.statMedium;
  return (
    <Text testID={testID} style={[base, { color }, style]}>
      {value}
      {unit ? (
        <Text style={{ color: colors.textSecondary, fontSize: base.fontSize * 0.5 }}>{unit}</Text>
      ) : null}
    </Text>
  );
}
