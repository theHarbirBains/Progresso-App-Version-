import { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonCards } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { listTrainerClients, startLiveWorkout } from '../lib/api';
import { recallShown, rememberShown } from '../lib/lastShown';
import { AppMenuContext } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { clientName, pickableClients } from '../trainer/clientPicker';
import {
  fetchMyOpenLiveSessions,
  type ActivityClient,
  type TrainerOpenSession,
} from '../trainer/clientQueries';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher';

type Props = RootStackScreenProps<'TrainerSessions'>;

interface SessionsData {
  open: TrainerOpenSession[];
  clients: ActivityClient[];
}

function startedLabel(iso: string): string {
  return `Started ${new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/**
 * The Trainer Workspace's Sessions tab: the live sessions you're running now, to pick
 * back up, then every client with the two ways to log for them -- Start a live session
 * as they train (or Resume theirs), or Log a workout they've already done. Starting asks
 * first, since it opens a session on the client's account; and only one session runs
 * at a time, so Start waits while another is open.
 */
export function TrainerSessionsScreen({ navigation }: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const { theme } = useProgressTheme();
  // The side menu and the workspace switcher (both absent outside the app shell, e.g. in a test).
  const menu = useContext(AppMenuContext);
  const workspace = useWorkspace();

  // What this page showed last time (lib/lastShown.ts): reopening the tab starts from it.
  const [data, setData] = useState<SessionsData | null>(
    () => recallShown<SessionsData>(userId, 'trainer.sessions') ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [startingFor, setStartingFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !userId) return;
    setError(null);
    try {
      const [open, clients] = await Promise.all([
        fetchMyOpenLiveSessions(userId),
        listTrainerClients(accessToken),
      ]);
      const next: SessionsData = {
        open,
        // Active clients only (sorted by name) -- you can't log for someone who hasn't accepted yet.
        clients: pickableClients(clients, new Set()).map((client) => ({
          clientId: client.clientId as string,
          name: clientName(client),
        })),
      };
      setData(next);
      rememberShown(userId, 'trainer.sessions', next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions');
    }
  }, [accessToken, userId]);

  // Loads each time the page comes into view -- including the first, so no separate mount load.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  // A trainer runs one live session at a time (the database allows no second), so
  // while one is open the other clients' Start waits for it to finish.
  const running = data?.open[0];

  function resume(open: TrainerOpenSession) {
    navigation.navigate('TrainerLiveWorkout', {
      workoutId: open.workoutId,
      clientId: open.clientId,
      clientName: open.clientName,
      startedAt: open.startedAt,
    });
  }

  function confirmStart(client: ActivityClient) {
    Alert.alert(
      `Start a live session with ${client.name}?`,
      'You log their sets as they train, then finish the session.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => void start(client) },
      ],
    );
  }

  async function start(client: ActivityClient) {
    if (!accessToken || startingFor) return;
    setStartingFor(client.clientId);
    try {
      const startedAt = new Date().toISOString();
      const { workoutId } = await startLiveWorkout(accessToken, client.clientId, 'Live session');
      navigation.navigate('TrainerLiveWorkout', {
        workoutId,
        clientId: client.clientId,
        clientName: client.name,
        startedAt,
      });
    } catch (err) {
      Alert.alert('Could not start the session', err instanceof Error ? err.message : 'Try again');
    } finally {
      setStartingFor(null);
    }
  }

  return (
    <Screen
      contentContainerStyle={{ gap: widgetGap }}
      header={
        <AppHeader
          testID="trainer-sessions-header"
          title="Sessions"
          titleContent={workspace?.isTrainer ? <WorkspaceSwitcher /> : undefined}
          leftAction={
            menu
              ? {
                  icon: 'menu',
                  onPress: () => menu.openMenu(),
                  accessibilityLabel: 'Open menu',
                  testID: 'trainer-sessions-open-menu',
                }
              : undefined
          }
        />
      }
    >
      {error && !data ? (
        <ErrorState testID="trainer-sessions-error" message={error} onRetry={() => void load()} />
      ) : null}

      {!data && !error ? <SkeletonCards testID="trainer-sessions-loading" /> : null}

      {running ? (
        <AppCard hero topAccent={theme.accent} testID="trainer-sessions-live">
          <SectionHeader label="Live now" />
          {data?.open.map((open, index) => (
            <ListRow
              key={open.workoutId}
              testID={`trainer-sessions-live-${open.workoutId}`}
              icon="play-circle"
              title={open.clientName}
              subtitle={startedLabel(open.startedAt)}
              divider={index > 0}
              onPress={() => resume(open)}
            />
          ))}
        </AppCard>
      ) : null}

      {data ? (
        <AppCard testID="trainer-sessions-clients">
          <SectionHeader label="Your clients" />
          {data.clients.length === 0 ? (
            <>
              <Text testID="trainer-sessions-no-clients" style={styles.note}>
                No clients yet. Add someone to start logging their workouts.
              </Text>
              <PrimaryButton
                testID="trainer-sessions-add-client"
                label="Add Client"
                onPress={() => navigation.navigate('TrainerClientForm')}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
              />
            </>
          ) : (
            <>
              <Text testID="trainer-sessions-clients-note" style={styles.note}>
                {running
                  ? `You run one live session at a time. Finish ${running.clientName}’s to start another, or log a past workout for anyone.`
                  : 'Start a live session as they train, or log a workout they’ve already done.'}
              </Text>
              {data.clients.map((client, index) => {
                const open = data.open.find((session) => session.clientId === client.clientId);
                return (
                  <ListRow
                    key={client.clientId}
                    testID={`trainer-sessions-client-${client.clientId}`}
                    title={client.name}
                    divider={index > 0}
                    trailing={
                      <View style={styles.actions}>
                        <SecondaryButton
                          testID={`trainer-sessions-log-${client.clientId}`}
                          label="Log"
                          size="sm"
                          onPress={() =>
                            navigation.navigate('TrainerLogWorkout', {
                              clientId: client.clientId,
                              clientName: client.name,
                            })
                          }
                        />
                        <PrimaryButton
                          testID={`trainer-sessions-start-${client.clientId}`}
                          label={open ? 'Resume' : 'Start'}
                          size="sm"
                          loading={startingFor === client.clientId}
                          disabled={startingFor !== null || (running !== undefined && !open)}
                          accentColor={theme.accent}
                          onAccentColor={theme.onAccent}
                          onPress={() => (open ? resume(open) : confirmStart(client))}
                        />
                      </View>
                    }
                  />
                );
              })}
            </>
          )}
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
