import { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { ErrorState } from '../design/ErrorState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonCards } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { machineLine } from '../exercises/machineDetails';
import { getPersonExercise, type PersonExercise } from '../lib/api';
import { formatDuration } from '../lib/duration';
import { formatWeightKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { setText } from '../social/setText';
import { formatCardDate } from '../workouts/workoutFormat';
import { personExerciseStyles as styles } from './personExerciseStyles';

type Props = RootStackScreenProps<'PersonExercise'>;

/** A record's row: what it is, its figure in the accent, and when. */
function RecordRow({
  label,
  value,
  date,
  accent,
  divider,
  testID,
}: {
  label: string;
  value: string;
  date: string;
  accent: string;
  divider: boolean;
  testID: string;
}) {
  return (
    <View testID={testID} style={[styles.row, divider && styles.rowDivider]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDate}>{formatCardDate(date)}</Text>
      </View>
      <Text style={[styles.rowValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

/**
 * One exercise of someone's -- a friend's, or yours -- from their profile's PRs: the machine
 * (photo, gym, grip), every record they hold on it (each rep-count PR and a true 1RM for weights,
 * most reps for bodyweight, longest for timed), and its top set from each workout, newest first,
 * each opening that workout. Read every time it opens, through the API, which shows only what
 * their followers can see.
 */
export function PersonExerciseScreen({ route, navigation }: Props) {
  const { userId, exerciseId, name } = route.params;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const isSelf = user?.id === userId;
  const { theme, weightUnit } = useProgressTheme();

  const [data, setData] = useState<PersonExercise | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setData(await getPersonExercise(accessToken, userId, exerciseId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this exercise');
    }
  }, [accessToken, userId, exerciseId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  const title = data?.exercise.exerciseName ?? name ?? 'Exercise';

  function renderRecords(exercise: PersonExercise) {
    const type = exercise.exercise.measurementType;
    const rows: { key: string; label: string; value: string; date: string }[] = [];
    if (exercise.oneRepMax) {
      rows.push({
        key: 'max',
        label: 'True 1RM',
        value: `${formatWeightKg(exercise.oneRepMax.weightKg, weightUnit)} ${weightUnit}`,
        date: exercise.oneRepMax.achievedAt,
      });
    }
    for (const pr of exercise.repPRs) {
      rows.push({
        key: `rep-${pr.reps}`,
        label: `${pr.reps} reps`,
        value: `${formatWeightKg(pr.weightKg, weightUnit)} ${weightUnit}`,
        date: pr.achievedAt,
      });
    }
    if (exercise.mostReps && type === 'bodyweight') {
      rows.push({
        key: 'most-reps',
        label: 'Most Reps',
        value: `${exercise.mostReps.reps} reps`,
        date: exercise.mostReps.achievedAt,
      });
    }
    if (exercise.longest && type === 'timed') {
      rows.push({
        key: 'longest',
        label: 'Longest',
        value: formatDuration(exercise.longest.durationSeconds),
        date: exercise.longest.achievedAt,
      });
    }
    return (
      <AppCard testID="person-exercise-records">
        <SectionHeader label={type === 'weight_reps' ? 'Records' : 'Record'} />
        {rows.length === 0 ? (
          <Text style={styles.empty}>No records on this one yet.</Text>
        ) : (
          rows.map((row, index) => (
            <RecordRow
              key={row.key}
              testID={`person-exercise-record-${row.key}`}
              label={row.label}
              value={row.value}
              date={row.date}
              accent={theme.accent}
              divider={index > 0}
            />
          ))
        )}
      </AppCard>
    );
  }

  return (
    <Screen
      scrollTestID="person-exercise-scroll"
      contentContainerStyle={styles.content}
      header={<AppHeader title={title} onBack={() => navigation.goBack()} />}
    >
      {error && !data ? (
        <ErrorState testID="person-exercise-error" message={error} onRetry={() => void load()} />
      ) : !data ? (
        <SkeletonCards testID="person-exercise-loading" heights={[96, 160, 220]} />
      ) : (
        <>
          <AppCard testID="person-exercise-summary">
            <View style={styles.summary}>
              <ExercisePhoto
                testID="person-exercise-photo"
                uri={data.exercise.photoUrl}
                name={data.exercise.exerciseName}
                size={56}
              />
              <View style={styles.summaryText}>
                <Text style={styles.name} accessibilityRole="header">
                  {data.exercise.exerciseName}
                </Text>
                {machineLine(data.exercise) ? (
                  <Text style={styles.machine}>{machineLine(data.exercise)}</Text>
                ) : null}
                <Text style={styles.count}>
                  Done in {data.topSets.length}
                  {data.topSets.length === 100 ? '+' : ''}{' '}
                  {data.topSets.length === 1 ? 'workout' : 'workouts'}
                </Text>
              </View>
            </View>
          </AppCard>

          {renderRecords(data)}

          <AppCard testID="person-exercise-top-sets">
            <SectionHeader label="Top Sets" />
            {data.topSets.map((set, index) => (
              <TouchableOpacity
                key={set.workoutId}
                testID={`person-exercise-top-set-${set.workoutId}`}
                style={[styles.row, index > 0 && styles.rowDivider]}
                onPress={() =>
                  navigation.navigate('WorkoutDetail', {
                    workoutId: set.workoutId,
                    ...(isSelf ? {} : { authorId: userId }),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${formatCardDate(set.performedAt)}: ${setText(
                  set,
                  data.exercise.measurementType,
                  weightUnit,
                )}. Open the workout`}
              >
                <Text style={styles.rowLabel}>{formatCardDate(set.performedAt)}</Text>
                <Text style={[styles.rowValue, { color: theme.accent }]}>
                  {setText(set, data.exercise.measurementType, weightUnit)}
                </Text>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </AppCard>
        </>
      )}
    </Screen>
  );
}
