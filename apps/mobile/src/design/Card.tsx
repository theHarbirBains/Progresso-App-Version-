import type { ReactNode } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from './theme';

interface Props {
  children: ReactNode;
  /**
   * The one hero card on a screen (e.g. Feed's Next Workout): no fill and no
   * edge, so its content sits straight on the warm gym photo behind the top
   * of every screen (AppBackgroundLayer), the way Option 4's hero does. Pair
   * with light text inside and a `colors.heroAction` button (the caller's
   * job, same as AppCard's hero convention).
   */
  hero?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Ignored when there's no `onPress`. Defaults to "button". */
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}

// The redesign's card: a flat, opaque surface -- no glass tint, no blur, no
// glow -- raised above the page purely by being a visibly lighter fill
// (`colors.surfaceRaised`) than the near-black background, the same way
// elevation reads in a dark OS theme. A faint warm hairline traces its edge,
// drawn as an absolutely positioned layer so it never changes the card's
// size or where its content sits. Bigger, softer corners than AppCard.
export function Card({
  children,
  hero,
  onPress,
  testID,
  style,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: Props) {
  const cardStyle = [styles.card, hero ? null : styles.surface, style];
  const content = (
    <>
      {children}
      {/* Drawn last, so nothing inside the card can cover its edge. */}
      {hero ? null : (
        <View
          testID={testID ? `${testID}-edge` : undefined}
          style={[styles.layer, styles.edge]}
          pointerEvents="none"
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  surface: {
    backgroundColor: colors.surfaceRaised,
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  edge: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
});
