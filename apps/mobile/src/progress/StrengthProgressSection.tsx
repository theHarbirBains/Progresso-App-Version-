import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { TextInput } from '../design/TextInput';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import { MOVEMENT_TYPE_LABELS, type MovementType } from '../exercises/movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { fromKg, roundWeight, formatWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type {
  ExerciseHistoryGroup,
  HistoricalSetWithExercise,
} from '../workouts/allExerciseHistoryQueries';
import { type TimeRange } from '../workouts/exerciseProgress';
import { ChartPointDetail } from './ChartPointDetail';
import { ProgressEmptyState } from './ProgressEmptyState';
import { ProgressionChart } from './ProgressionChart';
import { progressStyles as styles } from './progressStyles';
import { computeStrengthProgress, PROGRESS_LEVEL_LABELS } from './strengthProgress';
import { StrengthProgressRow } from './StrengthProgressRow';
import { TimeRangeSelector } from './TimeRangeSelector';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

interface Props {
  history: HistoricalSetWithExercise[];
  groups: ExerciseHistoryGroup[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onAccentColor: string;
  navigation: Navigation;
}

/**
 * Strength Progress: which exercises are genuinely getting stronger, not
 * just "did the number go up." Built entirely on data/derivations that
 * already existed -- topSetProgressionDetailed/summarizeProgress/
 * filterByTimeRange (workouts/exerciseProgress.ts, the same ones
 * ProgressExerciseDetailScreen already uses) and TOP_SET_MIN_REPS (the same
 * qualifying threshold the Top Sets tab uses) -- see strengthProgress.ts for
 * the one new piece, classifying a real gain as "significant" vs
 * "progressing" rather than treating every improvement the same way. The
 * featured card always shows the single most notable qualifying exercise
 * (significant first, then largest gain); every other qualifying exercise
 * is listed below and opens the existing per-exercise detail screen on
 * press -- the same drill-down every other Progress tab already uses, not
 * a new route.
 */
export function StrengthProgressSection({
  history,
  groups,
  weightUnit,
  accentColor,
  onAccentColor,
  navigation,
}: Props) {
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [range, setRange] = useState<TimeRange>('4w');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // Muscle group / movement type don't survive groupByExercise's own
  // per-set shape (see exerciseHistoryGrouping.ts) -- both are constant per
  // exercise, so this is a one-pass lookup over the same `history` every
  // other Progress section already has, not a second query.
  const infoByExercise = useMemo(() => {
    const map = new Map<string, { muscleGroup: MuscleGroup; movementType: MovementType }>();
    for (const s of history) {
      if (!map.has(s.exerciseId)) {
        map.set(s.exerciseId, { muscleGroup: s.muscleGroup, movementType: s.movementType });
      }
    }
    return map;
  }, [history]);

  const progressByExercise = useMemo(() => {
    return groups.map((g) => {
      const info = infoByExercise.get(g.exerciseId);
      const progress = computeStrengthProgress(g.sets, range);
      return {
        exerciseId: g.exerciseId,
        exerciseName: g.exerciseName,
        muscleGroup: info?.muscleGroup ?? ('other' as MuscleGroup),
        movementType: info?.movementType ?? ('bilateral' as MovementType),
        ...progress,
      };
    });
  }, [groups, infoByExercise, range]);

  const anyMeaningfulProgressEver = useMemo(
    () => progressByExercise.some((p) => p.level !== 'none'),
    [progressByExercise],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return progressByExercise.filter((p) => {
      if (muscleGroup && p.muscleGroup !== muscleGroup) return false;
      if (query && !p.exerciseName.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [progressByExercise, search, muscleGroup]);

  const meaningful = useMemo(
    () =>
      [...filtered]
        .filter((p) => p.level !== 'none')
        .sort((a, b) => {
          if (a.level !== b.level) return a.level === 'significant' ? -1 : 1;
          return (b.summary?.deltaKg ?? 0) - (a.summary?.deltaKg ?? 0);
        }),
    [filtered],
  );

  const featured = meaningful[0] ?? null;
  const otherRows = meaningful.slice(1);

  const chartPoints = useMemo(
    () =>
      featured
        ? featured.points.map((p) => ({
            x: new Date(p.performedAt).getTime(),
            y: roundWeight(fromKg(p.weightKg, weightUnit)),
          }))
        : [],
    [featured, weightUnit],
  );

  function openExercise(exerciseId: string, exerciseName: string) {
    navigation.navigate('ProgressExerciseDetail', { exerciseId, exerciseName });
  }

  if (groups.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-strength-empty"
          title="Log a workout to start tracking your strength."
          icon="trending-up"
        />
      </View>
    );
  }

  if (!anyMeaningfulProgressEver) {
    return (
      <View style={styles.sectionFill}>
        <Text style={styles.topSetsSectionTitle}>Strength Progress</Text>
        <Text style={styles.topSetsSectionSubtitle}>Track meaningful progress over time.</Text>
        <ProgressEmptyState
          testID="progress-strength-empty"
          title="Keep training consistently to see meaningful strength progress."
          icon="trending-up"
        />
      </View>
    );
  }

  const selectedDetail =
    featured && selectedPointIndex !== null ? featured.points[selectedPointIndex] : null;
  const previousDetail =
    featured && selectedPointIndex !== null && selectedPointIndex > 0
      ? featured.points[selectedPointIndex - 1]
      : null;

  return (
    <ScrollView
      testID="progress-strength-scroll"
      style={styles.sectionFill}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.topSetsSectionTitle}>Strength Progress</Text>
      <Text style={styles.topSetsSectionSubtitle}>Track meaningful progress over time.</Text>

      <View style={styles.searchWrap}>
        <TextInput
          testID="progress-strength-search"
          placeholder="Search exercises..."
          accessibilityLabel="Search exercises"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterGroup}>
        <View testID="progress-strength-muscle-group-wrap">
          <Text style={styles.filterLabel}>Muscle Group</Text>
          <MuscleGroupChips
            value={muscleGroup}
            onChange={setMuscleGroup}
            includeAll
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>

        <View>
          <Text style={styles.filterLabel}>Time Range</Text>
          <TimeRangeSelector
            value={range}
            onChange={setRange}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
        </View>
      </View>

      {featured && featured.summary ? (
        <>
          <View testID="progress-strength-card" style={styles.strengthCard}>
            <Text style={styles.strengthCardName}>{featured.exerciseName}</Text>
            <View style={styles.strengthTagsRow}>
              <View style={styles.strengthTag}>
                <Text style={styles.strengthTagText}>
                  {MUSCLE_GROUP_LABELS[featured.muscleGroup]}
                </Text>
              </View>
              <View style={styles.strengthTag}>
                <Text style={styles.strengthTagText}>
                  {MOVEMENT_TYPE_LABELS[featured.movementType]}
                </Text>
              </View>
            </View>

            <View style={styles.strengthPerfGrid}>
              <View>
                <Text style={styles.strengthPerfLabel}>Starting Performance</Text>
                <Text testID="progress-strength-starting" style={styles.strengthPerfValue}>
                  {formatWeight(roundWeight(fromKg(featured.points[0].weightKg, weightUnit)))}
                  {weightUnit} × {featured.points[0].reps}
                </Text>
              </View>
              <View>
                <Text style={styles.strengthPerfLabel}>Latest Performance</Text>
                <Text testID="progress-strength-latest" style={styles.strengthPerfValue}>
                  {formatWeight(
                    roundWeight(
                      fromKg(featured.points[featured.points.length - 1].weightKg, weightUnit),
                    ),
                  )}
                  {weightUnit} × {featured.points[featured.points.length - 1].reps}
                </Text>
              </View>
            </View>

            <View style={styles.strengthDeltaRow}>
              <Text
                testID="progress-strength-delta"
                style={[styles.strengthDeltaValue, { color: accentColor }]}
              >
                +{formatWeight(roundWeight(fromKg(featured.summary.deltaKg, weightUnit)))}
                {weightUnit}
              </Text>
              <View
                style={[
                  styles.strengthLevelBadge,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: accentColor,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  testID="progress-strength-level"
                  style={[styles.strengthLevelBadgeText, { color: accentColor }]}
                >
                  {featured.level !== 'none' ? PROGRESS_LEVEL_LABELS[featured.level] : ''}
                </Text>
              </View>
            </View>

            <ProgressionChart
              testID="progress-strength-chart"
              points={chartPoints}
              color={accentColor}
              selectedIndex={selectedPointIndex}
              onSelectIndex={setSelectedPointIndex}
              accessibilityLabelForPoint={(i) =>
                `${formatWeight(roundWeight(fromKg(featured.points[i].weightKg, weightUnit)))}${weightUnit} times ${featured.points[i].reps} on ${new Date(featured.points[i].performedAt).toLocaleDateString()}`
              }
            />
          </View>

          {selectedDetail ? (
            <ChartPointDetail
              testID="progress-strength-point-detail"
              accentColor={accentColor}
              onDismiss={() => setSelectedPointIndex(null)}
              data={{
                exerciseName: featured.exerciseName,
                weightDisplay: roundWeight(fromKg(selectedDetail.weightKg, weightUnit)),
                reps: selectedDetail.reps,
                performedAt: selectedDetail.performedAt,
                unit: weightUnit,
                volumeDisplay: roundWeight(
                  fromKg(selectedDetail.weightKg, weightUnit) * selectedDetail.reps,
                ),
                previous: previousDetail
                  ? {
                      weightDisplay: roundWeight(fromKg(previousDetail.weightKg, weightUnit)),
                      reps: previousDetail.reps,
                    }
                  : null,
                trueOneRepMaxDisplay:
                  selectedDetail.reps === 1
                    ? roundWeight(fromKg(selectedDetail.weightKg, weightUnit))
                    : null,
              }}
            />
          ) : null}
        </>
      ) : null}

      {otherRows.length > 0 ? (
        <View style={styles.section}>
          {otherRows.map((row, index) =>
            row.summary && row.level !== 'none' ? (
              <StrengthProgressRow
                key={row.exerciseId}
                testID={`progress-strength-row-${row.exerciseId}`}
                exerciseName={row.exerciseName}
                muscleGroupLabel={MUSCLE_GROUP_LABELS[row.muscleGroup]}
                deltaDisplay={roundWeight(fromKg(row.summary.deltaKg, weightUnit))}
                unit={weightUnit}
                level={row.level}
                accentColor={accentColor}
                showDivider={index > 0}
                onPress={() => openExercise(row.exerciseId, row.exerciseName)}
              />
            ) : null,
          )}
        </View>
      ) : null}

      {meaningful.length === 0 && filtered.length !== progressByExercise.length ? (
        <ProgressEmptyState testID="progress-strength-no-results" title="No matching exercises" />
      ) : null}
    </ScrollView>
  );
}
