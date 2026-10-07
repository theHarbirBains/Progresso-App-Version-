import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { UnderlineTabs } from '../design/UnderlineTabs';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { WorkoutFeedCard } from '../feed/WorkoutFeedCard';
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
import {
  fetchClientPersonalRecords,
  fetchClientWorkoutFeed,
  fetchOpenLiveSession,
  type ClientRecordRow,
} from '../trainer/clientQueries';
import { trainerClientStatusLabel } from '../trainer/trainerLabels';
import type { EnrichedWorkoutSummary } from '../workouts/workoutHistoryEnrichment';

type Props = RootStackScreenProps<'TrainerClientDetail'>;

/** A client's page always shows pounds, whatever the trainer's own unit setting is. */
const CLIENT_WEIGHT_UNIT = 'lb';

type Tab = 'workouts' | 'records';

interface ClientData {
  client: TrainerClient | null;
  workouts: EnrichedWorkoutSummary[];
  hasMore: boolean;
  records: ClientRecordRow[];
}

/** "5 ft 11 in" for a height stored in cm. */
function feetAndInchesText(heightCm: number): string {
  const { feet, inches } = feetAndInchesFromCm(heightCm);
  return `${feet} ft ${inches} in`;
}

/**
 * One client, as a profile for their trainer: an identity card with the logging action,
 * then Workouts (the same Feed cards the client sees, with their top-set carousels) and
 * Records. Edit Details, Start Live Session, Get Claim Code and End Trainer Link sit
 * behind the menu, so the page itself stays about the person. The data comes under the
 * trainer RLS policies, so a lapsed subscription or ended link shows nothing.
 */
export function TrainerClientDetailScreen({ navigation, route }: Props) {
  const { clientId, clientName } = route.params;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  const [data, setData] = useState<ClientData | null>(null);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<Tab>('workouts');
  const [manageOpen, setManageOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [liveSession, setLiveSession] = useState<{
    id: string;
    name: string;
    startedAt: string;
  } | null>(null);

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

  // Coming back from editing or logging a workout shows the change straight away.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

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
      const startedAt = new Date().toISOString();
      const { workoutId } = await startLiveWorkout(accessToken, clientId, 'Live session');
      navigation.navigate('TrainerLiveWorkout', {
        workoutId,
        clientId,
        clientName: client?.displayName ?? clientName,
        startedAt,
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
    setManageOpen(false);
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
          rightAction={
            client
              ? {
                  icon: 'more-horizontal',
                  onPress: () => setManageOpen(true),
                  accessibilityLabel: 'Client actions',
                  testID: 'trainer-client-manage',
                }
              : undefined
          }
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
          <AppCard hero topAccent={theme.accent} testID="trainer-client-profile">
            <View style={styles.identity}>
              <Avatar
                initial={initial}
                size={64}
                iconSize={28}
                iconColor={colors.textSecondary}
                initialStyle={styles.identityInitial}
              />
              <View style={styles.identityBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.status}>{trainerClientStatusLabel(client)}</Text>
              </View>
            </View>
            <View style={styles.stats}>
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
            {client.status === 'active' && liveSession ? (
              <SecondaryButton
                testID="trainer-client-resume-live"
                label="Resume Live Session"
                onPress={() =>
                  navigation.navigate('TrainerLiveWorkout', {
                    workoutId: liveSession.id,
                    clientId,
                    clientName: client.displayName ?? clientName,
                    startedAt: liveSession.startedAt,
                  })
                }
              />
            ) : null}
          </AppCard>

          <UnderlineTabs<Tab>
            categories={[
              { key: 'workouts', label: 'Workouts', icon: 'activity' },
              { key: 'records', label: 'Records', icon: 'award' },
            ]}
            active={tab}
            onSelect={setTab}
            accentColor={theme.accent}
            testID="trainer-client-tabs"
          />

          {tab === 'workouts' ? (
            <>
              <SecondaryButton
                testID="trainer-client-log-past"
                label="Log Past Workout"
                onPress={() =>
                  navigation.navigate('TrainerLogWorkout', { clientId, clientName: title })
                }
              />
              {data?.workouts.length === 0 ? (
                <AppCard testID="trainer-client-no-workouts">
                  <Text style={styles.empty}>No finished workouts yet.</Text>
                </AppCard>
              ) : null}
              {data?.workouts.map((workout) => (
                <WorkoutFeedCard
                  key={workout.id}
                  idPrefix="trainer-client-workout"
                  workout={workout}
                  authorName={title}
                  timestamp={workout.performedAt}
                  weightUnit={CLIENT_WEIGHT_UNIT}
                  onPress={() =>
                    navigation.navigate('WorkoutDetail', {
                      workoutId: workout.id,
                      clientId,
                      clientName: title,
                    })
                  }
                />
              ))}
              {data?.hasMore ? (
                <SecondaryButton
                  testID="trainer-client-workouts-more"
                  label={loadingMore ? 'Loading…' : 'Load More'}
                  disabled={loadingMore}
                  onPress={() => void loadMore()}
                />
              ) : null}
            </>
          ) : (
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
                  value={`${formatWeightKg(record.bestWeightKg, CLIENT_WEIGHT_UNIT)} ${CLIENT_WEIGHT_UNIT}`}
                  divider={index > 0}
                />
              ))}
            </AppCard>
          )}
        </>
      ) : null}

      <BottomSheet
        visible={manageOpen}
        onClose={() => setManageOpen(false)}
        testID="trainer-client-manage-sheet"
      >
        <SectionHeader label="Manage" />
        {client && client.status === 'active' && !liveSession ? (
          <ListRow
            testID="trainer-client-start-live"
            title="Start Live Session"
            subtitle="Log their workout as it happens"
            onPress={() => {
              setManageOpen(false);
              void startLive();
            }}
          />
        ) : null}
        {client?.source === 'managed' ? (
          <ListRow
            testID="trainer-client-edit"
            title="Edit Details"
            divider
            onPress={() => {
              setManageOpen(false);
              navigation.navigate('TrainerEditClient', { clientId });
            }}
          />
        ) : null}
        {client?.awaitingClaim ? (
          <ListRow
            testID="trainer-client-claim-code"
            title="Get Claim Code"
            subtitle="Hand this to them so they can link their history"
            divider
            onPress={() => {
              setManageOpen(false);
              void getClaimCode();
            }}
          />
        ) : null}
        <View style={styles.endAction}>
          <TextButton
            testID="trainer-client-end-link"
            label={ending ? 'Ending…' : 'End Trainer Link'}
            destructive
            disabled={ending}
            onPress={confirmEnd}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = {
  identity: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  identityInitial: {
    ...typeScale.screenTitle,
    color: colors.textSecondary,
  },
  identityBody: {
    flex: 1,
  },
  name: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  status: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row' as const,
    gap: widgetGap,
    marginBottom: spacing.md,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  endAction: {
    marginTop: spacing.md,
    alignItems: 'flex-start' as const,
  },
};
