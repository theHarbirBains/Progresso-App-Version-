import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { TextButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { colors, fonts, typeScale, widgetGap } from '../design/theme';
import { Card } from '../design/Card';
import { Section } from '../design/Section';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { fromKg, roundWeight, formatWeight } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { ProgressCardHeader } from '../progress/ProgressCardHeader';
import { ProgressEmptyState } from '../progress/ProgressEmptyState';
import { progressStyles as styles } from '../progress/progressStyles';
import { useProgressTheme } from '../progress/useProgressTheme';
import { fetchExerciseSetHistory, type HistoricalSet } from '../workouts/exerciseHistoryQueries';
import { summarizeProgress, topSetProgressionDetailed } from '../workouts/exerciseProgress';
import { fetchOneRepMax, fetchRepPRs, type OneRepMax, type RepPR } from '../workouts/prQueries';
import { deriveMilestones } from '../workouts/progressMilestones';
import { formatVolume } from '../workouts/workoutSummary';
import { EditTopSetSheet, type TopSetToEdit } from '../progress/EditTopSetSheet';
import { useBuiltinExtras } from '../exercises/builtinExtras';
import { useExerciseDetails } from '../exercises/ExerciseDetailsCard';
import { ExerciseGuideBody, useExerciseGuide } from '../exercises/ExerciseGuideSheet';
import { ExerciseOverview } from '../exercises/ExerciseOverview';
import { hasIllustration } from '../exercises/illustrations/exerciseArt';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';

type Props = RootStackScreenProps<'ProgressExerciseDetail'>;

type Tab = 'summary' | 'history' | 'howto';

const TABS: { key: Tab; label: string; icon: 'file-text' | 'clock' | 'book-open' }[] = [
  { key: 'summary', label: 'Summary', icon: 'file-text' },
  { key: 'history', label: 'History', icon: 'clock' },
  { key: 'howto', label: 'How To', icon: 'book-open' },
];

/** How many of the latest workouts' top sets History lists before Show All. */
const TOP_SETS_SHOWN = 10;

// The shared "this one exercise" destination, reached from Overview's milestones, Top Sets, All
// Time, the live workout, Muscle Activity and the Exercise Library -- one implementation for every
// entry point, laid out after Hevy's: Summary | History | How To tabs under the header, fixed while
// each scrolls on its own.
// - Summary: the exercise itself (ExerciseOverview: its picture, name, primary and secondary
//   muscles and setup), then the latest top set and how far it has come, and Personal Records.
// - History: each workout's top set, newest first (a tap fixes one logged wrong), with how many
//   sets it had, then the progression journey. No line graph.
// - How To: a built-in's guide, inline (ExerciseGuideBody) -- also the header's (i) and the
//   picture. A person's own exercise has no guide, so no tab.
export function ProgressExerciseDetailScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, weightUnit, themeLoading } = useProgressTheme();
  const details = useExerciseDetails(exerciseId);
  const extras = useBuiltinExtras(exerciseId);
  const guided = hasIllustration(extras?.slug);
  const [tab, setTab] = useState<Tab>('summary');
  // The guide is read the first time How To is shown.
  const guide = useExerciseGuide(exerciseId, guided && tab === 'howto');
  // A fixed top set changes Progress's shared history and PRs too.
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoricalSet[]>([]);
  const [repPRs, setRepPRs] = useState<RepPR[]>([]);
  const [oneRepMax, setOneRepMax] = useState<OneRepMax | null>(null);
  const [showAllTopSets, setShowAllTopSets] = useState(false);
  // A workout's top set opened to fix it; saving reads the page again.
  const [editing, setEditing] = useState<TopSetToEdit | null>(null);
  // Only the very first load for this exerciseId replaces the whole screen with a spinner --
  // every later call (the focus listener below) is a background refresh. Reset when exerciseId
  // itself changes, since that's genuinely new data.
  const hasLoadedOnce = useRef(false);
  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [exerciseId]);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      const [fetchedHistory, prs, orm] = await Promise.all([
        fetchExerciseSetHistory(userId, exerciseId),
        fetchRepPRs(userId, exerciseId),
        fetchOneRepMax(userId, exerciseId),
      ]);
      setHistory(fetchedHistory);
      setRepPRs(prs);
      setOneRepMax(orm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [userId, exerciseId]);

  // Loads each time the page comes into view -- including the first, so no separate mount load.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const allTimePoints = useMemo(() => topSetProgressionDetailed(history), [history]);
  const summary = useMemo(() => summarizeProgress(allTimePoints), [allTimePoints]);
  const milestones = useMemo(
    () => deriveMilestones(allTimePoints, weightUnit),
    [allTimePoints, weightUnit],
  );
  // Each workout's top set, newest first.
  const topSets = useMemo(() => [...allTimePoints].reverse(), [allTimePoints]);
  // How many working sets each workout had of it.
  const setsIn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const set of history) {
      counts.set(set.workoutExerciseId, (counts.get(set.workoutExerciseId) ?? 0) + 1);
    }
    return counts;
  }, [history]);
  // Its records from the sets themselves: the heaviest weight, and the most weight x reps in a set.
  const records = useMemo(() => {
    let heaviest: number | null = null;
    let bestSet: number | null = null;
    for (const set of history) {
      if (heaviest === null || set.weightKg > heaviest) heaviest = set.weightKg;
      const volume = set.weightKg * set.reps;
      if (bestSet === null || volume > bestSet) bestSet = volume;
    }
    return { heaviest, bestSet };
  }, [history]);

  if (loading || themeLoading) {
    return <LoadingState testID="progress-exercise-detail-loading" />;
  }

  const latest = allTimePoints[allTimePoints.length - 1] ?? null;
  const weight = (kg: number) =>
    `${formatWeight(roundWeight(fromKg(kg, weightUnit)))}${weightUnit}`;
  const tabs = TABS.filter((t) => t.key !== 'howto' || guided);
  const empty = (
    <ProgressEmptyState
      testID="progress-exercise-detail-empty"
      title="Complete a workout to start tracking this exercise."
      icon="trending-up"
    />
  );

  const summaryTab = (
    <>
      <ExerciseOverview
        details={details}
        exerciseId={exerciseId}
        exerciseName={exerciseName}
        accentColor={theme.accent}
        onOpenGuide={guided ? () => setTab('howto') : undefined}
        testID="progress-exercise-detail-details"
      />
      {allTimePoints.length === 0 ? (
        empty
      ) : (
        <>
          {latest ? (
            <Card testID="progress-exercise-detail-current-card">
              <Text style={local.kicker}>LATEST TOP SET</Text>
              <Text testID="progress-exercise-detail-current" style={styles.featuredCurrent}>
                {weight(latest.weightKg)} × {latest.reps}
              </Text>
              {summary ? (
                <Text
                  testID="progress-exercise-detail-delta"
                  style={[
                    styles.featuredDelta,
                    { color: summary.deltaKg >= 0 ? theme.accent : colors.destructive },
                  ]}
                >
                  {summary.deltaKg >= 0 ? '+' : ''}
                  {weight(summary.deltaKg)} since first recorded
                </Text>
              ) : null}
            </Card>
          ) : null}

          <AppCard testID="progress-exercise-detail-records">
            <ProgressCardHeader title="Personal Records" icon="award" accentColor={theme.accent} />
            <ListRow
              testID="progress-exercise-detail-record-heaviest"
              title="Heaviest Weight"
              value={records.heaviest !== null ? weight(records.heaviest) : '–'}
              chevron={false}
            />
            <ListRow
              testID="progress-exercise-detail-metric-1rm"
              title="1 Rep Max"
              subtitle="A set of exactly 1 rep"
              value={oneRepMax ? weight(oneRepMax.weightKg) : '–'}
              chevron={false}
              divider
            />
            <ListRow
              testID="progress-exercise-detail-record-best-set"
              title="Best Set Volume"
              subtitle="Weight × reps in one set"
              value={
                records.bestSet !== null
                  ? `${formatVolume(fromKg(records.bestSet, weightUnit))}${weightUnit}`
                  : '–'
              }
              chevron={false}
              divider
            />
            <ListRow
              testID="progress-exercise-detail-metric-prs"
              title="Rep PRs"
              subtitle="The heaviest at each rep count"
              value={String(repPRs.length)}
              chevron={false}
              divider
            />
          </AppCard>
        </>
      )}
    </>
  );

  const shownTopSets = showAllTopSets ? topSets : topSets.slice(0, TOP_SETS_SHOWN);
  const historyTab =
    allTimePoints.length === 0 ? (
      empty
    ) : (
      <>
        <Section title="Top Sets">
          {shownTopSets.map((point, index) => {
            const date = new Date(point.performedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const value = `${weight(point.weightKg)} × ${point.reps}`;
            const sets = setsIn.get(point.workoutExerciseId) ?? 1;
            return (
              // Tapping a workout's top set opens it to fix, when it was logged wrong.
              <TouchableOpacity
                key={point.workoutExerciseId}
                testID={`progress-exercise-detail-top-set-${index}`}
                style={[styles.workoutTopSetRow, index > 0 && styles.workoutTopSetDivider]}
                onPress={() =>
                  setEditing({
                    setId: point.setId,
                    exerciseName,
                    gym: details?.gym,
                    grip: details?.grip,
                    attachment: details?.attachment,
                    performedAt: point.performedAt,
                    weightKg: point.weightKg,
                    reps: point.reps,
                  })
                }
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${date}, ${value}, ${sets} ${sets === 1 ? 'set' : 'sets'}`}
                accessibilityHint="Opens its top set to edit"
              >
                <View>
                  <Text style={styles.workoutTopSetDate}>{date}</Text>
                  <Text style={local.setCount}>
                    {sets} {sets === 1 ? 'set' : 'sets'}
                  </Text>
                </View>
                <View style={styles.workoutTopSetEnd}>
                  <Text style={styles.workoutTopSetValue}>{value}</Text>
                  <Feather name="edit-2" size={14} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}
          {!showAllTopSets && topSets.length > TOP_SETS_SHOWN ? (
            <TextButton
              testID="progress-exercise-detail-top-sets-all"
              label={`Show All ${topSets.length}`}
              onPress={() => setShowAllTopSets(true)}
            />
          ) : null}
        </Section>

        {milestones.length > 0 ? (
          <Section title="Progression Journey">
            {milestones.map((m, i) => (
              <View
                key={`${m.kind}-${m.achievedAt}-${i}`}
                testID={`progress-exercise-detail-milestone-${i}`}
                style={styles.milestoneRow}
              >
                <View style={[styles.milestoneDot, { backgroundColor: theme.accent }]} />
                <View>
                  <Text style={styles.milestoneLabel}>{m.label}</Text>
                  <Text style={styles.milestoneDate}>
                    {new Date(m.achievedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </Section>
        ) : null}
      </>
    );

  return (
    <Screen
      scroll={false}
      rollout={false}
      contentContainerStyle={local.page}
      header={
        <AppHeader
          title={exerciseName}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'progress-exercise-detail-back',
          }}
          rightAction={
            guided
              ? {
                  icon: 'info',
                  onPress: () => setTab('howto'),
                  accessibilityLabel: `How to do ${exerciseName}`,
                  testID: 'progress-exercise-detail-info',
                }
              : undefined
          }
        />
      }
    >
      <UnderlineTabs
        testID="progress-exercise-detail-tabs"
        categories={tabs}
        active={tab}
        onSelect={setTab}
        accentColor={theme.accent}
      />

      {tab === 'howto' && guided ? (
        <View testID="progress-exercise-detail-howto" style={local.fill}>
          <ExerciseGuideBody
            exerciseId={exerciseId}
            exerciseName={exerciseName}
            state={guide}
            testID="progress-exercise-detail-guide"
          />
        </View>
      ) : (
        <ScrollView
          keyboardDismissMode="on-drag"
          testID="progress-exercise-detail-scroll"
          style={local.fill}
          contentContainerStyle={[local.scroll, styles.detailContent]}
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Text testID="progress-exercise-detail-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
          {tab === 'history' ? historyTab : summaryTab}
        </ScrollView>
      )}

      <EditTopSetSheet
        target={editing}
        weightUnit={weightUnit}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void load();
          void refetchAllTimeStats();
        }}
      />
    </Screen>
  );
}

const local = StyleSheet.create({
  page: {
    flex: 1,
    gap: widgetGap,
  },
  fill: {
    flex: 1,
  },
  scroll: {
    gap: widgetGap,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  setCount: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginTop: 2,
  },
});
