import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { RiseIn } from '../design/RiseIn';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, TextButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { cancelGroupWorkout, finishGroup, getGroup, type GroupDetail } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { liveWorkoutStyles as styles } from './liveWorkoutStyles';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { hasLoggedSets } from '../workouts/groupWorkoutHistory';
import { GroupInvitations } from '../workouts/GroupInvitations';
import { GroupWorkoutEditor, type LiveWorkoutFinish } from '../workouts/GroupWorkoutEditor';
import { usePreviousExercises } from '../workouts/usePreviousExercises';
import { refreshNextWorkout } from '../widgets/nextWorkoutRefresh';
import { showNextWorkoutWidget } from '../widgets/widgetUpdates';
import {
  endWorkoutActivities,
  endWorkoutActivity,
  showWorkoutActivity,
} from '../widgets/workoutActivity';

type Props = RootStackScreenProps<'GroupSession'>;

/**
 * One group session, laid out like the regular live workout: the header, then the
 * workout's exercises and sets, then Finish. The only addition is a row of tabs across
 * the top of the workout, one per person in the group. Who is training is chosen when
 * the group starts (see GroupStartScreen); more friends can be invited while it's going, and
 * every invite and its answer shows under the workout (GroupInvitations).
 */
export function GroupSessionScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id ?? '';
  const { theme, activeWorkoutSplitId } = useProgressTheme();
  // The editor's Finish step, called before the group is finished.
  const editorFinish = useRef<LiveWorkoutFinish | null>(null);
  const { refetch: refetchAllTimeStats } = useAllTimeStats();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  // Add Exercise's previous exercises -- the signed-in person's own, with their split day's
  // muscles when their group workout is one (unknown until the group is read).
  const previousExercises = usePreviousExercises(
    userId || undefined,
    group
      ? (group.members.find((member) => member.userId === userId)?.workoutSplitDayId ?? null)
      : undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setGroup(await getGroup(accessToken, groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this group');
    }
  }, [accessToken, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  // While the group is going and you're training in it, it's on the Lock Screen and the Next
  // Workout widget; found finished, its Lock Screen card ends.
  useEffect(() => {
    if (!group) return;
    const key = `group:${group.id}`;
    const training = group.members.some(
      (member) => member.userId === userId && member.status === 'joined',
    );
    if (group.status === 'live' && training) {
      const url = `progresso://groups/${group.id}`;
      void showWorkoutActivity(
        key,
        { title: group.name, kind: 'Group workout', startedAt: Date.parse(group.startedAt) },
        url,
      );
      void showNextWorkoutWidget(
        { title: group.name, kind: 'Group workout', startedAt: group.startedAt, url },
        null,
      );
    } else {
      void endWorkoutActivity(key);
    }
  }, [group, userId]);

  /** The group ended for you: off the Lock Screen, and Next Workout shows what's next again. */
  function afterEnded() {
    void endWorkoutActivities();
    void refreshNextWorkout(userId, activeWorkoutSplitId);
  }

  /** Runs one change. Resolves true only if it saved, so a failed change never leaves the screen. */
  async function run(action: () => Promise<unknown>, failure: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      Alert.alert(failure, err instanceof Error ? err.message : 'Try again');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    if (!accessToken) return;
    Alert.alert('Finish the group', 'This completes everyone’s workout in the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            // Timers stopped, sets left empty asked about, and everything typed saved first.
            if (!((await editorFinish.current?.readyToFinish()) ?? true)) return;
            const saved = await run(
              () => finishGroup(accessToken, groupId),
              'Could not finish the group',
            );
            if (!saved) return;
            afterEnded();
            // Your workout in the group is in your history and stats now, like a solo one.
            void refetchAllTimeStats();
            // Trained in it yourself: on to your share card, as after a solo workout, with
            // Workout History underneath. Only coached (nothing of your own logged): back.
            const mine = group?.members.find((member) => member.userId === userId)?.workoutId;
            if (mine && (await hasLoggedSets(mine))) {
              navigation.reset({
                index: 1,
                routes: [
                  { name: 'WorkoutHistory' },
                  { name: 'ShareWorkout', params: { workoutId: mine, justFinished: true } },
                ],
              });
              return;
            }
            navigation.goBack();
          })(),
      },
    ]);
  }

  // Discards the caller's workout, so it is never kept in history. The host ending it ends the group for everyone.
  function cancel() {
    if (!accessToken) return;
    Alert.alert(
      'Cancel your workout?',
      isHost
        ? 'Everyone’s open workout in this group is discarded and the group ends. Nothing is saved. This cannot be undone.'
        : 'Your workout is discarded and you leave the group. This cannot be undone.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Cancel workout',
          style: 'destructive',
          onPress: () =>
            void run(() => cancelGroupWorkout(accessToken, groupId), 'Could not cancel').then(
              (saved) => {
                if (!saved) return;
                afterEnded();
                navigation.goBack();
              },
            ),
        },
      ],
    );
  }

  const isHost = group?.hostId === userId;
  const isLive = group?.status === 'live';
  const joined = group?.members.filter((member) => member.status === 'joined') ?? [];
  const editorMembers = joined.flatMap((member) =>
    member.workoutId
      ? [{ userId: member.userId, displayName: member.displayName, workoutId: member.workoutId }]
      : [],
  );

  if (!group && error) {
    return (
      <Screen
        scroll={false}
        header={<AppHeader title="Group" onBack={() => navigation.goBack()} />}
      >
        <ErrorState testID="group-session-error" message={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (!group) {
    return <LoadingState testID="group-session-loading" />;
  }

  return (
    <Screen
      scroll={false}
      padded={false}
      keyboardAvoiding
      // The group editor rolls its own widgets out; the cards around it rise on their own.
      rollout={false}
      header={
        <AppHeader
          title={group.name}
          subtitle={isLive ? `${joined.length} in the group` : 'Finished'}
          onBack={() => navigation.goBack()}
          testID="group-session-header"
        />
      }
    >
      <ScrollView
        keyboardDismissMode="on-drag"
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text testID="group-session-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {group.status === 'finished' ? (
          <RiseIn>
            <AppCard testID="group-session-finished">
              <ListRow
                title="This group has finished"
                subtitle="Its workouts are in each person’s history"
              />
            </AppCard>
          </RiseIn>
        ) : null}

        {isLive && editorMembers.length > 0 ? (
          <GroupWorkoutEditor
            previousExercises={previousExercises}
            members={editorMembers}
            finishRef={editorFinish}
            startedAt={group.startedAt}
            userId={userId}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
            warmupsAndDrops
            testID="group-workout"
          />
        ) : null}

        {accessToken ? (
          <RiseIn>
            <GroupInvitations
              group={group}
              accessToken={accessToken}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
              onChanged={load}
            />
          </RiseIn>
        ) : null}
      </ScrollView>

      {isLive ? (
        <View style={styles.footer}>
          <PrimaryButton
            testID="group-finish"
            label={busy ? 'Finishing…' : 'Finish Group Workout'}
            onPress={finish}
            disabled={busy}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
          <TextButton testID="group-cancel" label="Cancel Workout" destructive onPress={cancel} />
        </View>
      ) : null}
    </Screen>
  );
}
