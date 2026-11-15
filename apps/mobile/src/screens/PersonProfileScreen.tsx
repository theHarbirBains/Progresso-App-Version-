import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { useHeroBackdrop } from '../design/AppBackgroundLayer';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { GlassBackground } from '../design/GlassBackground';
import { IconButton } from '../design/IconButton';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonCards } from '../design/Skeleton';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { UnderlineTabs } from '../design/UnderlineTabs';
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
import { formatWeightKg, fromKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { FITNESS_GOAL_OPTIONS } from '../onboarding/onboardingOptions';
import { useProgressTheme } from '../progress/useProgressTheme';
import { withAlpha } from '../theme/accentColor';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';
import { AchievementBadge } from '../social/AchievementBadge';
import { badgesFor, compactNumber, featuredBadges, type Badge } from '../social/achievements';
import { PeopleList, personLabel } from '../social/PeopleList';
import { PersonActionsSheet } from '../social/PersonActionsSheet';
import { useSocialSummaries } from '../social/useSocialSummaries';
import { personProfileStyles as styles } from './personProfileStyles';

type Props = RootStackScreenProps<'PersonProfile'>;
type Tab = 'overview' | 'workouts' | 'prs' | 'stats';

const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'workouts', label: 'Workouts', icon: 'activity' },
  { key: 'prs', label: 'PRs', icon: 'award' },
  { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
];

/** Each fitness goal's glyph on its chip. */
const GOAL_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  build_muscle: 'trending-up',
  get_stronger: 'zap',
  lose_fat: 'trending-down',
  improve_fitness: 'activity',
  improve_athletic_performance: 'target',
  maintain_fitness: 'shield',
  general_health: 'heart',
  other: 'star',
};

/** "Sam" from "Sam Lee", else their @username, else "them". */
function firstName(profile: PersonProfile): string {
  const name = profile.user.displayName?.trim();
  if (name) return name.split(/\s+/)[0] ?? name;
  return profile.user.username ? `@${profile.user.username}` : 'them';
}

/** One of the four figures: its glyph in the accent, the figure, what it is. */
function StatTile({
  icon,
  value,
  unit,
  label,
  accent,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  unit?: string;
  label: string;
  accent: string;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={styles.tile}
      accessible
      accessibilityLabel={`${value}${unit ? ` ${unit}` : ''} ${label}`}
    >
      <GlassBackground borderColor={withAlpha(accent, 0.35)} />
      <Feather name={icon} size={18} color={accent} />
      <View style={styles.tileValueRow}>
        <Text
          style={styles.tileValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {value}
          {unit ? <Text style={styles.tileLabel}>{` ${unit}`}</Text> : null}
        </Text>
      </View>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Someone's profile, after the design Harbir drew: the theme's photo glowing behind the top, where
 * their photo sits in an accent ring beside their name, @username, bio and fitness goals; their
 * followers and following, and the people you follow who follow them too; one wide Follow /
 * Following button (or Accept and Decline, or Edit Profile on your own) with Share beside it. For
 * you, or someone who accepted your follow: four figures -- workouts, the last 30 days, records
 * held and everything lifted -- then Overview (badges and their latest workout), Workouts (all of
 * them, with likes and comments), PRs (their heaviest lifts) and Stats. Until then, a line saying
 * what following them shows. Report and Block are behind the header's "...". Read every time it
 * opens, the profile and its first workouts together, so the page shows all at once.
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
  const [tab, setTab] = useState<Tab>('overview');
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [mutualsOpen, setMutualsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      // Both at once: the workouts are refused until they accept your follow, which the profile
      // says -- so a refusal there is no error.
      const [next, first] = await Promise.all([
        getPersonProfile(accessToken, userId),
        getPersonWorkouts(accessToken, userId, 0).catch(() => null),
      ]);
      setProfile(next);
      if (next.canSeeActivity && first) {
        setWorkouts(first.items);
        setHasMore(first.hasMore);
      } else {
        setWorkouts([]);
        setHasMore(false);
      }
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this profile');
    }
  }, [accessToken, userId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  // The photo glows through the top of the page, as behind Feed's hero.
  useHeroBackdrop(profile !== null);

  const social = useSocialSummaries(workouts.map((item) => item.workout.id));
  const badges = useMemo(
    () => (profile?.stats ? badgesFor(profile.stats, weightUnit) : []),
    [profile?.stats, weightUnit],
  );

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

  function share(target: PersonProfile, name: string) {
    const handle = target.user.username ? `@${target.user.username}` : null;
    const message = target.isSelf
      ? `Follow me on Progresso${handle ? `: ${handle}` : '.'}`
      : `Check out ${name} on Progresso${handle ? ` (${handle})` : ''}.`;
    void Share.share({ message }).catch(() => undefined);
  }

  const label = profile ? personLabel(profile.user) : null;

  function renderWorkout(item: FriendsFeedItem, target: PersonProfile, name: string) {
    const summary = social.summaries[item.workout.id];
    const open = (focusComments?: boolean) =>
      navigation.navigate('WorkoutDetail', {
        workoutId: item.workout.id,
        ...(target.isSelf ? {} : { authorId: userId }),
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
        authorName={name}
        avatarUrl={target.user.avatarUrl}
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
  }

  function renderBadge(badge: Badge) {
    return (
      <View key={badge.id} style={styles.badgeColumn} testID={`person-profile-badge-${badge.id}`}>
        <AchievementBadge badge={badge} accentColor={theme.accent} />
        <Text style={styles.badgeTitle} numberOfLines={2}>
          {badge.title}
        </Text>
      </View>
    );
  }

  function renderTab(target: PersonProfile, name: string) {
    const stats = target.stats;
    if (tab === 'overview') {
      const featured = featuredBadges(badges);
      return (
        <>
          {stats ? (
            <AppCard testID="person-profile-achievements">
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Achievements</Text>
                <TouchableOpacity
                  testID="person-profile-badges-all"
                  style={styles.viewAll}
                  onPress={() => setBadgesOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="View all achievements"
                >
                  <Text style={[styles.viewAllLabel, { color: theme.accent }]}>View All</Text>
                  <Feather name="arrow-right" size={14} color={theme.accent} />
                </TouchableOpacity>
              </View>
              <View
                style={styles.badges}
                accessible
                accessibilityLabel={`Achievements: ${
                  featured
                    .filter((b) => b.earned)
                    .map((b) => b.title)
                    .join(', ') || 'none earned yet'
                }`}
              >
                {featured.map(renderBadge)}
              </View>
            </AppCard>
          ) : null}
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader label="Recent Activity" />
          </View>
          {workouts[0] ? (
            renderWorkout(workouts[0], target, name)
          ) : (
            <EmptyState
              testID="person-profile-no-workouts"
              title="No workouts yet"
              description="Finished workouts show here."
            />
          )}
        </>
      );
    }
    if (tab === 'workouts') {
      return workouts.length === 0 ? (
        <EmptyState
          testID="person-profile-no-workouts"
          title="No workouts yet"
          description="Finished workouts show here."
        />
      ) : (
        <>
          {workouts.map((item) => renderWorkout(item, target, name))}
          {hasMore ? (
            <TextButton
              testID="person-profile-load-more"
              label={loadingMore ? 'Loading...' : 'Load More'}
              onPress={() => void loadMore()}
            />
          ) : null}
        </>
      );
    }
    if (tab === 'prs') {
      return target.bestLifts && target.bestLifts.length > 0 ? (
        <AppCard testID="person-profile-lifts">
          <SectionHeader label="Heaviest Lifts" />
          {target.bestLifts.map((lift, index) => {
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
      ) : (
        <EmptyState
          testID="person-profile-no-lifts"
          title="No lifts yet"
          description="Their heaviest set on each weighted exercise shows here."
        />
      );
    }
    return stats ? (
      <AppCard testID="person-profile-stats">
        <View style={styles.statGrid}>
          {[
            { id: 'workouts', value: String(stats.workouts), label: 'Workouts' },
            { id: 'recent', value: String(stats.lastThirtyDays), label: 'Last 30 Days' },
            { id: 'month', value: String(stats.bestMonthWorkouts), label: 'Busiest Month' },
            { id: 'prs', value: String(stats.prCount), label: 'PRs Held' },
            {
              id: 'volume',
              value: `${compactNumber(fromKg(stats.totalVolumeKg, weightUnit))} ${weightUnit}`,
              label: 'Total Volume',
            },
            {
              id: 'badges',
              value: `${badges.filter((b) => b.earned).length} of ${badges.length}`,
              label: 'Badges',
            },
          ].map((cell) => (
            <View key={cell.id} style={styles.statCell}>
              <StatBlock
                testID={`person-profile-stats-${cell.id}`}
                value={cell.value}
                label={cell.label}
              />
            </View>
          ))}
        </View>
      </AppCard>
    ) : null;
  }

  return (
    <Screen
      scrollTestID="person-profile-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          testID="person-profile-header"
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
        <SkeletonCards testID="person-profile-loading" heights={[200, 90, 220]} />
      ) : (
        <>
          <View testID="person-profile-identity" style={styles.top}>
            <View style={styles.identity}>
              <View style={[styles.avatarRing, { borderColor: theme.accent }]}>
                <Avatar
                  uri={profile.user.avatarUrl}
                  initial={label.title.charAt(0).toUpperCase()}
                  size={88}
                  iconSize={36}
                  iconColor={colors.textSecondary}
                  initialStyle={styles.avatarInitial}
                />
              </View>
              <View style={styles.identityText}>
                <Text
                  testID="person-profile-name"
                  style={styles.name}
                  numberOfLines={2}
                  accessibilityRole="header"
                >
                  {label.title}
                </Text>
                {label.subtitle ? <Text style={styles.username}>{label.subtitle}</Text> : null}
                {profile.bio ? (
                  <Text testID="person-profile-bio" style={styles.bio}>
                    {profile.bio}
                  </Text>
                ) : null}
                {profile.followsYou ? (
                  <Text testID="person-profile-follows-you" style={styles.followsYou}>
                    Follows you
                  </Text>
                ) : null}
                {profile.fitnessGoals.length > 0 ? (
                  <View testID="person-profile-goals" style={styles.chips}>
                    {profile.fitnessGoals.map((goal) => (
                      <View key={goal} style={styles.chip}>
                        <GlassBackground bordered={false} />
                        <Feather
                          name={GOAL_ICONS[goal] ?? 'star'}
                          size={13}
                          color={colors.textPrimary}
                        />
                        <Text style={styles.chipLabel}>
                          {FITNESS_GOAL_OPTIONS.find((option) => option.value === goal)?.label ??
                            goal}
                        </Text>
                      </View>
                    ))}
                  </View>
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
              <View style={styles.countDivider} />
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
              {profile.mutuals.count > 0 ? (
                <>
                  <View style={styles.countDivider} />
                  <TouchableOpacity
                    testID="person-profile-mutuals"
                    style={styles.mutuals}
                    onPress={() => setMutualsOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`${profile.mutuals.count} mutual ${
                      profile.mutuals.count === 1 ? 'friend' : 'friends'
                    }`}
                  >
                    <View style={styles.mutualAvatars}>
                      {profile.mutuals.people.slice(0, 3).map((person, index) => (
                        <View
                          key={person.id}
                          style={[styles.mutualAvatar, index > 0 && styles.mutualAvatarOverlap]}
                        >
                          <Avatar
                            uri={person.avatarUrl}
                            initial={personLabel(person).title.charAt(0).toUpperCase()}
                            size={26}
                            iconSize={12}
                            iconColor={colors.textSecondary}
                          />
                        </View>
                      ))}
                    </View>
                    <Text style={styles.mutualText} numberOfLines={2}>
                      {profile.mutuals.count} mutual{' '}
                      {profile.mutuals.count === 1 ? 'friend' : 'friends'}
                    </Text>
                    <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </>
              ) : null}
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
                    accentColor={theme.accent}
                    onAccentColor={theme.onAccent}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.actions}>
              <View style={styles.mainAction}>
                {profile.isSelf ? (
                  <SecondaryButton
                    testID="person-profile-edit"
                    label="Edit Profile"
                    icon="edit-2"
                    size="md"
                    onPress={() => navigation.navigate('SettingsPersonalInfo')}
                  />
                ) : profile.followStatus === 'accepted' ? (
                  <PrimaryButton
                    testID="person-profile-following"
                    label="Following"
                    icon="user-check"
                    size="md"
                    loading={busy}
                    onPress={() => confirmUnfollow(profile)}
                    accentColor={theme.accent}
                    onAccentColor={theme.onAccent}
                  />
                ) : profile.followStatus === 'pending' ? (
                  <SecondaryButton
                    testID="person-profile-requested"
                    label="Requested"
                    icon="clock"
                    size="md"
                    loading={busy}
                    onPress={() => confirmUnfollow(profile)}
                  />
                ) : (
                  <PrimaryButton
                    testID="person-profile-follow"
                    label="Follow"
                    icon="user-plus"
                    size="md"
                    loading={busy}
                    onPress={() => void run(() => sendFollowRequest(accessToken!, userId))}
                    accentColor={theme.accent}
                    onAccentColor={theme.onAccent}
                  />
                )}
              </View>
              <IconButton
                testID="person-profile-share"
                icon="share"
                onPress={() => share(profile, label.title)}
                accessibilityLabel={profile.isSelf ? 'Share your profile' : `Share ${label.title}`}
              />
            </View>
          </View>

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
                  : 'Their workouts, stats, badges and heaviest lifts show here once they accept.'
              }
            />
          ) : (
            <>
              {profile.stats ? (
                <View testID="person-profile-tiles" style={styles.tiles}>
                  <StatTile
                    testID="person-profile-stat-workouts"
                    icon="activity"
                    value={String(profile.stats.workouts)}
                    label="Workouts"
                    accent={theme.accent}
                  />
                  <StatTile
                    testID="person-profile-stat-recent"
                    icon="calendar"
                    value={String(profile.stats.lastThirtyDays)}
                    label="Last 30 Days"
                    accent={theme.accent}
                  />
                  <StatTile
                    testID="person-profile-stat-prs"
                    icon="award"
                    value={String(profile.stats.prCount)}
                    label="PRs"
                    accent={theme.accent}
                  />
                  <StatTile
                    testID="person-profile-stat-volume"
                    icon="layers"
                    value={compactNumber(fromKg(profile.stats.totalVolumeKg, weightUnit))}
                    unit={weightUnit}
                    label="Total Volume"
                    accent={theme.accent}
                  />
                </View>
              ) : null}

              <UnderlineTabs
                testID="person-profile-tab"
                categories={TABS}
                active={tab}
                onSelect={setTab}
                accentColor={theme.accent}
              />

              {renderTab(profile, label.title)}
            </>
          )}

          <BottomSheet
            visible={badgesOpen}
            onClose={() => setBadgesOpen(false)}
            testID="person-profile-badges-sheet"
          >
            <Text style={styles.sheetTitle}>Achievements</Text>
            <Text style={styles.sheetSubtitle}>
              {badges.filter((b) => b.earned).length} of {badges.length} earned
            </Text>
            <ScrollView>
              {badges.map((badge) => (
                <View
                  key={badge.id}
                  testID={`person-profile-badges-${badge.id}`}
                  style={styles.badgeRow}
                  accessible
                  accessibilityLabel={`${badge.title}. ${badge.requirement}. ${
                    badge.earned ? 'Earned' : 'Not earned yet'
                  }`}
                >
                  <AchievementBadge badge={badge} accentColor={theme.accent} size={40} />
                  <View style={styles.badgeRowText}>
                    <Text style={styles.badgeRowTitle}>{badge.title}</Text>
                    <Text style={styles.badgeRowRequirement}>{badge.requirement}</Text>
                  </View>
                  {badge.earned ? (
                    <Text style={[styles.badgeEarned, { color: theme.accent }]}>Earned</Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </BottomSheet>

          <BottomSheet
            visible={mutualsOpen}
            onClose={() => setMutualsOpen(false)}
            testID="person-profile-mutuals-sheet"
          >
            <Text style={styles.sheetTitle}>Mutual Friends</Text>
            <Text style={styles.sheetSubtitle}>People you follow who follow {label.title}</Text>
            <ScrollView>
              <PeopleList
                people={profile.mutuals.people.map((user) => ({ user, status: 'accepted' }))}
                selfId=""
                onOpen={(id) => {
                  setMutualsOpen(false);
                  navigation.push('PersonProfile', { userId: id });
                }}
                testIDPrefix="person-profile-mutual"
              />
            </ScrollView>
          </BottomSheet>
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
