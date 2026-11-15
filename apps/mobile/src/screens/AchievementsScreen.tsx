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
import {
  achievementStatuses,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  levelText,
  type AchievementStatus,
} from '../achievements/achievementProgress';
import type { AchievementCategory } from '../achievements/achievementQueries';
import { useAchievements } from '../achievements/achievementsContext';
import { AchievementEmblem } from '../achievements/AchievementEmblem';
import { RankEmblem } from '../achievements/RankEmblem';
import { nextRankLabel, rankForPoints } from '../achievements/ranks';
import { formatCardDate } from '../workouts/workoutFormat';
import { achievementsStyles as styles } from './achievementsStyles';

type Props = RootStackScreenProps<'Achievements'>;
type Filter = 'all' | AchievementCategory;

/**
 * Your achievements, from the side menu. At the top, your lifetime rank: its emblem, rank and
 * division, lifetime AP and the bar to the next division, with every rank a tap away. Then a
 * filter (All, each kind) and the achievements -- the ones you've started, the most recently
 * levelled first, then the ones not started -- each with its emblem (a ring of its levels), its
 * level, the bar to its next level, what that level takes and its AP, and the AP it's brought.
 * Nutrition ones only with Nutrition in your membership; only you ever see them. Asks the server
 * to award anything new each time it opens.
 */
export function AchievementsScreen({ navigation }: Props) {
  const { definitions, awards, progress, points, loading, error, evaluate } = useAchievements();
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
        progress,
        weightUnit,
      ),
    [definitions, awards, progress, weightUnit, nutrition],
  );
  const rank = rankForPoints(points);
  const filtered = shown.filter(
    (status) => filter === 'all' || status.definition.category === filter,
  );
  const started = filtered
    .filter((status) => status.earned)
    .sort((a, b) => (b.lastAwardedAt ?? '').localeCompare(a.lastAwardedAt ?? ''));
  const ahead = filtered
    .filter((status) => !status.earned)
    .sort((a, b) => b.progress - a.progress || a.definition.sort - b.definition.sort);
  const levelsReached = shown.reduce((sum, status) => sum + status.level, 0);
  const levelsInAll = shown.reduce((sum, status) => sum + status.levels, 0);

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...CATEGORY_ORDER.filter((category) => nutrition || category !== 'nutrition').map(
      (category) => ({ value: category, label: CATEGORY_LABELS[category] }),
    ),
  ];

  function renderRow(status: AchievementStatus, index: number) {
    const { definition } = status;
    return (
      <View
        key={definition.id}
        testID={`achievement-${definition.id}`}
        style={[styles.row, index > 0 && styles.rowDivider]}
        accessible
        accessibilityLabel={`${definition.title}, ${levelText(status)}. ${definition.description}. ${
          status.next
            ? `${status.progressLabel}; next, ${status.nextGoalLabel} for ${status.next.ap} AP`
            : 'Every level reached'
        }. ${status.apEarned} AP earned`}
      >
        <AchievementEmblem
          icon={definition.icon}
          level={status.level}
          levels={status.levels}
          accentColor={theme.accent}
          size={48}
        />
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {definition.title}
            </Text>
            <Text style={[styles.rowLevel, status.earned && { color: theme.accent }]}>
              {levelText(status)}
            </Text>
          </View>
          <Text style={styles.rowDescription}>{definition.description}</Text>
          {status.next ? (
            <>
              <View style={styles.rowProgress}>
                <View style={styles.rowBar}>
                  <AnimatedBar
                    testID={`achievement-${definition.id}-bar`}
                    fraction={status.progress}
                    color={theme.accent}
                  />
                </View>
                <Text style={styles.rowProgressLabel}>{status.progressLabel}</Text>
              </View>
              <Text style={styles.rowNext}>
                {definition.kind === 'single'
                  ? `+${status.next.ap} AP`
                  : `Level ${status.next.level}: ${status.nextGoalLabel} · +${status.next.ap} AP`}
              </Text>
            </>
          ) : (
            <Text style={[styles.rowNext, { color: theme.accent }]}>
              {definition.kind === 'single' ? 'Unlocked' : 'Every level reached'}
            </Text>
          )}
          {status.earned ? (
            <Text style={styles.rowEarned}>
              {status.apEarned.toLocaleString('en-US')} AP earned · last{' '}
              {formatCardDate(status.lastAwardedAt!)}
            </Text>
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
              {levelsReached} of {levelsInAll} levels reached across {shown.length} achievements
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

          {started.length > 0 ? (
            <View style={styles.section} testID="achievements-earned">
              <View style={styles.sectionHeader}>
                <SectionHeader label={`Earned (${started.length})`} />
                {filter === 'nutrition' ? (
                  <Text style={styles.sectionNote}>Only you see these</Text>
                ) : null}
              </View>
              <AppCard>{started.map(renderRow)}</AppCard>
            </View>
          ) : null}
          {ahead.length > 0 ? (
            <View style={styles.section} testID="achievements-ahead">
              <View style={styles.sectionHeader}>
                <SectionHeader label={`Not Started (${ahead.length})`} />
                {filter === 'nutrition' && started.length === 0 ? (
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
