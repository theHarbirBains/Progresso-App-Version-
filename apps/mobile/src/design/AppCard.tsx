import { createContext, useContext, type ReactNode } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassBackground } from './GlassBackground';
import { colors, radii, spacing } from './theme';

export type CardVariant = 'surface' | 'outline';

interface Props {
  children: ReactNode;
  /** Reserved for the single most important card on a screen (e.g. Dashboard's Recent Workout). */
  hero?: boolean;
  /**
   * `surface` (default): the translucent glass card -- for content that is
   * actionable or that genuinely groups related information.
   * `outline`: the same frame with no fill, only a hairline -- for grouped
   * content that shouldn't read as a floating, raised object.
   */
  variant?: CardVariant;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Ignored when there's no `onPress` (a non-pressable card has nothing to announce). Defaults to "button". */
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}

// True for everything rendered inside a card. A card inside a card is the
// "floating rectangles" look this design system exists to avoid, so a nested
// AppCard says so in development (never in tests/production -- it never
// changes rendering, it only points the author at the fix).
const InsideCardContext = createContext(false);

let warnedNested = false;
function warnNestedCard() {
  if (warnedNested || process.env.NODE_ENV === 'test' || !__DEV__) return;
  warnedNested = true;
  console.warn(
    'AppCard rendered inside another AppCard. Group content with spacing, a divider, or a ' +
      'ListRow instead of stacking cards (see DESIGN.md, Cards).',
  );
}

/** Test seam: lets a test re-arm the once-only nested-card warning. */
export function resetNestedCardWarning() {
  warnedNested = false;
}

// The one card treatment (plus the rare hero variant) -- a glass surface
// (see GlassBackground): a translucent tint over whatever the current
// Background Theme/environment is, not an opaque fill. `hero` keeps its own
// accent-adjacent tint/border (surfaceHero/borderHero) so it still reads as
// "the important one", just translucent like every other card rather than a
// flat color block. Use a card where it earns its place -- something the
// user taps, or a set of facts that belong together -- not as the default
// wrapper for every block of content.
export function AppCard({
  children,
  hero,
  variant = 'surface',
  onPress,
  testID,
  style,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: Props) {
  const nested = useContext(InsideCardContext);
  if (nested) warnNestedCard();

  const outline = variant === 'outline';
  const cardStyle = [styles.card, outline && styles.outline, style];
  const tintColor = hero ? colors.surfaceHero : undefined;
  const borderColor = hero ? colors.borderHero : undefined;

  const content = (
    <InsideCardContext.Provider value={true}>
      {outline ? null : <GlassBackground tintColor={tintColor} borderColor={borderColor} />}
      {children}
    </InsideCardContext.Provider>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.8}
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
    // The surface radius (see theme.radii): a card holds controls, so it
    // sits above the control radius.
    borderRadius: radii.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
});
