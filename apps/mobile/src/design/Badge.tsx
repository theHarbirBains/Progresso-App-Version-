import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { withAlpha } from '../theme/accentColor';
import { radii, typeScale } from './theme';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  label: string;
  testID?: string;
  /** Overrides the default brand-accent text color -- e.g. a screen-local mode theme. */
  color?: string;
  /** Overrides the default brand-accent tint background -- paired with `color`. */
  backgroundColor?: string;
}

// The one badge style the app needs right now: PR/achievement labels. Per
// the approved Concept B direction, PRs use the same brand accent as
// everything else important -- there is no separate "success" hue. `color`/
// `backgroundColor` are optional escape hatches for a screen that has its
// own accent theme (e.g. Dashboard's Workout/Nutrition modes); every other
// caller is unaffected and keeps the default brand accent.
export function Badge({ label, testID, color, backgroundColor }: Props) {
  const accent = useAppTheme().accent.accent;
  return (
    <View
      testID={testID}
      style={[styles.badge, { backgroundColor: backgroundColor ?? withAlpha(accent, 0.14) }]}
    >
      <Text style={[styles.text, { color: color ?? accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    ...typeScale.caption,
  },
});
