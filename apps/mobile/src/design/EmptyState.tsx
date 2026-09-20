import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SecondaryButton } from './Button';
import { Text } from './Text';
import { colors, spacing, typeScale } from './theme';

interface Props {
  icon?: ReactNode;
  title: string;
  /** One supporting sentence: what belongs here, or what to do next. */
  description?: string;
  /** A single next step. Rendered as a small secondary button. */
  action?: { label: string; onPress: () => void; testID?: string };
  testID?: string;
}

// A coherent replacement for the plain gray "no data" text every screen
// currently hand-rolls. Deliberately minimal -- an icon slot, a title, an
// optional sentence and an optional next step, nothing more. testID lands on
// the title Text itself (not the outer container) so
// toHaveTextContent(exact string) assertions aren't polluted by the icon
// glyph's own (invisible but real) text content.
export function EmptyState({ icon, title, description, action, testID }: Props) {
  return (
    <View style={styles.container}>
      {icon}
      <Text testID={testID} style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? (
        <View style={styles.action}>
          <SecondaryButton
            size="sm"
            label={action.label}
            onPress={action.onPress}
            testID={action.testID}
          />
        </View>
      ) : null}
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
    ...typeScale.callout,
    color: colors.textMuted,
    textAlign: 'center',
  },
  description: {
    ...typeScale.secondary,
    color: colors.textMuted,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.sm,
  },
});
