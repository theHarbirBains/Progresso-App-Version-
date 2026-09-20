import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SectionHeader } from './SectionHeader';
import { Text } from './Text';
import { colors, minTouchTarget, spacing, typeScale } from './theme';

interface SectionAction {
  label: string;
  onPress: () => void;
  testID?: string;
}

interface Props {
  title: string;
  /** testID for the title text itself, for a screen that needs to assert on it. */
  titleTestID?: string;
  /** A single quiet text action on the header's right ("See all"). Not for primary actions -- those are Buttons. */
  action?: SectionAction;
  /** Color of the action label; pass the active mode's accent. Defaults to the secondary text color. */
  actionColor?: string;
  children: ReactNode;
  testID?: string;
}

// A titled group of content. This is how a screen is organised by default:
// sections separated by whitespace, not a stack of cards each carrying its
// own heading. The heading uses SectionHeader's exact treatment, so a screen
// migrating from a bare SectionHeader looks identical.
export function Section({
  title,
  titleTestID,
  action,
  actionColor = colors.textSecondary,
  children,
  testID,
}: Props) {
  return (
    <View testID={testID}>
      <View style={styles.header}>
        <SectionHeader label={title} testID={titleTestID} />
        {action ? (
          <TouchableOpacity
            testID={action.testID}
            onPress={action.onPress}
            // The label is small; the touch area is not.
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}, ${title}`}
          >
            <Text style={[styles.actionText, { color: actionColor }]}>{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  action: {
    minHeight: minTouchTarget / 2,
    justifyContent: 'flex-start',
    paddingLeft: spacing.md,
  },
  actionText: {
    ...typeScale.secondary,
    fontFamily: typeScale.label.fontFamily,
  },
});
