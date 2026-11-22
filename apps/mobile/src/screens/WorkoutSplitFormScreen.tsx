import { Feather } from '@expo/vector-icons';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { IconButton } from '../design/IconButton';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { TextInput } from '../design/TextInput';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { withAlpha } from '../theme/accentColor';
import { SPLIT_DAY_TEMPLATES, type SplitDayTemplate } from '../workouts/splitDayTemplates';
import {
  SPLIT_MUSCLE_GROUPS,
  SPLIT_MUSCLE_GROUP_LABELS,
  type SplitMuscleGroup,
} from '../workouts/splitMuscleGroups';
import { fetchPlansForDays, type PlannedExercise } from '../workouts/splitPlanQueries';
import {
  createWorkoutSplit,
  createWorkoutSplitDay,
  deleteWorkoutSplitDay,
  fetchWorkoutSplitDetail,
  renameWorkoutSplit,
  renameWorkoutSplitDay,
  reorderWorkoutSplitDays,
  setWorkoutSplitDayMuscleGroups,
  type WorkoutSplitDay,
} from '../workouts/workoutSplitQueries';
import { workoutSplitStyles as styles } from './workoutSplitStyles';

type Props = RootStackScreenProps<'WorkoutSplitForm'>;

/** How many of a day's planned exercises its widget lists before "+N more". */
const PLAN_PREVIEW = 4;

type StepState = 'done' | 'current' | 'upcoming';

/** The builder's three steps across the top: where they are, and that exercises are optional. */
function SplitSteps({
  states,
  accent,
  onAccent,
}: {
  states: [StepState, StepState, StepState];
  accent: string;
  onAccent: string;
}) {
  const steps = ['Name it', 'Days & muscles', 'Exercises & sets'];
  return (
    <AppCard testID="workout-split-form-steps">
      <View style={local.steps}>
        {steps.map((label, i) => {
          const state = states[i]!;
          return (
            <Fragment key={label}>
              {i > 0 ? (
                <View
                  style={[
                    local.stepLine,
                    { backgroundColor: state === 'upcoming' ? colors.divider : accent },
                  ]}
                />
              ) : null}
              <View
                testID={`workout-split-form-step-${i + 1}`}
                style={local.step}
                accessible
                accessibilityLabel={`Step ${i + 1}, ${label}${i === 2 ? ', optional' : ''}: ${
                  state === 'done' ? 'done' : state === 'current' ? 'now' : 'next'
                }`}
              >
                <View
                  style={[
                    local.stepDot,
                    state === 'current' && { backgroundColor: accent, borderColor: accent },
                    state === 'done' && { borderColor: accent },
                  ]}
                >
                  {state === 'done' ? (
                    <Feather name="check" size={14} color={accent} />
                  ) : (
                    <Text style={[local.stepNumber, state === 'current' && { color: onAccent }]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[local.stepLabel, state !== 'upcoming' && { color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  {label}
                </Text>
                {i === 2 ? <Text style={local.stepOptional}>Optional</Text> : null}
              </View>
            </Fragment>
          );
        })}
      </View>
    </AppCard>
  );
}

// Create is just step one of edit: a brand-new split only needs a name, so
// this screen creates it immediately on that first save and switches itself
// into edit mode (via setParams) for day/muscle-group management -- rather
// than holding a whole draft split in local state and diffing it against
// the server on a single final "Save".
//
// Laid out as the three steps it is: the steps across the top (the third, Exercises & sets,
// marked Optional), the name in a widget, then each day as a widget of its own -- its number, its
// name, its muscle groups as chips, and Exercises & Sets: a clear "Add Exercises & Sets" for a day
// with none (it opens the day's plan, SplitDayPlan) or its exercises with their sets and "Edit".
// Days are added in one tap from the presets' days (Push, Pull, Legs, ... with their muscle
// groups) or as a blank day of their own. Every change saves at once.
export function WorkoutSplitFormScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, themeLoading } = useProgressTheme();
  const { updateProfile } = useProfile();
  const splitId = route.params?.splitId;
  const activateOnCreate = route.params?.activateOnCreate ?? false;

  const [loading, setLoading] = useState(Boolean(splitId));
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [splitName, setSplitName] = useState('');
  const [days, setDays] = useState<WorkoutSplitDay[]>([]);
  // Each day's planned exercises, read with the split and again whenever the page comes back
  // into view (a plan is changed on its own page).
  const [plans, setPlans] = useState<Map<string, PlannedExercise[]>>(new Map());
  // The last name actually persisted per day (server-confirmed), separate
  // from `days` state itself -- so a day that's been typed blank (e.g. the
  // user selected-all-and-deleted before typing a replacement) can be
  // reverted to something real on blur instead of staying visibly blank
  // indefinitely (renaming to blank is never persisted -- see
  // handleRenameDay -- so leaving the display blank would misrepresent
  // what the server actually has).
  const confirmedDayNames = useRef<Record<string, string>>({});
  const dayIds = useRef<string[]>([]);
  dayIds.current = days.map((day) => day.id);

  const loadPlans = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    // The plans are extras: a failure leaves the days as they are.
    const found = await fetchPlansForDays(ids).catch(() => null);
    if (found) setPlans(found);
  }, []);

  const load = useCallback(async () => {
    if (!splitId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchWorkoutSplitDetail(splitId);
      setSplitName(detail.name);
      setDays(detail.days);
      confirmedDayNames.current = Object.fromEntries(detail.days.map((d) => [d.id, d.name]));
      void loadPlans(detail.days.map((d) => d.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout split');
    } finally {
      setLoading(false);
    }
  }, [splitId, loadPlans]);

  useEffect(() => {
    load();
  }, [load]);

  // Back from a day's plan: its exercises are read again (only the plans -- a name being typed
  // is never replaced).
  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      void loadPlans(dayIds.current);
    });
    return unsubscribe;
  }, [navigation, loadPlans]);

  async function handleCreate() {
    if (!userId || !splitName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createWorkoutSplit(userId, splitName.trim());
      if (activateOnCreate) {
        await updateProfile({ activeWorkoutSplitId: created.id });
      }
      navigation.setParams({ splitId: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create split');
    } finally {
      setCreating(false);
    }
  }

  async function handleRenameSplit() {
    if (!splitId || !splitName.trim()) return;
    try {
      await renameWorkoutSplit(splitId, splitName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename split');
    }
  }

  /** A day added at the end: a blank one ("Day 4"), or a preset's day with its muscle groups. */
  async function handleAddDay(template?: SplitDayTemplate) {
    if (!splitId || adding) return;
    setAdding(template?.name ?? 'blank');
    setError(null);
    try {
      const day = await createWorkoutSplitDay(
        splitId,
        template?.name ?? `Day ${days.length + 1}`,
        days.length + 1,
      );
      let added = day;
      if (template && template.muscleGroups.length > 0) {
        await setWorkoutSplitDayMuscleGroups(day.id, template.muscleGroups);
        added = { ...day, muscleGroups: [...template.muscleGroups] };
      }
      setDays((prev) => [...prev, added]);
      confirmedDayNames.current[day.id] = day.name;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add day');
    } finally {
      setAdding(null);
    }
  }

  function updateDayNameLocally(dayId: string, name: string) {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name } : d)));
  }

  async function handleRenameDay(dayId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      // A blank name is never persisted -- revert the display back to the
      // last confirmed name rather than leaving the field looking blank
      // (nothing was actually lost server-side).
      const confirmed = confirmedDayNames.current[dayId];
      if (confirmed !== undefined) updateDayNameLocally(dayId, confirmed);
      return;
    }
    try {
      await renameWorkoutSplitDay(dayId, trimmed);
      confirmedDayNames.current[dayId] = trimmed;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename day');
    }
  }

  async function handleRemoveDay(dayId: string) {
    try {
      await deleteWorkoutSplitDay(dayId);
      setDays((prev) => prev.filter((d) => d.id !== dayId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove day');
    }
  }

  async function handleMoveDay(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= days.length || !splitId) return;
    const reordered = [...days];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setDays(reordered);
    try {
      await reorderWorkoutSplitDays(
        splitId,
        reordered.map((d) => ({ id: d.id, name: d.name })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder days');
    }
  }

  async function handleToggleMuscleGroup(day: WorkoutSplitDay, group: SplitMuscleGroup) {
    const has = day.muscleGroups.includes(group);
    const nextGroups = has
      ? day.muscleGroups.filter((g) => g !== group)
      : [...day.muscleGroups, group];
    setDays((prev) => prev.map((d) => (d.id === day.id ? { ...d, muscleGroups: nextGroups } : d)));
    try {
      await setWorkoutSplitDayMuscleGroups(day.id, nextGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update muscle groups');
    }
  }

  function openPlan(day: WorkoutSplitDay) {
    navigation.navigate('SplitDayPlan', {
      dayId: day.id,
      dayName: day.name.trim() || confirmedDayNames.current[day.id] || 'Workout Day',
      muscleGroups: day.muscleGroups,
    });
  }

  if (loading || themeLoading) {
    return <LoadingState testID="workout-split-form-loading" />;
  }

  const anyPlanned = days.some((day) => (plans.get(day.id) ?? []).length > 0);
  const daysReady = days.length > 0 && days.every((day) => day.muscleGroups.length > 0);
  const steps: [StepState, StepState, StepState] = !splitId
    ? ['current', 'upcoming', 'upcoming']
    : [
        'done',
        daysReady ? 'done' : 'current',
        anyPlanned ? 'done' : daysReady ? 'current' : 'upcoming',
      ];

  return (
    <Screen
      keyboardAvoiding
      scrollTestID="workout-split-form-scroll"
      contentContainerStyle={local.content}
      header={
        <AppHeader
          title={splitId ? 'Edit Split' : 'Create Workout Split'}
          leftAction={{
            icon: 'arrow-left',
            onPress: () => navigation.goBack(),
            accessibilityLabel: 'Back',
            testID: 'workout-split-form-back',
          }}
        />
      }
    >
      {error ? (
        <Text testID="workout-split-form-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <SplitSteps states={steps} accent={theme.accent} onAccent={theme.onAccent} />

      <AppCard hero={!splitId}>
        <TextInput
          testID="workout-split-form-name"
          label="Split Name"
          placeholder="My Training"
          value={splitName}
          onChangeText={setSplitName}
          onBlur={splitId ? handleRenameSplit : undefined}
        />
        {!splitId ? (
          <Text style={local.nameHelp}>
            Next, add your training days and the muscles each one works. Planning each day&apos;s
            exercises and sets is up to you.
          </Text>
        ) : null}
      </AppCard>

      {!splitId ? (
        <PrimaryButton
          testID="workout-split-form-create"
          label="Create Split"
          onPress={handleCreate}
          loading={creating}
          disabled={!splitName.trim()}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
      ) : (
        <>
          <SectionHeader
            label={days.length > 0 ? `Workout Days · ${days.length}` : 'Workout Days'}
          />
          {days.map((day, index) => {
            const plan = plans.get(day.id) ?? [];
            const sets = plan.reduce((sum, planned) => sum + planned.targetSets, 0);
            return (
              <AppCard key={day.id} testID={`workout-split-day-${day.id}`}>
                <View style={local.dayHeader}>
                  <View
                    style={[local.dayNumber, { backgroundColor: withAlpha(theme.accent, 0.16) }]}
                  >
                    <Text style={[local.dayNumberText, { color: theme.accent }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.formDayName}>
                    <TextInput
                      testID={`workout-split-day-name-${day.id}`}
                      value={day.name}
                      onChangeText={(text) => updateDayNameLocally(day.id, text)}
                      onBlur={() => handleRenameDay(day.id, day.name)}
                      accessibilityLabel={`Day ${index + 1} name`}
                    />
                  </View>
                </View>
                <View style={local.dayTools}>
                  <IconButton
                    testID={`workout-split-day-up-${day.id}`}
                    icon="arrow-up"
                    accessibilityLabel="Move day up"
                    onPress={() => handleMoveDay(index, -1)}
                    disabled={index === 0}
                  />
                  <IconButton
                    testID={`workout-split-day-down-${day.id}`}
                    icon="arrow-down"
                    accessibilityLabel="Move day down"
                    onPress={() => handleMoveDay(index, 1)}
                    disabled={index === days.length - 1}
                  />
                  <View style={local.toolsSpacer} />
                  <IconButton
                    testID={`workout-split-day-remove-${day.id}`}
                    icon="trash-2"
                    accessibilityLabel="Remove day"
                    color={colors.destructive}
                    onPress={() => handleRemoveDay(day.id)}
                  />
                </View>

                <Text style={styles.fieldLabel}>Muscle Groups</Text>
                <View style={styles.chipRow}>
                  {SPLIT_MUSCLE_GROUPS.map((group) => {
                    const selected = day.muscleGroups.includes(group);
                    return (
                      <TouchableOpacity
                        key={group}
                        testID={`workout-split-day-${day.id}-muscle-${group}`}
                        style={[
                          styles.chip,
                          selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => handleToggleMuscleGroup(day, group)}
                        activeOpacity={0.8}
                        hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.chipText, selected && { color: theme.onAccent }]}>
                          {SPLIT_MUSCLE_GROUP_LABELS[group]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Exercises & Sets: optional, and plain to see. */}
                <View style={local.planSection}>
                  <View style={local.planHead}>
                    <Text style={local.planTitle}>Exercises & Sets</Text>
                    <View style={local.optional}>
                      <Text style={local.optionalText}>Optional</Text>
                    </View>
                  </View>
                  {plan.length === 0 ? (
                    <TouchableOpacity
                      testID={`workout-split-day-plan-${day.id}`}
                      style={[
                        local.addPlan,
                        {
                          backgroundColor: withAlpha(theme.accent, 0.1),
                          borderColor: withAlpha(theme.accent, 0.35),
                        },
                      ]}
                      onPress={() => openPlan(day)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add exercises and sets to ${day.name}`}
                    >
                      <Feather name="plus-circle" size={20} color={theme.accent} />
                      <View style={local.addPlanText}>
                        <Text style={[local.addPlanTitle, { color: theme.accent }]}>
                          Add Exercises & Sets
                        </Text>
                        <Text style={local.addPlanLine}>
                          Or leave it, and choose them as you train.
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={theme.accent} />
                    </TouchableOpacity>
                  ) : (
                    <>
                      {plan.slice(0, PLAN_PREVIEW).map((planned) => (
                        <View key={planned.id} style={local.planRow}>
                          <Text style={local.planName} numberOfLines={1}>
                            {planned.exerciseName}
                          </Text>
                          <Text style={local.planSets}>
                            {planned.targetSets} {planned.targetSets === 1 ? 'set' : 'sets'}
                          </Text>
                        </View>
                      ))}
                      {plan.length > PLAN_PREVIEW ? (
                        <Text style={local.planMore}>+{plan.length - PLAN_PREVIEW} more</Text>
                      ) : null}
                      <TouchableOpacity
                        testID={`workout-split-day-plan-${day.id}`}
                        style={local.editPlan}
                        onPress={() => openPlan(day)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit exercises and sets for ${day.name}`}
                      >
                        <Text style={local.planSummary}>
                          {plan.length} {plan.length === 1 ? 'exercise' : 'exercises'} · {sets}{' '}
                          {sets === 1 ? 'set' : 'sets'}
                        </Text>
                        <Text style={[local.editPlanText, { color: theme.accent }]}>Edit</Text>
                        <Feather name="chevron-right" size={16} color={theme.accent} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </AppCard>
            );
          })}

          <AppCard testID="workout-split-form-quick-add">
            <Text style={local.quickTitle}>
              {days.length === 0 ? 'Add your first day' : 'Add a day'}
            </Text>
            <Text style={local.quickLine}>
              Tap one to add it with its muscle groups, or add a blank day and name it yourself.
            </Text>
            <View style={styles.chipRow}>
              {SPLIT_DAY_TEMPLATES.map((template) => (
                <TouchableOpacity
                  key={template.name}
                  testID={`workout-split-form-quick-${template.name}`}
                  style={[styles.chip, local.quickChip]}
                  onPress={() => handleAddDay(template)}
                  disabled={adding !== null}
                  activeOpacity={0.8}
                  hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${template.name}`}
                >
                  <Feather name="plus" size={14} color={theme.accent} />
                  <Text style={styles.chipText}>{template.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={local.blankDay}>
              <SecondaryButton
                testID="workout-split-form-add-day"
                label="+ Add Workout Day"
                onPress={() => handleAddDay()}
                loading={adding === 'blank'}
              />
            </View>
          </AppCard>

          <PrimaryButton
            testID="workout-split-form-done"
            label={activateOnCreate ? 'Create Split' : 'Done'}
            onPress={() => navigation.goBack()}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </>
      )}
    </Screen>
  );
}

const local = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    width: 84,
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepLine: {
    flex: 1,
    height: 2,
    borderRadius: radii.pill,
    marginTop: 13,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    ...typeScale.label,
    fontFamily: fonts.monoBold,
    color: colors.textMuted,
  },
  stepLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stepOptional: {
    ...typeScale.caption,
    fontSize: 10,
    color: colors.textMuted,
  },
  nameHelp: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    ...typeScale.cardTitle,
    fontFamily: fonts.monoBold,
  },
  dayTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  toolsSpacer: {
    flex: 1,
  },
  planSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planTitle: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  optional: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  optionalText: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  addPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  addPlanText: {
    flex: 1,
    gap: 2,
  },
  addPlanTitle: {
    ...typeScale.callout,
    fontFamily: fonts.display,
  },
  addPlanLine: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planName: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
  },
  planSets: {
    ...typeScale.secondary,
    fontFamily: fonts.mono,
    color: colors.textSecondaryBright,
  },
  planMore: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  editPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
  },
  planSummary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flex: 1,
  },
  editPlanText: {
    ...typeScale.label,
  },
  quickTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  quickLine: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  blankDay: {
    marginTop: spacing.md,
  },
});
