import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SectionHeader } from '../design/SectionHeader';
import { colors } from '../design/theme';
import { fromKg, roundWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import type { GlobalMilestone } from './globalMilestones';
import type { LifetimeStats } from './lifetimeStats';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';
import { StatTile } from './StatTile';
import { StrengthJourneySection } from './StrengthJourneySection';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import { summarizeProgress, topSetProgressionDetailed } from '../workouts/exerciseProgress';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import { formatTotalTime } from '../workouts/workoutMonthSummary';
import { ExerciseProgressRow } from './ExerciseProgressRow';
import { withAlpha } from '../theme/accentColor';

type Navigation = RootStackScreenProps<'ProgressOverview'>['navigation'];

interface Props {
  groups: ExerciseHistoryGroup[];
  weightUnit: 'kg' | 'lb';
  theme: { accent: string; onAccent: string };
  oneRepMaxes: OneRepMaxWithExercise[];
  repPRs: RepPRWithExercise[];
  lifetimeStats: LifetimeStats;
  totalCompletedSets: number;
  totalPRs: number;
  globalMilestones: GlobalMilestone[];
  navigation: Navigation;
}

// Overview: a quick, honest answer to "Am I getting better?" -- lifetime
// counts, the same Strength Journey chart Strength shows (in its compact
// form), Most Improved, a data-backed insight line, Training Momentum, and
// Milestones. Every number here is real; nothing is a new formula.
export function OverviewSection({
  groups,
  weightUnit,
  theme,
  oneRepMaxes,
  repPRs,
  lifetimeStats,
  totalCompletedSets,
  totalPRs,
  globalMilestones,
  navigation,
}: Props) {
  const improvingExercises = useMemo(() => {
    return groups
      .map((g) => {
        const points = topSetProgressionDetailed(g.sets);
        return {
          exerciseId: g.exerciseId,
          exerciseName: g.exerciseName,
          summary: summarizeProgress(points),
        };
      })
      .filter(
        (g): g is typeof g & { summary: NonNullable<typeof g.summary> } =>
          g.summary !== null && g.summary.deltaKg > 0,
      )
      .sort((a, b) => b.summary.percent - a.summary.percent)
      .slice(0, 5);
  }, [groups]);

  const prsThisMonth = useMemo(() => {
    const now = new Date();
    const isThisMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    return (
      repPRs.filter((pr) => isThisMonth(pr.achievedAt)).length +
      oneRepMaxes.filter((o) => isThisMonth(o.achievedAt)).length
    );
  }, [repPRs, oneRepMaxes]);

  const topImprovement = improvingExercises[0] ?? null;
  const insights = useMemo(() => {
    const rows: string[] = [];
    if (topImprovement) {
      rows.push(
        `${topImprovement.exerciseName} is up ${topImprovement.summary.percent.toFixed(1)}% since you started.`,
      );
    }
    if (prsThisMonth > 0) {
      rows.push(`You hit ${prsThisMonth} new PR${prsThisMonth === 1 ? '' : 's'} this month.`);
    }
    return rows;
  }, [topImprovement, prsThisMonth]);

  if (groups.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-overview-empty"
          title="Your progression starts here."
          icon="trending-up"
        />
      </View>
    );
  }

  return (
    <ScrollView
      testID="progress-overview-scroll"
      style={styles.sectionFill}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Section 1: compact lifetime stats */}
      <View style={styles.section}>
        <View style={styles.statsRow}>
          <StatTile
            testID="progress-stat-workouts"
            icon="activity"
            label="Workouts"
            value={String(lifetimeStats.totalWorkouts)}
            accentColor={theme.accent}
          />
          <StatTile
            testID="progress-stat-prs"
            icon="award"
            label="PRs"
            value={String(totalPRs)}
            accentColor={theme.accent}
          />
          <StatTile
            testID="progress-stat-sets"
            icon="check-circle"
            label="Sets Completed"
            value={String(totalCompletedSets)}
            accentColor={theme.accent}
          />
          <StatTile
            testID="progress-stat-time"
            icon="clock"
            label="Training Time"
            value={formatTotalTime(lifetimeStats.totalMinutes)}
            accentColor={theme.accent}
          />
        </View>
      </View>

      <StrengthJourneySection
        groups={groups}
        weightUnit={weightUnit}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        destructiveColor={colors.destructive}
        oneRepMaxes={oneRepMaxes}
        repPRs={repPRs}
        testIDPrefix="progress-overview"
      />

      {/* Section 3: You Got Stronger */}
      {insights.length > 0 ? (
        <View style={[styles.section, styles.insightCard]}>
          <View style={styles.insightTitleRow}>
            <Feather name="zap" size={16} color={theme.accent} />
            <Text style={styles.insightTitle}>You Got Stronger</Text>
          </View>
          {insights.map((text, i) => (
            <View key={i} testID={`progress-insight-${i}`} style={styles.insightRow}>
              <Feather name="check" size={14} color={theme.accent} />
              <Text style={styles.insightText}>{text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Section 4: Most Improved */}
      {improvingExercises.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader label="Most Improved" />
          {improvingExercises.map((ex, i) => (
            <View key={ex.exerciseId} style={styles.recordRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <ExerciseProgressRow
                  testID={`progress-improving-${ex.exerciseId}`}
                  exerciseName={ex.exerciseName}
                  currentWeightDisplay={roundWeight(fromKg(ex.summary.currentKg, weightUnit))}
                  unit={weightUnit}
                  deltaDisplay={roundWeight(fromKg(ex.summary.deltaKg, weightUnit))}
                  percent={ex.summary.percent}
                  accentColor={theme.accent}
                  onPress={() =>
                    navigation.navigate('ProgressExerciseDetail', {
                      exerciseId: ex.exerciseId,
                      exerciseName: ex.exerciseName,
                    })
                  }
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Section 7: Training Momentum -- no streak */}
      <View style={styles.section}>
        <SectionHeader label="Training Momentum" />
        <View style={styles.statsRow}>
          <StatTile
            testID="progress-momentum-month"
            icon="calendar"
            label="Workouts this month"
            value={String(lifetimeStats.workoutsThisMonth)}
            accentColor={theme.accent}
          />
          <StatTile
            testID="progress-momentum-avg"
            icon="bar-chart-2"
            label="Avg per week"
            value={lifetimeStats.avgWorkoutsPerWeek.toFixed(1)}
            accentColor={theme.accent}
          />
        </View>
      </View>

      {/* Section 11: Milestones -- frontend/foundation for now, count-based only. */}
      <View style={styles.section}>
        <SectionHeader label="Milestones" />
        {globalMilestones.map((m) => (
          <View
            key={m.key}
            testID={`progress-milestone-global-${m.key}`}
            style={styles.milestoneCard}
          >
            <View
              style={[
                styles.milestoneIconWrap,
                m.achieved && { backgroundColor: withAlpha(theme.accent, 0.14) },
              ]}
            >
              <Feather
                name={m.achieved ? 'check' : 'award'}
                size={16}
                color={m.achieved ? theme.accent : colors.textMuted}
              />
            </View>
            <View style={styles.milestoneBody}>
              <Text style={styles.milestoneCardLabel}>{m.label}</Text>
              {m.progress ? (
                <>
                  <View style={styles.muscleGroupBarTrack}>
                    <View
                      style={[
                        styles.muscleGroupBarFill,
                        {
                          width: `${Math.min(100, (m.progress.current / m.progress.target) * 100)}%`,
                          backgroundColor: theme.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.milestoneCardProgressText}>
                    {m.progress.current} / {m.progress.target}
                  </Text>
                </>
              ) : m.achieved && m.achievedAt ? (
                <Text style={styles.milestoneCardProgressText}>
                  Completed · {new Date(m.achievedAt).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
