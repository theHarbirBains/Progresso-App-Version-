import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { fromKg, roundWeight } from '../lib/units';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import {
  filterByTimeRange,
  summarizeProgress,
  topSetProgressionDetailed,
  type TimeRange,
} from '../workouts/exerciseProgress';
import { deriveMilestones } from '../workouts/progressMilestones';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import { ChartPointDetail } from './ChartPointDetail';
import { ExerciseSelector } from './ExerciseSelector';
import { MetricCard } from './MetricCard';
import { ProgressEmptyState } from './ProgressEmptyState';
import { ProgressionChart } from './ProgressionChart';
import { progressStyles as styles } from './progressStyles';
import { SectionHeader } from '../design/SectionHeader';
import { TimeRangeSelector } from './TimeRangeSelector';

interface Props {
  groups: ExerciseHistoryGroup[];
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onAccentColor: string;
  destructiveColor: string;
  oneRepMaxes: OneRepMaxWithExercise[];
  repPRs: RepPRWithExercise[];
  /** Overview shows the chart alone (a quick answer to "am I getting better?"); Strength additionally shows the metrics grid and this exercise's own milestone history -- same chart, same data, no duplicated logic. */
  detailed?: boolean;
  /** Distinguishes Overview's vs. Strength's copy of this component so their testIDs never collide when both exist in the component tree during tests. */
  testIDPrefix: string;
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * The interactive "Your Strength Journey" experience -- exercise selector,
 * time range, progression chart, tap-for-detail -- reused as-is by both the
 * Overview section (compact) and the dedicated Strength section (detailed).
 * Every derivation here already existed in exerciseProgress.ts; nothing new
 * is invented.
 */
export function StrengthJourneySection({
  groups,
  weightUnit,
  accentColor,
  onAccentColor,
  destructiveColor,
  oneRepMaxes,
  repPRs,
  detailed = false,
  testIDPrefix,
}: Props) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>('3m');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedExerciseId === null && groups.length > 0) {
      const mostTrained = [...groups].sort((a, b) => b.sets.length - a.sets.length)[0];
      setSelectedExerciseId(mostTrained.exerciseId);
    }
  }, [groups, selectedExerciseId]);

  const selectedGroup = groups.find((g) => g.exerciseId === selectedExerciseId) ?? null;

  const allTimePoints = useMemo(
    () => (selectedGroup ? topSetProgressionDetailed(selectedGroup.sets) : []),
    [selectedGroup],
  );
  const rangeFilteredSets = useMemo(
    () => (selectedGroup ? filterByTimeRange(selectedGroup.sets, range) : []),
    [selectedGroup, range],
  );
  const chartDetailPoints = useMemo(
    () => topSetProgressionDetailed(rangeFilteredSets),
    [rangeFilteredSets],
  );
  const chartPoints = useMemo(
    () =>
      chartDetailPoints.map((p) => ({
        x: new Date(p.performedAt).getTime(),
        y: roundWeight(fromKg(p.weightKg, weightUnit)),
      })),
    [chartDetailPoints, weightUnit],
  );

  const summary = useMemo(() => summarizeProgress(allTimePoints), [allTimePoints]);
  const milestones = useMemo(
    () => deriveMilestones(allTimePoints, weightUnit),
    [allTimePoints, weightUnit],
  );

  const featuredOneRepMax = oneRepMaxes.find((o) => o.exerciseId === selectedExerciseId) ?? null;
  const featuredPRCount = repPRs.filter((pr) => pr.exerciseId === selectedExerciseId).length;

  useEffect(() => {
    setSelectedPointIndex(null);
  }, [selectedExerciseId, range]);

  const latest = allTimePoints[allTimePoints.length - 1] ?? null;
  const selectedDetail = selectedPointIndex !== null ? chartDetailPoints[selectedPointIndex] : null;
  const previousDetail =
    selectedPointIndex !== null && selectedPointIndex > 0
      ? chartDetailPoints[selectedPointIndex - 1]
      : null;

  return (
    <View style={styles.section}>
      <SectionHeader label="Your Strength Journey" />
      <ExerciseSelector
        exercises={groups.map((g) => ({ id: g.exerciseId, name: g.exerciseName }))}
        selectedId={selectedExerciseId}
        onSelect={setSelectedExerciseId}
        accentColor={accentColor}
        testID={`${testIDPrefix}-exercise-selector`}
      />
      {latest ? (
        <Text testID={`${testIDPrefix}-current`} style={styles.featuredCurrent}>
          {formatWeight(roundWeight(fromKg(latest.weightKg, weightUnit)))}
          {weightUnit} × {latest.reps}
        </Text>
      ) : null}
      {summary ? (
        <Text
          testID={`${testIDPrefix}-delta`}
          style={[
            styles.featuredDelta,
            { color: summary.deltaKg >= 0 ? accentColor : destructiveColor },
          ]}
        >
          {summary.deltaKg >= 0 ? '+' : ''}
          {formatWeight(roundWeight(fromKg(summary.deltaKg, weightUnit)))}
          {weightUnit} since first recorded
        </Text>
      ) : null}

      <TimeRangeSelector
        value={range}
        onChange={setRange}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />

      {chartPoints.length > 0 ? (
        <ProgressionChart
          testID={`${testIDPrefix}-chart`}
          points={chartPoints}
          color={accentColor}
          selectedIndex={selectedPointIndex}
          onSelectIndex={setSelectedPointIndex}
          accessibilityLabelForPoint={(i) =>
            `${formatWeight(roundWeight(fromKg(chartDetailPoints[i].weightKg, weightUnit)))}${weightUnit} times ${chartDetailPoints[i].reps} on ${new Date(chartDetailPoints[i].performedAt).toLocaleDateString()}`
          }
        />
      ) : (
        <ProgressEmptyState
          testID={`${testIDPrefix}-chart-empty`}
          title="Keep logging this exercise to see your progression."
        />
      )}

      {selectedDetail && selectedGroup ? (
        <ChartPointDetail
          testID={`${testIDPrefix}-point-detail`}
          accentColor={accentColor}
          onDismiss={() => setSelectedPointIndex(null)}
          data={{
            exerciseName: selectedGroup.exerciseName,
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

      {detailed ? (
        <>
          <View style={[styles.section, { marginTop: 24 }]}>
            <SectionHeader label="Progress Metrics" />
            <View style={styles.metricsGrid}>
              <MetricCard
                testID={`${testIDPrefix}-metric-topset`}
                label="Top Set"
                value={latest ? roundWeight(fromKg(latest.weightKg, weightUnit)) : null}
                unit={weightUnit}
              />
              <MetricCard
                testID={`${testIDPrefix}-metric-1rm`}
                label="1RM"
                value={
                  featuredOneRepMax
                    ? roundWeight(fromKg(featuredOneRepMax.weightKg, weightUnit))
                    : null
                }
                unit={weightUnit}
                emptyLabel="No 1RM recorded yet"
              />
              <MetricCard
                testID={`${testIDPrefix}-metric-volume`}
                label="Volume"
                value={
                  latest ? roundWeight(fromKg(latest.weightKg, weightUnit) * latest.reps) : null
                }
                unit={weightUnit}
              />
              <MetricCard
                testID={`${testIDPrefix}-metric-prs`}
                label="PRs"
                value={featuredPRCount}
              />
            </View>
          </View>

          {milestones.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader label="Your Progression Journey" />
              {milestones.map((m, i) => (
                <View
                  key={`${m.kind}-${m.achievedAt}-${i}`}
                  testID={`${testIDPrefix}-milestone-${i}`}
                  style={styles.milestoneRow}
                >
                  <View style={[styles.milestoneDot, { backgroundColor: accentColor }]} />
                  <View>
                    <Text style={styles.milestoneLabel}>{m.label}</Text>
                    <Text style={styles.milestoneDate}>
                      {new Date(m.achievedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
