import { type StyleProp, type TextStyle } from 'react-native';
import { Text } from './Text';
import { colors, typeScale } from './theme';
import { useAppTheme } from '../theme/appThemeContext';

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
export function StatValue({ value, unit, size = 'large', color: colorProp, testID, style }: Props) {
  // Unless told otherwise, the app theme's accent.
  const themeAccent = useAppTheme().accent.accent;
  const color = colorProp ?? themeAccent;
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
