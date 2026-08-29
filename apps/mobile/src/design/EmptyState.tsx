import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from './theme';

interface Props {
  icon?: ReactNode;
  title: string;
  testID?: string;
}

// A coherent replacement for the plain gray "no data" text every screen
// currently hand-rolls. Deliberately minimal -- an icon slot, a title, done.
// testID lands on the title Text itself (not the outer container) so
// toHaveTextContent(exact string) assertions aren't polluted by the icon
// glyph's own (invisible but real) text content.
export function EmptyState({ icon, title, testID }: Props) {
  return (
    <View style={styles.container}>
      {icon}
      <Text testID={testID} style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
