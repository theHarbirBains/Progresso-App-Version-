import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { Text } from './Text';
import { colors, spacing, typeScale } from './theme';

/** How far the row moves to show its Delete. */
export const SWIPE_ACTION_WIDTH = 88;

interface Props {
  children: ReactNode;
  /** Whether Delete is showing. The list keeps this, so only one row is open at a time. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tapping Delete. It asks first -- nothing is deleted by the swipe alone. */
  onDelete: () => void;
  /** What's deleted, for the action's spoken label ("Delete Chicken Breast"). */
  name: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A row that swipes left to show a quiet destructive Delete behind its right edge -- a trash
 * glyph over "Delete" in the destructive colour, on the row's own surface. Swiping back right
 * closes it, and so do a tap on the row and opening another row. The row follows the finger, then settles open or
 * shut (instantly under Reduce Motion); dragging further than the action gives a little. A
 * swipe isn't something VoiceOver can do, so the row it wraps should offer the same Delete as an
 * accessibility action (ListRow's `accessibilityActions`).
 */
export function SwipeToDelete({
  children,
  open,
  onOpenChange,
  onDelete,
  name,
  style,
  testID,
}: Props) {
  const reduceMotion = useReduceMotionPreference();
  const offset = useRef(new Animated.Value(0)).current;
  const openRef = useRef(open);
  openRef.current = open;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    const toValue = open ? -SWIPE_ACTION_WIDTH : 0;
    if (reduceMotion) {
      offset.setValue(toValue);
      return;
    }
    Animated.spring(offset, { toValue, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
  }, [open, reduceMotion, offset]);

  const pan = useMemo(() => {
    const settle = (shouldOpen: boolean) => {
      const toValue = shouldOpen ? -SWIPE_ACTION_WIDTH : 0;
      if (reduceMotionRef.current) offset.setValue(toValue);
      else
        Animated.spring(offset, {
          toValue,
          useNativeDriver: true,
          bounciness: 0,
          speed: 18,
        }).start();
    };
    const from = () => (openRef.current ? -SWIPE_ACTION_WIDTH : 0);
    return PanResponder.create({
      // A clearly sideways drag -- never a scroll, nor a tap.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_event, gesture) => {
        const x = Math.min(0, from() + gesture.dx);
        offset.setValue(
          x < -SWIPE_ACTION_WIDTH ? -SWIPE_ACTION_WIDTH + (x + SWIPE_ACTION_WIDTH) * 0.3 : x,
        );
      },
      onPanResponderRelease: (_event, gesture) => {
        const x = from() + gesture.dx;
        const shouldOpen = gesture.vx < -0.3 || (gesture.vx <= 0.3 && x < -SWIPE_ACTION_WIDTH / 2);
        if (shouldOpen === openRef.current) settle(shouldOpen);
        else onOpenChangeRef.current(shouldOpen);
      },
      onPanResponderTerminate: () => settle(openRef.current),
    });
  }, [offset]);

  // Delete shows as the row moves away from it, so nothing sits behind a row at rest.
  const actionOpacity = offset.interpolate({
    inputRange: [-SWIPE_ACTION_WIDTH, -16, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  return (
    <View testID={testID} style={[styles.frame, style]}>
      <Animated.View
        style={[styles.actionWell, { opacity: actionOpacity }]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Pressable
          testID={testID ? `${testID}-delete` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${name}`}
          onPress={onDelete}
          style={styles.action}
        >
          <Feather name="trash-2" size={18} color={colors.destructive} />
          <Text style={styles.actionLabel}>Delete</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: offset }] }} {...pan.panHandlers}>
        {children}
        {/* While open, a tap on the row closes it rather than doing what the row does. */}
        {open ? (
          <Pressable
            testID={testID ? `${testID}-close` : undefined}
            style={StyleSheet.absoluteFill}
            onPress={() => onOpenChange(false)}
            accessible={false}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  actionWell: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SWIPE_ACTION_WIDTH,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionLabel: {
    ...typeScale.caption,
    color: colors.destructive,
  },
});
