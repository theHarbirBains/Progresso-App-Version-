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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { withAlpha } from '../theme/accentColor';
import { colors, radii, spacing } from './theme';

// The warm gym photograph behind a hero card (Warm Minimal, DESIGN.md §10).
const HERO_IMAGE = require('../../assets/hero-gym-warm.jpg');

interface Props {
  children: ReactNode;
  /**
   * The one hero card on a screen (e.g. Feed's Next Workout): the warm gym
   * photo, darkened across the left where the text sits (enough for AA
   * contrast even over its brightest highlights) and letting the window
   * light through only at the right edge, instead of
   * the quiet surface every other card uses. Pair with light text inside and
   * a `colors.heroAction` button (the caller's job, same as AppCard's hero
   * convention).
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
// elevation reads in a dark OS theme. A faint warm hairline traces its edge.
// Bigger, softer corners than AppCard. The photo and the hairline are both
// absolutely positioned layers behind the content, so neither changes the
// card's size or where its content sits.
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
  const cardStyle = [styles.card, hero ? styles.heroSurface : styles.surface, style];
  const content = (
    <>
      {hero ? (
        <View
          testID={testID ? `${testID}-photo` : undefined}
          style={styles.layer}
          pointerEvents="none"
        >
          <Image source={HERO_IMAGE} style={styles.layer} contentFit="cover" />
          <LinearGradient
            colors={[
              withAlpha(colors.background, 0.9),
              withAlpha(colors.background, 0.8),
              withAlpha(colors.background, 0.3),
            ]}
            locations={[0, 0.7, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.layer}
          />
        </View>
      ) : null}
      {children}
      {/* Drawn last, so nothing inside the card can cover its edge. */}
      <View
        testID={testID ? `${testID}-edge` : undefined}
        style={[styles.layer, styles.edge]}
        pointerEvents="none"
      />
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
  // Shown under the photo while it loads, and if it ever fails to.
  heroSurface: {
    backgroundColor: colors.surface,
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
