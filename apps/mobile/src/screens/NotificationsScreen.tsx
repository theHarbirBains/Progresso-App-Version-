import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import {
  listFollowNotifications,
  respondToFollowRequest,
  type FollowNotification,
  type FollowUser,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { computeStaleMuscleGroups, type StaleMuscleGroup } from '../notifications/muscleGroupFreshness';
import { formatCardDate } from '../workouts/workoutFormat';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { notificationsStyles as styles } from './notificationsStyles';

type Props = RootStackScreenProps<'Notifications'>;

function displayName(user: FollowUser): string {
  return user.displayName ?? (user.username ? `@${user.username}` : 'Someone');
}

/**
 * The bell's destination: two honest, real sections -- no fake "notification
 * center" placeholder (see CLAUDE.md, real notification delivery doesn't
 * exist yet). "Insights" is computed entirely client-side from the user's
 * own workout history (same data/attribution Progress's Muscle Group view
 * already uses -- see muscleGroupFreshness.ts), a same-user read with no
 * cross-user trust concern. "Activity" is the follows backend's merged
 * pending-requests + recently-accepted feed (see
 * FollowsService.listNotifications) -- the quick/recent view; Find People's
 * Requests tab is the full management list, same underlying data.
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

  const [staleGroups, setStaleGroups] = useState<StaleMuscleGroup[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [activity, setActivity] = useState<FollowNotification[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Keyed by followId -- disables just that card's buttons while its
  // accept/reject is in flight, same pattern as FindPeopleScreen.
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const loadInsights = useCallback(async () => {
    if (!userId) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const history = await fetchAllExerciseHistory(userId);
      setStaleGroups(computeStaleMuscleGroups(history));
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
      setActivity(await listFollowNotifications(accessToken));
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

  async function handleAccept(followId: string) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [followId]: true }));
    try {
      await respondToFollowRequest(accessToken, followId, 'accept');
      setActivity((prev) => prev.filter((item) => item.followId !== followId));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to accept request');
      setPending((p) => ({ ...p, [followId]: false }));
    }
  }

  async function handleReject(followId: string) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [followId]: true }));
    try {
      await respondToFollowRequest(accessToken, followId, 'reject');
      setActivity((prev) => prev.filter((item) => item.followId !== followId));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to reject request');
      setPending((p) => ({ ...p, [followId]: false }));
    }
  }

  const nothingAtAll =
    !insightsLoading &&
    !activityLoading &&
    !insightsError &&
    !activityError &&
    staleGroups.length === 0 &&
    activity.length === 0;

  return (
    <Screen
      scrollTestID="notifications-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader title="Notifications" onBack={() => navigation.goBack()} testID="notifications-header" />
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
          {insightsLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator
                testID="notifications-insights-loading"
                size="large"
                color={colors.textPrimary}
              />
            </View>
          ) : insightsError ? (
            <ErrorState
              testID="notifications-insights-error"
              message={insightsError}
              onRetry={loadInsights}
            />
          ) : staleGroups.length > 0 ? (
            <>
              <View style={styles.sectionHeaderWrap}>
                <SectionHeader label="Insights" />
              </View>
              {staleGroups.map((group) => (
                <AppCard
                  key={group.muscleGroup}
                  testID={`notifications-insight-${group.muscleGroup}`}
                  topAccent={colors.textPrimary}
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
            <View style={styles.loading}>
              <ActivityIndicator
                testID="notifications-activity-loading"
                size="large"
                color={colors.textPrimary}
              />
            </View>
          ) : activityError ? (
            <ErrorState
              testID="notifications-activity-error"
              message={activityError}
              onRetry={loadActivity}
            />
          ) : activity.length > 0 ? (
            <>
              <View style={styles.sectionHeaderWrap}>
                <SectionHeader label="Activity" />
              </View>
              {activity.map((item) => {
                const isPending = Boolean(pending[item.followId]);
                return (
                  <AppCard
                    key={`${item.kind}-${item.followId}`}
                    testID={`notifications-activity-${item.kind}-${item.followId}`}
                    topAccent={colors.textPrimary}
                  >
                    <View style={styles.itemRow}>
                      <Avatar
                        uri={item.user.avatarUrl}
                        initial={displayName(item.user).charAt(0).toUpperCase()}
                        size={44}
                        iconSize={20}
                        iconColor={colors.textSecondary}
                        initialStyle={styles.avatarInitial}
                      />
                      <View style={styles.itemBody}>
                        <Text style={styles.itemTitle}>
                          {item.kind === 'request'
                            ? `${displayName(item.user)} wants to follow you`
                            : `${displayName(item.user)} accepted your follow request`}
                        </Text>
                        <Text style={styles.itemSubtitle}>{formatCardDate(item.at)}</Text>
                      </View>
                    </View>
                    {item.kind === 'request' ? (
                      <View style={styles.itemActionWrap}>
                        <View style={styles.requestActions}>
                          <SecondaryButton
                            testID={`notifications-activity-request-${item.followId}-reject`}
                            label="Reject"
                            loading={isPending}
                            onPress={() => handleReject(item.followId)}
                          />
                          <PrimaryButton
                            testID={`notifications-activity-request-${item.followId}-accept`}
                            label="Accept"
                            loading={isPending}
                            onPress={() => handleAccept(item.followId)}
                          />
                        </View>
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
