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
import { GlassBackground } from './GlassBackground';
import { colors, radii, spacing } from './theme';

interface Props {
  children: ReactNode;
  /** Reserved for the single most important card on a screen (e.g. Dashboard's Recent Workout). */
  hero?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Ignored when there's no `onPress` (a non-pressable card has nothing to announce). Defaults to "button". */
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}

// The one card treatment (plus the rare hero variant) -- now a glass
// surface (see GlassBackground): a translucent tint over whatever the
// current Background Theme/environment is, not an opaque fill. `hero`
// keeps its own accent-adjacent tint/border (surfaceHero/borderHero) so it
// still reads as "the important one", just translucent like every other
// card rather than a flat color block.
export function AppCard({
  children,
  hero,
  onPress,
  testID,
  style,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: Props) {
  const cardStyle = [styles.card, style];
  const tintColor = hero ? colors.surfaceHero : undefined;
  const borderColor = hero ? colors.borderHero : undefined;

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
        <GlassBackground tintColor={tintColor} borderColor={borderColor} />
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      <GlassBackground tintColor={tintColor} borderColor={borderColor} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    padding: spacing.lg,
    overflow: 'hidden',
  },
});
