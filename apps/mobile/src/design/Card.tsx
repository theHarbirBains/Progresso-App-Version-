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
   * Fills the card solid with this color instead of the quiet neutral
   * surface every other card uses -- for the one hero card on a screen
   * (e.g. Feed's Next Workout), filled with the mode accent. Pair with
   * light-on-dark text/icon colors inside (the caller's job, same as
   * AppCard's hero convention).
   */
  heroColor?: string;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Ignored when there's no `onPress`. Defaults to "button". */
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}

// The redesign's card: a flat, opaque surface -- no glass tint, no blur, no
// border, no glow -- raised above the page purely by being a visibly
// lighter fill (`colors.surfaceRaised`) than the near-black background, the
// same way elevation reads in a dark OS theme (iOS/Material dark mode use a
// lighter fill at higher elevation, never a drop shadow, since a shadow is
// invisible against black). Bigger, softer corners than the old AppCard.
// Scoped to FeedScreen for now, as the first screen in the app's visual
// redesign -- see DESIGN.md once this direction is confirmed and the
// rest of the app migrates over; AppCard/GlassBackground are untouched and
// still used everywhere else.
export function Card({
  children,
  heroColor,
  onPress,
  testID,
  style,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: Props) {
  const cardStyle = [
    styles.card,
    heroColor ? { backgroundColor: heroColor } : styles.surface,
    style,
  ];

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
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {children}
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
});
