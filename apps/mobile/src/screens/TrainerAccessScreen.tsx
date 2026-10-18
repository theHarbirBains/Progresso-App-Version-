import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import {
  endTrainerLink,
  listMyTrainers,
  listTrainerRequests,
  respondToTrainerRequest,
  type TrainerRequest,
} from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { formatCardDate } from '../workouts/workoutFormat';
import { useWorkspace } from '../workspace/WorkspaceContext';

type Props = RootStackScreenProps<'TrainerAccess'>;

interface AccessData {
  requests: TrainerRequest[];
  trainers: TrainerRequest[];
}

/**
 * Trainer access -- the side of it everyone has -- as widgets: an overview of who can log
 * for you; requests waiting on you (Accept is the one primary action); your trainers, each
 * with End; for a trainer, a way into their Trainer Workspace (their clients live there,
 * not here); how trainer access works; and linking history a trainer tracked before you
 * joined. A side-menu page, so the menu button sits at the top left.
 */
export function TrainerAccessScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  // The side menu, for the menu button, and the workspace (both absent outside the app shell, e.g. in a test).
  const menu = useContext(AppMenuContext);
  const workspace = useWorkspace();
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  // Only the first load shows placeholders; coming back refreshes in place.
  const hasLoaded = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTrainerId, setBusyTrainerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    if (!hasLoaded.current) setLoading(true);
    setError(null);
    try {
      const [requests, trainers] = await Promise.all([
        listTrainerRequests(accessToken),
        listMyTrainers(accessToken),
      ]);
      setData({ requests, trainers });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trainer access');
    } finally {
      setLoading(false);
      hasLoaded.current = true;
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

  const trainerCount = data?.trainers.length ?? 0;
  const statusLine =
    trainerCount === 0
      ? 'No trainer can log workouts for you right now.'
      : trainerCount === 1
        ? 'One trainer can log workouts for you.'
        : `${trainerCount} trainers can log workouts for you.`;

  return (
    <Screen
      contentContainerStyle={{ gap: widgetGap }}
      header={
        <AppHeader
          title="Trainer Access"
          testID="trainer-access-header"
          leftAction={
            menu
              ? {
                  icon: 'menu',
                  onPress: () => menu.openMenu(),
                  accessibilityLabel: 'Open menu',
                  testID: 'trainer-access-open-menu',
                }
              : undefined
          }
        />
      }
    >
      {loading ? <LoadingState testID="trainer-access-loading" inline /> : null}

      {!loading && error ? (
        <ErrorState testID="trainer-access-error" message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && data ? (
        <>
          <AppCard
            testID="trainer-access-overview"
            topAccent={theme.accent}
            hero={data.requests.length === 0}
          >
            <Text style={styles.eyebrow}>Overview</Text>
            <Text testID="trainer-access-status" style={styles.lede}>
              {statusLine}
            </Text>
            <View style={styles.stats}>
              <StatBlock
                testID="trainer-access-stat-trainers"
                value={String(trainerCount)}
                label={trainerCount === 1 ? 'Trainer' : 'Trainers'}
              />
              <StatBlock
                testID="trainer-access-stat-requests"
                value={String(data.requests.length)}
                label={data.requests.length === 1 ? 'Request' : 'Requests'}
                valueColor={data.requests.length > 0 ? theme.accent : undefined}
              />
            </View>
          </AppCard>

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

          <AppCard testID="trainer-access-trainers">
            <SectionHeader label="Your trainers" />
            {data.trainers.length === 0 ? (
              <Text testID="trainer-access-empty" style={styles.empty}>
                A trainer can ask to log workouts for you. Their request will appear here, and you
                decide whether to accept it.
              </Text>
            ) : (
              data.trainers.map((trainer, index) => (
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
              ))
            )}
          </AppCard>

          {workspace?.isTrainer ? (
            <AppCard testID="trainer-access-coaching">
              <SectionHeader label="Coaching" />
              <ListRow
                testID="trainer-access-open-workspace"
                icon="users"
                title="Open Trainer Workspace"
                subtitle="Your clients, adding a client, and logging their workouts."
                onPress={() => workspace.switchTo('trainer')}
              />
            </AppCard>
          ) : null}

          <AppCard testID="trainer-access-how">
            <SectionHeader label="How it works" />
            <ListRow
              icon="user-plus"
              title="A trainer asks"
              subtitle="Their request shows up here, waiting for you."
            />
            <ListRow
              icon="check-circle"
              title="You decide"
              subtitle="Accept, and they can log workouts for you and see your training."
              divider
            />
            <ListRow
              icon="x-circle"
              title="End it any time"
              subtitle="Workouts they already logged stay on your account."
              divider
            />
          </AppCard>

          <AppCard testID="trainer-access-claim">
            <SectionHeader label="Tracked before you joined?" />
            <ListRow
              testID="trainer-access-open-claim"
              icon="link"
              title="Link tracked history"
              subtitle="Enter the code a trainer gave you to move that history onto your account."
              onPress={() => navigation.navigate('TrainerClaim')}
            />
          </AppCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
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
    color: colors.textSecondary,
    marginVertical: spacing.sm,
  },
  stats: {
    flexDirection: 'row' as const,
    gap: widgetGap,
  },
  cardAction: {
    marginTop: spacing.md,
  },
};
