import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, typeScale } from './theme';

interface Props {
  label: string;
  testID?: string;
}

// The one badge style the app needs right now: PR/achievement labels. Per
// the approved Concept B direction, PRs use the same brand accent as
// everything else important -- there is no separate "success" hue.
export function Badge({ label, testID }: Props) {
  return (
    <View testID={testID} style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
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
