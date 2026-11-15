import { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AnimatedBar } from '../design/AnimatedBar';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { FilterChips } from '../design/FilterChips';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonCards } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { useMembership } from '../membership/useMembership';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { withAlpha } from '../theme/accentColor';
import {
  achievementStatuses,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  describe,
  type AchievementStatus,
} from '../achievements/achievementProgress';
import type { AchievementCategory } from '../achievements/achievementQueries';
import { useAchievements } from '../achievements/achievementsContext';
import { RankEmblem } from '../achievements/RankEmblem';
import { nextRankLabel, rankForPoints } from '../achievements/ranks';
import { formatCardDate } from '../workouts/workoutFormat';
import { achievementsStyles as styles } from './achievementsStyles';

type Props = RootStackScreenProps<'Achievements'>;
type Filter = 'all' | 'repeatable' | AchievementCategory;

/**
 * Your achievements, from the side menu. At the top, your lifetime rank: its emblem, rank and
 * division, lifetime AP and the bar to the next division, with every rank a tap away. Then a
 * filter (All, each kind, Repeatable) and the achievements -- the ones you've earned, latest
 * first, with when (a repeatable one how many times), then the ones still ahead, nearest first,
 * each with exactly what it takes, where you are and its AP. Nutrition ones only with Nutrition
 * in your membership; only you ever see them. Asks the server to award anything new each time
 * it opens.
 */
export function AchievementsScreen({ navigation }: Props) {
  const { definitions, awards, metrics, points, loading, error, evaluate } = useAchievements();
  const { theme, weightUnit } = useProgressTheme();
  const { nutrition } = useMembership();
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void evaluate());
    return unsubscribe;
  }, [navigation, evaluate]);

  const shown = useMemo(
    () =>
      achievementStatuses(
        definitions.filter((d) => nutrition || d.category !== 'nutrition'),
        awards,
        metrics,
        weightUnit,
      ),
    [definitions, awards, metrics, weightUnit, nutrition],
  );
  const rank = rankForPoints(points);
  const filtered = shown.filter((status) =>
    filter === 'all'
      ? true
      : filter === 'repeatable'
        ? status.definition.repeats !== 'once'
        : status.definition.category === filter,
  );
  const earned = filtered
    .filter((status) => status.earned)
    .sort((a, b) => (b.lastAwardedAt ?? '').localeCompare(a.lastAwardedAt ?? ''));
  const ahead = filtered
    .filter((status) => !status.earned)
    .sort((a, b) => b.progress - a.progress || a.definition.sort - b.definition.sort);

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...CATEGORY_ORDER.filter((category) => nutrition || category !== 'nutrition').map(
      (category) => ({ value: category, label: CATEGORY_LABELS[category] }),
    ),
    { value: 'repeatable', label: 'Repeatable' },
  ];

  function renderRow(status: AchievementStatus, index: number) {
    const { definition } = status;
    const repeats = definition.repeats !== 'once';
    return (
      <View
        key={definition.id}
        testID={`achievement-${definition.id}`}
        style={[styles.row, index > 0 && styles.rowDivider]}
        accessible
        accessibilityLabel={`${definition.title}, ${definition.ap} AP. ${describe(definition, weightUnit)}. ${
          status.earned
            ? repeats
              ? `Earned ${status.times} ${status.times === 1 ? 'time' : 'times'}`
              : `Earned ${formatCardDate(status.firstAwardedAt!)}`
            : `${status.progressLabel} so far`
        }`}
      >
        <View
          style={[
            styles.icon,
            {
              backgroundColor: status.earned
                ? withAlpha(theme.accent, 0.16)
                : withAlpha(colors.textMuted, 0.12),
            },
          ]}
        >
          <Feather
            name={definition.icon}
            size={20}
            color={status.earned ? theme.accent : colors.textMuted}
          />
        </View>
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {definition.title}
            </Text>
            <Text style={[styles.rowAp, status.earned && { color: theme.accent }]}>
              {repeats ? `${definition.ap} AP each` : `${definition.ap} AP`}
            </Text>
          </View>
          <Text style={styles.rowDescription}>{describe(definition, weightUnit)}</Text>
          {status.earned ? (
            <Text style={styles.rowEarned}>
              {repeats
                ? `Earned ${status.times} ${status.times === 1 ? 'time' : 'times'} · last ${formatCardDate(status.lastAwardedAt!)}`
                : `Earned ${formatCardDate(status.firstAwardedAt!)}`}
            </Text>
          ) : null}
          {!status.earned || repeats ? (
            <View style={styles.rowProgress}>
              <View style={styles.rowBar}>
                <AnimatedBar
                  testID={`achievement-${definition.id}-bar`}
                  fraction={status.progress}
                  color={theme.accent}
                />
              </View>
              <Text style={styles.rowProgressLabel}>
                {repeats
                  ? `${status.progressLabel} ${definition.repeats === 'weekly' ? 'this week' : 'this month'}`
                  : status.progressLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Screen
      scrollTestID="achievements-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title="Achievements"
          onBack={() => navigation.goBack()}
          testID="achievements-header"
        />
      }
    >
      {error && definitions.length === 0 ? (
        <ErrorState testID="achievements-error" message={error} onRetry={() => void evaluate()} />
      ) : loading || definitions.length === 0 ? (
        <SkeletonCards testID="achievements-loading" heights={[180, 260, 260]} />
      ) : (
        <>
          <AppCard hero testID="achievements-summary">
            <TouchableOpacity
              testID="achievements-rank"
              style={styles.rank}
              onPress={() => navigation.navigate('RankProgression')}
              accessibilityRole="button"
              accessibilityLabel={`${rank.label}, ${points.toLocaleString('en-US')} AP. See every rank`}
            >
              <RankEmblem tierIndex={rank.tierIndex} divisionIndex={rank.divisionIndex} size={72} />
              <View style={styles.rankText}>
                <Text style={[styles.rankLabel, { color: rank.tier.palette.primary }]}>
                  {rank.label}
                </Text>
                <Text style={styles.rankPoints}>{points.toLocaleString('en-US')} AP</Text>
                <AnimatedBar
                  testID="achievements-rank-bar"
                  fraction={rank.progress}
                  color={rank.tier.palette.primary}
                  height={8}
                />
                <Text style={styles.rankNext}>
                  {(rank.to - rank.points).toLocaleString('en-US')} AP to {nextRankLabel(rank)}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <Text testID="achievements-count" style={styles.count}>
              {shown.filter((s) => s.earned).length} of {shown.length} achievements earned
            </Text>
          </AppCard>

          <FilterChips
            testID="achievements-filter"
            options={filters}
            value={filter}
            onChange={setFilter}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />

          {earned.length > 0 ? (
            <View style={styles.section} testID="achievements-earned">
              <View style={styles.sectionHeader}>
                <SectionHeader label={`Earned (${earned.length})`} />
              </View>
              <AppCard>{earned.map(renderRow)}</AppCard>
            </View>
          ) : null}
          {ahead.length > 0 ? (
            <View style={styles.section} testID="achievements-ahead">
              <View style={styles.sectionHeader}>
                <SectionHeader label={`Still Ahead (${ahead.length})`} />
                {filter === 'nutrition' ? (
                  <Text style={styles.sectionNote}>Only you see these</Text>
                ) : null}
              </View>
              <AppCard>{ahead.map(renderRow)}</AppCard>
            </View>
          ) : null}
          {filtered.length === 0 ? (
            <EmptyState testID="achievements-empty" title="Nothing here yet" />
          ) : null}
        </>
      )}
    </Screen>
  );
}
