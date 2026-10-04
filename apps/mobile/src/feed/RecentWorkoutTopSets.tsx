import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { formatWeightKg } from '../lib/units';
import type { WorkoutTopSet } from '../workouts/recentWorkoutTopSets';

const AUTO_ADVANCE_MS = 3500;
const PHOTO_SIZE = 56;

interface Props {
  topSets: WorkoutTopSet[];
  weightUnit: 'kg' | 'lb';
  testID?: string;
}

// A swipeable, self-advancing "Top Sets" strip for the most recent workout on
// Feed: one slide per exercise with a real top set, paged by swipe, moving on
// by itself every few seconds (held still while the user is dragging, and not
// animated when Reduce Motion is on), with a quiet pagination indicator. Only
// the exercise name and its top-set readout are the visual focus. When an
// exercise has a machine photo it sits beside its readout, and tapping it opens
// the full-size picture (ExercisePhoto's zoom) -- the same for everyone's cards.
export function RecentWorkoutTopSets({ topSets, weightUnit, testID }: Props) {
  const reduceMotion = useReduceMotionPreference();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const draggingRef = useRef(false);
  const count = topSets.length;

  function goTo(next: number) {
    indexRef.current = next;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: !reduceMotion });
  }

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      if (draggingRef.current) return;
      goTo((indexRef.current + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
    // goTo reads width/reduceMotion via closure; restart the timer if either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, width, reduceMotion]);

  if (count === 0) {
    return (
      <View testID={testID} style={styles.wrap}>
        <Text style={styles.heading}>Top Sets</Text>
        <Text testID={testID ? `${testID}-empty` : undefined} style={styles.empty}>
          No top sets logged in this workout
        </Text>
      </View>
    );
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    draggingRef.current = false;
    if (width === 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    indexRef.current = next;
    setIndex(next);
  }

  return (
    <View testID={testID} style={styles.wrap}>
      <Text style={styles.heading}>Top Sets</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
        }}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {topSets.map((topSet) => (
          <View
            key={topSet.exerciseId}
            testID={testID ? `${testID}-slide-${topSet.exerciseId}` : undefined}
            style={[styles.slide, { width: width || undefined }]}
          >
            {topSet.photoUrl ? (
              <ExercisePhoto
                testID={testID ? `${testID}-photo-${topSet.exerciseId}` : undefined}
                uri={topSet.photoUrl}
                name={topSet.exerciseName}
                size={PHOTO_SIZE}
              />
            ) : null}
            <View style={styles.slideText}>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {topSet.exerciseName}
              </Text>
              <Text style={styles.topSetValue}>
                {`${formatWeightKg(topSet.weightKg, weightUnit)} ${weightUnit} × ${topSet.reps}`}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      {count > 1 ? (
        <View style={styles.dots}>
          {topSets.map((topSet, i) => (
            <View
              key={topSet.exerciseId}
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
  wrap: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  heading: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  slide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  slideText: {
    flex: 1,
    gap: spacing.xs,
  },
  exerciseName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  topSetValue: {
    ...typeScale.statMedium,
    color: colors.textPrimary,
  },
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
