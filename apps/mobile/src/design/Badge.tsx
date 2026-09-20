import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, radii, typeScale } from './theme';

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
  return (
    <View testID={testID} style={[styles.badge, backgroundColor ? { backgroundColor } : null]}>
      <Text style={[styles.text, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(41, 227, 199, 0.14)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    ...typeScale.caption,
    color: colors.accent,
  },
});
