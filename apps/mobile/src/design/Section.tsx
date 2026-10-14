import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SectionHeader } from './SectionHeader';
import { Text } from './Text';
import { colors, minTouchTarget, spacing, typeScale } from './theme';
import { Card } from './Card';
import { useInsideCard } from './insideCard';

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

// A titled group of content -- a widget: standing on its own on a page it is
// a Card with its heading inside, the same as every other widget, so a page
// built from Sections (Settings, the forms) reads as widgets like the rest of
// the app. Inside a card already it is just a titled group, never a card in a
// card (insideCard.ts). The heading uses SectionHeader's exact treatment.
export function Section({
  title,
  titleTestID,
  action,
  actionColor = colors.textSecondary,
  children,
  testID,
}: Props) {
  const insideCard = useInsideCard();
  const body = (
    <>
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
    </>
  );
  if (insideCard) return <View testID={testID}>{body}</View>;
  return <Card testID={testID}>{body}</Card>;
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
