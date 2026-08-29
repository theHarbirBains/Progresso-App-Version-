import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typeScale } from './theme';

interface Props {
  label: string;
  testID?: string;
}

export function SectionHeader({ label, testID }: Props) {
  return (
    <Text testID={testID} style={styles.label}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typeScale.sectionHeading,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});
