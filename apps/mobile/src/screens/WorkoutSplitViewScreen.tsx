import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { fetchWorkoutSplitDetail, type WorkoutSplitDetail } from '../workouts/workoutSplitQueries';
import { workoutSplitStyles as styles } from './workoutSplitStyles';

type Props = RootStackScreenProps<'WorkoutSplitView'>;

// Read-only presentation of a split's days/muscle groups -- reached by
// tapping a split in WorkoutSplitsScreen. Deliberately not the same screen
// as WorkoutSplitFormScreen: that screen auto-saves every change
// immediately, so simply wanting to look at a split's structure shouldn't
// risk editing it. Editing is one explicit tap away via the header button.
//
// Layout: the days are plain blocks (name, then its muscle groups as one
// line of text) separated by hairlines. Muscle groups here are information,
// not controls, so they are not chips or badges.
export function WorkoutSplitViewScreen({ navigation, route }: Props) {
  const { splitId } = route.params;
  const { themeLoading } = useProgressTheme();

  const [detail, setDetail] = useState<WorkoutSplitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the very first load for this splitId should replace the whole
  // screen with a spinner -- every later call (the focus listener below) is
  // a background refresh, same pattern as DashboardScreen/ProfileScreen.
  const hasLoadedOnce = useRef(false);
  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [splitId]);

  const load = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      setDetail(await fetchWorkoutSplitDetail(splitId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout split');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [splitId]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  if (loading || themeLoading) {
    return <LoadingState testID="workout-split-view-loading" />;
  }

  return (
    <Screen
      scrollTestID="workout-split-view-scroll"
      header={
        <AppHeader
          title={detail?.name ?? 'Workout Split'}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'workout-split-view-back',
          }}
          rightAction={
            detail
              ? {
                  icon: 'edit-2',
                  onPress: () => navigation.navigate('WorkoutSplitForm', { splitId: detail.id }),
                  accessibilityLabel: 'Edit split',
                  testID: 'workout-split-view-edit',
                }
              : undefined
          }
        />
      }
    >
      {error ? (
        <Text testID="workout-split-view-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      {detail && detail.days.length === 0 ? (
        <EmptyState testID="workout-split-view-empty" title="This split has no days yet." />
      ) : null}

      {detail?.days.map((day, index) => (
        <View
          key={day.id}
          testID={`workout-split-view-day-${day.id}`}
          style={[styles.dayBlock, index > 0 && styles.dayDivider]}
        >
          <Text style={styles.dayName}>{day.name}</Text>
          {day.muscleGroups.length > 0 ? (
            <View style={styles.muscleLine}>
              {day.muscleGroups.map((group, groupIndex) => (
                <Fragment key={group}>
                  {groupIndex > 0 ? <Text style={styles.muscleSeparator}>·</Text> : null}
                  <Text
                    testID={`workout-split-view-day-${day.id}-muscle-${group}`}
                    style={styles.muscleLabel}
                  >
                    {SPLIT_MUSCLE_GROUP_LABELS[group]}
                  </Text>
                </Fragment>
              ))}
            </View>
          ) : (
            <Text testID={`workout-split-view-day-${day.id}-no-groups`} style={styles.noGroups}>
              No muscle groups set
            </Text>
          )}
        </View>
      ))}
    </Screen>
  );
}
