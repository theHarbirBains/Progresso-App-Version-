import { useCallback, useEffect, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
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
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';
import {
  addGroupGuest,
  finishGroup,
  getGroup,
  getTrainerStatus,
  inviteToGroup,
  leaveGroup,
  setMyGroupWorkoutDay,
  type GroupDetail,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { GroupWorkoutEditor } from '../workouts/GroupWorkoutEditor';
import { fetchWorkoutSplitDetail, type WorkoutSplitDay } from '../workouts/workoutSplitQueries';

type Props = RootStackScreenProps<'GroupSession'>;

/**
 * One group session. The group's live workout is one editor with a tab per member; the
 * exercises are shared by everyone, and each tab holds that person's own sets. Each person picks which day of
 * their own split their workout is. Friends are invited by username, a trainer brings
 * in their clients from a separate list, and guests are added by name.
 */
export function GroupSessionScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id ?? '';
  const { theme, activeWorkoutSplitId } = useProgressTheme();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [days, setDays] = useState<WorkoutSplitDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      setGroup(await getGroup(accessToken, groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this group');
      return;
    }
    try {
      const status = await getTrainerStatus(accessToken);
      setIsTrainer(status.isTrainer);
    } catch {
      setIsTrainer(false);
    }
  }, [accessToken, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeWorkoutSplitId) {
      setDays([]);
      return;
    }
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

  async function run(action: () => Promise<unknown>, failure: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      Alert.alert(failure, err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  function invite() {
    const trimmed = username.trim().toLowerCase();
    if (!accessToken || trimmed === '') return;
    void run(async () => {
      await inviteToGroup(accessToken, groupId, trimmed);
      setUsername('');
    }, 'Could not invite them');
  }

  function addGuest() {
    const trimmed = guestName.trim();
    if (!accessToken || trimmed === '') return;
    void run(async () => {
      await addGroupGuest(accessToken, groupId, trimmed);
      setGuestName('');
    }, 'Could not add the guest');
  }

  function pickDay(splitDayId: string | null) {
    if (!accessToken) return;
    void run(
      () => setMyGroupWorkoutDay(accessToken, groupId, splitDayId),
      'Could not set your day',
    );
  }

  function finish() {
    if (!accessToken) return;
    Alert.alert('Finish the group', 'This completes everyone’s workout in the group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: () =>
          void run(() => finishGroup(accessToken, groupId), 'Could not finish the group').then(() =>
            navigation.goBack(),
          ),
      },
    ]);
  }

  function leave() {
    if (!accessToken) return;
    void run(() => leaveGroup(accessToken, groupId), 'Could not leave the group').then(() =>
      navigation.goBack(),
    );
  }

  const isHost = group?.hostId === userId;
  const isLive = group?.status === 'live';
  const joined = group?.members.filter((member) => member.status === 'joined') ?? [];
  const invited = group?.members.filter((member) => member.status === 'invited') ?? [];
  const me = joined.find((member) => member.userId === userId);

  return (
    <Screen
      scrollTestID="group-session-scroll"
      contentContainerStyle={{ gap: widgetGap }}
      header={
        <AppHeader
          title={group?.name ?? 'Group'}
          subtitle={isLive ? `${joined.length} in the group` : 'Finished'}
          onBack={() => navigation.goBack()}
          testID="group-session-header"
        />
      }
    >
      {error ? (
        <ErrorState testID="group-session-error" message={error} onRetry={() => void load()} />
      ) : null}
      {!group && !error ? <LoadingState testID="group-session-loading" /> : null}

      {group ? (
        <>
          {group.status === 'finished' ? (
            <AppCard testID="group-session-finished">
              <ListRow
                title="This group has finished"
                subtitle="Its workouts are in each person’s history"
              />
            </AppCard>
          ) : null}

          {me && isLive ? (
            <AppCard testID="group-session-day" topAccent={theme.accent}>
              <SectionHeader label="Your day" />
              {days.length === 0 ? (
                <Text style={styles.muted}>Choose a split to tag your workout with its day.</Text>
              ) : (
                <View style={styles.chips}>
                  <DayChip
                    testID="group-day-none"
                    label="No day"
                    selected={me.workoutSplitDayId === null}
                    accent={theme.accent}
                    onAccent={theme.onAccent}
                    onPress={() => pickDay(null)}
                  />
                  {days.map((day) => (
                    <DayChip
                      key={day.id}
                      testID={`group-day-${day.id}`}
                      label={day.name}
                      selected={me.workoutSplitDayId === day.id}
                      accent={theme.accent}
                      onAccent={theme.onAccent}
                      onPress={() => pickDay(day.id)}
                    />
                  ))}
                </View>
              )}
            </AppCard>
          ) : null}

          {isLive ? (
            <GroupWorkoutEditor
              members={joined.flatMap((member) =>
                member.workoutId
                  ? [
                      {
                        userId: member.userId,
                        displayName: member.displayName,
                        workoutId: member.workoutId,
                      },
                    ]
                  : [],
              )}
              userId={userId}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
              testID="group-workout"
            />
          ) : null}

          {invited.length > 0 ? (
            <AppCard testID="group-session-invited">
              <SectionHeader label="Invited" />
              {invited.map((member, index) => (
                <ListRow
                  key={member.userId}
                  title={member.displayName ?? 'Invited'}
                  subtitle="Waiting for them to accept"
                  divider={index > 0}
                />
              ))}
            </AppCard>
          ) : null}

          {isLive && isTrainer ? (
            <AppCard testID="group-session-clients">
              <SectionHeader label="Clients" />
              <ListRow
                testID="group-open-add-clients"
                title="Add clients"
                subtitle="Bring in several of your clients at once"
                chevron
                onPress={() => navigation.navigate('GroupAddClients', { groupId })}
              />
            </AppCard>
          ) : null}

          {isLive ? (
            <AppCard testID="group-session-add">
              <SectionHeader label="Add a friend or a guest" />
              <TextInput
                testID="group-invite-username"
                label="Friend's username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
              <SecondaryButton
                testID="group-invite-submit"
                label="Invite"
                onPress={invite}
                disabled={busy}
              />
              <TextInput
                testID="group-guest-name"
                label="Guest's name"
                value={guestName}
                onChangeText={setGuestName}
                helperText="A guest needs no Progresso account."
              />
              <SecondaryButton
                testID="group-guest-submit"
                label="Add Guest"
                onPress={addGuest}
                disabled={busy}
              />
            </AppCard>
          ) : null}

          {isLive ? (
            <PrimaryButton
              testID="group-finish"
              label="Finish Group"
              onPress={finish}
              disabled={busy}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          ) : null}

          {isLive && !isHost ? (
            <TextButton testID="group-leave" label="Leave Group" destructive onPress={leave} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

interface DayChipProps {
  testID: string;
  label: string;
  selected: boolean;
  accent: string;
  onAccent: string;
  onPress: () => void;
}

/** A split day as a pill. Selected fills with the mode accent; the rest sit on the surface. */
function DayChip({ testID, label, selected, accent, onAccent, onPress }: DayChipProps) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? { backgroundColor: accent, borderColor: accent } : null]}
    >
      <Text style={[styles.chipLabel, { color: selected ? onAccent : colors.textPrimary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = {
  muted: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center' as const,
  },
  chipLabel: {
    ...typeScale.secondary,
  },
};
