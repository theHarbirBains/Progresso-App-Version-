import { Feather } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AutoCarousel } from '../design/AutoCarousel';
import { SecondaryButton } from '../design/Button';
import { Card } from '../design/Card';
import { RiseIn } from '../design/RiseIn';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { ExercisePhoto } from '../exercises/ExercisePhoto';
import type { MeasurementType, MovementType } from '../exercises/movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { cuesEqual, type AllTimeBest, type ProgressionCue } from './progression';
import { PER_SIDE_NOTE, SetColumnHeader } from './SetColumnHeader';
import { SetRow } from './SetRow';
import { formatSetValues } from './setValues';
import { UnilateralSetRow, type UnilateralSideInput } from './UnilateralSetRow';
import { formatShortDate } from './workoutFormat';

const PHOTO_SIZE = 48;

/** One set from the user's last completed session with this exercise --
 * already fully formatted by the caller (ActiveWorkoutScreen), which knows
 * the weight unit; this component stays presentation-only. */
export interface PreviousSessionSet {
  setNumber: number;
  weightDisplay: string;
  unit: 'kg' | 'lb';
  reps: number;
  /** A timed exercise's set, as shown ("1:30"); null for every other set. */
  durationDisplay?: string | null;
  /** Only present for a unilateral exercise's set -- shown as a small "L"/"R" tag so two same-numbered-look rows aren't ambiguous. */
  side: 'left' | 'right' | null;
}

export interface PreviousSessionDisplay {
  dateDisplay: string;
  /** That session's top set, as shown ("72.5 lb × 7"); null when it has none to show. */
  topSetDisplay?: string | null;
  /** Which of `sets` (by setNumber) was the top set. */
  topSetNumber?: number | null;
  sets: PreviousSessionSet[];
}

export interface ExerciseCardSet {
  id: string;
  setIndex: number;
  weight: string;
  reps: string;
  /** A timed set's duration as typed. */
  duration?: string;
  completed: boolean;
  canComplete: boolean;
}

export interface UnilateralExerciseCardSet {
  setIndex: number;
  /** Same shape/validity semantics as ExerciseCardSet -- computed by the
   * caller (ActiveWorkoutScreen's isValidDraft), never re-derived here from
   * raw weight/reps strings. */
  left: UnilateralSideInput & { completed: boolean; canComplete: boolean };
  right: UnilateralSideInput & { completed: boolean; canComplete: boolean };
}

interface Props {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  /** What the exercise is logged as: weight and reps, reps only, or a time. Defaults to weight and reps. */
  measurementType?: MeasurementType;
  /** The exercise's machine photo, when it has one: beside its name, opening full size on a tap. */
  photoUrl?: string | null;
  /** The unit the all-time best is shown in. */
  weightUnit?: 'kg' | 'lb';
  /** Every set from the user's last completed session with this exercise
   * (never today's own in-progress sets) -- null/omitted when there's no
   * prior session yet, in which case Last Time is omitted entirely. */
  previousSession?: PreviousSessionDisplay | null;
  /** Opens this exercise's full history (Progress > Exercise Detail). Only
   * rendered when a previous session exists to link out from. */
  onViewHistory?: () => void;
  /** The best set ever, within the person's rep range (progression.ts's allTimeBest). */
  allTimeBest?: AllTimeBest | null;
  /** What to aim for today, from the last session (workouts/progression.ts), under Last Time. */
  progressionCue?: ProgressionCue | null;
  /** Said once today's own top set reaches the top of the range, under today's sets. */
  sessionCue?: string | null;
  /** Only for an exercise with a rep range of its own ("Own range 3–5"); the person's own range is shown once, at the top of the workout. */
  ownRangeText?: string | null;
  /** Opens this exercise's own range and weight step, from its menu. Must be stable (see arePropsEqual). */
  onEditProgression?: () => void;
  /** Used when movementType is 'bilateral' -- one row per set, unchanged from before unilateral support existed. */
  sets: ExerciseCardSet[];
  /** Used when movementType is 'unilateral' -- one row per LOGICAL set (both sides), never a separate exercise per side. */
  unilateralSets: UnilateralExerciseCardSet[];
  onChangeWeight: (setId: string, text: string) => void;
  onChangeReps: (setId: string, text: string) => void;
  onChangeDuration?: (setId: string, text: string) => void;
  onToggleComplete: (setId: string) => void;
  /** Only used for a unilateral exercise -- completes/uncompletes both sides of one logical set together, since a unilateral set is one unit, not two independent ones. */
  onAddSet: () => void;
  /** Omitted where removing a set mid-workout isn't offered (see each caller). */
  onRemoveSet?: (setId: string) => void;
  onRemoveExercise: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}

/** One of the exercise's two records: what it is, the figure, and when. */
function RecordTile({
  testID,
  label,
  value,
  meta,
  valueColor,
}: {
  testID?: string;
  label: string;
  value: string;
  meta: string;
  valueColor?: string;
}) {
  return (
    <View
      testID={testID}
      style={styles.recordTile}
      accessible
      accessibilityLabel={`${label}: ${value}, ${meta}`}
    >
      <Text style={styles.recordLabel}>{label}</Text>
      <Text
        style={[styles.recordValue, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={styles.recordMeta}>{meta}</Text>
    </View>
  );
}

/** One action in an exercise's menu: a glyph over a short label, a 44pt target. */
function MenuAction({
  testID,
  icon,
  label,
  accessibilityLabel,
  onPress,
  destructive,
}: {
  testID?: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? colors.destructive : colors.textSecondary;
  return (
    <TouchableOpacity
      testID={testID}
      style={styles.menuAction}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={icon} size={18} color={color} />
      <Text style={[styles.menuActionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function slideValue(set: PreviousSessionSet, type: MeasurementType): string {
  if (type === 'timed') return set.durationDisplay ?? '—';
  if (type === 'bodyweight') return `${set.reps} ${set.reps === 1 ? 'rep' : 'reps'}`;
  return `${set.weightDisplay} ${set.unit} × ${set.reps}`;
}

// One exercise in the live workout, as its own widget (a `Card`):
// - its photo (tap for full size) or initial, name, muscle group, and -- only when it has one --
//   its own rep range; a "more" glyph opens a row of actions inside the widget (Up, Down, Rep
//   Range, Remove), so nothing opens over the workout;
// - two records side by side: All-Time Best (the best set ever within the rep range, with its
//   date, or "Today" in the accent once today's beats it) and Last Time (that session's top set,
//   its date and how many sets);
// - Last Time's sets as a carousel that moves on by itself and can be swiped to any set, the
//   top set marked, with View History; then the suggestion for today;
// - today's sets to log, as rows that never move, and Add Set.
function ExerciseCardComponent({
  exerciseName,
  muscleGroup,
  movementType,
  measurementType = 'weight_reps',
  photoUrl = null,
  weightUnit = 'lb',
  previousSession = null,
  onViewHistory,
  allTimeBest = null,
  progressionCue = null,
  sessionCue = null,
  ownRangeText = null,
  onEditProgression,
  sets,
  unilateralSets,
  onChangeWeight,
  onChangeReps,
  onChangeDuration,
  onToggleComplete,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onMoveUp,
  onMoveDown,
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isUnilateral = movementType === 'unilateral';
  const hasRows = isUnilateral ? unilateralSets.length > 0 : sets.length > 0;
  const previousSets = previousSession?.sets ?? [];
  const id = (suffix: string) => (testID ? `${testID}-${suffix}` : undefined);

  function fromMenu(action: () => void) {
    return () => {
      setMenuOpen(false);
      action();
    };
  }

  return (
    <Card testID={testID}>
      <View style={styles.exerciseHeader}>
        <ExercisePhoto testID={id('photo')} uri={photoUrl} name={exerciseName} size={PHOTO_SIZE} />
        <View style={styles.exerciseTitleBlock}>
          <Text style={styles.exerciseName}>{exerciseName}</Text>
          <Text testID={id('muscle-group')} style={styles.exerciseMuscle}>
            {MUSCLE_GROUP_LABELS[muscleGroup]}
          </Text>
          {ownRangeText ? (
            <Text testID={id('own-range')} style={[styles.ownRange, { color: accentColor }]}>
              {ownRangeText}
            </Text>
          ) : null}
          {isUnilateral ? (
            <Text testID={id('per-side-note')} style={styles.perSideNote}>
              {PER_SIDE_NOTE[measurementType]}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          testID={id('menu')}
          style={styles.exerciseAction}
          onPress={() => setMenuOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={`${exerciseName} options`}
          accessibilityState={{ expanded: menuOpen }}
        >
          <Feather
            name={menuOpen ? 'x' : 'more-horizontal'}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {menuOpen ? (
        <RiseIn>
          <View testID={id('actions')} style={styles.menuRow}>
            {onMoveUp ? (
              <MenuAction
                testID={id('move-up')}
                icon="chevron-up"
                label="Up"
                accessibilityLabel="Move exercise up"
                onPress={fromMenu(onMoveUp)}
              />
            ) : null}
            {onMoveDown ? (
              <MenuAction
                testID={id('move-down')}
                icon="chevron-down"
                label="Down"
                accessibilityLabel="Move exercise down"
                onPress={fromMenu(onMoveDown)}
              />
            ) : null}
            {onEditProgression ? (
              <MenuAction
                testID={id('range')}
                icon="sliders"
                label="Rep Range"
                accessibilityLabel={`Change the rep range for ${exerciseName}`}
                onPress={fromMenu(onEditProgression)}
              />
            ) : null}
            <MenuAction
              testID={id('remove')}
              icon="trash-2"
              label="Remove"
              accessibilityLabel="Remove exercise"
              onPress={fromMenu(onRemoveExercise)}
              destructive
            />
          </View>
        </RiseIn>
      ) : null}

      {allTimeBest || previousSession ? (
        <View style={styles.recordTiles}>
          {allTimeBest ? (
            <RecordTile
              testID={id('best')}
              label="All-Time Best"
              value={formatSetValues(allTimeBest, weightUnit)}
              meta={allTimeBest.achievedAt ? formatShortDate(allTimeBest.achievedAt) : 'Today'}
              valueColor={allTimeBest.achievedAt ? undefined : accentColor}
            />
          ) : null}
          {previousSession ? (
            <RecordTile
              testID={id('last')}
              label="Last Time"
              value={previousSession.topSetDisplay ?? '—'}
              meta={`${previousSession.dateDisplay} · ${previousSets.length} ${previousSets.length === 1 ? 'set' : 'sets'}`}
            />
          ) : null}
        </View>
      ) : null}

      {previousSets.length > 0 ? (
        <View testID={id('previous-session')} style={styles.previousSession}>
          <View style={styles.previousHeaderRow}>
            <SectionHeader label="Last Time's Sets" />
            {onViewHistory ? (
              <TouchableOpacity
                testID={id('view-history')}
                onPress={onViewHistory}
                accessibilityRole="button"
                accessibilityLabel="View History"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 0 }}
              >
                <View style={styles.viewHistory}>
                  <Text style={[styles.viewHistoryText, { color: accentColor }]}>View History</Text>
                  <Feather name="chevron-right" size={14} color={accentColor} />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
          <AutoCarousel
            testID={id('previous')}
            items={previousSets}
            keyOf={(set) => String(set.setNumber)}
            renderSlide={(set) => {
              const top = set.setNumber === previousSession?.topSetNumber;
              const side = set.side ? ` · ${set.side === 'left' ? 'Left' : 'Right'}` : '';
              const value = slideValue(set, measurementType);
              return (
                <View
                  testID={id(`previous-set-${set.setNumber}`)}
                  style={styles.slide}
                  accessible
                  accessibilityLabel={`Set ${set.setNumber} of ${previousSets.length}${side}: ${value}${top ? ', top set' : ''}`}
                >
                  <Text style={styles.slideLabel}>
                    Set {set.setNumber} of {previousSets.length}
                    {side}
                  </Text>
                  <Text style={styles.slideValue}>{value}</Text>
                  {top ? (
                    <Text style={[styles.slideTag, { color: accentColor }]}>Top Set</Text>
                  ) : null}
                </View>
              );
            }}
          />
        </View>
      ) : null}

      {progressionCue ? (
        <View
          testID={id('cue')}
          style={styles.cue}
          accessible
          accessibilityLabel={[
            progressionCue.headline,
            ...progressionCue.options,
            progressionCue.detail,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Feather name="trending-up" size={16} color={accentColor} style={styles.cueIcon} />
          <View style={styles.cueBody}>
            <Text style={styles.cueHeadline}>{progressionCue.headline}</Text>
            {progressionCue.options.map((option) => (
              <Text key={option} style={styles.cueOption}>
                {option}
              </Text>
            ))}
            {progressionCue.detail ? (
              <Text style={styles.cueDetail}>{progressionCue.detail}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.today}>
        <SectionHeader label="Today" />
        {hasRows ? <SetColumnHeader measurementType={measurementType} /> : null}

        {isUnilateral
          ? unilateralSets.map((set, position) => (
              <UnilateralSetRow
                key={set.setIndex}
                testID={id(`set-${set.setIndex}`)}
                // Numbered by position, so removing a set never leaves a gap (1, 3).
                setIndex={position + 1}
                left={set.left}
                right={set.right}
                completed={set.left.completed && set.right.completed}
                canComplete={set.left.canComplete && set.right.canComplete}
                measurementType={measurementType}
                onChangeWeight={onChangeWeight}
                onChangeReps={onChangeReps}
                onChangeDuration={onChangeDuration}
                onToggleComplete={onToggleComplete}
                onRemove={onRemoveSet}
                accentColor={accentColor}
                onAccentColor={onAccentColor}
              />
            ))
          : sets.map((set, position) => (
              <SetRow
                key={set.id}
                testID={id(`set-${set.id}`)}
                setIndex={position + 1}
                weight={set.weight}
                reps={set.reps}
                duration={set.duration ?? ''}
                measurementType={measurementType}
                completed={set.completed}
                canComplete={set.canComplete}
                setId={set.id}
                onChangeWeight={onChangeWeight}
                onChangeReps={onChangeReps}
                onChangeDuration={onChangeDuration}
                onToggleComplete={onToggleComplete}
                onRemove={onRemoveSet}
                accentColor={accentColor}
                onAccentColor={onAccentColor}
              />
            ))}

        {sessionCue ? (
          <View
            testID={id('session-cue')}
            style={styles.sessionCue}
            accessible
            accessibilityLabel={sessionCue}
          >
            <Feather name="check-circle" size={16} color={accentColor} />
            <Text style={styles.sessionCueText}>{sessionCue}</Text>
          </View>
        ) : null}

        <View style={styles.addSet}>
          <SecondaryButton
            testID={id('add-set')}
            size="md"
            label="+ Add Set"
            accessibilityLabel="Add Set"
            onPress={onAddSet}
          />
        </View>
      </View>
    </Card>
  );
}

function arraysEqual<T>(a: T[], b: T[], elementEqual: (x: T, y: T) => boolean): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, i) => elementEqual(item, b[i]));
}

function setsEqual(a: ExerciseCardSet[], b: ExerciseCardSet[]): boolean {
  return arraysEqual(
    a,
    b,
    (set, other) =>
      set.id === other.id &&
      set.setIndex === other.setIndex &&
      set.weight === other.weight &&
      set.reps === other.reps &&
      set.duration === other.duration &&
      set.completed === other.completed &&
      set.canComplete === other.canComplete,
  );
}

function unilateralSideEqual(
  a: UnilateralExerciseCardSet['left'],
  b: UnilateralExerciseCardSet['left'],
): boolean {
  return (
    a.weight === b.weight &&
    a.reps === b.reps &&
    a.duration === b.duration &&
    a.completed === b.completed &&
    a.canComplete === b.canComplete
  );
}

function unilateralSetsEqual(
  a: UnilateralExerciseCardSet[],
  b: UnilateralExerciseCardSet[],
): boolean {
  return arraysEqual(
    a,
    b,
    (set, other) =>
      set.setIndex === other.setIndex &&
      unilateralSideEqual(set.left, other.left) &&
      unilateralSideEqual(set.right, other.right),
  );
}

function previousSessionEqual(
  a: PreviousSessionDisplay | null | undefined,
  b: PreviousSessionDisplay | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.dateDisplay !== b.dateDisplay ||
    (a.topSetDisplay ?? null) !== (b.topSetDisplay ?? null) ||
    (a.topSetNumber ?? null) !== (b.topSetNumber ?? null)
  ) {
    return false;
  }
  return arraysEqual(
    a.sets,
    b.sets,
    (set, other) =>
      set.setNumber === other.setNumber &&
      set.weightDisplay === other.weightDisplay &&
      set.unit === other.unit &&
      set.reps === other.reps &&
      set.durationDisplay === other.durationDisplay &&
      set.side === other.side,
  );
}

function allTimeBestEqual(a: AllTimeBest | null, b: AllTimeBest | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.measurementType === b.measurementType &&
    a.weightKg === b.weightKg &&
    a.reps === b.reps &&
    a.durationSeconds === b.durationSeconds &&
    a.achievedAt === b.achievedAt
  );
}

// ActiveWorkoutScreen rebuilds `sets`/`unilateralSets`/`previousSession`/`allTimeBest` as
// fresh array/object literals on every render (they're derived from a single flat setInputs
// map covering every exercise in the workout), so a default reference-equality memo would
// never actually skip a re-render -- typing into one exercise's set would still re-render
// every OTHER exercise's widget too. This comparator checks those props by value instead. The
// set-mutation callbacks (onChangeWeight, onToggleComplete, onAddSet, ...) are deliberately
// not compared: each is either a pure functional state update (reads no stale closure state)
// or closes over this exercise/set, which the value checks above already confirm is unchanged
// -- so an old closure reference behaves identically to a new one. onMoveUp/onMoveDown are the
// one exception (see ActiveWorkoutScreen's own comment on why they're kept genuinely stable
// per position) and ARE compared, as is onEditProgression. Exported so its exact equality
// semantics -- the actual mechanism behind ExerciseCard's re-render fix -- can be unit tested
// directly and deterministically.
export function arePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.exerciseName === next.exerciseName &&
    prev.muscleGroup === next.muscleGroup &&
    prev.movementType === next.movementType &&
    prev.measurementType === next.measurementType &&
    (prev.photoUrl ?? null) === (next.photoUrl ?? null) &&
    prev.weightUnit === next.weightUnit &&
    prev.accentColor === next.accentColor &&
    prev.onAccentColor === next.onAccentColor &&
    prev.testID === next.testID &&
    prev.onMoveUp === next.onMoveUp &&
    prev.onMoveDown === next.onMoveDown &&
    (prev.onViewHistory === undefined) === (next.onViewHistory === undefined) &&
    allTimeBestEqual(prev.allTimeBest ?? null, next.allTimeBest ?? null) &&
    (prev.sessionCue ?? null) === (next.sessionCue ?? null) &&
    (prev.ownRangeText ?? null) === (next.ownRangeText ?? null) &&
    prev.onEditProgression === next.onEditProgression &&
    cuesEqual(prev.progressionCue ?? null, next.progressionCue ?? null) &&
    previousSessionEqual(prev.previousSession, next.previousSession) &&
    setsEqual(prev.sets, next.sets) &&
    unilateralSetsEqual(prev.unilateralSets, next.unilateralSets)
  );
}

export const ExerciseCard = memo(ExerciseCardComponent, arePropsEqual);
