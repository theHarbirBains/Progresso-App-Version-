import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { BottomSheet } from '../design/BottomSheet';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import {
  createGroup,
  listGroupInvites,
  listGroups,
  respondToGroupInvite,
  type GroupInvite,
  type GroupSummary,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { formatCardDate } from '../workouts/workoutFormat';
import {
  fetchWorkoutSplitDetail,
  type WorkoutSplitDay,
  type WorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';

type Props = RootStackScreenProps<'Groups'>;

function musclesLabel(day: WorkoutSplitDay): string {
  return day.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ');
}

/**
 * Group workouts. Start one on any day of your split, or as a separate workout
 * outside it. Then see the invites you have and the groups that are live. Styled
 * like the rest of Train: the mode accent, widget cards, and plain rows.
 */
export function GroupsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme, activeWorkoutSplitId } = useProgressTheme();

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [split, setSplit] = useState<WorkoutSplitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const [live, waiting] = await Promise.all([
        listGroups(accessToken),
        listGroupInvites(accessToken),
      ]);
      setGroups(live);
      setInvites(waiting);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your groups');
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeWorkoutSplitId) {
      setSplit(null);
      return;
    }
    let cancelled = false;
    fetchWorkoutSplitDetail(activeWorkoutSplitId)
      .then((detail) => {
        if (!cancelled) setSplit(detail);
      })
      .catch(() => {
        if (!cancelled) setSplit(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkoutSplitId]);

  const days = split ? [...split.days].sort((a, b) => a.orderIndex - b.orderIndex) : [];

  // A group started on a day names itself after the day; one started outside the split
  // is named by the person, and that is its workout's name too.
  async function start(input: { splitDayId?: string; name: string }) {
    if (!accessToken || busy) return;
    const trimmed = input.name.trim();
    if (trimmed === '') return;
    setBusy(true);
    try {
      const { groupId } = input.splitDayId
        ? await createGroup(accessToken, { name: trimmed, splitDayId: input.splitDayId })
        : await createGroup(accessToken, { name: trimmed, workoutName: trimmed });
      setSheetOpen(false);
      setWorkoutName('');
      navigation.navigate('GroupSession', { groupId });
    } catch (err) {
      Alert.alert('Could not start the group', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function answer(groupId: string, action: 'accept' | 'decline') {
    if (!accessToken) return;
    try {
      await respondToGroupInvite(accessToken, groupId, action);
      if (action === 'accept') navigation.navigate('GroupSession', { groupId });
      await load();
    } catch (err) {
      Alert.alert('Could not answer the invite', err instanceof Error ? err.message : 'Try again');
    }
  }

  return (
    <>
      <Screen
        scrollTestID="groups-scroll"
        contentContainerStyle={{ gap: widgetGap }}
        header={
          <AppHeader
            title="Group Workouts"
            subtitle="Train together with friends, clients and guests"
            onBack={() => navigation.goBack()}
            testID="groups-header"
          />
        }
      >
        {error ? (
          <ErrorState testID="groups-error" message={error} onRetry={() => void load()} />
        ) : null}
        {groups === null && !error ? <LoadingState testID="groups-loading" /> : null}

        {groups !== null ? (
          <>
            <AppCard hero topAccent={theme.accent} testID="groups-start">
              <Text style={styles.eyebrow}>Start a group</Text>
              <Text style={styles.lede}>
                Pick the day you are training. Everyone in the group can enter and edit sets.
              </Text>

              {days.length > 0 ? (
                days.map((day, index) => (
                  <ListRow
                    key={day.id}
                    testID={`groups-day-${day.id}`}
                    divider={index > 0}
                    leading={
                      <Text style={[styles.dayNumber, { color: theme.accent }]}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                    }
                    title={day.name}
                    subtitle={day.muscleGroups.length > 0 ? musclesLabel(day) : undefined}
                    chevron
                    disabled={busy}
                    onPress={() => void start({ splitDayId: day.id, name: day.name })}
                    accessibilityLabel={`Start a group on ${day.name}`}
                  />
                ))
              ) : (
                <ListRow
                  testID="groups-choose-split"
                  title="Choose your workout split"
                  subtitle="Then start a group on any of its days"
                  chevron
                  onPress={() => navigation.navigate('ChooseWorkoutSplit')}
                />
              )}
            </AppCard>

            <AppCard testID="groups-outside">
              <SectionHeader label="Outside your split" />
              <ListRow
                testID="groups-create-separate"
                title="Create a separate workout"
                subtitle="Named by you, kept out of your split"
                chevron
                onPress={() => setSheetOpen(true)}
              />
            </AppCard>

            {invites.length > 0 ? (
              <AppCard testID="groups-invites">
                <SectionHeader label="Invites" />
                {invites.map((invite, index) => (
                  <View key={invite.groupId} style={styles.inviteBlock}>
                    <ListRow
                      testID={`group-invite-${invite.groupId}`}
                      title={invite.name}
                      subtitle={`From ${invite.hostDisplayName ?? 'a friend'}`}
                      detail={formatCardDate(invite.invitedAt)}
                      divider={index > 0}
                    />
                    <View style={styles.inviteActions}>
                      <SecondaryButton
                        testID={`group-invite-decline-${invite.groupId}`}
                        label="Decline"
                        size="sm"
                        onPress={() => void answer(invite.groupId, 'decline')}
                      />
                      <PrimaryButton
                        testID={`group-invite-accept-${invite.groupId}`}
                        label="Accept"
                        size="sm"
                        accentColor={theme.accent}
                        onAccentColor={theme.onAccent}
                        onPress={() => void answer(invite.groupId, 'accept')}
                      />
                    </View>
                  </View>
                ))}
              </AppCard>
            ) : null}

            <AppCard testID="groups-live">
              <SectionHeader label="Live now" />
              {groups.length === 0 ? (
                <EmptyState
                  testID="groups-empty"
                  title="No live groups"
                  description="Start one above, or accept an invite."
                />
              ) : (
                groups.map((group, index) => (
                  <ListRow
                    key={group.id}
                    testID={`group-row-${group.id}`}
                    title={group.name}
                    subtitle={group.myRole === 'host' ? 'You are hosting' : 'You are in this group'}
                    detail={formatCardDate(group.startedAt)}
                    chevron
                    divider={index > 0}
                    onPress={() => navigation.navigate('GroupSession', { groupId: group.id })}
                  />
                ))
              )}
            </AppCard>
          </>
        ) : null}
      </Screen>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => (busy ? null : setSheetOpen(false))}
        testID="groups-separate-sheet"
      >
        <Text style={styles.sheetTitle}>Create a separate workout</Text>
        <Text style={styles.sheetSubtitle}>Name it. It won&apos;t be added to your split.</Text>
        <TextInput
          testID="groups-separate-name"
          label="Workout name"
          placeholder="e.g. Arms and abs"
          value={workoutName}
          onChangeText={setWorkoutName}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <View style={styles.sheetAction}>
          <PrimaryButton
            testID="groups-separate-start"
            label="Start Group"
            loading={busy}
            disabled={workoutName.trim() === '' || busy}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
            onPress={() => void start({ name: workoutName })}
          />
        </View>
      </BottomSheet>
    </>
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
  dayNumber: {
    ...typeScale.statSmall,
    width: 28,
    textAlign: 'center' as const,
  },
  inviteBlock: {
    gap: spacing.sm,
  },
  inviteActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sheetAction: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
};
