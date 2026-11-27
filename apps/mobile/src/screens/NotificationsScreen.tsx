import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import {
  listNotifications,
  markNotificationsRead,
  respondToFollowRequest,
  sendFollowRequest,
  type AppNotification,
} from '../lib/api';
import { setAppBadge } from '../lib/pushNotifications';
import type { RootStackScreenProps } from '../navigation/types';
import {
  computeStaleMuscleGroups,
  type StaleMuscleGroup,
} from '../notifications/muscleGroupFreshness';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { useProgressTheme } from '../progress/useProgressTheme';
import { formatCardDate } from '../workouts/workoutFormat';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { notificationsStyles as styles } from './notificationsStyles';
import { SkeletonRows } from '../design/Skeleton';

type Props = RootStackScreenProps<'Notifications'>;

/** How a notification's sender is named on its avatar: their name, @username, or "Someone". */
function actorName(item: AppNotification): string {
  const actor = item.actor;
  return actor?.displayName ?? (actor?.username ? `@${actor.username}` : 'Someone');
}

/** Why a notification can't be opened any more, or null where it can. */
function unavailableMessage(item: AppNotification): string | null {
  if (item.available) return null;
  switch (item.type) {
    case 'workout_like':
    case 'workout_comment':
      return 'This workout has been deleted, or is no longer shared with you.';
    case 'workout_invite':
      return item.inviteStatus === 'expired'
        ? 'This invitation has expired: the workout has finished.'
        : 'This invitation is no longer open.';
    case 'invite_answer':
      return 'This live workout has finished.';
    case 'follow_request':
      return 'This follow request was withdrawn.';
    default:
      return 'This account is no longer on Progresso.';
  }
}

/**
 * The bell's destination: two honest, real sections -- no fake "notification
 * center" placeholder (see CLAUDE.md, real notification delivery doesn't
 * exist yet). "Insights" is computed entirely client-side from the user's
 * own data, a same-user read with no cross-user trust concern: stale-muscle-
 * group cards from workout history (same data/attribution Progress's Muscle
 * Group view already uses -- see muscleGroupFreshness.ts), plus two simple
 * setup reminders -- no active workout split (activeWorkoutSplitId, via
 * useProgressTheme -- the same source WorkoutSplitsScreen reads) and no
 * nutrition goals saved yet (fetchNutritionGoals returning a null calories
 * field, i.e. no row) -- each tapping straight into the screen that fixes
 * it. "Activity" is their social notifications as the server recorded them
 * (GET /notifications -- the same records, in the same words, their pushes
 * come from): follow requests (Accept and Reject, then Follow Back), requests
 * accepted, new followers, workout invitations and their answers, likes
 * (grouped by workout) and comments -- unread ones with a dot, a tap marking
 * one read and opening it (or saying why it can't be: a workout deleted, an
 * invitation expired), and Mark All as Read. Find People's Requests tab is
 * still the full list of requests.
 *
 * Each item is its own full AppCard (Feed's own activity-card anatomy --
 * icon/avatar + title + subtitle, an accent band on top) rather than
 * compact rows grouped into one card -- purely a presentation choice so the
 * screen reads as substantial and scrollable rather than a few thin lines,
 * same real data either way.
 */
export function NotificationsScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { activeWorkoutSplitId, themeLoading } = useProgressTheme();

  const [staleGroups, setStaleGroups] = useState<StaleMuscleGroup[]>([]);
  const [nutritionGoalsMissing, setNutritionGoalsMissing] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [activity, setActivity] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const accent = useAppTheme().accent.accent;

  // Keyed by followId -- disables just that card's buttons while its
  // accept/reject is in flight, same pattern as FindPeopleScreen.
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const loadInsights = useCallback(async () => {
    if (!userId) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const [history, goals] = await Promise.all([
        // Every session counts toward when a muscle was trained, bodyweight and timed too.
        fetchAllExerciseHistory(userId, { allTypes: true }),
        fetchNutritionGoals(userId),
      ]);
      setStaleGroups(computeStaleMuscleGroups(history));
      setNutritionGoalsMissing(goals.calories === null);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setInsightsLoading(false);
    }
  }, [userId]);

  const loadActivity = useCallback(async () => {
    if (!accessToken) return;
    setActivityLoading(true);
    setActivityError(null);
    try {
      const read = await listNotifications(accessToken);
      setActivity(read.notifications);
      setUnread(read.unread);
      void setAppBadge(read.unread);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setActivityLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadInsights();
      void loadActivity();
    });
    return unsubscribe;
  }, [navigation, loadInsights, loadActivity]);

  /** Marks these read on screen at once, then on the server; the badge follows. */
  function markRead(ids: string[]) {
    if (!accessToken || ids.length === 0) return;
    setActivity((prev) =>
      prev.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item)),
    );
    setUnread((count) => Math.max(0, count - ids.length));
    markNotificationsRead(accessToken, ids)
      .then((result) => {
        setUnread(result.unread);
        void setAppBadge(result.unread);
      })
      .catch(() => {});
  }

  function markAllRead() {
    if (!accessToken) return;
    setActivity((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnread(0);
    void setAppBadge(0);
    markNotificationsRead(accessToken)
      .then((result) => {
        setUnread(result.unread);
        void setAppBadge(result.unread);
      })
      .catch(() => {});
  }

  /** A tap: read, then what it's about -- or why that's gone. */
  function openNotification(item: AppNotification) {
    if (!item.read) markRead([item.id]);
    const gone = unavailableMessage(item);
    if (gone) {
      Alert.alert('Not available', gone);
      return;
    }
    switch (item.type) {
      case 'workout_like':
      case 'workout_comment':
        if (item.workoutId) {
          navigation.navigate('WorkoutDetail', {
            workoutId: item.workoutId,
            focusComments: item.type === 'workout_comment',
          });
        }
        return;
      case 'workout_invite':
        navigation.navigate('Groups');
        return;
      case 'invite_answer':
        if (item.groupId) navigation.navigate('GroupSession', { groupId: item.groupId });
        return;
      default:
        if (item.actor) navigation.navigate('PersonProfile', { userId: item.actor.id });
    }
  }

  async function handleAccept(item: AppNotification) {
    if (!accessToken || !item.followId) return;
    const followId = item.followId;
    setPending((p) => ({ ...p, [followId]: true }));
    try {
      await respondToFollowRequest(accessToken, followId, 'accept');
      // The request stays, now a follower -- to follow back from right here.
      setActivity((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, followStatus: 'accepted', read: true } : entry,
        ),
      );
      if (!item.read) markRead([item.id]);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setPending((p) => ({ ...p, [followId]: false }));
    }
  }

  async function handleFollowBack(item: AppNotification) {
    if (!accessToken || !item.actor) return;
    const key = item.id;
    setPending((p) => ({ ...p, [key]: true }));
    try {
      const { status } = await sendFollowRequest(accessToken, item.actor.id);
      setActivity((prev) =>
        prev.map((entry) => (entry.id === key ? { ...entry, followingBack: status } : entry)),
      );
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to follow back');
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleReject(item: AppNotification) {
    if (!accessToken || !item.followId) return;
    const followId = item.followId;
    setPending((p) => ({ ...p, [followId]: true }));
    try {
      await respondToFollowRequest(accessToken, followId, 'reject');
      // Declined: gone from the list (and from the unread count).
      setActivity((prev) => prev.filter((entry) => entry.id !== item.id));
      if (!item.read) setUnread((count) => Math.max(0, count - 1));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to reject request');
      setPending((p) => ({ ...p, [followId]: false }));
    }
  }

  const hasAnyInsight =
    activeWorkoutSplitId === null || nutritionGoalsMissing || staleGroups.length > 0;

  const nothingAtAll =
    !insightsLoading &&
    !activityLoading &&
    !insightsError &&
    !activityError &&
    !themeLoading &&
    !hasAnyInsight &&
    activity.length === 0;

  return (
    <Screen
      scrollTestID="notifications-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title="Notifications"
          onBack={() => navigation.goBack()}
          testID="notifications-header"
        />
      }
    >
      {nothingAtAll ? (
        <EmptyState
          testID="notifications-empty"
          title="You're all caught up"
          description="Training reminders and follow activity will show up here."
        />
      ) : (
        <>
          {insightsLoading || themeLoading ? (
            <SkeletonRows testID="notifications-insights-loading" count={3} />
          ) : insightsError ? (
            <ErrorState
              testID="notifications-insights-error"
              message={insightsError}
              onRetry={loadInsights}
            />
          ) : hasAnyInsight ? (
            <>
              <View style={styles.sectionHeaderWrap}>
                <SectionHeader label="Insights" />
              </View>
              {activeWorkoutSplitId === null ? (
                <AppCard
                  testID="notifications-insight-no-split"
                  onPress={() => navigation.navigate('ChooseWorkoutSplit')}
                >
                  <View style={styles.itemRow}>
                    <View style={styles.iconWell}>
                      <Feather name="layers" size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle}>Set up a workout split</Text>
                      <Text style={styles.itemSubtitle}>
                        Pick a split so your training days stay organized
                      </Text>
                    </View>
                  </View>
                </AppCard>
              ) : null}
              {nutritionGoalsMissing ? (
                <AppCard
                  testID="notifications-insight-no-nutrition-goals"
                  onPress={() => navigation.navigate('NutritionGoals')}
                >
                  <View style={styles.itemRow}>
                    <View style={styles.iconWell}>
                      <Feather name="target" size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle}>Set your calorie target</Text>
                      <Text style={styles.itemSubtitle}>
                        Get a personalized daily calorie and macro goal
                      </Text>
                    </View>
                  </View>
                </AppCard>
              ) : null}
              {staleGroups.map((group) => (
                <AppCard
                  key={group.muscleGroup}
                  testID={`notifications-insight-${group.muscleGroup}`}
                  onPress={() => navigation.navigate('NewWorkout')}
                >
                  <View style={styles.itemRow}>
                    <View style={styles.iconWell}>
                      <Feather name="activity" size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle}>
                        It&apos;s been {group.daysSince} days since you trained {group.label}
                      </Text>
                      <Text style={styles.itemSubtitle}>
                        Last trained {formatCardDate(group.lastTrainedAt)}
                      </Text>
                    </View>
                  </View>
                </AppCard>
              ))}
            </>
          ) : null}

          {activityLoading ? (
            <SkeletonRows testID="notifications-activity-loading" count={5} />
          ) : activityError ? (
            <ErrorState
              testID="notifications-activity-error"
              message={activityError}
              onRetry={loadActivity}
            />
          ) : activity.length > 0 ? (
            <>
              <View style={[styles.sectionHeaderWrap, styles.activityHeader]}>
                <SectionHeader label="Activity" />
                {unread > 0 ? (
                  <TextButton
                    testID="notifications-mark-all-read"
                    label="Mark All as Read"
                    onPress={markAllRead}
                  />
                ) : null}
              </View>
              {activity.map((item) => {
                const followKey = item.followId ?? item.id;
                const isPending = Boolean(pending[followKey] || pending[item.id]);
                const name = actorName(item);
                const showFollowBack =
                  (item.type === 'new_follower' ||
                    (item.type === 'follow_request' && item.followStatus === 'accepted')) &&
                  item.followingBack !== 'accepted' &&
                  item.actor !== null;
                return (
                  <AppCard
                    key={item.id}
                    testID={`notifications-activity-${item.id}`}
                    onPress={() => openNotification(item)}
                    accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.body}`}
                  >
                    <View style={styles.itemRow}>
                      <View>
                        <Avatar
                          uri={item.actor?.avatarUrl ?? null}
                          initial={name.replace('@', '').charAt(0).toUpperCase()}
                          size={44}
                          iconSize={20}
                          iconColor={colors.textSecondary}
                          initialStyle={styles.avatarInitial}
                        />
                        {item.read ? null : (
                          <View
                            testID={`notifications-activity-${item.id}-unread`}
                            style={[styles.unreadDot, { backgroundColor: accent }]}
                          />
                        )}
                      </View>
                      <View style={styles.itemBody}>
                        <Text style={styles.itemKicker} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text
                          testID={`notifications-activity-${item.id}-body`}
                          style={[styles.itemTitle, item.read && styles.itemTitleRead]}
                        >
                          {item.body}
                        </Text>
                        <Text style={styles.itemSubtitle}>
                          {formatCardDate(item.at)}
                          {item.type === 'workout_invite' && item.inviteStatus
                            ? ` · ${
                                item.inviteStatus === 'invited'
                                  ? 'Waiting for you'
                                  : item.inviteStatus === 'joined'
                                    ? 'Joined'
                                    : item.inviteStatus === 'expired'
                                      ? 'Expired'
                                      : 'Declined'
                              }`
                            : ''}
                          {item.available ? '' : ' · No longer available'}
                        </Text>
                      </View>
                    </View>
                    {item.type === 'follow_request' && item.followStatus === 'pending' ? (
                      <View style={styles.itemActionWrap}>
                        <View style={styles.requestActions}>
                          <SecondaryButton
                            testID={`notifications-activity-${item.id}-reject`}
                            label="Reject"
                            loading={isPending}
                            onPress={() => handleReject(item)}
                          />
                          <PrimaryButton
                            testID={`notifications-activity-${item.id}-accept`}
                            label="Accept"
                            loading={isPending}
                            onPress={() => handleAccept(item)}
                          />
                        </View>
                      </View>
                    ) : showFollowBack ? (
                      <View style={styles.itemActionWrap}>
                        {item.followingBack === 'pending' ? (
                          <SecondaryButton
                            testID={`notifications-activity-${item.id}-requested`}
                            label="Requested"
                            disabled
                            onPress={() => {}}
                          />
                        ) : (
                          <PrimaryButton
                            testID={`notifications-activity-${item.id}-follow-back`}
                            label="Follow Back"
                            loading={isPending}
                            onPress={() => handleFollowBack(item)}
                          />
                        )}
                      </View>
                    ) : null}
                  </AppCard>
                );
              })}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
