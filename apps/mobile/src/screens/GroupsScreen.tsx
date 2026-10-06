import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import {
  createGroup,
  listGroupInvites,
  listGroups,
  respondToGroupInvite,
  type GroupInvite,
  type GroupSummary,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { formatCardDate } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'Groups'>;

/** Group workouts: start one, see the live ones you are in, and answer invites. */
export function GroupsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const [live, waiting] = await Promise.all([
        listGroups(accessToken),
        listGroupInvites(accessToken),
      ]);
      setGroups(live);
      setInvites(waiting);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your groups');
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function start() {
    if (!accessToken || busy) return;
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Name the group first');
      return;
    }
    setBusy(true);
    try {
      const { groupId } = await createGroup(accessToken, { name: trimmed });
      setName('');
      navigation.navigate('GroupSession', { groupId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the group');
    } finally {
      setBusy(false);
    }
  }

  async function answer(groupId: string, action: 'accept' | 'decline') {
    if (!accessToken) return;
    try {
      await respondToGroupInvite(accessToken, groupId, action);
      if (action === 'accept') {
        navigation.navigate('GroupSession', { groupId });
      }
      await load();
    } catch (err) {
      Alert.alert('Could not answer the invite', err instanceof Error ? err.message : 'Try again');
    }
  }

  return (
    <Screen
      scrollTestID="groups-scroll"
      header={
        <AppHeader
          title="Group Workouts"
          onBack={() => navigation.goBack()}
          testID="groups-header"
        />
      }
    >
      <View style={{ gap: 6 }}>
        <AppCard testID="groups-start">
          <SectionHeader label="Start a group" />
          <TextInput
            testID="groups-name-input"
            label="Group name"
            value={name}
            onChangeText={setName}
            placeholder="Thursday legs"
          />
          <PrimaryButton
            testID="groups-create"
            label="Start Group"
            onPress={() => void start()}
            loading={busy}
            disabled={busy}
          />
        </AppCard>

        {error ? (
          <ErrorState testID="groups-error" message={error} onRetry={() => void load()} />
        ) : null}

        {groups === null && !error ? <LoadingState testID="groups-loading" /> : null}

        {invites.length > 0 ? (
          <AppCard testID="groups-invites">
            <SectionHeader label="Invites" />
            {invites.map((invite, index) => (
              <View key={invite.groupId} style={{ gap: 8 }}>
                <ListRow
                  testID={`group-invite-${invite.groupId}`}
                  title={invite.name}
                  subtitle={`From ${invite.hostDisplayName ?? 'a friend'}`}
                  detail={formatCardDate(invite.invitedAt)}
                  divider={index > 0}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <SecondaryButton
                    testID={`group-invite-decline-${invite.groupId}`}
                    label="Decline"
                    size="sm"
                    onPress={() => void answer(invite.groupId, 'decline')}
                  />
                  <PrimaryButton
                    testID={`group-invite-accept-${invite.groupId}`}
                    label="Accept"
                    size="sm"
                    onPress={() => void answer(invite.groupId, 'accept')}
                  />
                </View>
              </View>
            ))}
          </AppCard>
        ) : null}

        {groups !== null && groups.length === 0 && !error ? (
          <EmptyState
            testID="groups-empty"
            title="No live groups"
            description="Start a group workout with friends, clients and guests. Everyone in it can enter and edit sets."
          />
        ) : null}

        {groups !== null && groups.length > 0 ? (
          <AppCard testID="groups-live">
            <SectionHeader label="Live now" />
            {groups.map((group, index) => (
              <ListRow
                key={group.id}
                testID={`group-row-${group.id}`}
                icon="users"
                title={group.name}
                subtitle={group.myRole === 'host' ? 'You are hosting' : 'You are in this group'}
                detail={formatCardDate(group.startedAt)}
                chevron
                divider={index > 0}
                onPress={() => navigation.navigate('GroupSession', { groupId: group.id })}
              />
            ))}
          </AppCard>
        ) : null}
      </View>
    </Screen>
  );
}
