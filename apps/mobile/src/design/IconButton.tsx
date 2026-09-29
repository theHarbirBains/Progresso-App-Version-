import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassBackground } from './GlassBackground';
import { colors, minTouchTarget, radii, typeScale } from './theme';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  /** Icon glyph color. Defaults to colors.textPrimary. */
  color?: string;
  /** Fills the circle with this color instead of the default bordered-surface
   * treatment -- e.g. an accent-filled action. Pass a matching `color`
   * (usually the accent's onAccent) alongside for readable contrast. */
  backgroundColor?: string;
  /** A small count badge on the button's corner -- e.g. a pending-request count on a notifications bell. Omitted or 0 shows nothing; capped at "9+" past 9. Brand accent, matching DESIGN.md's one-accent rule -- never a separate alert color. */
  badgeCount?: number;
  testID?: string;
}

const VISIBLE_SIZE = 36;
const HIT_INSET = (minTouchTarget - VISIBLE_SIZE) / 2;
const ICON_BUTTON_HIT_SLOP = {
  top: HIT_INSET,
  bottom: HIT_INSET,
  left: HIT_INSET,
  right: HIT_INSET,
} as const;

// Component Logic: one 36x36 bordered circle (the exact treatment already
// repeated across several screens' hand-rolled "back button" styles) that
// renders either a Feather glyph or a loading spinner in its place --
// no variant enum, no extra wrapping Views, just color/backgroundColor
// props for the two visual states (default surface vs. accent-filled) that
// actually occur in the app today. `badgeCount` adds one more optional
// corner overlay (a notifications count) -- the button itself is wrapped in
// a plain, unstyled View so the badge can sit outside the button's own
// `overflow: 'hidden'` circle instead of being clipped by it.
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  loading,
  color = colors.textPrimary,
  backgroundColor,
  badgeCount,
  testID,
}: Props) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        testID={testID}
        style={[
          styles.button,
          backgroundColor ? { backgroundColor, borderWidth: 0 } : null,
          disabled && styles.disabled,
        ]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        // The 36pt circle is the visible size; the touch area is extended to
        // the 44pt minimum (see theme.minTouchTarget) without changing it.
        hitSlop={ICON_BUTTON_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: Boolean(disabled) }}
      >
        {!backgroundColor ? <GlassBackground /> : null}
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Feather name={icon} size={18} color={color} />
        )}
      </TouchableOpacity>

      {badgeCount ? (
        <View testID={testID ? `${testID}-badge` : undefined} style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : String(badgeCount)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  button: {
    width: VISIBLE_SIZE,
    height: VISIBLE_SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typeScale.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.onAccent,
  },
});
