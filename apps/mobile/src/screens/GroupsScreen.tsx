import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { SecondaryButton, PrimaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { spacing, widgetGap } from '../design/theme';
import {
  listGroupInvites,
  listGroups,
  respondToGroupInvite,
  type GroupInvite,
  type GroupSummary,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { formatCardDate } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'Groups'>;

/** Group workouts: answer invites and open the groups that are live. A group is started from Start Workout. */
export function GroupsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  async function answer(groupId: string, action: 'accept' | 'decline') {
    if (!accessToken) return;
    try {
      await respondToGroupInvite(accessToken, groupId, action);
      if (action === 'accept') navigation.navigate('GroupSession', { groupId });
      await load();
    } catch (err) {
      Alert.alert('Could not answer the invite', err instanceof Error ? err.message : 'Try again');
    }
  }

  return (
    <Screen
      scrollTestID="groups-scroll"
      contentContainerStyle={{ gap: widgetGap }}
      header={
        <AppHeader
          title="Group Workouts"
          subtitle="Your live and invited groups"
          onBack={() => navigation.goBack()}
          testID="groups-header"
        />
      }
    >
      {error ? (
        <ErrorState testID="groups-error" message={error} onRetry={() => void load()} />
      ) : null}
      {groups === null && !error ? <LoadingState testID="groups-loading" /> : null}

      {groups !== null ? (
        <>
          {invites.length > 0 ? (
            <AppCard testID="groups-invites">
              <SectionHeader label="Invites" />
              {invites.map((invite, index) => (
                <View key={invite.groupId} style={styles.invite}>
                  <ListRow
                    testID={`group-invite-${invite.groupId}`}
                    title={invite.name}
                    subtitle={`From ${invite.hostDisplayName ?? 'a friend'}`}
                    detail={formatCardDate(invite.invitedAt)}
                    divider={index > 0}
                  />
                  <View style={styles.actions}>
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
                      accentColor={theme.accent}
                      onAccentColor={theme.onAccent}
                      onPress={() => void answer(invite.groupId, 'accept')}
                    />
                  </View>
                </View>
              ))}
            </AppCard>
          ) : null}

          <AppCard testID="groups-live">
            <SectionHeader label="Live now" />
            {groups.length === 0 ? (
              <EmptyState
                testID="groups-empty"
                title="No live groups"
                description="Start one from Start Workout, or accept an invite."
              />
            ) : (
              groups.map((group, index) => (
                <ListRow
                  key={group.id}
                  testID={`group-row-${group.id}`}
                  title={group.name}
                  subtitle={group.myRole === 'host' ? 'You are hosting' : 'You are in this group'}
                  detail={formatCardDate(group.startedAt)}
                  chevron
                  divider={index > 0}
                  onPress={() => navigation.navigate('GroupSession', { groupId: group.id })}
                />
              ))
            )}
          </AppCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  invite: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
};
