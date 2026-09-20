import { useMemo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { fromKg, roundWeight } from '../lib/units';
import { withAlpha } from '../theme/accentColor';
import type { RootStackScreenProps } from '../navigation/types';
import type {
  ExerciseHistoryGroup,
  HistoricalSetWithExercise,
} from '../workouts/allExerciseHistoryQueries';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import type { WorkoutSummary } from '../workouts/workoutQueries';
import { computeLifetimeMilestones } from './allTimeMilestones';
import { computeLifetimeVolumeKg, rankExercisesByVolume } from './lifetimeStats';
import type { LifetimeStats } from './lifetimeStats';
import { computeMuscleGroupVolumeKg } from './muscleGroupProgress';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';
import { computeTopSets } from './topSets';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

const TOP_RECORDS_LIMIT = 4;
const TOP_EXERCISES_LIMIT = 5;

interface Props {
  groups: ExerciseHistoryGroup[];
  history: HistoricalSetWithExercise[];
  completedWorkouts: WorkoutSummary[];
  lifetimeStats: LifetimeStats;
  totalCompletedSets: number;
  totalPRs: number;
  repPRs: RepPRWithExercise[];
  oneRepMaxes: OneRepMaxWithExercise[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  navigation: Navigation;
}

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  const value = roundWeight(fromKg(kg, unit));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatVolume(kg: number, unit: 'kg' | 'lb'): string {
  const value = Math.round(fromKg(kg, unit));
  return value.toLocaleString();
}

function formatMilestoneDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function AllTimeStat({
  icon,
  value,
  label,
  accentColor,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  label: string;
  accentColor: string;
  testID: string;
}) {
  return (
    <AppCard testID={testID} style={styles.allTimeStatCard}>
      <View style={[styles.allTimeStatIcon, { backgroundColor: withAlpha(accentColor, 0.14) }]}>
        <Feather name={icon} size={16} color={accentColor} />
      </View>
      <Text style={styles.allTimeStatValue}>{value}</Text>
      <Text style={styles.allTimeStatLabel}>{label}</Text>
    </AppCard>
  );
}

// The fourth Progress tab: a lifetime, all-time-only view built entirely
// from data every other Progress section already fetches/derives (real
// workout history, real PRs, real per-exercise/muscle-group aggregation) --
// no new query, no fabricated numbers. See progress-relative-strength's own
// comment below for why that one section deliberately shows no numbers yet.
export function AllTimeSection({
  groups,
  history,
  completedWorkouts,
  lifetimeStats,
  totalCompletedSets,
  totalPRs,
  repPRs,
  oneRepMaxes,
  weightUnit,
  accentColor,
  navigation,
}: Props) {
  const totalVolumeKg = useMemo(() => computeLifetimeVolumeKg(history), [history]);
  const topRecords = useMemo(
    () =>
      [...computeTopSets(history)]
        .sort((a, b) => b.weightKg - a.weightKg)
        .slice(0, TOP_RECORDS_LIMIT),
    [history],
  );
  const muscleGroupVolume = useMemo(() => computeMuscleGroupVolumeKg(history), [history]);
  const maxMuscleGroupVolumeKg = muscleGroupVolume[0]?.volumeKg ?? 0;
  const topExercises = useMemo(
    () => rankExercisesByVolume(groups).slice(0, TOP_EXERCISES_LIMIT),
    [groups],
  );
  const milestones = useMemo(
    () => computeLifetimeMilestones(completedWorkouts, history, weightUnit),
    [completedWorkouts, history, weightUnit],
  );

  if (groups.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-all-time-empty"
          title="Your all-time record starts here."
          icon="calendar"
        />
      </View>
    );
  }

  return (
    <ScrollView
      testID="progress-all-time-scroll"
      style={styles.sectionFill}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <AppCard hero testID="progress-all-time-hero" style={styles.allTimeHero}>
        <Text style={styles.allTimeHeroTitle}>All Time</Text>
        <Text style={styles.allTimeHeroSubtitle}>A record of your work. Keep going.</Text>
      </AppCard>

      <View style={styles.allTimeStatGrid}>
        <AllTimeStat
          testID="progress-all-time-stat-workouts"
          icon="calendar"
          value={String(lifetimeStats.totalWorkouts)}
          label="Total Workouts"
          accentColor={accentColor}
        />
        <AllTimeStat
          testID="progress-all-time-stat-sets"
          icon="check-circle"
          value={String(totalCompletedSets)}
          label="Total Sets"
          accentColor={accentColor}
        />
        <AllTimeStat
          testID="progress-all-time-stat-volume"
          icon="bar-chart-2"
          value={`${formatVolume(totalVolumeKg, weightUnit)} ${weightUnit}`}
          label="Total Volume"
          accentColor={accentColor}
        />
        <AllTimeStat
          testID="progress-all-time-stat-prs"
          icon="award"
          value={String(totalPRs)}
          label="Personal Records"
          accentColor={accentColor}
        />
      </View>

      {topRecords.length > 0 ? (
        <AppCard testID="progress-all-time-prs" style={styles.overviewCard}>
          <View style={styles.overviewCardHeader}>
            <View
              style={[
                styles.overviewCardIconWrap,
                { backgroundColor: withAlpha(accentColor, 0.14) },
              ]}
            >
              <Feather name="award" size={18} color={accentColor} />
            </View>
            <View style={styles.overviewCardTitleColumn}>
              <Text style={styles.overviewCardTitle}>All Time Personal Records</Text>
              <Text style={styles.overviewCardSubtitle}>See your strongest lifts</Text>
            </View>
          </View>
          <View style={styles.allTimePrGrid}>
            {topRecords.map((record) => (
              <TouchableOpacity
                key={record.exerciseId}
                testID={`progress-all-time-pr-${record.exerciseId}`}
                style={styles.allTimePrCell}
                onPress={() =>
                  navigation.navigate('ProgressExerciseDetail', {
                    exerciseId: record.exerciseId,
                    exerciseName: record.exerciseName,
                  })
                }
              >
                <Text style={styles.allTimePrName} numberOfLines={1}>
                  {record.exerciseName}
                </Text>
                <Text style={styles.allTimePrValue}>
                  {formatWeight(record.weightKg, weightUnit)} {weightUnit}
                </Text>
                <Text style={styles.allTimePrCaption}>x {record.reps} reps</Text>
              </TouchableOpacity>
            ))}
          </View>
        </AppCard>
      ) : null}

      {muscleGroupVolume.length > 0 ? (
        <AppCard testID="progress-all-time-muscle-volume" style={styles.overviewCard}>
          <View style={styles.overviewCardHeader}>
            <View
              style={[
                styles.overviewCardIconWrap,
                { backgroundColor: withAlpha(accentColor, 0.14) },
              ]}
            >
              <Feather name="activity" size={18} color={accentColor} />
            </View>
            <View style={styles.overviewCardTitleColumn}>
              <Text style={styles.overviewCardTitle}>Muscle Group Volume</Text>
              <Text style={styles.overviewCardSubtitle}>All time total volume by muscle group</Text>
            </View>
          </View>
          {muscleGroupVolume.map((mg) => {
            const percent = maxMuscleGroupVolumeKg > 0 ? mg.volumeKg / maxMuscleGroupVolumeKg : 0;
            return (
              <View
                key={mg.group}
                testID={`progress-all-time-muscle-${mg.group}`}
                style={styles.muscleGroupRow}
              >
                <View style={styles.muscleGroupLabelRow}>
                  <Text style={styles.muscleGroupLabel}>{mg.label}</Text>
                  <Text style={styles.muscleGroupCount}>
                    {formatVolume(mg.volumeKg, weightUnit)} {weightUnit}
                  </Text>
                </View>
                <View style={styles.muscleGroupBarTrack}>
                  <View
                    style={[
                      styles.muscleGroupBarFill,
                      { width: `${percent * 100}%`, backgroundColor: accentColor },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </AppCard>
      ) : null}

      <View style={styles.allTimeStatGrid}>
        <AllTimeStat
          testID="progress-all-time-stat-exercises"
          icon="list"
          value={String(groups.length)}
          label="Unique Exercises"
          accentColor={accentColor}
        />
        <AllTimeStat
          testID="progress-all-time-stat-frequency"
          icon="trending-up"
          value={String(lifetimeStats.avgWorkoutsPerWeek)}
          label="Avg Workouts/Week"
          accentColor={accentColor}
        />
      </View>

      {topExercises.length > 0 ? (
        <AppCard testID="progress-all-time-top-exercises" style={styles.overviewCard}>
          <View style={styles.overviewCardHeader}>
            <View
              style={[
                styles.overviewCardIconWrap,
                { backgroundColor: withAlpha(accentColor, 0.14) },
              ]}
            >
              <Feather name="bar-chart-2" size={18} color={accentColor} />
            </View>
            <View style={styles.overviewCardTitleColumn}>
              <Text style={styles.overviewCardTitle}>Top Exercises</Text>
              <Text style={styles.overviewCardSubtitle}>By total volume</Text>
            </View>
          </View>
          {topExercises.map((exercise, index) => (
            <View
              key={exercise.exerciseId}
              testID={`progress-all-time-top-exercise-${exercise.exerciseId}`}
              style={[styles.allTimeRankRow, index > 0 && styles.allTimeRankRowDivider]}
            >
              <View style={styles.allTimeRankBadge}>
                <Text style={styles.allTimeRankBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.allTimeRankName} numberOfLines={1}>
                {exercise.exerciseName}
              </Text>
              <Text style={styles.allTimeRankValue}>
                {formatVolume(exercise.volumeKg, weightUnit)} {weightUnit}
              </Text>
            </View>
          ))}
        </AppCard>
      ) : null}

      {milestones.length > 0 ? (
        <AppCard testID="progress-all-time-milestones" style={styles.overviewCard}>
          <View style={styles.overviewCardHeader}>
            <View
              style={[
                styles.overviewCardIconWrap,
                { backgroundColor: withAlpha(accentColor, 0.14) },
              ]}
            >
              <Feather name="flag" size={18} color={accentColor} />
            </View>
            <View style={styles.overviewCardTitleColumn}>
              <Text style={styles.overviewCardTitle}>Progress Highlights</Text>
              <Text style={styles.overviewCardSubtitle}>All time milestones</Text>
            </View>
          </View>
          {milestones.map((milestone, index) => (
            <View
              key={milestone.key}
              testID={`progress-all-time-milestone-${milestone.key}`}
              style={[styles.allTimeMilestoneRow, index > 0 && styles.allTimeMilestoneRowDivider]}
            >
              <Text style={styles.allTimeMilestoneLabel}>{milestone.label}</Text>
              <Text style={styles.allTimeMilestoneDate}>
                {formatMilestoneDate(milestone.achievedAt)}
              </Text>
            </View>
          ))}
        </AppCard>
      ) : null}

      {/* Relative Strength: replaces the reference's motivational quote
          card. Progresso has exactly one real account in its database today
          -- there is no reference population to compute a same-sex
          percentile against, for overall strength or any muscle group, so
          this deliberately shows an honest "not available yet" state
          instead of a number. See the session's own report for what a real
          implementation would need (reference population size/minimum
          sample gate, a backend aggregate endpoint, an approved
          normalization algorithm) -- this card is the placeholder the real
          feature would slot into once that exists. */}
      <AppCard testID="progress-all-time-relative-strength">
        <Text style={styles.relativeStrengthTitle}>Relative Strength</Text>
        <Text style={styles.relativeStrengthBody}>
          Comparing your strength with other users of the same sex needs a larger, active user base
          to produce a statistically meaningful result. This is not available yet -- check back as
          Progresso grows.
        </Text>
      </AppCard>
    </ScrollView>
  );
}
