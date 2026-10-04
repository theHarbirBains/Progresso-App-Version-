import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { BubbleMenu, BubbleMenuRow } from '../design/BubbleMenu';
import { PrimaryButton, TextButton } from '../design/Button';
import { Card } from '../design/Card';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { StatBlock } from '../design/StatBlock';
import { StatValue } from '../design/StatValue';
import { colors } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { fetchFeedItems, type FeedItem } from '../feed/feedQueries';
import { fetchFriendsFeed, listFollowNotifications, type FriendsFeedItem } from '../lib/api';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { mealTypeLabel, type MealType } from '../nutrition/mealTypes';
import { FoodImage } from '../nutrition/FoodImage';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { useProgressTheme } from '../progress/useProgressTheme';
import { computeNextWorkout, type NextWorkoutPlan } from '../workouts/nextWorkout';
import { RecentWorkoutTopSets } from '../feed/RecentWorkoutTopSets';
import type { WorkoutTopSet } from '../workouts/recentWorkoutTopSets';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { formatCardDate, formatCardDuration } from '../workouts/workoutFormat';
import { feedStyles as styles } from './feedStyles';

type Props = RootStackScreenProps<'Feed'>;

function musclesLabel(day: NextWorkoutPlan['day']): string {
  return day.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ');
}

// A normalized shape both "You" (feedQueries.ts, self-only) and "Friends"
// (lib/api.ts's fetchFriendsFeed, backend-merged followees' activity) map
// into, so the card JSX below is written once rather than twice. `onPress`
// is undefined for a friend's card -- WorkoutDetail/Nutrition both assume
// ownership (direct-to-Supabase reads RLS-scoped to the signed-in user), so
// a friend's item is informational only, not a navigation target, until
// there's a real "someone else's read-only detail" screen to send it to.
interface DisplayItem {
  key: string;
  kind: 'workout' | 'foodLog';
  timestamp: string;
  authorName: string;
  avatarUrl: string | null;
  onPress?: () => void;
  workout?: {
    id: string;
    name: string;
    splitDayName: string | null;
    muscleGroups: SplitMuscleGroup[];
    durationMinutes: number | null;
    exerciseCount: number;
    completedSetCount: number;
    totalVolumeKg: number;
    completedExerciseCount: number;
    topSets: WorkoutTopSet[];
  };
  log?: {
    id: string;
    foodNameSnapshot: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    mealType: MealType | null;
    imageUrl: string | null;
  };
}

// The app's landing screen -- a personal activity feed, replacing the old
// Dashboard + Workout/Nutrition toggle, plus (see Social v1: the
// follows/feed backend modules) accepted followees' own activity merged
// into the same single reverse-chronological list, not a separate tab --
// one feed, "everyone whose activity you can see", the same way Strava's
// own feed doesn't split "you" from "people you follow". A card's byline
// (name + avatar) is what tells the two apart; Friends-sourced items only
// ever come from people who've accepted a follow request (see
// FindPeopleScreen). There is no algorithmic ranking, just recency.
//
// Card anatomy deliberately borrows Strava's activity-feed structure (a
// byline row, a bold title, a stat strip) -- see DESIGN.md's Feed section
// -- but stays black-and-white/monochrome rather than Strava's orange, and
// has no GPS map or streak/"congratulate" banner: Progresso has no
// location data to draw a route from, and Feed stays purely informational
// (no kudos/social prompts). `topAccent` is a neutral top band on every
// card; which activity a card is comes across via its byline icon, not a
// color.
//
// Each card's own numbers are the most relevant ones actually available: a
// workout's stat area is a 2x2 grid (Duration/Exercises, Sets/Volume) --
// the same shape WorkoutDetailScreen's own hero uses, not a cramped 3-up
// row -- and a food card leads with a hero-sized photo (FoodFacts.tsx's own
// sizing) beside its name and calorie readout, then all three macros
// (Protein/Carbs/Fat), not just Protein.
//
// The header's "+" mirrors Strava's own top-bar button: a shortcut menu
// (Start Workout / Log Food) to the same destinations Train's and
// Nutrition's own primary buttons already open. It's an addition, not a
// replacement -- those tab-root buttons are still how starting a workout or
// logging food normally happens (see the "option A" decision this redesign
// made); this is just a faster path from Feed itself. Scan Barcode used to
// live here too (it had no other entry point at all at the time), but now
// belongs with Nutrition's own actions instead -- see
// NutritionTodayScreen's Scan Barcode / Search Food buttons. Find People
// (following more people, to bring more activity into this feed) is the
// header's search icon, next to the menu button (AppHeader's leftAction2)
// -- still also reachable from the app menu's SOCIAL section, same as every
// other menu destination. The bell (rightAction2) is a real, working
// notifications entry point, not a placeholder: it's badged with the count
// of incoming follow requests and opens NotificationsScreen, which merges
// real follow activity with training insights (stale muscle groups) -- see
// that screen's own comment. There is no push/email delivery system (see
// CLAUDE.md), so this only ever surfaces things the app can actually show,
// honestly. The "+" menu itself opens via `BubbleMenu` (design/BubbleMenu.tsx)
// rather than `BottomSheet` -- it grows out from the "+" button itself
// instead of sliding up from the bottom edge, a deliberate different
// entrance for a button-triggered menu vs. a full sheet of content.
export function FeedScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { openMenu } = useAppMenu();
  const { theme, weightUnit, displayName, username, avatarUrl, activeWorkoutSplitId } =
    useProgressTheme();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [friendsItems, setFriendsItems] = useState<FriendsFeedItem[]>([]);
  const [friendsPage, setFriendsPage] = useState(0);
  const [friendsHasMore, setFriendsHasMore] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsLoadingMore, setFriendsLoadingMore] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  // The header bell's badge -- the same count of things NotificationsScreen
  // itself would show right now: incoming follow requests plus its two
  // setup reminders (no active split, no nutrition goals saved -- see that
  // screen's own comment). Not folded into the friends-feed error/loading
  // state above: a failure here is silently a missing badge, never a
  // reason to block the whole screen with an error.
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [nutritionGoalsMissing, setNutritionGoalsMissing] = useState(false);

  // The widget pinned above everything else on this screen -- the same
  // "advance to the next day in the active split's rotation" preview
  // NewWorkoutScreen's own hero card computes (see computeNextWorkout).
  // Deliberately read-only here: tapping it opens NewWorkoutScreen rather
  // than starting the workout directly, so the one place that actually
  // creates a workout (with its one-active-workout conflict handling) stays
  // the single source of truth, not duplicated onto Feed too. Absent
  // entirely for a user with no active split, or an active split with no
  // days -- never a "choose a split" prompt here, since Notifications
  // already carries that reminder (see NotificationsScreen).
  const [nextPlan, setNextPlan] = useState<NextWorkoutPlan | null>(null);

  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  // Only the very first load should replace the whole screen with a
  // spinner -- every later focus is a background refresh, same pattern as
  // WorkoutHistoryScreen/ProfileScreen.
  const hasLoadedOnce = useRef(false);
  const hasLoadedFriendsOnce = useRef(false);

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

  const loadFriends = useCallback(async () => {
    if (!accessToken) return;
    if (!hasLoadedFriendsOnce.current) setFriendsLoading(true);
    setFriendsError(null);
    try {
      const result = await fetchFriendsFeed(accessToken, 0);
      setFriendsItems(result.items);
      setFriendsHasMore(result.hasMore);
      setFriendsPage(0);
    } catch (err) {
      setFriendsError(err instanceof Error ? err.message : 'Failed to load your friends feed');
    } finally {
      setFriendsLoading(false);
      hasLoadedFriendsOnce.current = true;
    }
  }, [accessToken]);

  const loadNotificationBadgeCount = useCallback(async () => {
    if (!accessToken || !userId) return;
    try {
      const [notifications, goals] = await Promise.all([
        listFollowNotifications(accessToken),
        fetchNutritionGoals(userId),
      ]);
      setPendingRequestCount(notifications.filter((n) => n.kind === 'request').length);
      setNutritionGoalsMissing(goals.calories === null);
    } catch {
      // A missing badge count isn't worth surfacing as a screen-level error.
    }
  }, [accessToken, userId]);

  const loadNextWorkout = useCallback(async () => {
    if (!userId || !activeWorkoutSplitId) {
      setNextPlan(null);
      return;
    }
    try {
      const [detail, lastDayId] = await Promise.all([
        fetchWorkoutSplitDetail(activeWorkoutSplitId),
        fetchLastWorkoutSplitDayId(userId),
      ]);
      setNextPlan(computeNextWorkout(detail, lastDayId));
    } catch {
      // A preview widget failing to load isn't worth a screen-level error --
      // it just doesn't show, same as a missing badge count above.
      setNextPlan(null);
    }
  }, [userId, activeWorkoutSplitId]);

  // Runs as soon as the active split becomes known, not just on the next
  // focus event -- activeWorkoutSplitId arrives asynchronously (it comes
  // from ProfileProvider's own fetch), so without this the widget would
  // stay absent through Feed's very first mount until the user left and
  // came back. A plain effect, not folded into the focus-listener effect
  // below, so this reactivity never touches that effect's own
  // subscribe/unsubscribe lifecycle.
  useEffect(() => {
    void loadNextWorkout();
  }, [loadNextWorkout]);

  // loadNextWorkout is deliberately read via a ref, not a dependency, here:
  // its own identity changes whenever activeWorkoutSplitId changes (see
  // above), which would otherwise make this effect resubscribe to
  // navigation's focus event every time that happens -- a real focus
  // listener doesn't refire just from resubscribing, but it's still a
  // needless churn this avoids entirely. The ref always calls the latest
  // version, so a real focus event still reloads with current values.
  const loadNextWorkoutRef = useRef(loadNextWorkout);
  loadNextWorkoutRef.current = loadNextWorkout;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void load();
      void loadFriends();
      void loadNotificationBadgeCount();
      void loadNextWorkoutRef.current();
    });
    return unsubscribe;
  }, [navigation, load, loadFriends, loadNotificationBadgeCount]);

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

  async function handleLoadMoreFriends() {
    if (!accessToken || friendsLoadingMore || !friendsHasMore) return;
    setFriendsLoadingMore(true);
    try {
      const next = friendsPage + 1;
      const result = await fetchFriendsFeed(accessToken, next);
      setFriendsItems((prev) =>
        [...prev, ...result.items].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
      );
      setFriendsHasMore(result.hasMore);
      setFriendsPage(next);
    } catch (err) {
      setFriendsError(
        err instanceof Error ? err.message : 'Failed to load more of your friends feed',
      );
    } finally {
      setFriendsLoadingMore(false);
    }
  }

  const byline = displayName ?? username ?? 'You';

  const mineDisplayItems: DisplayItem[] = items.map((item) =>
    item.kind === 'workout'
      ? {
          key: item.id,
          kind: 'workout',
          timestamp: item.timestamp,
          authorName: byline,
          avatarUrl,
          onPress: () => navigation.navigate('WorkoutDetail', { workoutId: item.workout.id }),
          workout: {
            id: item.workout.id,
            name: item.workout.splitDayName ?? item.workout.name,
            splitDayName: item.workout.splitDayName,
            muscleGroups: item.workout.muscleGroups,
            durationMinutes: item.workout.durationMinutes,
            exerciseCount: item.workout.exerciseCount,
            completedSetCount: item.workout.completedSetCount,
            totalVolumeKg: item.workout.totalVolumeKg,
            completedExerciseCount: item.workout.completedExerciseCount,
            topSets: item.workout.topSets,
          },
        }
      : {
          key: item.id,
          kind: 'foodLog',
          timestamp: item.timestamp,
          authorName: byline,
          avatarUrl,
          onPress: () => navigation.navigate('Nutrition'),
          log: {
            id: item.log.id,
            foodNameSnapshot: item.log.foodNameSnapshot,
            calories: item.log.calories,
            proteinG: item.log.proteinG,
            carbsG: item.log.carbsG,
            fatG: item.log.fatG,
            mealType: item.log.mealType,
            imageUrl: item.log.imageUrl ?? null,
          },
        },
  );

  const friendsDisplayItems: DisplayItem[] = friendsItems.map((item) =>
    item.kind === 'workout'
      ? {
          key: item.id,
          kind: 'workout',
          timestamp: item.timestamp,
          authorName:
            item.author.displayName ??
            (item.author.username ? `@${item.author.username}` : 'Someone'),
          avatarUrl: item.author.avatarUrl,
          workout: {
            id: item.workout.id,
            name: item.workout.splitDayName ?? item.workout.name,
            splitDayName: item.workout.splitDayName,
            muscleGroups: item.workout.muscleGroups as SplitMuscleGroup[],
            durationMinutes: item.workout.durationMinutes,
            exerciseCount: item.workout.exerciseCount,
            completedSetCount: item.workout.completedSetCount,
            totalVolumeKg: item.workout.totalVolumeKg,
            completedExerciseCount: item.workout.completedExerciseCount,
            topSets: item.workout.topSets,
          },
        }
      : {
          key: item.id,
          kind: 'foodLog',
          timestamp: item.timestamp,
          authorName:
            item.author.displayName ??
            (item.author.username ? `@${item.author.username}` : 'Someone'),
          avatarUrl: item.author.avatarUrl,
          log: {
            id: item.log.id,
            foodNameSnapshot: item.log.foodNameSnapshot,
            calories: item.log.calories,
            proteinG: item.log.proteinG,
            carbsG: item.log.carbsG,
            fatG: item.log.fatG,
            mealType: item.log.mealType as MealType | null,
            imageUrl: item.log.imageUrl,
          },
        },
  );

  const displayItems = [...mineDisplayItems, ...friendsDisplayItems].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  // Both sources load together on every focus (see the effect above), so
  // the very first load is "in progress" until both have settled at least
  // once -- same reasoning useSignedInResource's own loading flag uses.
  const initialLoading = loading || friendsLoading;
  // Graceful degradation, same philosophy as feedQueries.ts's own
  // Promise.allSettled merge of workouts/food logs: a failure on one source
  // only blocks the whole screen if there's genuinely nothing else to show;
  // otherwise this quietly shows whatever the other source returned.
  const blockingError = displayItems.length === 0 ? (error ?? friendsError) : null;
  const hasMoreOfEither = hasMore || friendsHasMore;
  const loadingMoreEither = loadingMore || friendsLoadingMore;
  // Matches NotificationsScreen's own total exactly: requests plus its two
  // setup reminders. Stale-muscle-group insights are deliberately not
  // counted here -- computing those needs the user's whole exercise
  // history, real weight to add to every Feed focus just for a badge
  // number, whereas activeWorkoutSplitId is already free (useProgressTheme)
  // and nutrition goals is one lightweight row fetch.
  const notificationBadgeCount =
    pendingRequestCount + (activeWorkoutSplitId === null ? 1 : 0) + (nutritionGoalsMissing ? 1 : 0);

  function retryAll() {
    void load();
    void loadFriends();
  }

  async function handleLoadMoreAll() {
    await Promise.all([handleLoadMore(), handleLoadMoreFriends()]);
  }

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
          leftAction2={{
            icon: 'search',
            onPress: () => navigation.navigate('FindPeople'),
            accessibilityLabel: 'Find people',
            testID: 'feed-find-people',
          }}
          rightAction={{
            icon: 'plus',
            onPress: () => setQuickActionsOpen(true),
            accessibilityLabel: 'Quick actions',
            testID: 'feed-quick-actions',
          }}
          rightAction2={{
            icon: 'bell',
            onPress: () => navigation.navigate('Notifications'),
            accessibilityLabel: 'Notifications',
            testID: 'feed-notifications',
            badgeCount: notificationBadgeCount,
          }}
        />
      }
    >
      <BubbleMenu
        testID="feed-quick-actions-sheet"
        visible={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
      >
        <BubbleMenuRow
          testID="feed-quick-action-start-workout"
          icon="activity"
          label="Start Workout"
          onPress={() => {
            setQuickActionsOpen(false);
            navigation.navigate('NewWorkout');
          }}
        />
        <BubbleMenuRow
          testID="feed-quick-action-log-food"
          icon="coffee"
          label="Log Food"
          onPress={() => {
            setQuickActionsOpen(false);
            navigation.navigate('FoodLibrary');
          }}
        />
      </BubbleMenu>

      {nextPlan ? (
        <Card
          heroColor={theme.accent}
          testID="feed-next-workout"
          onPress={() => navigation.navigate('NewWorkout')}
          accessibilityLabel={`Next workout: ${nextPlan.day.name}${
            nextPlan.day.muscleGroups.length > 0 ? `, ${musclesLabel(nextPlan.day)}` : ''
          }`}
        >
          <Text style={[styles.nextWorkoutEyebrow, { color: withAlpha(theme.onAccent, 0.72) }]}>
            Next Workout
          </Text>
          <Text style={[styles.nextWorkoutDayName, { color: theme.onAccent }]}>
            {nextPlan.day.name}
          </Text>
          {nextPlan.day.muscleGroups.length > 0 ? (
            <Text style={[styles.nextWorkoutMuscles, { color: withAlpha(theme.onAccent, 0.85) }]}>
              {musclesLabel(nextPlan.day)}
            </Text>
          ) : null}
          <Text style={[styles.nextWorkoutMeta, { color: withAlpha(theme.onAccent, 0.72) }]}>
            {nextPlan.previousDayName
              ? `Up next after ${nextPlan.previousDayName}`
              : "Let's get started"}
          </Text>
          {/* The card is the one tap target (into NewWorkoutScreen, which
              actually starts it); this is the real button, shown for the eye,
              with its own touches off -- same convention as NewWorkoutScreen's
              own hero card. Inverted from the card's own accent fill: a solid
              onAccent pill with accent-colored text, so it reads as a real
              button against the bold hero rather than disappearing into it. */}
          <View
            style={styles.nextWorkoutAction}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <PrimaryButton
              label="Start Workout"
              onPress={() => undefined}
              accentColor={theme.onAccent}
              onAccentColor={theme.accent}
            />
          </View>
        </Card>
      ) : null}

      {blockingError ? (
        <ErrorState testID="feed-error" message={blockingError} onRetry={retryAll} />
      ) : initialLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator testID="feed-loading" size="large" color={colors.textPrimary} />
        </View>
      ) : displayItems.length === 0 ? (
        <View testID="feed-empty">
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader label="Get Started" />
          </View>
          <Card testID="feed-empty-actions">
            <ListRow
              testID="feed-empty-action-start-workout"
              icon="activity"
              title="Start a Workout"
              subtitle="Track sets and reps as you train"
              onPress={() => navigation.navigate('NewWorkout')}
            />
            <ListRow
              testID="feed-empty-action-log-food"
              icon="coffee"
              title="Log Food"
              subtitle="Search or scan something you ate"
              onPress={() => navigation.navigate('FoodLibrary')}
              divider
            />
            <ListRow
              testID="feed-empty-action-find-people"
              icon="search"
              title="Find People to Follow"
              subtitle="See their workouts and meals here too"
              onPress={() => navigation.navigate('FindPeople')}
              divider
            />
          </Card>
        </View>
      ) : (
        <>
          {displayItems.map((item) =>
            item.kind === 'workout' && item.workout ? (
              <Card
                key={item.key}
                testID={`feed-item-workout-${item.workout.id}`}
                onPress={item.onPress}
              >
                <View style={styles.metaRow}>
                  <View style={styles.avatarWrap}>
                    <Avatar
                      uri={item.avatarUrl}
                      initial={item.authorName.charAt(0).toUpperCase()}
                      size={32}
                      iconSize={16}
                      iconColor={colors.textSecondary}
                      initialStyle={styles.avatarInitial}
                    />
                  </View>
                  <View style={styles.metaBody}>
                    <Text style={styles.metaName} numberOfLines={1}>
                      {item.authorName}
                    </Text>
                    <View style={styles.metaSubRow}>
                      <Feather name="activity" size={11} color={colors.textMuted} />
                      <Text style={styles.metaTimestamp}>{formatCardDate(item.timestamp)}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.workout.name}
                </Text>
                {item.workout.muscleGroups.length > 0 ? (
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {item.workout.muscleGroups
                      .map((group) => SPLIT_MUSCLE_GROUP_LABELS[group])
                      .join(' • ')}
                  </Text>
                ) : null}

                <View style={styles.statRow}>
                  <StatBlock
                    testID={`feed-item-workout-${item.workout.id}-duration`}
                    value={formatCardDuration(item.workout.durationMinutes)}
                    label="Duration"
                  />
                  <StatBlock
                    testID={`feed-item-workout-${item.workout.id}-exercises`}
                    value={String(item.workout.completedExerciseCount)}
                    label={item.workout.completedExerciseCount === 1 ? 'Exercise' : 'Exercises'}
                  />
                  <StatBlock
                    testID={`feed-item-workout-${item.workout.id}-sets`}
                    value={String(item.workout.completedSetCount)}
                    label="Sets"
                  />
                </View>
                <RecentWorkoutTopSets
                  testID={`feed-item-workout-${item.workout.id}-top-sets`}
                  topSets={item.workout.topSets}
                  weightUnit={weightUnit}
                />
              </Card>
            ) : item.log ? (
              <Card
                key={item.key}
                testID={`feed-item-foodlog-${item.log.id}`}
                onPress={item.onPress}
              >
                <View style={styles.metaRow}>
                  <View style={styles.avatarWrap}>
                    <Avatar
                      uri={item.avatarUrl}
                      initial={item.authorName.charAt(0).toUpperCase()}
                      size={32}
                      iconSize={16}
                      iconColor={colors.textSecondary}
                      initialStyle={styles.avatarInitial}
                    />
                  </View>
                  <View style={styles.metaBody}>
                    <Text style={styles.metaName} numberOfLines={1}>
                      {item.authorName}
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
              </Card>
            ) : null,
          )}

          {hasMoreOfEither ? (
            <TextButton
              testID="feed-load-more"
              label="Load More"
              loading={loadingMoreEither}
              onPress={handleLoadMoreAll}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
