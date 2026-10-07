import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { getTrainerStatus, listTrainerClients, type TrainerClient } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { clientName } from '../trainer/clientPicker';
import { trainerClientStatusLabel } from '../trainer/trainerLabels';

type Props = RootStackScreenProps<'TrainerClients'>;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; isTrainer: boolean; clients: TrainerClient[] };

/** The groups a client list is split into, in the order they are shown. */
interface ClientGroups {
  active: TrainerClient[];
  tracked: TrainerClient[];
  pending: TrainerClient[];
  invited: TrainerClient[];
}

/**
 * Sorts each client into the one group that says what needs doing for them: a tracked
 * client with no account yet, an active client, a link they have not accepted, or an
 * invite that has not been opened. Each group is sorted by name.
 */
function groupClients(clients: TrainerClient[]): ClientGroups {
  const byName = (a: TrainerClient, b: TrainerClient) =>
    clientName(a).localeCompare(clientName(b), undefined, { sensitivity: 'base' });
  const groups: ClientGroups = { active: [], tracked: [], pending: [], invited: [] };
  for (const client of clients) {
    if (client.status === 'invited') groups.invited.push(client);
    else if (client.awaitingClaim) groups.tracked.push(client);
    else if (client.status === 'pending') groups.pending.push(client);
    else groups.active.push(client);
  }
  groups.active.sort(byName);
  groups.tracked.sort(byName);
  groups.pending.sort(byName);
  groups.invited.sort(byName);
  return groups;
}

/**
 * A trainer's clients, grouped by what each one needs: the hero counts them and offers
 * Add Client, then one widget per group. Trainer mode is workouts only; logging for a
 * client is in TrainerClientDetail.
 */
export function TrainerClientsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setState({ status: 'loading' });
    try {
      const { isTrainer } = await getTrainerStatus(accessToken);
      const clients = isTrainer ? await listTrainerClients(accessToken) : [];
      setState({ status: 'ready', isTrainer, clients });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not load your clients',
      });
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const isTrainer = state.status === 'ready' && state.isTrainer;
  const clients = useMemo(() => (state.status === 'ready' ? state.clients : []), [state]);
  const groups = useMemo(() => groupClients(clients), [clients]);
  const activeCount = groups.active.length;
  const trackedCount = groups.tracked.length;
  const waitingCount = groups.pending.length + groups.invited.length;

  const goToAdd = () => navigation.navigate('TrainerClientForm');

  return (
    <Screen
      scrollTestID="trainer-clients-scroll"
      contentContainerStyle={{ gap: widgetGap }}
      header={
        <AppHeader
          title="Clients"
          subtitle="Track workouts for the people you train"
          onBack={() => navigation.goBack()}
          rightAction={
            isTrainer
              ? {
                  icon: 'plus',
                  onPress: goToAdd,
                  accessibilityLabel: 'Add client',
                  testID: 'trainer-clients-add',
                }
              : undefined
          }
          testID="trainer-clients-header"
        />
      }
    >
      {state.status === 'loading' ? <LoadingState testID="trainer-clients-loading" /> : null}

      {state.status === 'error' ? (
        <ErrorState
          testID="trainer-clients-error"
          message={state.message}
          onRetry={() => void load()}
        />
      ) : null}

      {state.status === 'ready' && !state.isTrainer ? (
        <EmptyState
          testID="trainer-clients-not-trainer"
          title="Trainer mode is not available"
          description="Clients are managed with a Trainer subscription."
        />
      ) : null}

      {state.status === 'ready' && state.isTrainer && clients.length === 0 ? (
        <EmptyState
          testID="trainer-clients-empty"
          title="No clients yet"
          description="Add someone to your client pool, even if they do not use Progresso yet. Track their workouts from the start."
          action={{ label: 'Add Client', onPress: goToAdd, testID: 'trainer-clients-empty-add' }}
        />
      ) : null}

      {state.status === 'ready' && state.isTrainer && clients.length > 0 ? (
        <>
          <AppCard hero topAccent={theme.accent} testID="trainer-clients-summary">
            <View style={styles.stats}>
              <StatBlock
                testID="trainer-clients-count-active"
                value={String(activeCount)}
                label="Active"
                valueColor={theme.accent}
              />
              <StatBlock
                testID="trainer-clients-count-tracked"
                value={String(trackedCount)}
                label="Tracked"
              />
              <StatBlock
                testID="trainer-clients-count-waiting"
                value={String(waitingCount)}
                label="Waiting"
              />
            </View>
            <PrimaryButton
              testID="trainer-clients-add-another"
              label="Add Client"
              onPress={goToAdd}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </AppCard>

          {groups.active.length > 0 ? (
            <ClientGroupCard
              title="Active"
              testID="trainer-clients-active"
              clients={groups.active}
              onOpen={openDetail}
            />
          ) : null}
          {groups.tracked.length > 0 ? (
            <ClientGroupCard
              title="Not on Progresso yet"
              hint="Their history waits here. They can link it later with a claim code."
              testID="trainer-clients-tracked"
              clients={groups.tracked}
              onOpen={openDetail}
            />
          ) : null}
          {groups.pending.length > 0 ? (
            <ClientGroupCard
              title="Waiting to accept"
              testID="trainer-clients-pending"
              clients={groups.pending}
              onOpen={openDetail}
            />
          ) : null}
          {groups.invited.length > 0 ? (
            <ClientGroupCard
              title="Invites sent"
              testID="trainer-clients-invited"
              clients={groups.invited}
              onOpen={openDetail}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );

  function openDetail(client: TrainerClient) {
    if (!client.clientId) return;
    navigation.navigate('TrainerClientDetail', {
      clientId: client.clientId,
      clientName: client.displayName ?? undefined,
    });
  }
}

interface GroupCardProps {
  title: string;
  hint?: string;
  testID: string;
  clients: TrainerClient[];
  onOpen: (client: TrainerClient) => void;
}

/**
 * One widget per group of clients. An invite has no account yet, so its row has nothing
 * to open and is shown without a chevron.
 */
function ClientGroupCard({ title, hint, testID, clients, onOpen }: GroupCardProps) {
  return (
    <AppCard testID={testID}>
      <SectionHeader label={title} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {clients.map((client, index) => {
        const openable = client.clientId !== null;
        return (
          <ListRow
            key={client.clientId ?? client.inviteId ?? `${title}-${index}`}
            testID={
              openable ? `trainer-client-${client.clientId}` : `trainer-invite-${client.inviteId}`
            }
            title={client.displayName ?? client.email ?? 'Unnamed client'}
            subtitle={trainerClientStatusLabel(client)}
            chevron={openable}
            divider={index > 0}
            onPress={openable ? () => onOpen(client) : undefined}
          />
        );
      })}
    </AppCard>
  );
}

const styles = {
  stats: {
    flexDirection: 'row' as const,
    gap: widgetGap,
    marginBottom: spacing.md,
  },
  hint: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
};
