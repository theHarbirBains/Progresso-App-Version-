import { useMemo, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typeScale } from '../design/theme';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import { PRRow } from './PRRow';
import { ProgressEmptyState } from './ProgressEmptyState';
import { fetchWorkoutIdForSet } from './progressStatsQueries';
import { progressStyles as styles } from './progressStyles';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

interface Props {
  repPRs: RepPRWithExercise[];
  oneRepMaxes: OneRepMaxWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  navigation: Navigation;
}

interface Row {
  key: string;
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number | null;
  achievedAt: string;
  recordType: string;
  sourceSetId: string;
}

// Every personal record Progresso currently tracks: rep-count PRs and true
// 1RMs (both database-maintained, see prSummaryQueries.ts), merged into one
// feed sorted by when they were achieved. The record-type distinction shown
// per row is exactly what the data supports -- nothing invented. Section 12
// (Shareable Progress) lives here, next to the most recent record, reusing
// the existing ShareWorkout flow by resolving a PR's source set back to the
// workout it was achieved in.
export function PRsSection({ repPRs, oneRepMaxes, weightUnit, accentColor, navigation }: Props) {
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const fromPRs: Row[] = repPRs.map((pr) => ({
      key: `pr-${pr.exerciseId}-${pr.reps}`,
      exerciseId: pr.exerciseId,
      exerciseName: pr.exerciseName,
      weightKg: pr.bestWeightKg,
      reps: pr.reps,
      achievedAt: pr.achievedAt,
      recordType: `${pr.reps}-Rep PR`,
      sourceSetId: pr.sourceSetId,
    }));
    const fromOrms: Row[] = oneRepMaxes.map((orm) => ({
      key: `orm-${orm.exerciseId}`,
      exerciseId: orm.exerciseId,
      exerciseName: orm.exerciseName,
      weightKg: orm.weightKg,
      reps: null,
      achievedAt: orm.achievedAt,
      recordType: '1RM',
      sourceSetId: orm.sourceSetId,
    }));
    return [...fromPRs, ...fromOrms].sort(
      (a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime(),
    );
  }, [repPRs, oneRepMaxes]);

  const mostRecent = rows[0] ?? null;

  async function handleShareMostRecent() {
    if (!mostRecent || sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      const workoutId = await fetchWorkoutIdForSet(mostRecent.sourceSetId);
      if (!workoutId) {
        setShareError('That workout is no longer available to share.');
        return;
      }
      navigation.navigate('ShareWorkout', { workoutId });
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to open share');
    } finally {
      setSharing(false);
    }
  }

  if (rows.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-prs-empty"
          title="Your personal records will appear here as you progress."
          icon="award"
        />
      </View>
    );
  }

  return (
    <View style={styles.sectionFill}>
      <Text
        testID="progress-prs-count"
        style={[typeScale.cardTitle, { color: colors.textPrimary, marginBottom: 8 }]}
      >
        {rows.length} {rows.length === 1 ? 'PR' : 'PRs'}
      </Text>
      {shareError ? (
        <Text testID="progress-share-error" style={styles.errorText}>
          {shareError}
        </Text>
      ) : null}
      <TouchableOpacity
        testID="progress-share-recent-pr"
        style={[styles.shareButton, { borderColor: accentColor, marginBottom: 16 }]}
        onPress={handleShareMostRecent}
        disabled={sharing}
        accessibilityRole="button"
      >
        <Feather name="share-2" size={14} color={accentColor} />
        <Text style={[styles.shareButtonText, { color: accentColor }]}>Share Progress</Text>
      </TouchableOpacity>
      <FlatList
        testID="progress-prs-list"
        style={styles.sectionFill}
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => (
          <PRRow
            testID={`progress-pr-row-${item.key}`}
            exerciseName={item.exerciseName}
            weightDisplay={roundWeight(fromKg(item.weightKg, weightUnit))}
            reps={item.reps}
            unit={weightUnit}
            achievedAt={item.achievedAt}
            recordType={item.recordType}
            accentColor={accentColor}
            showDivider={index > 0}
            onPress={() =>
              navigation.navigate('ProgressExerciseDetail', {
                exerciseId: item.exerciseId,
                exerciseName: item.exerciseName,
              })
            }
          />
        )}
      />
    </View>
  );
}
