import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { StatBlock } from '../design/StatBlock';
import { StatValue } from '../design/StatValue';
import { colors } from '../design/theme';
import { fetchFeedItems, type FeedItem } from '../feed/feedQueries';
import { formatWeightKg } from '../lib/units';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { mealTypeLabel } from '../nutrition/mealTypes';
import { FoodImage } from '../nutrition/FoodImage';
import { useProgressTheme } from '../progress/useProgressTheme';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { formatCardDate, formatCardDuration } from '../workouts/workoutFormat';
import { feedStyles as styles } from './feedStyles';

type Props = RootStackScreenProps<'Feed'>;

// The app's landing screen -- a personal activity feed, replacing the old
// Dashboard + Workout/Nutrition toggle. There is no following/social graph
// yet (see DESIGN.md), so this is "what did I actually do": your own
// completed workouts and logged foods, most recent first, as one list of
// widgets (see feedQueries.ts). Starting a workout and logging food live on
// their own tabs (Train/Nutrition) now, not here. Load More pages in older
// workouts (food logs stay bounded to the current week -- see
// feedQueries.ts's own comment on why).
//
// Card anatomy deliberately borrows Strava's activity-feed structure (a
// byline row, a bold title, a stat strip) -- see DESIGN.md's Feed section
// -- but stays black-and-white/monochrome rather than Strava's orange, and
// has no GPS map or streak/"congratulate" banner: Progresso has no
// location data to draw a route from, and Feed stays purely informational
// (no kudos/social prompts) since there's no social graph yet. `topAccent`
// is a neutral top band on every card; which activity a card is comes
// across via its byline icon, not a color.
//
// Each card's own numbers are the most relevant ones actually available: a
// workout's stat area is a 2x2 grid (Duration/Exercises, Sets/Volume) --
// the same shape WorkoutDetailScreen's own hero uses, not a cramped 3-up
// row -- and a food card leads with a hero-sized photo (FoodFacts.tsx's own
// sizing) beside its name and calorie readout, then all three macros
// (Protein/Carbs/Fat), not just Protein.
//
// The header's "+" mirrors Strava's own top-bar button: a shortcut sheet
// (Start Workout / Log Food) to the same destinations Train's and
// Nutrition's own primary buttons already open. It's an addition, not a
// replacement -- those tab-root buttons are still how starting a workout
// or logging food normally happens (see the "option A" decision this
// redesign made); this is just a faster path from Feed itself.
export function FeedScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { openMenu } = useAppMenu();
  const { weightUnit, displayName, username, avatarUrl } = useProgressTheme();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  // Only the very first load should replace the whole screen with a
  // spinner -- every later focus is a background refresh, same pattern as
  // WorkoutHistoryScreen/ProfileScreen.
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      const result = await fetchFeedItems(userId, 0);
      setItems(result.items);
      setHasMore(result.hasMore);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your feed');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [userId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  async function handleLoadMore() {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const result = await fetchFeedItems(userId, next);
      // Merge and re-sort rather than assume the new page is strictly
      // older than everything already shown -- correct even if a workout
      // was logged with a backdated date.
      setItems((prev) =>
        [...prev, ...result.items].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
      );
      setHasMore(result.hasMore);
      setPage(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more of your feed');
    } finally {
      setLoadingMore(false);
    }
  }

  const byline = displayName ?? username ?? 'You';
  const avatarInitial = byline.charAt(0).toUpperCase();

  return (
    <Screen
      scrollTestID="feed-scroll"
      contentContainerStyle={styles.content}
      testID="feed-screen"
      header={
        <AppHeader
          testID="feed-header"
          title="Progresso"
          leftAction={{
            icon: 'menu',
            onPress: () => openMenu(),
            accessibilityLabel: 'Open menu',
            testID: 'feed-open-menu',
          }}
          rightAction={{
            icon: 'plus',
            onPress: () => setQuickActionsOpen(true),
            accessibilityLabel: 'Quick actions',
            testID: 'feed-quick-actions',
          }}
        />
      }
    >
      <BottomSheet
        testID="feed-quick-actions-sheet"
        visible={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
      >
        <Text style={styles.sheetTitle}>Quick Actions</Text>
        <ListRow
          testID="feed-quick-action-start-workout"
          icon="activity"
          title="Start Workout"
          onPress={() => {
            setQuickActionsOpen(false);
            navigation.navigate('NewWorkout');
          }}
        />
        <ListRow
          testID="feed-quick-action-log-food"
          icon="coffee"
          title="Log Food"
          divider
          onPress={() => {
            setQuickActionsOpen(false);
            navigation.navigate('FoodLibrary');
          }}
        />
      </BottomSheet>

      {error ? (
        <ErrorState testID="feed-error" message={error} onRetry={load} />
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator testID="feed-loading" size="large" color={colors.textPrimary} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          testID="feed-empty"
          title="Nothing here yet"
          description="Finish a workout or log a food and it'll show up here."
        />
      ) : (
        <>
          {items.map((item) =>
            item.kind === 'workout' ? (
              <AppCard
                key={item.id}
                testID={`feed-item-workout-${item.workout.id}`}
                topAccent={colors.textPrimary}
                onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.workout.id })}
              >
                <View style={styles.metaRow}>
                  <View style={styles.avatarWrap}>
                    <Avatar
                      uri={avatarUrl}
                      initial={avatarInitial}
                      size={32}
                      iconSize={16}
                      iconColor={colors.textSecondary}
                      initialStyle={styles.avatarInitial}
                    />
                  </View>
                  <View style={styles.metaBody}>
                    <Text style={styles.metaName} numberOfLines={1}>
                      {byline}
                    </Text>
                    <View style={styles.metaSubRow}>
                      <Feather name="activity" size={11} color={colors.textMuted} />
                      <Text style={styles.metaTimestamp}>{formatCardDate(item.timestamp)}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.workout.splitDayName ?? item.workout.name}
                </Text>
                {item.workout.muscleGroups.length > 0 ? (
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {item.workout.muscleGroups
                      .map((group) => SPLIT_MUSCLE_GROUP_LABELS[group])
                      .join(' • ')}
                  </Text>
                ) : null}

                <View style={styles.statGrid}>
                  <View style={styles.statRow}>
                    <StatBlock
                      testID={`feed-item-workout-${item.workout.id}-duration`}
                      value={formatCardDuration(item.workout.durationMinutes)}
                      label="Duration"
                    />
                    <StatBlock
                      testID={`feed-item-workout-${item.workout.id}-exercises`}
                      value={String(item.workout.exerciseCount)}
                      label={item.workout.exerciseCount === 1 ? 'Exercise' : 'Exercises'}
                    />
                  </View>
                  <View style={styles.statRow}>
                    <StatBlock
                      testID={`feed-item-workout-${item.workout.id}-sets`}
                      value={String(item.workout.completedSetCount)}
                      label="Sets"
                    />
                    <StatBlock
                      testID={`feed-item-workout-${item.workout.id}-volume`}
                      value={formatWeightKg(item.workout.totalVolumeKg, weightUnit)}
                      label={`Volume (${weightUnit})`}
                    />
                  </View>
                </View>
              </AppCard>
            ) : (
              <AppCard
                key={item.id}
                testID={`feed-item-foodlog-${item.log.id}`}
                topAccent={colors.textPrimary}
                onPress={() => navigation.navigate('Nutrition')}
              >
                <View style={styles.metaRow}>
                  <View style={styles.avatarWrap}>
                    <Avatar
                      uri={avatarUrl}
                      initial={avatarInitial}
                      size={32}
                      iconSize={16}
                      iconColor={colors.textSecondary}
                      initialStyle={styles.avatarInitial}
                    />
                  </View>
                  <View style={styles.metaBody}>
                    <Text style={styles.metaName} numberOfLines={1}>
                      {byline}
                    </Text>
                    <View style={styles.metaSubRow}>
                      <Feather name="coffee" size={11} color={colors.textMuted} />
                      <Text style={styles.metaTimestamp}>
                        {item.log.mealType ? `${mealTypeLabel(item.log.mealType)} · ` : ''}
                        {formatCardDate(item.timestamp)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.foodTitleRow}>
                  <FoodImage uri={item.log.imageUrl} name={item.log.foodNameSnapshot} size={88} />
                  <View style={styles.foodTitleBody}>
                    <Text style={styles.foodTitle} numberOfLines={2}>
                      {item.log.foodNameSnapshot}
                    </Text>
                    <StatValue
                      testID={`feed-item-foodlog-${item.log.id}-calories`}
                      value={String(item.log.calories)}
                      unit=" cal"
                      color={colors.textPrimary}
                    />
                  </View>
                </View>

                <View style={styles.statRow}>
                  <StatBlock
                    testID={`feed-item-foodlog-${item.log.id}-protein`}
                    value={`${Math.round(item.log.proteinG)}g`}
                    label="Protein"
                  />
                  <StatBlock
                    testID={`feed-item-foodlog-${item.log.id}-carbs`}
                    value={`${Math.round(item.log.carbsG)}g`}
                    label="Carbs"
                  />
                  <StatBlock
                    testID={`feed-item-foodlog-${item.log.id}-fat`}
                    value={`${Math.round(item.log.fatG)}g`}
                    label="Fat"
                  />
                </View>
              </AppCard>
            ),
          )}

          {hasMore ? (
            <TextButton
              testID="feed-load-more"
              label="Load More"
              loading={loadingMore}
              onPress={handleLoadMore}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
