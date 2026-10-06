import { useCallback, useEffect, useState } from 'react';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { useAuth } from '../auth/AuthProvider';
import { getTrainerStatus, listTrainerClients, type TrainerClient } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { trainerClientStatusLabel } from '../trainer/trainerLabels';

type Props = RootStackScreenProps<'TrainerClients'>;

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; isTrainer: boolean; clients: TrainerClient[] };

/** A trainer's clients. Trainer mode is workouts only; logging for a client is in TrainerClientDetail. */
export function TrainerClientsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
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

  return (
    <Screen
      scrollTestID="trainer-clients-scroll"
      header={
        <AppHeader
          title="Clients"
          onBack={() => navigation.goBack()}
          rightAction={
            isTrainer
              ? {
                  icon: 'plus',
                  onPress: () => navigation.navigate('TrainerClientForm'),
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

      {state.status === 'ready' && state.isTrainer && state.clients.length === 0 ? (
        <EmptyState
          testID="trainer-clients-empty"
          title="No clients yet"
          description="Add a client by email to start logging workouts for them."
          action={{
            label: 'Add Client',
            onPress: () => navigation.navigate('TrainerClientForm'),
            testID: 'trainer-clients-empty-add',
          }}
        />
      ) : null}

      {state.status === 'ready' && state.isTrainer && state.clients.length > 0 ? (
        <AppCard testID="trainer-clients-list">
          {state.clients.map((client, index) => {
            // An invite has no account yet, so there is no page to open for it.
            const clientId = client.clientId;
            const key = clientId ?? client.inviteId ?? String(index);
            return (
              <ListRow
                key={key}
                testID={
                  clientId ? `trainer-client-${clientId}` : `trainer-invite-${client.inviteId}`
                }
                icon={clientId ? 'user' : 'mail'}
                title={client.displayName ?? client.email ?? 'Unnamed client'}
                subtitle={trainerClientStatusLabel(client)}
                chevron={clientId !== null}
                divider={index > 0}
                onPress={
                  clientId
                    ? () =>
                        navigation.navigate('TrainerClientDetail', {
                          clientId,
                          clientName: client.displayName ?? undefined,
                        })
                    : undefined
                }
              />
            );
          })}
        </AppCard>
      ) : null}

      {isTrainer && state.status === 'ready' && state.clients.length > 0 ? (
        <SecondaryButton
          testID="trainer-clients-add-another"
          label="Add Client"
          onPress={() => navigation.navigate('TrainerClientForm')}
        />
      ) : null}
    </Screen>
  );
}
