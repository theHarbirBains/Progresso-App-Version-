import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
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
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import {
  endTrainerLink,
  getTrainerStatus,
  listMyTrainers,
  listTrainerClients,
  listTrainerRequests,
  respondToTrainerRequest,
  type TrainerClient,
  type TrainerRequest,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { clientName } from '../trainer/clientPicker';
import { trainerClientStatusLabel } from '../trainer/trainerLabels';
import { formatCardDate } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'TrainerAccess'>;

interface AccessData {
  isTrainer: boolean;
  requests: TrainerRequest[];
  trainers: TrainerRequest[];
  clients: TrainerClient[];
}

/**
 * Trainer access, filling the screen. Requests waiting on you come first (Accept is the
 * one primary action). Then Add Client on its own, and the Clients widget, which takes
 * the rest of the height and scrolls its own list. Your trainers, and ending a link, are
 * always your choice. Linking tracked history is a discreet text link at the foot.
 */
export function TrainerAccessScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTrainerId, setBusyTrainerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [status, requests, trainers] = await Promise.all([
        getTrainerStatus(accessToken),
        listTrainerRequests(accessToken),
        listMyTrainers(accessToken),
      ]);
      const clients = status.isTrainer ? await listTrainerClients(accessToken) : [];
      setData({ isTrainer: status.isTrainer, requests, trainers, clients });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trainer access');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Coming back from a client's page shows any change straight away.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  const sortedClients = useMemo(
    () =>
      [...(data?.clients ?? [])].sort((a, b) =>
        clientName(a).localeCompare(clientName(b), undefined, { sensitivity: 'base' }),
      ),
    [data],
  );

  async function respond(trainerId: string, action: 'accept' | 'decline') {
    if (!accessToken || busyTrainerId) return;
    setBusyTrainerId(trainerId);
    try {
      await respondToTrainerRequest(accessToken, trainerId, action);
      await load();
    } catch (err) {
      Alert.alert('Could not update the request', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusyTrainerId(null);
    }
  }

  function confirmEnd(trainerId: string) {
    Alert.alert(
      'End trainer link',
      'This trainer will no longer be able to log workouts for you or see your data. Workouts they already logged stay on your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End link',
          style: 'destructive',
          onPress: () => void end(trainerId),
        },
      ],
    );
  }

  async function end(trainerId: string) {
    if (!accessToken) return;
    try {
      await endTrainerLink(accessToken, trainerId);
      await load();
    } catch (err) {
      Alert.alert('Could not end the link', err instanceof Error ? err.message : 'Try again');
    }
  }

  const nothingToShow =
    data !== null && data.requests.length === 0 && data.trainers.length === 0 && !data.isTrainer;

  return (
    <Screen
      scroll={false}
      contentContainerStyle={styles.body}
      header={
        <AppHeader
          title="Trainer Access"
          subtitle="Who can log workouts for you"
          onBack={() => navigation.goBack()}
          testID="trainer-access-header"
        />
      }
    >
      {loading ? <LoadingState testID="trainer-access-loading" /> : null}

      {!loading && error ? (
        <ErrorState testID="trainer-access-error" message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && data ? (
        <>
          {data.requests.length > 0 ? (
            <AppCard hero topAccent={theme.accent} testID="trainer-access-requests">
              <Text style={styles.eyebrow}>Waiting for you</Text>
              <Text style={styles.lede}>
                A trainer wants to log workouts for you. You decide whether to accept.
              </Text>
              {data.requests.map((request, index) => (
                <View key={request.trainerId} style={styles.block}>
                  <ListRow
                    testID={`trainer-request-${request.trainerId}`}
                    title={request.trainerDisplayName ?? 'A trainer'}
                    subtitle={`Asked ${formatCardDate(request.requestedAt)}`}
                    divider={index > 0}
                  />
                  <View style={styles.actions}>
                    <SecondaryButton
                      testID={`trainer-request-decline-${request.trainerId}`}
                      label="Decline"
                      size="sm"
                      disabled={busyTrainerId !== null}
                      onPress={() => void respond(request.trainerId, 'decline')}
                    />
                    <PrimaryButton
                      testID={`trainer-request-accept-${request.trainerId}`}
                      label="Accept"
                      size="sm"
                      loading={busyTrainerId === request.trainerId}
                      disabled={busyTrainerId !== null}
                      accentColor={theme.accent}
                      onAccentColor={theme.onAccent}
                      onPress={() => void respond(request.trainerId, 'accept')}
                    />
                  </View>
                </View>
              ))}
            </AppCard>
          ) : null}

          {data.isTrainer ? (
            <PrimaryButton
              testID="trainer-access-add-client"
              label="Add Client"
              onPress={() => navigation.navigate('TrainerClientForm')}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          ) : null}

          <View style={styles.fill}>
            <AppCard
              testID="trainer-access-clients"
              topAccent={theme.accent}
              hero={data.requests.length === 0}
            >
              <SectionHeader label="Clients" />
              {!data.isTrainer ? (
                <Text style={styles.empty}>Clients need a Trainer subscription.</Text>
              ) : sortedClients.length === 0 ? (
                <Text style={styles.empty} testID="trainer-access-no-clients">
                  No clients yet. Add someone, even if they do not use Progresso yet.
                </Text>
              ) : (
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                >
                  {sortedClients.map((client, index) => {
                    const openable = client.clientId !== null;
                    return (
                      <ListRow
                        key={client.clientId ?? client.inviteId ?? `client-${index}`}
                        testID={
                          openable
                            ? `trainer-access-client-${client.clientId}`
                            : `trainer-access-invite-${client.inviteId}`
                        }
                        title={clientName(client)}
                        subtitle={trainerClientStatusLabel(client)}
                        chevron={openable}
                        divider={index > 0}
                        onPress={
                          openable
                            ? () =>
                                navigation.navigate('TrainerClientDetail', {
                                  clientId: client.clientId as string,
                                  clientName: client.displayName ?? undefined,
                                })
                            : undefined
                        }
                      />
                    );
                  })}
                </ScrollView>
              )}
            </AppCard>
          </View>

          {data.trainers.length > 0 ? (
            <AppCard testID="trainer-access-trainers" topAccent={theme.accent}>
              <SectionHeader label="Your trainers" />
              {data.trainers.map((trainer, index) => (
                <ListRow
                  key={trainer.trainerId}
                  testID={`trainer-active-${trainer.trainerId}`}
                  title={trainer.trainerDisplayName ?? 'Your trainer'}
                  subtitle="Can log workouts for you"
                  divider={index > 0}
                  trailing={
                    <TextButton
                      testID={`trainer-end-${trainer.trainerId}`}
                      label="End"
                      destructive
                      onPress={() => confirmEnd(trainer.trainerId)}
                    />
                  }
                />
              ))}
            </AppCard>
          ) : null}

          {nothingToShow ? (
            <EmptyState
              testID="trainer-access-empty"
              title="No trainer links"
              description="A trainer can ask to log workouts for you. Their request will appear here, and you decide whether to accept it."
            />
          ) : null}

          <TextButton
            testID="trainer-access-open-claim"
            label="Link tracked history"
            onPress={() => navigation.navigate('TrainerClaim')}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  body: {
    flexGrow: 1,
    gap: widgetGap,
  },
  fill: {
    flex: 1,
    minHeight: 160,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  eyebrow: {
    ...typeScale.sectionHeading,
    color: colors.textSecondary,
  },
  lede: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    marginBottom: spacing.sm,
  },
  block: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  empty: {
    ...typeScale.secondary,
    color: colors.textMuted,
    marginVertical: spacing.sm,
  },
};
