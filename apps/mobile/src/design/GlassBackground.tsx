import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { withAlpha } from '../theme/accentColor';
import { colors, widgetFillAlpha } from './theme';

export type GlassVariant = 'surface' | 'chrome';

interface Props {
  /** 'surface' (default): cards, controls, icon buttons -- tint only, no
   * blur, since these repeat many times on one screen and a BlurView per
   * instance would be wasteful. 'chrome': the persistent structural
   * surfaces that exist once at a time (bottom nav, side menu, bottom
   * sheet) -- adds a real native blur, since the one-instance-at-a-time
   * cost is bounded and these are exactly the surfaces DESIGN.md's
   * navigation section calls for blur on. */
  variant?: GlassVariant;
  /** Overrides the tint's base color instead of the warm surface/
   * surfaceRaised (e.g. AppCard's hero variant, which uses the
   * accent-adjacent surfaceHero hue). */
  tintColor?: string;
  borderColor?: string;
  /** Set false for a surface that draws its own partial border (e.g.
   * BottomNavBar's top-edge-only hairline) instead of this component's
   * default all-sides border. */
  bordered?: boolean;
  testID?: string;
}

// Every `surface` glass widget (AppCard, controls, etc.) shares Card's fill
// opacity (`widgetFillAlpha`), so the background photo stays faintly
// visible through it while its text keeps measured contrast -- see
// DESIGN.md §3b -- app-wide, from this one shared token rather than
// per-screen overrides.
const FILL_ALPHA: Record<GlassVariant, number> = { surface: widgetFillAlpha, chrome: 0.8 };
const BLUR_INTENSITY: Record<GlassVariant, number> = { surface: 24, chrome: 46 };

/**
 * The one place that renders a glass fill (+ optional blur). Purely
 * decorative and absolutely-positioned -- consuming components (AppCard,
 * BottomNavBar, SegmentedControl, ...) render this as their first child
 * and keep their own outer border/radius/overflow:hidden exactly as
 * before, so the corner-clipping and touch-target box stay unchanged.
 * Never used standalone as a whole screen's background -- that's
 * AppBackgroundLayer's job; this is the layer "glass" sits on top of it.
 */
export function GlassBackground({
  variant = 'surface',
  tintColor,
  borderColor,
  bordered = true,
  testID,
}: Props) {
  const base = tintColor ?? (variant === 'chrome' ? colors.surfaceRaised : colors.surface);
  const edge =
    borderColor ?? (variant === 'chrome' ? colors.glassBorderStrong : colors.glassBorder);

  return (
    <View testID={testID} style={StyleSheet.absoluteFill} pointerEvents="none">
      {variant === 'chrome' ? (
        <BlurView intensity={BLUR_INTENSITY[variant]} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View
        testID={testID ? `${testID}-fill` : undefined}
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(base, FILL_ALPHA[variant]) }]}
      />
      {bordered ? (
        <View style={[StyleSheet.absoluteFill, styles.border, { borderColor: edge }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  border: {
    borderWidth: 1,
  },
});
