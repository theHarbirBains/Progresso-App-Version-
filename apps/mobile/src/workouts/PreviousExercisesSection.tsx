import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { TextButton } from '../design/Button';
import { Skeleton, SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale, widgetGap } from '../design/theme';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { machineLine } from '../exercises/machineDetails';
import { figureSexFor } from '../exercises/MuscleBrowseStrip';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { MUSCLE_TILES } from '../exercises/muscleTiles.generated';
import { useProfileIfAny } from '../profile/profileContext';
import { formatRecentDate } from './workoutFormat';
import {
  muscleGroupList,
  planPreviousExercises,
  type PreviousExercise,
  type PreviousSection,
} from './previousExercises';
import { formatSetValues } from './setValues';
import type { PreviousExercisesState } from './usePreviousExercises';

interface Props {
  previous: PreviousExercisesState;
  /** The muscle groups of the exercises already in the workout, in the order they were added. */
  addedGroups: MuscleGroup[];
  /** The exercises the picker can add, by id: a previous exercise shows only as one of these. */
  library: Map<string, ExerciseRow>;
  alreadyAddedIds: Set<string>;
  weightUnit: 'kg' | 'lb';
  onSelect: (exercise: ExerciseRow) => void;
  /** The session's own name -- the split day's ("Lower Body") -- for its card's title. */
  sessionName?: string | null;
  accentColor: string;
  testID?: string;
}

/** "3 sets · Top set 80 kg × 8" -- "Best 12 reps", "Best 1:30" -- and who logged it. */
function performanceLine(previous: PreviousExercise, unit: 'kg' | 'lb'): string {
  const parts = [`${previous.setCount} ${previous.setCount === 1 ? 'set' : 'sets'}`];
  if (previous.best) {
    const values = formatSetValues(
      { ...previous.best, measurementType: previous.measurementType },
      unit,
    );
    parts.push(previous.measurementType === 'weight_reps' ? `Top set ${values}` : `Best ${values}`);
  }
  if (previous.byTrainer) parts.push('Logged by your trainer');
  return parts.join(' · ');
}

/** "November 23, 2026". */
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** A section's exercises the picker has -- one no longer in the library is never stood in for. */
function availableIn(section: PreviousSection, library: Map<string, ExerciseRow>) {
  return section.exercises.flatMap((done) => {
    const exercise = library.get(done.exerciseId);
    return exercise ? [{ done, exercise }] : [];
  });
}

/**
 * The session's muscles, Harbir's figure of its first muscle group (a man's or a woman's, by the
 * person's sex) in two layers: the body in grey on a clear background, and its muscles tinted in
 * the accent over it -- so it's the theme's colour, with every muscle's shading kept.
 */
function SessionFigure({ group, accentColor }: { group: MuscleGroup; accentColor: string }) {
  const sex = figureSexFor(useProfileIfAny()?.gender);
  const tile = MUSCLE_TILES[sex][group];
  if (!tile) return null;
  return (
    <View
      style={styles.figure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={tile.figure} style={styles.figureLayer} contentFit="contain" />
      <Image
        source={tile.muscle}
        style={styles.figureLayer}
        contentFit="contain"
        tintColor={accentColor}
      />
    </View>
  );
}

/** One of the session card's figures: its glyph in the accent, the number, and what it counts. */
function Stat({
  icon,
  value,
  label,
  divider,
  testID,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  divider: boolean;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={[styles.stat, divider && styles.statDivider]}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <View style={styles.statTop}>
        {icon}
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * The top of a live workout's Add Exercise -- Last Time (previousExercises.ts): what the person
 * did the last time they trained each muscle group, laid out after Harbir's reference. A session
 * card first: YOUR PREVIOUS SESSION, the split day's name (or, without one, their recent
 * training), the day it was last done, how many muscle groups, exercises and sets there are below,
 * and the first muscle group on Harbir's figure in the accent. Then one card of the muscle groups,
 * each under an accent bar with when it was last trained, and its exercises -- each the very one
 * they did, with its photo, its setup and how it went, a tap from being added.
 */
export function PreviousExercisesSection({
  previous,
  addedGroups,
  library,
  alreadyAddedIds,
  weightUnit,
  onSelect,
  sessionName,
  accentColor,
  testID = 'previous-exercises',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const plan = useMemo(
    () => planPreviousExercises(previous.groups, { dayGroups: previous.dayGroups, addedGroups }),
    [previous.groups, previous.dayGroups, addedGroups],
  );
  const shown = expanded ? plan.sections : plan.sections.slice(0, plan.initialCount);
  const hidden = plan.sections.length - shown.length;

  if (previous.status === 'loading') {
    return (
      <View testID={testID} style={styles.stack}>
        <View testID={`${testID}-loading`} style={styles.stack}>
          <Skeleton height={196} radius={radii.xl} />
          <AppCard>
            <SkeletonRows count={4} />
          </AppCard>
        </View>
      </View>
    );
  }

  if (previous.status === 'error') {
    return (
      <View testID={testID} style={styles.stack}>
        <AppCard>
          <View testID={`${testID}-error`} style={styles.errorRow}>
            <Text style={styles.muted}>Couldn’t load your previous exercises.</Text>
            <TextButton testID={`${testID}-retry`} label="Try Again" onPress={previous.retry} />
          </View>
        </AppCard>
      </View>
    );
  }

  if (plan.sections.length === 0) {
    return (
      <View testID={testID} style={styles.stack}>
        <AppCard>
          <Text testID={`${testID}-first`} style={styles.muted}>
            Finish a workout and what you did for each muscle group shows here, so you can pick up
            where you left off.
          </Text>
        </AppCard>
      </View>
    );
  }

  // The session card's figures: what's listed below it.
  const listed = plan.sections.map((section) => ({ section, rows: availableIn(section, library) }));
  const withExercises = listed.filter(({ rows }) => rows.length > 0);
  const exerciseCount = withExercises.reduce((sum, { rows }) => sum + rows.length, 0);
  const setCount = withExercises.reduce(
    (sum, { rows }) => sum + rows.reduce((n, { done }) => n + done.setCount, 0),
    0,
  );
  const lastDone = plan.sections
    .map((section) => section.lastTrainedAt)
    .filter((at): at is string => at !== null)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const title =
    plan.mode === 'day'
      ? sessionName?.trim() || muscleGroupList(previous.dayGroups)
      : 'Recent Training';
  const figureGroup = (withExercises[0]?.section ?? plan.sections[0])!.muscleGroup;

  return (
    <View testID={testID} style={styles.stack}>
      <AppCard hero testID={`${testID}-session`}>
        <SessionFigure group={figureGroup} accentColor={accentColor} />
        <View style={styles.sessionWords}>
          <Text style={styles.kicker}>
            {plan.mode === 'day' ? 'YOUR PREVIOUS SESSION' : 'YOUR PREVIOUS SESSIONS'}
          </Text>
          <Text
            testID={`${testID}-title`}
            style={styles.sessionTitle}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {lastDone ? (
            <View style={styles.dateRow}>
              <Feather name="calendar" size={15} color={colors.textSecondary} />
              <Text testID={`${testID}-date`} style={styles.date}>
                {longDate(lastDone)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rule} />
        <View style={styles.stats}>
          <Stat
            testID={`${testID}-stat-groups`}
            icon={<Feather name="layers" size={20} color={accentColor} />}
            value={withExercises.length}
            label={withExercises.length === 1 ? 'Muscle Group' : 'Muscle Groups'}
            divider={false}
          />
          <Stat
            testID={`${testID}-stat-exercises`}
            icon={<MaterialCommunityIcons name="dumbbell" size={20} color={accentColor} />}
            value={exerciseCount}
            label={exerciseCount === 1 ? 'Exercise' : 'Exercises'}
            divider
          />
          <Stat
            testID={`${testID}-stat-sets`}
            icon={<Feather name="list" size={20} color={accentColor} />}
            value={setCount}
            label="Total Sets"
            divider
          />
        </View>
      </AppCard>

      <AppCard testID={`${testID}-list`}>
        {shown.map((section, sectionIndex) => {
          const label = MUSCLE_GROUP_LABELS[section.muscleGroup];
          const available = availableIn(section, library);
          const groupID = `${testID}-group-${section.muscleGroup}`;
          return (
            <View
              key={section.muscleGroup}
              testID={groupID}
              style={[styles.group, sectionIndex > 0 && styles.groupGap]}
            >
              <View style={styles.groupHeading}>
                <View style={[styles.groupBar, { backgroundColor: accentColor }]} />
                <Text style={styles.groupName} accessibilityRole="header">
                  {label.toUpperCase()}
                </Text>
                {section.lastTrainedAt ? (
                  <Text testID={`${groupID}-date`} style={styles.groupDate}>
                    Last trained {formatRecentDate(section.lastTrainedAt)}
                  </Text>
                ) : null}
              </View>
              {section.exercises.length === 0 ? (
                <Text testID={`${groupID}-empty`} style={styles.muted}>
                  No {label} exercises logged yet.
                </Text>
              ) : available.length === 0 ? (
                <Text testID={`${groupID}-gone`} style={styles.muted}>
                  Those exercises are no longer in your library.
                </Text>
              ) : (
                available.map(({ done, exercise }, index) => {
                  const added = alreadyAddedIds.has(exercise.id);
                  const setup =
                    machineLine(exercise, MUSCLE_GROUP_LABELS[exercise.muscleGroup]) ?? null;
                  const detail = performanceLine(done, weightUnit);
                  const name = added ? `${exercise.name} (added)` : exercise.name;
                  return (
                    <Pressable
                      key={exercise.id}
                      testID={`${groupID}-${exercise.id}`}
                      onPress={() => onSelect(exercise)}
                      disabled={added}
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && styles.rowDivider,
                        pressed && styles.rowPressed,
                        added && styles.rowAdded,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: added }}
                      accessibilityLabel={[
                        name,
                        setup,
                        detail,
                        `last done ${formatRecentDate(done.performedAt)}`,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    >
                      <ExercisePhoto
                        uri={exercise.photoUrl}
                        name={exercise.name}
                        size={56}
                        exerciseId={exercise.createdBy === null ? exercise.id : undefined}
                        slug={exercise.slug}
                      />
                      <View style={styles.rowWords}>
                        <Text style={styles.rowName} numberOfLines={2}>
                          {name}
                        </Text>
                        {setup ? (
                          <Text style={styles.rowSetup} numberOfLines={2}>
                            {setup}
                          </Text>
                        ) : null}
                        <Text style={styles.rowDetail}>{detail}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })}
        {plan.sections.length > plan.initialCount ? (
          <TextButton
            testID={`${testID}-more`}
            label={expanded ? 'Show Less' : `Show More (${hidden})`}
            accessibilityLabel={
              expanded ? 'Show fewer muscle groups' : `Show ${hidden} more muscle groups`
            }
            onPress={() => setExpanded((open) => !open)}
          />
        ) : null}
      </AppCard>
    </View>
  );
}

const FIGURE_WIDTH = 150;

const styles = StyleSheet.create({
  stack: {
    gap: widgetGap * 2,
  },
  // The figure, top right, behind the words; it fades into the card at its own bottom.
  figure: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: FIGURE_WIDTH,
    height: 168,
    overflow: 'hidden',
    borderTopRightRadius: radii.xl,
  },
  figureLayer: {
    position: 'absolute',
    top: -spacing.sm,
    left: 0,
    width: FIGURE_WIDTH,
    height: FIGURE_WIDTH / 0.88,
  },
  sessionWords: {
    paddingRight: FIGURE_WIDTH - spacing.xl,
    gap: spacing.xs,
    minHeight: 120,
    justifyContent: 'center',
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.display,
    color: colors.textSecondary,
    letterSpacing: 1.6,
  },
  sessionTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  date: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.divider,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statValue: {
    fontFamily: fonts.displayHeavy,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  group: {
    gap: 0,
  },
  groupGap: {
    marginTop: spacing.xl,
  },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  groupBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  groupName: {
    ...typeScale.label,
    fontFamily: fonts.display,
    letterSpacing: 1.6,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  groupDate: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowAdded: {
    opacity: 0.5,
  },
  rowWords: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...typeScale.body,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  rowSetup: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  rowDetail: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  muted: {
    ...typeScale.secondary,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  errorRow: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
});
