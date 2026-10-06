import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import {
  endTrainerClient,
  listTrainerClients,
  regenerateTrainerClaimCode,
  type TrainerClient,
} from '../lib/api';
import { formatWeightKg } from '../lib/units';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import {
  fetchClientPersonalRecords,
  fetchClientWorkouts,
  type ClientRecordRow,
  type ClientWorkoutRow,
} from '../trainer/clientQueries';
import { trainerClientStatusLabel } from '../trainer/trainerLabels';
import { formatCardDate } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'TrainerClientDetail'>;

interface ClientData {
  client: TrainerClient | null;
  workouts: ClientWorkoutRow[];
  records: ClientRecordRow[];
}

/**
 * One client, for their trainer: profile, the entry point for logging a
 * workout for them, their recent workouts and PRs (read-only), and ending the
 * link. The workouts and PRs come straight from Supabase under the trainer RLS
 * policies, so a lapsed subscription or ended link shows nothing.
 */
export function TrainerClientDetailScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { weightUnit } = useProgressTheme();

  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const clients = await listTrainerClients(accessToken);
      const client = clients.find((row) => row.clientId === clientId) ?? null;
      if (!client) {
        setData({ client: null, workouts: [], records: [] });
        return;
      }
      const [workouts, records] = await Promise.all([
        fetchClientWorkouts(clientId),
        fetchClientPersonalRecords(clientId),
      ]);
      setData({ client, workouts, records });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this client');
    } finally {
      setLoading(false);
    }
  }, [accessToken, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function getClaimCode() {
    if (!accessToken) return;
    try {
      const { claimCode } = await regenerateTrainerClaimCode(accessToken, clientId);
      navigation.navigate('TrainerClaimCode', {
        code: claimCode,
        clientId,
        clientName: client?.displayName ?? clientName,
      });
    } catch (err) {
      Alert.alert('Could not get a code', err instanceof Error ? err.message : 'Try again');
    }
  }

  function confirmEnd() {
    Alert.alert(
      'End trainer link',
      'You will no longer be able to log workouts for this client or see their data. Their existing workouts are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End link',
          style: 'destructive',
          onPress: () => void endLink(),
        },
      ],
    );
  }

  async function endLink() {
    if (!accessToken || ending) return;
    setEnding(true);
    try {
      await endTrainerClient(accessToken, clientId);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not end the link', err instanceof Error ? err.message : 'Try again');
      setEnding(false);
    }
  }

  const client = data?.client ?? null;
  const title = client?.displayName ?? clientName ?? 'Client';
  const canLog = client?.status === 'active';

  return (
    <Screen
      scrollTestID="trainer-client-detail-scroll"
      header={
        <AppHeader
          title={title}
          onBack={() => navigation.goBack()}
          testID="trainer-client-detail-header"
        />
      }
    >
      {loading ? <LoadingState testID="trainer-client-detail-loading" /> : null}

      {!loading && error ? (
        <ErrorState
          testID="trainer-client-detail-error"
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      {!loading && !error && data && !client ? (
        <EmptyState
          testID="trainer-client-detail-gone"
          title="This client is no longer linked"
          description="You can't see or log workouts for them any more."
        />
      ) : null}

      {!loading && !error && client ? (
        <View style={{ gap: 6 }}>
          <AppCard testID="trainer-client-profile">
            <ListRow
              title="Status"
              value={trainerClientStatusLabel(client)}
              testID="trainer-client-status"
            />
            <ListRow
              title="Height"
              value={client.heightValue === null ? '—' : `${client.heightValue} cm`}
              divider
              testID="trainer-client-height-value"
            />
            <ListRow
              title="Weight"
              value={
                client.weightValue === null
                  ? '—'
                  : `${formatWeightKg(client.weightValue, client.weightUnit)} ${client.weightUnit}`
              }
              divider
              testID="trainer-client-weight-value"
            />
            <View style={{ gap: 8, paddingTop: 12 }}>
              <PrimaryButton
                testID="trainer-client-log-workout"
                label="Log Workout"
                disabled={!canLog}
                onPress={() =>
                  navigation.navigate('TrainerLogWorkout', { clientId, clientName: title })
                }
              />
              {client.awaitingClaim ? (
                <SecondaryButton
                  testID="trainer-client-claim-code"
                  label="Get Claim Code"
                  onPress={() => void getClaimCode()}
                />
              ) : null}
              {client.source === 'managed' ? (
                <SecondaryButton
                  testID="trainer-client-edit"
                  label="Edit Details"
                  onPress={() => navigation.navigate('TrainerEditClient', { clientId })}
                />
              ) : null}
            </View>
          </AppCard>

          <AppCard testID="trainer-client-workouts">
            <SectionHeader label="Workouts" />
            {data?.workouts.length === 0 ? (
              <ListRow title="No workouts logged yet" testID="trainer-client-no-workouts" />
            ) : null}
            {data?.workouts.map((workout, index) => (
              <ListRow
                key={workout.id}
                testID={`trainer-client-workout-${workout.id}`}
                title={workout.name}
                subtitle={formatCardDate(workout.performedAt)}
                divider={index > 0}
              />
            ))}
          </AppCard>

          <AppCard testID="trainer-client-records">
            <SectionHeader label="Personal Records" />
            {data?.records.length === 0 ? (
              <ListRow title="No personal records yet" testID="trainer-client-no-records" />
            ) : null}
            {data?.records.map((record, index) => (
              <ListRow
                key={record.id}
                testID={`trainer-client-record-${record.id}`}
                title={record.exerciseName}
                subtitle={`${record.reps} ${record.reps === 1 ? 'rep' : 'reps'}`}
                value={`${formatWeightKg(record.bestWeightKg, weightUnit)} ${weightUnit}`}
                divider={index > 0}
              />
            ))}
          </AppCard>

          <TextButton
            testID="trainer-client-end-link"
            label={ending ? 'Ending…' : 'End Trainer Link'}
            destructive
            disabled={ending}
            onPress={confirmEnd}
          />
        </View>
      ) : null}
    </Screen>
  );
}
