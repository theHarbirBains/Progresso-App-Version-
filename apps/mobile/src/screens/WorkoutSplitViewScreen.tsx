import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppCard } from '../design/AppCard';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { colors } from '../design/theme';
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
export function WorkoutSplitViewScreen({ navigation, route }: Props) {
  const { splitId } = route.params;
  const { theme, themeLoading } = useProgressTheme();
  const insets = useSafeAreaInsets();

  const [detail, setDetail] = useState<WorkoutSplitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchWorkoutSplitDetail(splitId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout split');
    } finally {
      setLoading(false);
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} testID="workout-split-view-scroll">
        <View style={styles.header}>
          <TouchableOpacity
            testID="workout-split-view-back"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {detail?.name ?? 'Workout Split'}
          </Text>
          {detail ? (
            <TouchableOpacity
              testID="workout-split-view-edit"
              style={styles.backButton}
              onPress={() => navigation.navigate('WorkoutSplitForm', { splitId: detail.id })}
              accessibilityLabel="Edit split"
              accessibilityRole="button"
            >
              <Feather name="edit-2" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? (
          <Text testID="workout-split-view-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {detail && detail.days.length === 0 ? (
          <EmptyState
            testID="workout-split-view-empty"
            title="This split has no days yet."
            icon={<Feather name="calendar" size={24} color={colors.textMuted} />}
          />
        ) : null}

        {detail?.days.map((day) => (
          <AppCard key={day.id} testID={`workout-split-view-day-${day.id}`} style={styles.dayCard}>
            <Text style={styles.dayName}>{day.name}</Text>
            {day.muscleGroups.length > 0 ? (
              <View style={styles.muscleChipRow}>
                {day.muscleGroups.map((group) => (
                  <View
                    key={group}
                    testID={`workout-split-view-day-${day.id}-muscle-${group}`}
                    style={[
                      styles.muscleChip,
                      { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                  >
                    <Text style={[styles.muscleChipText, { color: theme.onAccent }]}>
                      {SPLIT_MUSCLE_GROUP_LABELS[group]}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text testID={`workout-split-view-day-${day.id}-no-groups`} style={styles.splitMeta}>
                No muscle groups set
              </Text>
            )}
          </AppCard>
        ))}
      </ScrollView>
    </View>
  );
}
