import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { BottomSheet } from '../design/BottomSheet';
import { EmptyState } from '../design/EmptyState';
import { LoadingState } from '../design/LoadingState';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { getMyProfile } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { computeNextWorkout, type NextWorkoutPlan } from '../workouts/nextWorkout';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import { createWorkout, type WorkoutSummary } from '../workouts/workoutQueries';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
  type WorkoutSplitDay,
  type WorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { startWorkoutStyles as styles } from './startWorkoutStyles';

type Props = RootStackScreenProps<'NewWorkout'>;

const CUSTOM_BUSY_KEY = 'custom';

function musclesLabel(day: WorkoutSplitDay): string {
  return day.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ');
}

// This screen is ONLY about choosing which workout to perform -- no
// exercise selection here. Exercises are added after entering
// ActiveWorkoutScreen (which already supports that in full). Picking any
// day (the recommended next one, or any other day in the active split)
// immediately creates the workout tagged with that day and enters the
// live tracking screen; "Do a Different Workout" collects a free-text name
// for an improvised, untagged workout via the same path.
export function NewWorkoutScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  const [loading, setLoading] = useState(true);
  const [hasActiveSplitId, setHasActiveSplitId] = useState(false);
  const [activeSplit, setActiveSplit] = useState<WorkoutSplitDetail | null>(null);
  const [nextPlan, setNextPlan] = useState<NextWorkoutPlan | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<WorkoutSummary | null>(null);

  const [customSheetOpen, setCustomSheetOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  // Only the very first load should replace the whole screen with a
  // spinner -- every later call (the focus listener below, e.g. returning
  // here after picking a split in ChooseWorkoutSplitScreen) is a background
  // refresh, same pattern as DashboardScreen/ProfileScreen.
  const hasLoadedOnce = useRef(false);

  // Re-checked on every focus (not just mount) so returning here after
  // picking a split in ChooseWorkoutSplitScreen immediately unblocks this
  // screen, matching the previous screen's existing behavior.
  useEffect(() => {
    if (!userId || !accessToken) return;
    let cancelled = false;
    async function load() {
      if (!hasLoadedOnce.current) setLoading(true);
      setSplitError(null);
      try {
        const profile = await getMyProfile(accessToken!);
        if (cancelled) return;
        if (!profile.activeWorkoutSplitId) {
          setHasActiveSplitId(false);
          return;
        }
        setHasActiveSplitId(true);
        try {
          const [detail, lastDayId] = await Promise.all([
            fetchWorkoutSplitDetail(profile.activeWorkoutSplitId),
            fetchLastWorkoutSplitDayId(userId),
          ]);
          if (cancelled) return;
          setActiveSplit(detail);
          setNextPlan(computeNextWorkout(detail, lastDayId));
        } catch (err) {
          // Non-critical: the user does have an active split, a failed
          // detail fetch just means we can't show it right now -- "Do a
          // Different Workout" still lets them start something.
          if (!cancelled) {
            setSplitError(err instanceof Error ? err.message : 'Failed to load your split');
          }
        }
      } catch {
        // Profile fetch itself failing is treated the same as "no split"
        // rather than leaving the screen stuck loading forever.
        if (!cancelled) setHasActiveSplitId(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasLoadedOnce.current = true;
        }
      }
    }
    const unsubscribe = navigation.addListener('focus', load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, accessToken, navigation]);

  const startWorkout = useCallback(
    async (key: string, name: string, dayId: string | undefined) => {
      if (!userId || busyKey) return;
      setError(null);
      setConflict(null);
      setBusyKey(key);
      try {
        const result = await createWorkout(userId, name, dayId);
        if (result.type === 'conflict') {
          setConflict(result.existingWorkout);
          return;
        }
        setCustomSheetOpen(false);
        navigation.replace('ActiveWorkout', { workoutId: result.workout.id });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start workout');
      } finally {
        setBusyKey(null);
      }
    },
    [userId, busyKey, navigation],
  );

  const trimmedCustomName = customName.trim();

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Start Workout" testID="start-workout-header" />
        <LoadingState testID="new-workout-loading" />
      </View>
    );
  }

  if (!hasActiveSplitId) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Start Workout" testID="start-workout-header" />
        <View style={styles.emptyWrap}>
          <EmptyState
            testID="new-workout-no-split"
            icon={<Feather name="layers" size={24} color={colors.textMuted} />}
            title="Choose Your Workout Split"
          />
          <View style={{ marginHorizontal: 24, marginTop: 16 }}>
            <PrimaryButton
              testID="new-workout-choose-split"
              label="Choose Your Workout Split"
              onPress={() => navigation.navigate('ChooseWorkoutSplit')}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </View>
        </View>
      </View>
    );
  }

  const orderedDays = activeSplit
    ? [...activeSplit.days].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];
  const otherDays = orderedDays.filter((d) => d.id !== nextPlan?.day.id);

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Start Workout"
        subtitle="Choose a workout day to begin."
        testID="start-workout-header"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {error ? (
          <Text testID="start-workout-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
        {splitError ? (
          <Text testID="start-workout-split-error" style={styles.errorText}>
            {splitError}
          </Text>
        ) : null}

        {conflict ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.errorText}>
              You already have an active workout: &quot;{conflict.name}&quot;
            </Text>
            <PrimaryButton
              testID="resume-instead"
              label="Resume It Instead"
              onPress={() => navigation.replace('ActiveWorkout', { workoutId: conflict.id })}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </View>
        ) : null}

        {nextPlan ? (
          <View style={styles.section}>
            <SectionHeader label="Your Next Workout" />
            <AppCard
              hero
              testID="start-workout-next"
              onPress={() => startWorkout(nextPlan.day.id, nextPlan.day.name, nextPlan.day.id)}
              style={busyKey === nextPlan.day.id ? styles.dayRowDisabled : undefined}
              accessibilityLabel={`Start ${nextPlan.day.name} workout${
                nextPlan.day.muscleGroups.length > 0 ? `, ${musclesLabel(nextPlan.day)}` : ''
              }`}
              accessibilityState={{ disabled: busyKey === nextPlan.day.id }}
            >
              <View style={styles.heroTopRow}>
                <View style={[styles.heroIconChip, { backgroundColor: theme.accent }]}>
                  <Feather name="activity" size={20} color={theme.onAccent} />
                </View>
                <View style={styles.heroTextBlock}>
                  <Text style={[styles.heroEyebrow, { color: theme.accent }]}>Next Workout</Text>
                  <Text style={styles.heroDayName}>{nextPlan.day.name}</Text>
                  {nextPlan.day.muscleGroups.length > 0 ? (
                    <Text style={styles.heroMuscles}>{musclesLabel(nextPlan.day)}</Text>
                  ) : null}
                </View>
                {busyKey === nextPlan.day.id ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <View style={[styles.heroChevronCircle, { backgroundColor: theme.accent }]}>
                    <Feather name="chevron-right" size={18} color={theme.onAccent} />
                  </View>
                )}
              </View>
              <View style={styles.heroMetaRow}>
                <Feather name="calendar" size={13} color={colors.textSecondary} />
                <Text style={styles.heroMetaText}>
                  {nextPlan.previousDayName
                    ? `Up next after ${nextPlan.previousDayName}`
                    : "Let's get started"}
                </Text>
              </View>
            </AppCard>
          </View>
        ) : null}

        {otherDays.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader label="All Workout Days" />
            {otherDays.map((day) => {
              const busy = busyKey === day.id;
              return (
                <AppCard
                  key={day.id}
                  testID={`start-workout-day-${day.id}`}
                  onPress={() => startWorkout(day.id, day.name, day.id)}
                  style={[styles.dayRow, busy && styles.dayRowDisabled]}
                  accessibilityLabel={`Start ${day.name} workout${
                    day.muscleGroups.length > 0 ? `, ${musclesLabel(day)}` : ''
                  }`}
                  accessibilityState={{ disabled: busy }}
                >
                  <View style={styles.dayRowInner}>
                    <View style={styles.dayIconCircle}>
                      <Feather name="activity" size={16} color={colors.textSecondary} />
                    </View>
                    <View style={styles.dayTextBlock}>
                      <Text style={styles.dayName}>{day.name}</Text>
                      {day.muscleGroups.length > 0 ? (
                        <Text style={styles.dayMuscles}>{musclesLabel(day)}</Text>
                      ) : null}
                    </View>
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    ) : (
                      <Feather name="chevron-right" size={20} color={colors.textMuted} />
                    )}
                  </View>
                </AppCard>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader label="Do a Different Workout" />
          <AppCard
            testID="start-workout-custom"
            onPress={() => setCustomSheetOpen(true)}
            style={styles.dayRow}
            accessibilityLabel="Do a Different Workout, not part of your split"
          >
            <View style={styles.dayRowInner}>
              <View style={styles.dayIconCircle}>
                <Feather name="plus" size={16} color={colors.textSecondary} />
              </View>
              <View style={styles.dayTextBlock}>
                <Text style={styles.dayName}>Do a Different Workout</Text>
                <Text style={styles.dayMuscles}>Not part of your split</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </View>
          </AppCard>
        </View>
      </ScrollView>

      <BottomSheet
        visible={customSheetOpen}
        onClose={() => (busyKey === CUSTOM_BUSY_KEY ? null : setCustomSheetOpen(false))}
        testID="start-workout-custom-sheet"
      >
        <Text style={styles.sheetTitle}>Do a Different Workout</Text>
        <Text style={styles.sheetSubtitle}>
          Name this workout. It won&apos;t be added to your split.
        </Text>
        <TextInput
          testID="start-workout-custom-name"
          label="Workout name"
          placeholder="e.g. Arms + Abs"
          value={customName}
          onChangeText={setCustomName}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <View style={styles.sheetButtonRow}>
          <PrimaryButton
            testID="start-workout-custom-confirm"
            label={busyKey === CUSTOM_BUSY_KEY ? 'Starting…' : 'Start Workout'}
            onPress={() => startWorkout(CUSTOM_BUSY_KEY, trimmedCustomName, undefined)}
            disabled={trimmedCustomName.length === 0 || busyKey === CUSTOM_BUSY_KEY}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
