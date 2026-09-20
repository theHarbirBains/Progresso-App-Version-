import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { colors, radii, spacing } from './theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// A placeholder block for content that is loading. It exists so a screen can
// keep its own layout while data arrives (no jump when the real content
// lands) instead of replacing everything with a centred spinner. The pulse is
// a slow opacity fade on the native driver, and disappears entirely -- a
// static block -- under Reduce Motion.
export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.sm,
  style,
  testID,
}: SkeletonProps) {
  const reduceMotion = useReduceMotionPreference();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View
      testID={testID}
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceRaised, opacity },
        style,
      ]}
    />
  );
}

interface SkeletonRowsProps {
  count?: number;
  testID?: string;
}

// The loading stand-in for a ListRow group: an icon well plus two text lines
// per row, at ListRow's own height, so the swap to real rows doesn't shift
// the layout.
export function SkeletonRows({ count = 4, testID }: SkeletonRowsProps) {
  return (
    <View
      testID={testID}
      // One announcement for the whole placeholder, not one per block.
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={styles.rows}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={36} height={36} radius={radii.md} />
          <View style={styles.lines}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  lines: {
    flex: 1,
    gap: spacing.xs + 2,
  },
});
