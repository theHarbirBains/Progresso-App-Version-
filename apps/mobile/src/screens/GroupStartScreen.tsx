import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import {
  addClientToGroup,
  addGroupGuest,
  createGroup,
  getTrainerStatus,
  inviteToGroup,
  listFollowing,
  listTrainerClients,
  type FollowUser,
  type TrainerClient,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { pickableClients, clientName } from '../trainer/clientPicker';
import { fetchWorkoutSplitDetail, type WorkoutSplitDay } from '../workouts/workoutSplitQueries';

type Props = RootStackScreenProps<'GroupStart'>;

/** The two steps: who is working out today, then which workout they are doing. */
type Step = 'people' | 'workout';

/** The workout choice for "create my own"; any other value is a split day's id. */
const OWN = 'own';

/**
 * Working out as a group, opened from Start Workout. Step one asks who is working out
 * today (friends, the trainer's clients, or guests by name). Step two is the workout:
 * create their own with a name, or choose a day from their own split. Friends and
 * clients join the group straight away; a guest needs no account.
 */
export function GroupStartScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme, activeWorkoutSplitId } = useProgressTheme();

  const [friends, setFriends] = useState<FollowUser[]>([]);
  const [clients, setClients] = useState<TrainerClient[]>([]);
  const [days, setDays] = useState<WorkoutSplitDay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('people');
  const [pickedFriends, setPickedFriends] = useState<Set<string>>(new Set());
  const [pickedClients, setPickedClients] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<string[]>([]);
  const [guestName, setGuestName] = useState('');

  const [workout, setWorkout] = useState<string | null>(null);
  const [ownName, setOwnName] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const [following, status] = await Promise.all([
          listFollowing(accessToken!),
          getTrainerStatus(accessToken!),
        ]);
        const trainerClients = status.isTrainer ? await listTrainerClients(accessToken!) : [];
        if (cancelled) return;
        setFriends(following);
        setClients(trainerClients);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your people');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!activeWorkoutSplitId) return;
    let cancelled = false;
    fetchWorkoutSplitDetail(activeWorkoutSplitId)
      .then((detail) => {
        if (!cancelled) setDays([...detail.days].sort((a, b) => a.orderIndex - b.orderIndex));
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkoutSplitId]);

  const pickableClientList = useMemo(() => pickableClients(clients, new Set()), [clients]);
  const selectedCount = pickedFriends.size + pickedClients.size + guests.length;
  const workoutName =
    workout === OWN ? ownName.trim() : (days.find((d) => d.id === workout)?.name ?? '');
  const canStart = workout !== null && workoutName !== '' && !starting;

  function toggle(set: Set<string>, id: string, update: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  }

  function addGuest() {
    const trimmed = guestName.trim();
    if (trimmed === '') return;
    setGuests((prev) => [...prev, trimmed]);
    setGuestName('');
  }

  async function start() {
    if (!accessToken || !canStart) return;
    setStarting(true);
    setError(null);
    try {
      const { groupId } =
        workout === OWN
          ? await createGroup(accessToken, { name: workoutName, workoutName })
          : await createGroup(accessToken, { name: workoutName, splitDayId: workout as string });

      // Everyone else is added after the group exists. A failure for one person does not stop the rest.
      const failed: string[] = [];
      for (const friend of friends.filter((f) => pickedFriends.has(f.id))) {
        if (!friend.username) {
          failed.push(friend.displayName ?? 'a friend');
          continue;
        }
        await inviteToGroup(accessToken, groupId, friend.username).catch(() =>
          failed.push(friend.displayName ?? friend.username ?? 'a friend'),
        );
      }
      for (const client of pickableClientList.filter(
        (c) => c.clientId && pickedClients.has(c.clientId),
      )) {
        await addClientToGroup(accessToken, groupId, client.clientId as string).catch(() =>
          failed.push(clientName(client)),
        );
      }
      for (const name of guests) {
        await addGroupGuest(accessToken, groupId, name).catch(() => failed.push(name));
      }

      if (failed.length > 0) {
        Alert.alert(
          'Some people were not added',
          `${failed.join(', ')} can be added from the group.`,
        );
      }
      navigation.replace('GroupSession', { groupId });
    } catch (err) {
      Alert.alert('Could not start the workout', err instanceof Error ? err.message : 'Try again');
    } finally {
      setStarting(false);
    }
  }

  const check = (on: boolean) => (
    <Feather
      name={on ? 'check-circle' : 'circle'}
      size={22}
      color={on ? theme.accent : colors.textMuted}
    />
  );

  const summary =
    selectedCount === 0
      ? 'Just you'
      : `You and ${selectedCount} ${selectedCount === 1 ? 'other' : 'others'}`;

  return (
    <Screen
      scrollTestID="group-start-scroll"
      contentContainerStyle={{ gap: widgetGap }}
      header={
        <AppHeader
          title="Working Out as a Group"
          subtitle={step === 'people' ? "Who's working out today?" : 'What are you doing?'}
          onBack={() => (step === 'workout' ? setStep('people') : navigation.goBack())}
          testID="group-start-header"
        />
      }
    >
      {error ? <ErrorState testID="group-start-error" message={error} /> : null}
      {!loaded ? <LoadingState testID="group-start-loading" /> : null}

      {loaded && step === 'people' ? (
        <>
          <AppCard testID="group-start-people">
            <SectionHeader label="Who's working out today?" />

            {friends.length > 0 ? <Text style={styles.group}>Friends</Text> : null}
            {friends.map((friend) => (
              <ListRow
                key={friend.id}
                testID={`group-start-friend-${friend.id}`}
                title={friend.displayName ?? friend.username ?? 'Friend'}
                subtitle={friend.username ? `@${friend.username}` : undefined}
                trailing={check(pickedFriends.has(friend.id))}
                onPress={() => toggle(pickedFriends, friend.id, setPickedFriends)}
              />
            ))}

            {pickableClientList.length > 0 ? <Text style={styles.group}>Clients</Text> : null}
            {pickableClientList.map((client) => (
              <ListRow
                key={client.clientId ?? clientName(client)}
                testID={`group-start-client-${client.clientId}`}
                title={clientName(client)}
                trailing={check(pickedClients.has(client.clientId as string))}
                onPress={() => toggle(pickedClients, client.clientId as string, setPickedClients)}
              />
            ))}

            <Text style={styles.group}>Guests</Text>
            {guests.map((name, index) => (
              <ListRow
                key={`${name}-${index}`}
                testID={`group-start-guest-${index}`}
                title={name}
                subtitle="No account needed"
                trailing={check(true)}
                onPress={() => setGuests((prev) => prev.filter((_, i) => i !== index))}
              />
            ))}
            <View style={styles.guestRow}>
              <View style={styles.guestField}>
                <TextInput
                  testID="group-start-guest-name"
                  label="Add a guest"
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Their name"
                />
              </View>
              <SecondaryButton
                testID="group-start-guest-add"
                label="Add"
                size="sm"
                disabled={guestName.trim() === ''}
                onPress={addGuest}
              />
            </View>
          </AppCard>

          <Text style={styles.summary}>{summary}</Text>
          <PrimaryButton
            testID="group-start-continue"
            label="Continue"
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
            onPress={() => setStep('workout')}
          />
        </>
      ) : null}

      {loaded && step === 'workout' ? (
        <>
          <AppCard testID="group-start-workout">
            <SectionHeader label="Create your own" />
            <ListRow
              testID="group-start-own"
              title="Create my own workout"
              subtitle="Name it, then add exercises as you go"
              trailing={check(workout === OWN)}
              onPress={() => setWorkout(OWN)}
            />
            {workout === OWN ? (
              <TextInput
                testID="group-start-own-name"
                label="Workout name"
                value={ownName}
                onChangeText={setOwnName}
                placeholder="e.g. Arms and abs"
              />
            ) : null}
          </AppCard>

          <AppCard testID="group-start-split">
            <SectionHeader label="From your split" />
            {days.length === 0 ? (
              <Text style={styles.group}>You have no active split yet.</Text>
            ) : null}
            {days.map((day, index) => (
              <ListRow
                key={day.id}
                testID={`group-start-day-${day.id}`}
                divider={index > 0}
                leading={
                  <Text style={[styles.dayNumber, { color: theme.accent }]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                }
                title={day.name}
                trailing={check(workout === day.id)}
                onPress={() => setWorkout(day.id)}
              />
            ))}
          </AppCard>

          <Text style={styles.summary}>
            {workoutName ? workoutName : 'No workout chosen'} · {summary}
          </Text>

          <PrimaryButton
            testID="group-start-submit"
            label={starting ? 'Starting…' : 'Start Workout'}
            onPress={() => void start()}
            disabled={!canStart}
            loading={starting}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
          <TextButton
            testID="group-start-back-people"
            label="Change who's training"
            onPress={() => setStep('people')}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  group: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  guestRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: spacing.sm,
  },
  guestField: {
    flex: 1,
  },
  dayNumber: {
    ...typeScale.statSmall,
    width: 28,
    textAlign: 'center' as const,
  },
  summary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
};
