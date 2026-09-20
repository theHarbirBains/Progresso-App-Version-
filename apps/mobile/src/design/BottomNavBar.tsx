import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { GlassBackground } from './GlassBackground';
import { Text } from './Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from './theme';

export type BottomNavDestination = 'home' | 'workouts' | 'progress' | 'profile';

interface Props {
  active: BottomNavDestination;
  /** Which mode's tabs to show -- Workouts/Progress in Workout mode, Food/Goals in Nutrition mode. Drives the second and fourth tab's label/icon only; Home and Profile stay the same in both modes. */
  mode: 'workout' | 'nutrition';
  accentColor: string;
  onAccentColor: string;
  onNavigateHome: () => void;
  onNavigateWorkouts: () => void;
  onNavigateProgress: () => void;
  onNavigateProfile: () => void;
  onPressPlus: () => void;
  paddingBottom: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
}

const ACCENT_CROSSFADE_MS = 260;

/**
 * THE bottom navigation -- the only one in the app. Mounted once in App.tsx
 * as a sibling of the whole screen-stack navigator, so it persists across
 * every push/pop and appears on Dashboard too (Dashboard used to render a
 * second, hand-maintained copy; the two are now one system).
 *
 * Normal in-flow layout (not an absolutely-positioned overlay) so the
 * navigator's content area is naturally sized to end above it -- no screen
 * ever needs its own bottom padding to clear it.
 *
 * `mode` and `accentColor` come from the caller (App.tsx derives both from
 * the current route / Dashboard's mode toggle). When the accent changes -- the
 * Workout <-> Nutrition switch -- the centre "+" button crossfades between the
 * two colours over 260ms (instantly under Reduce Motion), which is the one
 * behaviour Dashboard's own copy of the bar had that this one lacked.
 *
 * Navigation UI only: it calls back, it does not navigate. It is not a second
 * navigation system on top of the single stack navigator.
 */
export function BottomNavBar({
  active,
  mode,
  accentColor,
  onAccentColor,
  onNavigateHome,
  onNavigateWorkouts,
  onNavigateProgress,
  onNavigateProfile,
  onPressPlus,
  paddingBottom,
  onLayout,
  testID,
}: Props) {
  const reduceMotion = useReduceMotionPreference();
  const fill = useRef(new Animated.Value(1)).current;
  const shownAccent = useRef(accentColor);
  const [fromAccent, setFromAccent] = useState(accentColor);

  useEffect(() => {
    if (shownAccent.current === accentColor) return;
    setFromAccent(shownAccent.current);
    shownAccent.current = accentColor;
    if (reduceMotion) {
      fill.setValue(1);
      return;
    }
    fill.setValue(0);
    // A colour can't run on the native driver, so this one animation stays on
    // the JS thread -- it is a single 260ms interpolation on one small view.
    Animated.timing(fill, {
      toValue: 1,
      duration: ACCENT_CROSSFADE_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [accentColor, reduceMotion, fill]);

  const centerFill = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [fromAccent, accentColor],
  });

  function itemColor(destination: BottomNavDestination) {
    return destination === active ? accentColor : colors.textSecondary;
  }
  const workoutsLabel = mode === 'workout' ? 'Workouts' : 'Food';
  const workoutsIcon = mode === 'workout' ? 'activity' : 'pie-chart';
  const progressLabel = mode === 'workout' ? 'Progress' : 'Goals';
  const progressIcon = mode === 'workout' ? 'trending-up' : 'target';

  function renderItem(
    destination: BottomNavDestination,
    itemTestID: string,
    label: string,
    icon: keyof typeof Feather.glyphMap,
    onPress: () => void,
  ) {
    const selected = destination === active;
    return (
      <TouchableOpacity
        testID={itemTestID}
        style={styles.item}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        <Feather name={icon} size={22} color={itemColor(destination)} />
        <Text style={[styles.label, { color: itemColor(destination) }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      testID={testID ?? 'bottom-nav-bar'}
      style={[styles.bar, { paddingBottom }]}
      onLayout={onLayout}
      accessibilityRole="tablist"
    >
      <GlassBackground variant="chrome" bordered={false} />
      {renderItem('home', 'bottom-nav-home', 'Home', 'home', onNavigateHome)}
      {renderItem(
        'workouts',
        'bottom-nav-workouts',
        workoutsLabel,
        workoutsIcon,
        onNavigateWorkouts,
      )}

      <TouchableOpacity
        testID="bottom-nav-plus"
        style={styles.center}
        onPress={onPressPlus}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Quick actions"
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: centerFill }]}
        />
        <Feather name="plus" size={22} color={onAccentColor} />
      </TouchableOpacity>

      {renderItem(
        'progress',
        'bottom-nav-progress',
        progressLabel,
        progressIcon,
        onNavigateProgress,
      )}
      {renderItem('profile', 'bottom-nav-profile', 'Profile', 'user', onNavigateProfile)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorderStrong,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  // A comfortable target: at least 56 wide and 48 tall (the 44pt minimum plus
  // room for the label), rather than the ~48x40 hit box the old bar had.
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 56,
    minHeight: minTouchTarget + spacing.xs,
  },
  label: {
    ...typeScale.caption,
  },
  // Sits flush in the row: no negative margin lifting it above the bar (the
  // bar's own overflow: 'hidden' clipped that, which is what the old raised
  // button kept fighting). The circle is the 44pt minimum.
  center: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
