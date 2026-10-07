import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
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
  listTrainerActivity,
  listTrainerRequests,
  respondToTrainerRequest,
  type TrainerActivity,
  type TrainerRequest,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { describeTrainerActivity } from '../trainer/trainerLabels';
import { formatCardDate } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'TrainerAccess'>;

interface AccessData {
  isTrainer: boolean;
  requests: TrainerRequest[];
  trainers: TrainerRequest[];
  activity: TrainerActivity[];
}

/**
 * Trainer access, for everyone: the trainer's own clients (if they are a trainer), a
 * way to link history a trainer tracked for them, requests from trainers who want to
 * log for you, the trainers who currently can, and a record of what has been done.
 * Accepting or declining, and ending a link, are always the client's choice.
 *
 * Styled like the rest of Train: the mode accent, a hero card for anything waiting on
 * the person, widget cards with plain rows, and accent buttons.
 */
export function TrainerAccessScreen({ navigation }: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id ?? '';
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
      const [status, requests, trainers, activity] = await Promise.all([
        getTrainerStatus(accessToken),
        listTrainerRequests(accessToken),
        listMyTrainers(accessToken),
        listTrainerActivity(accessToken),
      ]);
      setData({ isTrainer: status.isTrainer, requests, trainers, activity });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trainer access');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

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
    data !== null &&
    data.requests.length === 0 &&
    data.trainers.length === 0 &&
    data.activity.length === 0;

  return (
    <Screen
      scrollTestID="trainer-access-scroll"
      contentContainerStyle={{ gap: widgetGap }}
      header={
        <AppHeader
          title="Trainer Access"
          subtitle="Who can log workouts for you, and what they have done"
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
                    subtitle="Wants to log workouts for you"
                    detail={formatCardDate(request.requestedAt)}
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

          <AppCard testID="trainer-access-clients">
            <SectionHeader label="Clients" />
            {data.isTrainer ? (
              <ListRow
                testID="trainer-access-open-clients"
                title="Your client pool"
                subtitle="Track workouts, with or without their account"
                chevron
                onPress={() => navigation.navigate('TrainerClients')}
              />
            ) : (
              <ListRow
                testID="trainer-access-open-clients"
                title="Clients"
                subtitle="Needs a Trainer subscription. Open to see what it includes"
                chevron
                onPress={() => navigation.navigate('TrainerClients')}
              />
            )}
          </AppCard>

          <AppCard testID="trainer-access-link-history">
            <SectionHeader label="Tracked history" />
            <ListRow
              testID="trainer-access-open-claim"
              title="Link Tracked History"
              subtitle="A trainer tracked you before you had an account? Enter their code."
              chevron
              onPress={() => navigation.navigate('TrainerClaim')}
            />
          </AppCard>

          {data.trainers.length > 0 ? (
            <AppCard testID="trainer-access-trainers">
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

          {data.activity.length > 0 ? (
            <AppCard testID="trainer-access-activity">
              <SectionHeader label="Activity" />
              {data.activity.map((entry, index) => (
                <ListRow
                  key={entry.id}
                  testID={`trainer-activity-${entry.id}`}
                  title={describeTrainerActivity(entry, userId)}
                  detail={formatCardDate(entry.createdAt)}
                  divider={index > 0}
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
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
