import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useScreenFocused } from '../navigation/useScreenFocused';
import { colors, spacing } from './theme';

export const AUTO_ADVANCE_MS = 3500;

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  renderSlide: (item: T, index: number) => ReactNode;
  /** The slide it opens on (the first by default). */
  initialIndex?: number;
  /** Slides are `${testID}-slide-${key}`, the dots `${testID}-dot-${index}`. */
  testID?: string;
}

/**
 * A swipeable strip of slides that also moves on by itself: one slide in view at a time, paged
 * by swipe, advancing every few seconds and wrapping back to the first. It holds still while
 * the person is dragging and while its page isn't the one in view, and under Reduce Motion it
 * jumps rather than slides. A quiet row of dots says which slide is showing. One slide shows
 * on its own, with no dots and no advancing. Feed's Top Sets and the live workout's Last Time
 * both use it, so they move the same way.
 */
export function AutoCarousel<T>({ items, keyOf, renderSlide, initialIndex = 0, testID }: Props<T>) {
  const reduceMotion = useReduceMotionPreference();
  // Nobody sees it advance while another page is open on top of this one.
  const inView = useScreenFocused();
  const [width, setWidth] = useState(0);
  const start = initialIndex > 0 && initialIndex < items.length ? initialIndex : 0;
  const [index, setIndex] = useState(start);
  const indexRef = useRef(start);
  const scrollRef = useRef<ScrollView>(null);
  const draggingRef = useRef(false);
  const count = items.length;

  function goTo(next: number) {
    indexRef.current = next;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: !reduceMotion });
  }

  useEffect(() => {
    if (count < 2 || !inView) return;
    const id = setInterval(() => {
      if (draggingRef.current) return;
      goTo((indexRef.current + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
    // goTo reads width/reduceMotion via closure; restart the timer if either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, width, reduceMotion, inView]);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    draggingRef.current = false;
    if (width === 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    indexRef.current = next;
    setIndex(next);
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          // Once its width is known, it moves to the slide it opens on.
          if (width === 0 && indexRef.current > 0) {
            scrollRef.current?.scrollTo({ x: indexRef.current * next, animated: false });
          }
          setWidth(next);
        }}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
        }}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {items.map((item, i) => (
          <View
            key={keyOf(item)}
            testID={testID ? `${testID}-slide-${keyOf(item)}` : undefined}
            style={{ width: width || undefined }}
          >
            {renderSlide(item, i)}
          </View>
        ))}
      </ScrollView>
      {count > 1 ? (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View
              key={keyOf(item)}
              testID={testID ? `${testID}-dot-${i}` : undefined}
              accessibilityState={{ selected: i === index }}
              style={[styles.dot, i === index ? styles.dotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  dotActive: {
    backgroundColor: colors.textPrimary,
  },
});
