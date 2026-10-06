import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import {
  addGroupGuest,
  finishGroup,
  getGroup,
  inviteToGroup,
  leaveGroup,
  type GroupDetail,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { LiveWorkoutEditor } from '../workouts/LiveWorkoutEditor';

type Props = RootStackScreenProps<'GroupSession'>;

/**
 * One group session. Every joined member's workout is shown with an editor, so
 * anyone in the group can enter and change sets and exercises. Friends and clients
 * are invited by username; guests are added by name, with no account needed.
 */
export function GroupSessionScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id ?? '';

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [guestName, setGuestName] = useState('');
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

  async function run(action: () => Promise<unknown>, failure: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      Alert.alert(failure, err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  function invite() {
    const trimmed = username.trim().toLowerCase();
    if (!accessToken || trimmed === '') return;
    void run(async () => {
      await inviteToGroup(accessToken, groupId, trimmed);
      setUsername('');
    }, 'Could not invite them');
  }

  function addGuest() {
    const trimmed = guestName.trim();
    if (!accessToken || trimmed === '') return;
    void run(async () => {
      await addGroupGuest(accessToken, groupId, trimmed);
      setGuestName('');
    }, 'Could not add the guest');
  }

  function finish() {
    if (!accessToken) return;
    Alert.alert('Finish the group', 'This completes everyone’s workout in the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: () =>
          void run(() => finishGroup(accessToken, groupId), 'Could not finish the group').then(() =>
            navigation.goBack(),
          ),
      },
    ]);
  }

  function leave() {
    if (!accessToken) return;
    void run(() => leaveGroup(accessToken, groupId), 'Could not leave the group').then(() =>
      navigation.goBack(),
    );
  }

  const isHost = group?.hostId === userId;

  return (
    <Screen
      scrollTestID="group-session-scroll"
      header={
        <AppHeader
          title={group?.name ?? 'Group'}
          onBack={() => navigation.goBack()}
          testID="group-session-header"
        />
      }
    >
      {error ? (
        <ErrorState testID="group-session-error" message={error} onRetry={() => void load()} />
      ) : null}
      {!group && !error ? <LoadingState testID="group-session-loading" /> : null}

      {group ? (
        <View style={{ gap: 6 }}>
          {group.status === 'finished' ? (
            <AppCard testID="group-session-finished">
              <ListRow
                title="This group has finished"
                subtitle="Its workouts are in each person’s history"
              />
            </AppCard>
          ) : null}

          {group.members
            .filter((member) => member.status === 'joined')
            .map((member) => (
              <AppCard key={member.userId} testID={`group-member-${member.userId}`}>
                <SectionHeader
                  label={`${member.displayName ?? 'Member'}${member.isGuest ? ' · guest' : ''}${member.role === 'host' ? ' · host' : ''}`}
                />
                {member.workoutId ? (
                  <LiveWorkoutEditor
                    workoutId={member.workoutId}
                    userId={userId}
                    testID={`group-workout-${member.userId}`}
                  />
                ) : null}
              </AppCard>
            ))}

          {group.members.some((member) => member.status === 'invited') ? (
            <AppCard testID="group-session-invited">
              <SectionHeader label="Invited" />
              {group.members
                .filter((member) => member.status === 'invited')
                .map((member, index) => (
                  <ListRow
                    key={member.userId}
                    title={member.displayName ?? 'Invited'}
                    subtitle="Waiting for them to accept"
                    divider={index > 0}
                  />
                ))}
            </AppCard>
          ) : null}

          {group.status === 'live' ? (
            <AppCard testID="group-session-add">
              <SectionHeader label="Add to the group" />
              <TextInput
                testID="group-invite-username"
                label="Friend or client's username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
              <SecondaryButton
                testID="group-invite-submit"
                label="Invite"
                onPress={invite}
                disabled={busy}
              />
              <TextInput
                testID="group-guest-name"
                label="Guest's name"
                value={guestName}
                onChangeText={setGuestName}
                helperText="A guest needs no Progresso account."
              />
              <SecondaryButton
                testID="group-guest-submit"
                label="Add Guest"
                onPress={addGuest}
                disabled={busy}
              />
            </AppCard>
          ) : null}

          {group.status === 'live' ? (
            <PrimaryButton
              testID="group-finish"
              label="Finish Group"
              onPress={finish}
              disabled={busy}
            />
          ) : null}

          {group.status === 'live' && !isHost ? (
            <TextButton testID="group-leave" label="Leave Group" destructive onPress={leave} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
