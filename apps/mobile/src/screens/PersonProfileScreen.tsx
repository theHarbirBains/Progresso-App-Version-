import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonCards } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import { machineLine } from '../exercises/machineDetails';
import { WorkoutFeedCard } from '../feed/WorkoutFeedCard';
import {
  getPersonProfile,
  getPersonWorkouts,
  respondToFollowRequest,
  sendFollowRequest,
  unfollowUser,
  type FriendsFeedItem,
  type PersonProfile,
} from '../lib/api';
import { formatWeightKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { FollowButton } from '../social/FollowButton';
import { personLabel } from '../social/PeopleList';
import { PersonActionsSheet } from '../social/PersonActionsSheet';
import { useSocialSummaries } from '../social/useSocialSummaries';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';

type Props = RootStackScreenProps<'PersonProfile'>;

/** "Sam" from "Sam Lee", else their @username, else "them". */
function firstName(profile: PersonProfile): string {
  const name = profile.user.displayName?.trim();
  if (name) return name.split(/\s+/)[0] ?? name;
  return profile.user.username ? `@${profile.user.username}` : 'them';
}

/**
 * Someone's profile. Who they are -- photo, name, @username, "Follows you" -- with how many
 * follow them and how many they follow, and Follow / Requested / Following (or, when they asked
 * to follow you, Accept and Decline). For you, or someone who accepted your follow: their
 * workouts in all and in the last 30 days, their heaviest lift on each exercise (with its photo,
 * gym and grip), the people they follow and who follow them, and their workouts in full, newest
 * first, each with its likes and comments. Until then, a line saying what following them shows.
 * Report and Block are behind the header's "...". Read every time it opens.
 */
export function PersonProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();

  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<FriendsFeedItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const next = await getPersonProfile(accessToken, userId);
      setProfile(next);
      if (next.canSeeActivity) {
        const first = await getPersonWorkouts(accessToken, userId, 0);
        setWorkouts(first.items);
        setHasMore(first.hasMore);
        setPage(0);
      } else {
        setWorkouts([]);
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this profile');
    }
  }, [accessToken, userId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  const social = useSocialSummaries(workouts.map((item) => item.workout.id));

  async function loadMore() {
    if (!accessToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await getPersonWorkouts(accessToken, userId, page + 1);
      setWorkouts((prev) => [...prev, ...next.items]);
      setHasMore(next.hasMore);
      setPage(page + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more workouts');
    } finally {
      setLoadingMore(false);
    }
  }

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      Alert.alert('That did not work', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmUnfollow(target: PersonProfile) {
    if (target.followStatus === 'pending') {
      void run(() => unfollowUser(accessToken!, userId));
      return;
    }
    Alert.alert(`Unfollow ${firstName(target)}?`, "You won't see their workouts any more.", [
      { text: 'Keep Following', style: 'cancel' },
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: () => void run(() => unfollowUser(accessToken!, userId)),
      },
    ]);
  }

  const label = profile ? personLabel(profile.user) : null;

  return (
    <Screen
      scrollTestID="person-profile-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          testID="person-profile-header"
          title={label?.title ?? 'Profile'}
          onBack={() => navigation.goBack()}
          rightAction={
            profile && !profile.isSelf
              ? {
                  icon: 'more-horizontal',
                  onPress: () => setActionsOpen(true),
                  accessibilityLabel: `More options for ${label?.title ?? 'this person'}`,
                  testID: 'person-profile-more',
                }
              : undefined
          }
        />
      }
    >
      {error && !profile ? (
        <ErrorState testID="person-profile-error" message={error} onRetry={() => void load()} />
      ) : !profile || !label ? (
        <SkeletonCards testID="person-profile-loading" heights={[220, 140, 200]} />
      ) : (
        <>
          <AppCard hero topAccent={theme.accent} testID="person-profile-identity">
            <View style={styles.identity}>
              <Avatar
                uri={profile.user.avatarUrl}
                initial={label.title.charAt(0).toUpperCase()}
                size={72}
                iconSize={32}
                iconColor={colors.textSecondary}
                initialStyle={styles.avatarInitial}
              />
              <View style={styles.identityText}>
                <Text testID="person-profile-name" style={styles.name} numberOfLines={2}>
                  {label.title}
                </Text>
                {label.subtitle ? <Text style={styles.username}>{label.subtitle}</Text> : null}
                {profile.followsYou ? (
                  <Text testID="person-profile-follows-you" style={styles.followsYou}>
                    Follows you
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.counts}>
              <TouchableOpacity
                testID="person-profile-count-followers"
                style={styles.count}
                disabled={!profile.canSeeActivity}
                onPress={() =>
                  navigation.navigate('FollowList', {
                    userId,
                    which: 'followers',
                    name: label.title,
                  })
                }
                accessibilityRole={profile.canSeeActivity ? 'button' : undefined}
                accessibilityLabel={`${profile.followerCount} ${profile.followerCount === 1 ? 'follower' : 'followers'}`}
              >
                <Text style={styles.countValue}>{profile.followerCount}</Text>
                <Text style={styles.countLabel}>
                  {profile.followerCount === 1 ? 'Follower' : 'Followers'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="person-profile-count-following"
                style={styles.count}
                disabled={!profile.canSeeActivity}
                onPress={() =>
                  navigation.navigate('FollowList', {
                    userId,
                    which: 'following',
                    name: label.title,
                  })
                }
                accessibilityRole={profile.canSeeActivity ? 'button' : undefined}
                accessibilityLabel={`Following ${profile.followingCount}`}
              >
                <Text style={styles.countValue}>{profile.followingCount}</Text>
                <Text style={styles.countLabel}>Following</Text>
              </TouchableOpacity>
            </View>

            {profile.requestId ? (
              <View testID="person-profile-request" style={styles.request}>
                <Text style={styles.requestText}>{firstName(profile)} wants to follow you.</Text>
                <View style={styles.requestActions}>
                  <SecondaryButton
                    testID="person-profile-request-decline"
                    label="Decline"
                    size="sm"
                    loading={busy}
                    onPress={() =>
                      void run(() =>
                        respondToFollowRequest(accessToken!, profile.requestId!, 'reject'),
                      )
                    }
                  />
                  <PrimaryButton
                    testID="person-profile-request-accept"
                    label="Accept"
                    size="sm"
                    loading={busy}
                    onPress={() =>
                      void run(() =>
                        respondToFollowRequest(accessToken!, profile.requestId!, 'accept'),
                      )
                    }
                  />
                </View>
              </View>
            ) : null}

            {!profile.isSelf ? (
              <View style={styles.followAction}>
                <FollowButton
                  testID="person-profile"
                  size="md"
                  status={profile.followStatus}
                  loading={busy}
                  onFollow={() => void run(() => sendFollowRequest(accessToken!, userId))}
                  onUnfollow={() => confirmUnfollow(profile)}
                />
              </View>
            ) : null}
          </AppCard>

          {!profile.canSeeActivity ? (
            <EmptyState
              testID="person-profile-private"
              title={
                profile.followStatus === 'pending'
                  ? 'Request sent'
                  : `Follow ${firstName(profile)} to see their training`
              }
              description={
                profile.followStatus === 'pending'
                  ? `You'll see ${firstName(profile)}'s workouts, stats and lifts once they accept.`
                  : 'Their workouts, stats and heaviest lifts show here once they accept.'
              }
            />
          ) : (
            <>
              {profile.stats ? (
                <AppCard testID="person-profile-stats">
                  <View style={styles.statRow}>
                    <StatBlock
                      testID="person-profile-stat-workouts"
                      value={String(profile.stats.workouts)}
                      label="Workouts"
                      valueColor={theme.accent}
                    />
                    <StatBlock
                      testID="person-profile-stat-recent"
                      value={String(profile.stats.lastThirtyDays)}
                      label="Last 30 Days"
                    />
                  </View>
                </AppCard>
              ) : null}

              {profile.bestLifts && profile.bestLifts.length > 0 ? (
                <AppCard testID="person-profile-lifts">
                  <SectionHeader label="Heaviest Lifts" />
                  {profile.bestLifts.map((lift, index) => {
                    const machine = machineLine(lift);
                    return (
                      <View
                        key={lift.exerciseId}
                        testID={`person-profile-lift-${lift.exerciseId}`}
                        style={[styles.lift, index > 0 && styles.liftDivider]}
                      >
                        <ExercisePhoto
                          testID={`person-profile-lift-${lift.exerciseId}-photo`}
                          uri={lift.photoUrl}
                          name={lift.exerciseName}
                          size={40}
                        />
                        <View style={styles.liftText}>
                          <Text style={styles.liftName} numberOfLines={1}>
                            {lift.exerciseName}
                          </Text>
                          {machine ? (
                            <Text style={styles.liftMachine} numberOfLines={1}>
                              {machine}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[styles.liftValue, { color: theme.accent }]}>
                          {formatWeightKg(lift.weightKg, weightUnit)} {weightUnit} × {lift.reps}
                        </Text>
                      </View>
                    );
                  })}
                </AppCard>
              ) : null}

              <View style={styles.workoutsHeader}>
                <SectionHeader label="Workouts" />
              </View>
              {workouts.length === 0 ? (
                <EmptyState
                  testID="person-profile-no-workouts"
                  title="No workouts yet"
                  description="Finished workouts show here."
                />
              ) : (
                workouts.map((item) => {
                  const summary = social.summaries[item.workout.id];
                  const open = (focusComments?: boolean) =>
                    navigation.navigate('WorkoutDetail', {
                      workoutId: item.workout.id,
                      ...(profile.isSelf ? {} : { authorId: userId }),
                      ...(focusComments ? { focusComments: true } : {}),
                    });
                  return (
                    <WorkoutFeedCard
                      key={item.id}
                      idPrefix="person-profile-workout"
                      workout={{
                        id: item.workout.id,
                        name: item.workout.splitDayName ?? item.workout.name,
                        muscleGroups: item.workout.muscleGroups as SplitMuscleGroup[],
                        durationMinutes: item.workout.durationMinutes,
                        completedExerciseCount: item.workout.completedExerciseCount,
                        completedSetCount: item.workout.completedSetCount,
                        topSets: item.workout.topSets,
                      }}
                      authorName={label.title}
                      avatarUrl={profile.user.avatarUrl}
                      timestamp={item.timestamp}
                      weightUnit={weightUnit}
                      onPress={() => open()}
                      social={
                        summary
                          ? {
                              summary,
                              onToggleLike: () => void social.toggleLike(item.workout.id),
                              onComments: () => open(true),
                              accentColor: theme.accent,
                            }
                          : undefined
                      }
                    />
                  );
                })
              )}
              {hasMore ? (
                <TextButton
                  testID="person-profile-load-more"
                  label={loadingMore ? 'Loading...' : 'Load More'}
                  onPress={() => void loadMore()}
                />
              ) : null}
            </>
          )}
        </>
      )}
      <PersonActionsSheet
        person={actionsOpen && profile ? profile.user : null}
        onClose={() => setActionsOpen(false)}
        onBlocked={() => navigation.goBack()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: widgetGap,
    paddingBottom: spacing.xxl,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatarInitial: {
    ...typeScale.screenTitle,
    color: colors.textSecondary,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  username: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  followsYou: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  counts: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  count: {
    minHeight: 44,
    justifyContent: 'center',
  },
  countValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  countLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  request: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  requestText: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  followAction: {
    marginTop: spacing.lg,
    alignItems: 'flex-start',
  },
  statRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  lift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  liftDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  liftText: {
    flex: 1,
  },
  liftName: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  liftMachine: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  liftValue: {
    ...typeScale.statSmall,
  },
  workoutsHeader: {
    marginTop: spacing.md,
  },
});
