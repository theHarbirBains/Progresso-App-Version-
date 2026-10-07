import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, TextButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { cancelGroupWorkout, finishGroup, getGroup, type GroupDetail } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { liveWorkoutStyles as styles } from './liveWorkoutStyles';
import { GroupWorkoutEditor } from '../workouts/GroupWorkoutEditor';

type Props = RootStackScreenProps<'GroupSession'>;

/**
 * One group session, laid out like the regular live workout: the header, then the
 * workout's exercises and sets, then Finish. The only addition is a row of tabs across
 * the top of the workout, one per person in the group. Who is training is chosen when
 * the group starts (see GroupStartScreen); nobody can be added once it has started.
 */
export function GroupSessionScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id ?? '';
  const { theme } = useProgressTheme();

  const [group, setGroup] = useState<GroupDetail | null>(null);
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
          void run(() => finishGroup(accessToken, groupId), 'Could not finish the group').then(
            (saved) => {
              if (saved) navigation.goBack();
            },
          ),
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
                if (saved) navigation.goBack();
              },
            ),
        },
      ],
    );
  }

  const isHost = group?.hostId === userId;
  const isLive = group?.status === 'live';
  const joined = group?.members.filter((member) => member.status === 'joined') ?? [];
  const invited = group?.members.filter((member) => member.status === 'invited') ?? [];
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
          <AppCard testID="group-session-finished">
            <ListRow
              title="This group has finished"
              subtitle="Its workouts are in each person’s history"
            />
          </AppCard>
        ) : null}

        {isLive && editorMembers.length > 0 ? (
          <GroupWorkoutEditor
            members={editorMembers}
            startedAt={group.startedAt}
            userId={userId}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
            testID="group-workout"
          />
        ) : null}

        {invited.length > 0 ? (
          <AppCard testID="group-session-invited">
            <SectionHeader label="Invited" />
            {invited.map((member, index) => (
              <ListRow
                key={member.userId}
                title={member.displayName ?? 'Invited'}
                subtitle="Waiting for them to accept"
                divider={index > 0}
              />
            ))}
          </AppCard>
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
