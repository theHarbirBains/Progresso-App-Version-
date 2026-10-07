import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { Card } from '../design/Card';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, widgetGap } from '../design/theme';
import { RecentWorkoutTopSets } from '../feed/RecentWorkoutTopSets';
import {
  endTrainerClient,
  listTrainerClients,
  regenerateTrainerClaimCode,
  startLiveWorkout,
  type TrainerClient,
} from '../lib/api';
import { formatWeightKg, toKg } from '../lib/units';
import { feetAndInchesFromCm } from '../onboarding/weightHeightConversion';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { feedStyles as styles } from '../screens/feedStyles';
import {
  fetchClientPersonalRecords,
  fetchClientWorkoutFeed,
  fetchOpenLiveSession,
  type ClientRecordRow,
} from '../trainer/clientQueries';
import { trainerClientStatusLabel } from '../trainer/trainerLabels';
import type { EnrichedWorkoutSummary } from '../workouts/workoutHistoryEnrichment';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { formatCardDate, formatCardDuration } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'TrainerClientDetail'>;

/** A client's page always shows pounds, whatever the trainer's own unit setting is. */
const CLIENT_WEIGHT_UNIT = 'lb';

interface ClientData {
  client: TrainerClient | null;
  workouts: EnrichedWorkoutSummary[];
  hasMore: boolean;
  records: ClientRecordRow[];
}

/** "5 ft 11 in" for a height stored in cm, so the profile shows both units. */
function feetAndInchesText(heightCm: number): string {
  const { feet, inches } = feetAndInchesFromCm(heightCm);
  return `${feet} ft ${inches} in`;
}

/**
 * One client, for their trainer, laid out like the Feed: a profile card, the actions for
 * logging for them, then one Feed-style card per finished workout (byline, title, stat
 * strip, top sets), then their PRs. The workouts come from the same history and
 * enrichment the client's own Feed uses, under the trainer RLS policies, so a lapsed
 * subscription or ended link shows nothing.
 */
export function TrainerClientDetailScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  const [data, setData] = useState<ClientData | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [liveSession, setLiveSession] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const clients = await listTrainerClients(accessToken);
      const client = clients.find((row) => row.clientId === clientId) ?? null;
      if (!client) {
        setData({ client: null, workouts: [], hasMore: false, records: [] });
        return;
      }
      const [feed, records] = await Promise.all([
        fetchClientWorkoutFeed(clientId, 0),
        fetchClientPersonalRecords(clientId),
      ]);
      setLiveSession(await fetchOpenLiveSession(clientId, user?.id ?? ''));
      setPage(0);
      setData({ client, workouts: feed.workouts, hasMore: feed.hasMore, records });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this client');
    } finally {
      setLoading(false);
    }
  }, [accessToken, clientId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (loadingMore || !data) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const feed = await fetchClientWorkoutFeed(clientId, next);
      setData((prev) =>
        prev
          ? { ...prev, workouts: [...prev.workouts, ...feed.workouts], hasMore: feed.hasMore }
          : prev,
      );
      setPage(next);
    } catch (err) {
      Alert.alert('Could not load more', err instanceof Error ? err.message : 'Try again');
    } finally {
      setLoadingMore(false);
    }
  }

  async function startLive() {
    if (!accessToken) return;
    try {
      const { workoutId } = await startLiveWorkout(accessToken, clientId, 'Live session');
      navigation.navigate('TrainerLiveWorkout', {
        workoutId,
        clientId,
        clientName: client?.displayName ?? clientName,
      });
    } catch (err) {
      Alert.alert('Could not start the session', err instanceof Error ? err.message : 'Try again');
    }
  }

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
  const initial = title.charAt(0).toUpperCase();
  const canLog = client?.status === 'active';

  return (
    <Screen
      scrollTestID="trainer-client-detail-scroll"
      contentContainerStyle={{ gap: widgetGap }}
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
        <>
          <Card testID="trainer-client-profile">
            <View style={styles.metaRow}>
              <View style={styles.avatarWrap}>
                <Avatar
                  initial={initial}
                  size={32}
                  iconSize={16}
                  iconColor={colors.textSecondary}
                  initialStyle={styles.avatarInitial}
                />
              </View>
              <View style={styles.metaBody}>
                <Text style={styles.metaName} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.metaTimestamp}>{trainerClientStatusLabel(client)}</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <StatBlock
                testID="trainer-client-height-value"
                value={client.heightValue === null ? '—' : feetAndInchesText(client.heightValue)}
                label="Height"
              />
              <StatBlock
                testID="trainer-client-weight-value"
                value={
                  client.weightValue === null
                    ? '—'
                    : `${formatWeightKg(toKg(client.weightValue, client.weightUnit), CLIENT_WEIGHT_UNIT)} ${CLIENT_WEIGHT_UNIT}`
                }
                label="Weight"
              />
            </View>
          </Card>

          <Card testID="trainer-client-actions">
            <PrimaryButton
              testID="trainer-client-log-workout"
              label="Log Workout"
              disabled={!canLog}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
              onPress={() =>
                navigation.navigate('TrainerLogWorkout', { clientId, clientName: title })
              }
            />
            {client.status === 'active' ? (
              liveSession ? (
                <SecondaryButton
                  testID="trainer-client-resume-live"
                  label="Resume Live Session"
                  onPress={() =>
                    navigation.navigate('TrainerLiveWorkout', {
                      workoutId: liveSession.id,
                      clientId,
                      clientName: client.displayName ?? clientName,
                    })
                  }
                />
              ) : (
                <SecondaryButton
                  testID="trainer-client-start-live"
                  label="Start Live Session"
                  onPress={() => void startLive()}
                />
              )
            ) : null}
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
          </Card>

          <View style={styles.sectionHeaderWrap}>
            <SectionHeader label="Workouts" />
          </View>
          {data?.workouts.length === 0 ? (
            <Card testID="trainer-client-no-workouts">
              <ListRow title="No finished workouts yet" />
            </Card>
          ) : null}
          {data?.workouts.map((workout) => (
            <Card key={workout.id} testID={`trainer-client-workout-${workout.id}`}>
              <View style={styles.metaRow}>
                <View style={styles.avatarWrap}>
                  <Avatar
                    initial={initial}
                    size={32}
                    iconSize={16}
                    iconColor={colors.textSecondary}
                    initialStyle={styles.avatarInitial}
                  />
                </View>
                <View style={styles.metaBody}>
                  <Text style={styles.metaName} numberOfLines={1}>
                    {title}
                  </Text>
                  <View style={styles.metaSubRow}>
                    <Feather name="activity" size={11} color={colors.textMuted} />
                    <Text style={styles.metaTimestamp}>{formatCardDate(workout.performedAt)}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.itemTitle} numberOfLines={1}>
                {workout.name}
              </Text>
              {workout.muscleGroups.length > 0 ? (
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                  {workout.muscleGroups
                    .map((group) => SPLIT_MUSCLE_GROUP_LABELS[group])
                    .join(' • ')}
                </Text>
              ) : null}

              <View style={styles.statRow}>
                <StatBlock
                  testID={`trainer-client-workout-${workout.id}-duration`}
                  value={formatCardDuration(workout.durationMinutes)}
                  label="Duration"
                />
                <StatBlock
                  testID={`trainer-client-workout-${workout.id}-exercises`}
                  value={String(workout.completedExerciseCount)}
                  label={workout.completedExerciseCount === 1 ? 'Exercise' : 'Exercises'}
                />
                <StatBlock
                  testID={`trainer-client-workout-${workout.id}-sets`}
                  value={String(workout.completedSetCount)}
                  label="Sets"
                />
              </View>
              <RecentWorkoutTopSets
                testID={`trainer-client-workout-${workout.id}-top-sets`}
                topSets={workout.topSets}
                weightUnit={CLIENT_WEIGHT_UNIT}
              />
            </Card>
          ))}
          {data?.hasMore ? (
            <SecondaryButton
              testID="trainer-client-workouts-more"
              label={loadingMore ? 'Loading…' : 'Load More'}
              disabled={loadingMore}
              onPress={() => void loadMore()}
            />
          ) : null}

          <Card testID="trainer-client-records">
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
                value={`${formatWeightKg(record.bestWeightKg, CLIENT_WEIGHT_UNIT)} ${CLIENT_WEIGHT_UNIT}`}
                divider={index > 0}
              />
            ))}
          </Card>

          <TextButton
            testID="trainer-client-end-link"
            label={ending ? 'Ending…' : 'End Trainer Link'}
            destructive
            disabled={ending}
            onPress={confirmEnd}
          />
        </>
      ) : null}
    </Screen>
  );
}
