import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { withAlpha } from '../theme/accentColor';
import { colors, radii, spacing } from './theme';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  children: ReactNode;
  onPress: () => void;
  /** Whether it's the chosen one of a set. Leave it out for a tile that opens something instead. */
  selected?: boolean;
  accentColor?: string;
  onAccentColor?: string;
  accessibilityLabel: string;
  testID?: string;
  /** Sizes the tile in its row (`flex: 1` for a grid cell). */
  style?: StyleProp<ViewStyle>;
}

// Pressed in, the tile gives a little; chosen, it pops back with a slight bounce.
const PRESS_SCALE = 0.96;
const PRESS_SPRING = { stiffness: 320, damping: 20, mass: 1 } as const;
const POP_FROM = 0.94;
const POP_SPRING = { stiffness: 240, damping: 12, mass: 1 } as const;
const CHOOSE_MS = 180;

/**
 * A raised tile that is one choice of a set (an estimate, a sex) or opens a picker (a height).
 * Chosen, an accent edge and tint fade in over it and a check appears in its corner, with a
 * small spring "pop"; pressed, it gives a little. Every motion runs on the native driver. Under
 * Reduce Motion it simply changes.
 */
export function ChoiceTile({
  children,
  onPress,
  selected,
  accentColor: accentColorProp,
  onAccentColor: onAccentColorProp,
  accessibilityLabel,
  testID,
  style,
}: Props) {
  // Unless told otherwise, the app theme's accent and the ink that reads on it.
  const themeAccent = useAppTheme().accent;
  const accentColor = accentColorProp ?? themeAccent.accent;
  const onAccentColor = onAccentColorProp ?? themeAccent.onAccent;
  const reduceMotion = useReduceMotionPreference();
  const scale = useRef(new Animated.Value(1)).current;
  const chosen = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const wasSelected = useRef(selected);

  useEffect(() => {
    const target = selected ? 1 : 0;
    const becameSelected = Boolean(selected) && !wasSelected.current;
    wasSelected.current = selected;
    if (reduceMotion) {
      chosen.setValue(target);
      return undefined;
    }
    const animations = [
      Animated.timing(chosen, { toValue: target, duration: CHOOSE_MS, useNativeDriver: true }),
    ];
    if (becameSelected) {
      scale.setValue(POP_FROM);
      animations.push(Animated.spring(scale, { toValue: 1, ...POP_SPRING, useNativeDriver: true }));
    }
    const animation = Animated.parallel(animations);
    animation.start();
    return () => animation.stop();
  }, [selected, reduceMotion, chosen, scale]);

  function pressTo(value: number) {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: value, ...PRESS_SPRING, useNativeDriver: true }).start();
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => pressTo(PRESS_SCALE)}
      onPressOut={() => pressTo(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={style}
    >
      <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>
        {selected !== undefined ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.chosen,
              {
                borderColor: accentColor,
                backgroundColor: withAlpha(accentColor, 0.14),
                opacity: chosen,
              },
            ]}
          />
        ) : null}
        {children}
        {selected !== undefined ? (
          <Animated.View
            style={[
              styles.check,
              {
                backgroundColor: accentColor,
                opacity: chosen,
                transform: [
                  { scale: chosen.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                ],
              },
            ]}
          >
            <Feather name="check" size={11} color={onAccentColor} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLift,
    padding: spacing.md,
  },
  // The chosen look, faded in over the tile's own edge and fill.
  chosen: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  check: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
