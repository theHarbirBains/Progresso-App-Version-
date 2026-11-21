import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { GlassBackground } from '../design/GlassBackground';
import { ZoomablePhoto } from '../design/PhotoLightbox';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonCards } from '../design/Skeleton';
import { TextInput } from '../design/TextInput';
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
  listFollowRequests,
  respondToFollowRequest,
  sendFollowRequest,
  unfollowUser,
  type EarnedAchievement,
  type FollowUser,
  type FriendsFeedItem,
  type PersonProfile,
} from '../lib/api';
import { recallShown, rememberShown } from '../lib/lastShown';
import { fromKg } from '../lib/units';
import { useShowAllAtOnce } from '../lib/useShowAllAtOnce';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { withAlpha } from '../theme/accentColor';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';
import { compactNumber } from '../social/compactNumber';
import { AchievementEmblem } from '../achievements/AchievementEmblem';
import { RankEmblem } from '../achievements/RankEmblem';
import { nextRankLabel, rankForPoints } from '../achievements/ranks';
import { AnimatedBar } from '../design/AnimatedBar';
import { formatCardDate } from '../workouts/workoutFormat';
import { setText } from '../social/setText';
import { PeopleList, personLabel } from '../social/PeopleList';
import { OwnProfileSheet } from '../social/OwnProfileSheet';
import { PersonActionsSheet } from '../social/PersonActionsSheet';
import { shareProfile } from '../social/shareProfile';
import { MontageViewer } from '../profile/montage/MontageViewer';
import { ProfileMontage } from '../profile/montage/ProfileMontage';
import { useSocialSummaries } from '../social/useSocialSummaries';
import { personProfileStyles as styles } from './personProfileStyles';
import { confirmUnfollow } from '../social/confirmUnfollow';

type Props = RootStackScreenProps<'PersonProfile'>;
type Tab = 'stats' | 'workouts' | 'prs' | 'achievements';
/** Past this many exercises, the PRs tab offers a search. */
const LIFT_SEARCH_FROM = 6;
/** All the page asks of its screen's navigation -- PersonProfile's, or the You tab's. */
type Navigation = Pick<Props['navigation'], 'navigate' | 'push' | 'goBack' | 'addListener'>;

/**
 * What the You tab brings when it shows your own profile on this page (screens/ProfileScreen.tsx):
 * its own header, your photo to change, and your own figures inside the tabs, under what friends
 * see.
 */
export interface OwnProfile {
  header: ReactNode;
  /** Who you are from the shared profile, so a photo or bio just changed shows at once. */
  identity:
    | (Pick<FollowUser, 'displayName' | 'username' | 'avatarUrl'> & {
        lastName: string | null;
        bio: string | null;
      })
    | null;
  avatar: { onPress: () => void; saving: boolean };
  /** Above the page: a photo that didn't save, say. */
  notices?: ReactNode;
  stats?: ReactNode;
  prs?: ReactNode;
  /** Whether what those read is in, so the page shows all at once. */
  ready: boolean;
}

/** What the You tab last showed, so it opens again at once (lib/lastShown.ts). */
interface ShownProfile {
  profile: PersonProfile;
  workouts: FriendsFeedItem[];
  hasMore: boolean;
  requests: number;
}

const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
  { key: 'workouts', label: 'Workouts', icon: 'activity' },
  { key: 'prs', label: 'PRs', icon: 'award' },
  { key: 'achievements', label: 'Achievements', icon: 'star' },
];

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
 * their photo sits in an accent ring beside their name, and "@username · 12 workouts" under it;
 * their bio; "12 followers • 3 following" on one line (on your own, your follow requests between
 * them, when there are any) and the people you follow who follow them too; then Follow /
 * Following at full size with a small Share beside it -- on your own, nothing: Edit Profile and
 * Share Profile are behind the header's "..." -- with Accept and Decline above them when they
 * asked to follow you. For
 * you, or someone who accepted your follow: four figures -- workouts, the last 30 days, records
 * held and everything lifted -- then Stats (where it opens), Workouts (all of them, with likes
 * and comments), PRs (every exercise's best set, each opening its top sets and records) and
 * Achievements (the ones they've earned). Until then, a line saying
 * what following them shows. Report and Block are behind the header's "...". Read every time it
 * opens, the profile and its first workouts together, and shown with their likes all at once.
 */
export function PersonProfileScreen({ route, navigation }: Props) {
  return <PersonProfilePage userId={route.params.userId} navigation={navigation} />;
}

/** Someone's profile page -- or, with `own`, yours as the You tab shows it. */
export function PersonProfilePage({
  userId,
  navigation,
  own,
}: {
  userId: string;
  navigation: Navigation;
  own?: OwnProfile;
}) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const { theme, weightUnit } = useProgressTheme();
  const isOwn = own !== undefined;
  // Your own, from the You tab or opened like anyone's: your follow requests count beside it.
  const isMine = userId === user?.id;

  const [shown] = useState(() =>
    isOwn ? recallShown<ShownProfile>(user?.id, 'profile.page') : undefined,
  );
  const [fetchedProfile, setProfile] = useState<PersonProfile | null>(shown?.profile ?? null);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<FriendsFeedItem[]>(shown?.workouts ?? []);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(shown?.hasMore ?? false);
  const [requestCount, setRequestCount] = useState(shown?.requests ?? 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Your own, opened like anyone's: Edit Profile and Share Profile behind its "...".
  const [ownMenuOpen, setOwnMenuOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('stats');
  const [liftQuery, setLiftQuery] = useState('');
  const [mutualsOpen, setMutualsOpen] = useState(false);
  // Their montage, playing full screen.
  const [montageOpen, setMontageOpen] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !userId) return;
    setError(null);
    try {
      // All at once: the workouts are refused until they accept your follow, which the profile
      // says -- so a refusal there is no error; and on yours, your follow requests, whose count
      // simply doesn't show if they can't be read.
      const [next, first, requests] = await Promise.all([
        getPersonProfile(accessToken, userId),
        getPersonWorkouts(accessToken, userId, 0).catch(() => null),
        isMine ? listFollowRequests(accessToken).catch(() => null) : null,
      ]);
      const items = next.canSeeActivity && first ? first.items : [];
      const more = next.canSeeActivity && first ? first.hasMore : false;
      const waiting = requests?.length ?? 0;
      setProfile(next);
      setWorkouts(items);
      setHasMore(more);
      setRequestCount(waiting);
      setPage(0);
      if (isOwn) {
        rememberShown<ShownProfile>(user?.id, 'profile.page', {
          profile: next,
          workouts: items,
          hasMore: more,
          requests: waiting,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this profile');
    }
  }, [accessToken, userId, isOwn, isMine, user?.id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  // On yours, who you are comes from the shared profile, which a save changes at once.
  const identity = own?.identity;
  const profile: PersonProfile | null =
    fetchedProfile && identity
      ? {
          ...fetchedProfile,
          user: {
            ...fetchedProfile.user,
            displayName: identity.displayName,
            username: identity.username,
            avatarUrl: identity.avatarUrl,
          },
          lastName: identity.lastName,
          bio: identity.bio,
        }
      : fetchedProfile;

  const social = useSocialSummaries(
    workouts.map((item) => item.workout.id),
    isOwn ? 'profile.social' : undefined,
  );
  // The page shows all at once: who they are, their workouts with their likes, and on yours your
  // own figures -- or what there is after a few seconds. Opened again, the You tab starts from
  // what it last showed.
  const settled =
    shown !== undefined ||
    ((profile !== null || error !== null) && social.loaded && (own?.ready ?? true));
  const showPage = useShowAllAtOnce(settled);

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

  function handleUnfollow(target: PersonProfile) {
    if (target.followStatus === 'pending') {
      void run(() => unfollowUser(accessToken!, userId));
      return;
    }
    confirmUnfollow(firstName(target), () => void run(() => unfollowUser(accessToken!, userId)));
  }

  const label = profile ? personLabel(profile.user) : null;
  // Their full name -- first and last -- else their @username.
  const fullName = profile
    ? [profile.user.displayName?.trim(), profile.lastName?.trim()].filter(Boolean).join(' ')
    : '';
  const title = fullName || label?.title || '';
  // Their @username heads the page.
  const handle = profile?.user.username ? `@${profile.user.username}` : undefined;
  // Under the name: how many workouts they've done, once you can see that.
  const workoutCount = profile?.stats?.workouts ?? null;
  const subline =
    workoutCount !== null ? `${workoutCount} ${workoutCount === 1 ? 'workout' : 'workouts'}` : null;

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
          cardio: item.workout.cardio,
          activeMinutes: item.workout.activeMinutes,
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

  /** Their photo in a ring of the accent -- on yours, a spinner in its place while one saves. */
  function renderAvatar(target: PersonProfile, title: string) {
    return (
      <View style={[styles.avatarRing, { borderColor: theme.accent }]}>
        {own?.avatar.saving ? (
          <View style={styles.avatarSaving}>
            <ActivityIndicator testID="profile-avatar-saving" color={theme.accent} />
          </View>
        ) : (
          <Avatar
            uri={target.user.avatarUrl}
            initial={title.charAt(0).toUpperCase()}
            size={72}
            iconSize={30}
            iconColor={colors.textSecondary}
            initialStyle={styles.avatarInitial}
          />
        )}
      </View>
    );
  }

  function renderAchievement(achievement: EarnedAchievement, index: number) {
    const levelled = achievement.kind === 'levels';
    const step = levelled ? `Level ${achievement.level} of ${achievement.levels}` : 'Unlocked';
    return (
      <View
        key={achievement.id}
        testID={`person-profile-achievement-${achievement.id}`}
        style={[styles.achievement, index > 0 && styles.liftDivider]}
        accessible
        accessibilityLabel={`${achievement.title}, ${step}, ${achievement.ap} AP. ${achievement.description}. Last on ${formatCardDate(achievement.lastAwardedAt)}`}
      >
        <AchievementEmblem
          icon={achievement.icon as keyof typeof Feather.glyphMap}
          level={achievement.level}
          levels={achievement.levels}
          accentColor={theme.accent}
          size={40}
        />
        <View style={styles.liftText}>
          <Text style={styles.liftName} numberOfLines={1}>
            {achievement.title}
          </Text>
          <Text style={styles.liftMachine} numberOfLines={2}>
            {achievement.description}
          </Text>
          <Text style={styles.achievementWhen}>
            {step} · {formatCardDate(achievement.lastAwardedAt)}
          </Text>
        </View>
        <Text style={[styles.achievementAp, { color: theme.accent }]}>
          +{achievement.ap.toLocaleString('en-US')}
        </Text>
      </View>
    );
  }

  /** Their lifetime rank: emblem, rank and division, AP and the bar to the next division. */
  function renderRank(target: PersonProfile, title: string) {
    const rank = rankForPoints(target.rank!.points);
    const count = target.achievements?.length ?? null;
    return (
      <TouchableOpacity
        testID="person-profile-rank"
        style={styles.rank}
        onPress={() =>
          navigation.navigate(
            'RankProgression',
            target.isSelf ? undefined : { points: rank.points, name: firstName(target) },
          )
        }
        accessibilityRole="button"
        accessibilityLabel={`${target.isSelf ? 'Your' : `${title}'s`} rank: ${rank.label}, ${rank.points.toLocaleString('en-US')} AP. See every rank`}
      >
        <GlassBackground borderColor={withAlpha(rank.tier.palette.primary, 0.35)} />
        <RankEmblem tierIndex={rank.tierIndex} divisionIndex={rank.divisionIndex} size={48} />
        <View style={styles.rankText}>
          <View style={styles.rankLine}>
            <Text style={[styles.rankLabel, { color: rank.tier.palette.primary }]}>
              {rank.label}
            </Text>
            <Text style={styles.rankPoints}>
              {rank.points.toLocaleString('en-US')} AP
              {count !== null ? ` · ${count} ${count === 1 ? 'achievement' : 'achievements'}` : ''}
            </Text>
          </View>
          <AnimatedBar fraction={rank.progress} color={rank.tier.palette.primary} />
          <Text style={styles.rankNext}>
            {(rank.to - rank.points).toLocaleString('en-US')} AP to {nextRankLabel(rank)}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  function renderTab(target: PersonProfile, name: string) {
    const stats = target.stats;
    if (tab === 'achievements') {
      const earned = target.achievements ?? [];
      const seeAll = own ? (
        <TextButton
          testID="profile-all-achievements"
          label="See All Your Achievements"
          onPress={() => navigation.navigate('Achievements')}
        />
      ) : null;
      // Only what they've earned -- never what's still ahead.
      return earned.length === 0 ? (
        <>
          <EmptyState
            testID="person-profile-no-achievements"
            title="No achievements yet"
            description={
              target.isSelf
                ? 'Finish a workout to earn your first.'
                : 'Their achievements show here as they earn them.'
            }
          />
          {seeAll}
        </>
      ) : (
        <AppCard testID="person-profile-achievements">
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Achievements</Text>
            <Text testID="person-profile-achievement-count" style={styles.ranksEarned}>
              {earned.length} earned
            </Text>
          </View>
          {earned.map(renderAchievement)}
          {seeAll}
        </AppCard>
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
      return (
        <>
          {renderLifts(target)}
          {own?.prs}
        </>
      );
    }
    return (
      <>
        {stats ? (
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
                ...(target.rank
                  ? [
                      {
                        id: 'ap',
                        value: target.rank.points.toLocaleString('en-US'),
                        label: 'Achievement Points',
                      },
                    ]
                  : []),
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
        ) : null}
        {own?.stats}
      </>
    );
  }

  /**
   * Every exercise they've done, the most-done first, each with its best set and opening its top
   * sets and records -- searchable once there are more than a few. With none, an empty state,
   * unless your full records below say so.
   */
  function renderLifts(target: PersonProfile) {
    const all = target.exercises ?? [];
    if (all.length === 0) {
      return own?.prs ? null : (
        <EmptyState
          testID="person-profile-no-lifts"
          title="No lifts yet"
          description={`${target.isSelf ? 'Your' : 'Their'} best set on each exercise shows here.`}
        />
      );
    }
    const query = liftQuery.trim().toLowerCase();
    const shown = query
      ? all.filter((lift) =>
          [lift.exerciseName, machineLine(lift)].some((text) =>
            text?.toLowerCase().includes(query),
          ),
        )
      : all;
    return (
      <AppCard testID="person-profile-lifts">
        <SectionHeader label="Every Exercise" />
        {all.length > LIFT_SEARCH_FROM ? (
          <View style={styles.liftSearch}>
            <TextInput
              testID="person-profile-lift-search"
              placeholder="Search exercises"
              accessibilityLabel="Search exercises"
              value={liftQuery}
              onChangeText={setLiftQuery}
              autoCapitalize="none"
              leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
            />
          </View>
        ) : null}
        {shown.length === 0 ? (
          <Text testID="person-profile-lift-none" style={styles.liftNone}>
            No exercise matches &quot;{liftQuery.trim()}&quot;.
          </Text>
        ) : null}
        {shown.map((lift, index) => {
          const machine = machineLine(
            lift,
            `${lift.workouts} ${lift.workouts === 1 ? 'workout' : 'workouts'}`,
          );
          const best = setText(lift, lift.measurementType, weightUnit);
          return (
            <TouchableOpacity
              key={lift.exerciseId}
              testID={`person-profile-lift-${lift.exerciseId}`}
              style={[styles.lift, index > 0 && styles.liftDivider]}
              onPress={() =>
                navigation.navigate('PersonExercise', {
                  userId,
                  exerciseId: lift.exerciseId,
                  name: lift.exerciseName,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${lift.exerciseName}, best ${best}. See every top set and record`}
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
              <Text style={[styles.liftValue, { color: theme.accent }]}>{best}</Text>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </AppCard>
    );
  }

  return (
    <Screen
      testID={own ? 'profile-screen' : undefined}
      scrollTestID={own ? 'profile-scroll' : 'person-profile-scroll'}
      contentContainerStyle={styles.content}
      header={
        own ? (
          own.header
        ) : (
          <AppHeader
            testID="person-profile-header"
            title={handle}
            onBack={() => navigation.goBack()}
            rightAction={
              !profile
                ? undefined
                : profile.isSelf
                  ? {
                      icon: 'more-horizontal',
                      onPress: () => setOwnMenuOpen(true),
                      accessibilityLabel: 'Edit or share your profile',
                      testID: 'person-profile-own-menu',
                    }
                  : {
                      icon: 'more-horizontal',
                      onPress: () => setActionsOpen(true),
                      accessibilityLabel: `More options for ${title || 'this person'}`,
                      testID: 'person-profile-more',
                    }
            }
          />
        )
      }
    >
      {own?.notices}
      {error && !profile ? (
        <ErrorState testID="person-profile-error" message={error} onRetry={() => void load()} />
      ) : !profile || !label || !showPage ? (
        <SkeletonCards
          testID={own ? 'profile-loading' : 'person-profile-loading'}
          heights={[200, 90, 220]}
        />
      ) : (
        <>
          <View testID="person-profile-identity" style={styles.top}>
            <View style={styles.identity}>
              {own ? (
                <TouchableOpacity
                  testID="profile-avatar"
                  onPress={own.avatar.onPress}
                  disabled={own.avatar.saving}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile picture"
                >
                  {renderAvatar(profile, title)}
                  <View style={[styles.avatarEditBadge, { backgroundColor: theme.accent }]}>
                    <Feather name="camera" size={13} color={theme.onAccent} />
                  </View>
                </TouchableOpacity>
              ) : profile.user.avatarUrl ? (
                // Their photo opens full screen, to see it properly.
                <ZoomablePhoto
                  uri={profile.user.avatarUrl}
                  name={title}
                  testID="person-profile-photo"
                >
                  {renderAvatar(profile, title)}
                </ZoomablePhoto>
              ) : (
                renderAvatar(profile, title)
              )}
              <View style={styles.identityText}>
                <Text
                  testID="person-profile-name"
                  style={styles.name}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                {subline ? (
                  <Text testID="person-profile-subline" style={styles.subline} numberOfLines={1}>
                    {subline}
                  </Text>
                ) : null}
              </View>
            </View>

            {profile.bio ? (
              <Text testID="person-profile-bio" style={styles.bio}>
                {profile.bio}
              </Text>
            ) : null}

            <View testID="person-profile-counts" style={styles.counts}>
              <TouchableOpacity
                testID="person-profile-count-followers"
                style={styles.count}
                disabled={!profile.canSeeActivity}
                onPress={() =>
                  navigation.navigate('FollowList', {
                    userId,
                    which: 'followers',
                    name: title,
                  })
                }
                accessibilityRole={profile.canSeeActivity ? 'button' : undefined}
              >
                <Text style={styles.countText}>
                  {profile.followerCount} {profile.followerCount === 1 ? 'follower' : 'followers'}
                </Text>
              </TouchableOpacity>
              {isMine && requestCount > 0 ? (
                <>
                  <Text style={styles.countDot}>•</Text>
                  <TouchableOpacity
                    testID="person-profile-count-requests"
                    style={styles.count}
                    onPress={() => navigation.navigate('FindPeople', { tab: 'requests' })}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.countText, { color: theme.accent }]}>
                      {requestCount} {requestCount === 1 ? 'request' : 'requests'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
              <Text style={styles.countDot}>•</Text>
              <TouchableOpacity
                testID="person-profile-count-following"
                style={styles.count}
                disabled={!profile.canSeeActivity}
                onPress={() =>
                  navigation.navigate('FollowList', {
                    userId,
                    which: 'following',
                    name: title,
                  })
                }
                accessibilityRole={profile.canSeeActivity ? 'button' : undefined}
              >
                <Text style={styles.countText}>{profile.followingCount} following</Text>
              </TouchableOpacity>
            </View>

            {profile.mutuals.count > 0 ? (
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
                <Text style={styles.mutualText} numberOfLines={1}>
                  {profile.mutuals.count} mutual{' '}
                  {profile.mutuals.count === 1 ? 'friend' : 'friends'}
                </Text>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}

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

            {/* Someone else's: Follow at full size, Share small beside it. Your own has no
                buttons on the page -- the profile is the page, not its buttons (Harbir's call):
                Edit Profile and Share Profile are behind the header's "...". */}
            {profile.isSelf ? null : (
              <View style={styles.actions}>
                <View style={styles.action}>
                  {profile.followStatus === 'accepted' ? (
                    <PrimaryButton
                      testID="person-profile-following"
                      label="Following"
                      size="md"
                      loading={busy}
                      onPress={() => handleUnfollow(profile)}
                      accentColor={theme.accent}
                      onAccentColor={theme.onAccent}
                    />
                  ) : profile.followStatus === 'pending' ? (
                    <SecondaryButton
                      testID="person-profile-requested"
                      label="Requested"
                      size="md"
                      loading={busy}
                      onPress={() => handleUnfollow(profile)}
                    />
                  ) : (
                    <PrimaryButton
                      testID="person-profile-follow"
                      label="Follow"
                      size="md"
                      loading={busy}
                      onPress={() => void run(() => sendFollowRequest(accessToken!, userId))}
                      accentColor={theme.accent}
                      onAccentColor={theme.onAccent}
                    />
                  )}
                </View>
                <SecondaryButton
                  testID="person-profile-share"
                  label="Share"
                  icon="share"
                  size="sm"
                  onPress={() =>
                    shareProfile({ isSelf: false, username: profile.user.username }, title)
                  }
                  accessibilityLabel={`Share ${title}'s profile`}
                />
              </View>
            )}

            {/* Their montage, once you can see their activity and they've added to it -- one or more,
                yours just as others see it (it's added to and changed from Edit Profile). Tapped,
                it plays full screen. */}
            {profile.montage && profile.montage.length > 0 ? (
              <>
                <ProfileMontage
                  testID="person-profile-montage"
                  items={profile.montage}
                  accent={theme.accent}
                  ownerName={firstName(profile)}
                  isOwn={profile.isSelf}
                  onOpen={() => setMontageOpen(true)}
                  paused={montageOpen}
                />
                <MontageViewer
                  testID="person-profile-montage-viewer"
                  items={profile.montage}
                  visible={montageOpen}
                  ownerName={firstName(profile)}
                  isOwn={profile.isSelf}
                  onClose={() => setMontageOpen(false)}
                  accent={theme.accent}
                />
              </>
            ) : null}

            {profile.rank ? renderRank(profile, title) : null}
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
                  : 'Their workouts, stats, achievements and lifts show here once they accept.'
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

              {renderTab(profile, title)}
            </>
          )}

          <BottomSheet
            visible={mutualsOpen}
            onClose={() => setMutualsOpen(false)}
            testID="person-profile-mutuals-sheet"
          >
            <Text style={styles.sheetTitle}>Mutual Friends</Text>
            <Text style={styles.sheetSubtitle}>People you follow who follow {title}</Text>
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
      <OwnProfileSheet
        visible={ownMenuOpen}
        onClose={() => setOwnMenuOpen(false)}
        onEditProfile={() => navigation.navigate('SettingsPersonalInfo')}
        onShare={() =>
          shareProfile({ isSelf: true, username: profile?.user.username ?? null }, title)
        }
      />
    </Screen>
  );
}
