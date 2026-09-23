import { memo } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { SecondaryButton } from '../design/Button';
import { colors } from '../design/theme';
import type { MovementType } from '../exercises/movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { liveWorkoutStyles as styles } from '../screens/liveWorkoutStyles';
import { SetRow } from './SetRow';
import { UnilateralSetRow, type UnilateralSideInput } from './UnilateralSetRow';

/** One set from the user's last completed session with this exercise --
 * already fully formatted by the caller (ActiveWorkoutScreen), which knows
 * the weight unit; this component stays presentation-only. */
export interface PreviousSessionSet {
  setNumber: number;
  weightDisplay: string;
  unit: 'kg' | 'lb';
  reps: number;
  /** Only present for a unilateral exercise's set -- shown as a small "L"/"R" tag so two same-numbered-look rows aren't ambiguous. */
  side: 'left' | 'right' | null;
}

export interface PreviousSessionDisplay {
  dateDisplay: string;
  sets: PreviousSessionSet[];
}

export interface ExerciseCardSet {
  id: string;
  setIndex: number;
  weight: string;
  reps: string;
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
  /** Every set from the user's last completed session with this exercise
   * (never today's own in-progress sets) -- null/omitted when there's no
   * prior session yet, in which case the section is omitted entirely. */
  previousSession?: PreviousSessionDisplay | null;
  /** Opens this exercise's full history (Progress > Exercise Detail). Only
   * rendered when a previous session exists to link out from. */
  onViewHistory?: () => void;
  /** Used when movementType is 'bilateral' -- one row per set, unchanged from before unilateral support existed. */
  sets: ExerciseCardSet[];
  /** Used when movementType is 'unilateral' -- one row per LOGICAL set (both sides), never a separate exercise per side. */
  unilateralSets: UnilateralExerciseCardSet[];
  onChangeWeight: (setId: string, text: string) => void;
  onChangeReps: (setId: string, text: string) => void;
  onToggleComplete: (setId: string) => void;
  /** Only used for a unilateral exercise -- completes/uncompletes both sides of one logical set together, since a unilateral set is one unit, not two independent ones. */
  onToggleUnilateralComplete: (setIndex: number) => void;
  onChangeUnilateralWeight: (setIndex: number, side: 'left' | 'right', text: string) => void;
  onChangeUnilateralReps: (setIndex: number, side: 'left' | 'right', text: string) => void;
  onAddSet: () => void;
  onRemoveExercise: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** A hairline above this block -- every exercise but the first. */
  divider?: boolean;
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}

// One exercise in the live workout: its name and quiet controls, the last
// session's numbers to compare against, then the sets to log. Despite the
// legacy name it is a plain block on the screen, not a card -- consecutive
// exercises are separated by a hairline, so a long workout reads as one
// list rather than a stack of boxes. No exercise image: every exercise is
// text.
function ExerciseCardComponent({
  exerciseName,
  muscleGroup,
  movementType,
  previousSession = null,
  onViewHistory,
  sets,
  unilateralSets,
  onChangeWeight,
  onChangeReps,
  onToggleComplete,
  onToggleUnilateralComplete,
  onChangeUnilateralWeight,
  onChangeUnilateralReps,
  onAddSet,
  onRemoveExercise,
  onMoveUp,
  onMoveDown,
  divider,
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  const isUnilateral = movementType === 'unilateral';
  const hasRows = isUnilateral ? unilateralSets.length > 0 : sets.length > 0;
  return (
    <View testID={testID} style={[styles.exerciseBlock, divider && styles.exerciseDivider]}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseTitleBlock}>
          <Text style={styles.exerciseName}>{exerciseName}</Text>
          <Text
            testID={testID ? `${testID}-muscle-group` : undefined}
            style={styles.exerciseMuscle}
          >
            {MUSCLE_GROUP_LABELS[muscleGroup]}
          </Text>
          {isUnilateral ? (
            <Text
              testID={testID ? `${testID}-per-side-note` : undefined}
              style={styles.perSideNote}
            >
              Weight is per side
            </Text>
          ) : null}
        </View>
        <View style={styles.exerciseActions}>
          {onMoveUp ? (
            <TouchableOpacity
              testID={testID ? `${testID}-move-up` : undefined}
              style={styles.exerciseAction}
              onPress={onMoveUp}
              accessibilityLabel="Move exercise up"
              accessibilityRole="button"
            >
              <Feather name="chevron-up" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {onMoveDown ? (
            <TouchableOpacity
              testID={testID ? `${testID}-move-down` : undefined}
              style={styles.exerciseAction}
              onPress={onMoveDown}
              accessibilityLabel="Move exercise down"
              accessibilityRole="button"
            >
              <Feather name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            testID={testID ? `${testID}-remove` : undefined}
            style={styles.exerciseAction}
            onPress={onRemoveExercise}
            accessibilityLabel="Remove exercise"
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {previousSession && previousSession.sets.length > 0 ? (
        <View
          testID={testID ? `${testID}-previous-session` : undefined}
          style={styles.previousSession}
        >
          <View style={styles.previousHeaderRow}>
            <View style={styles.previousTitleRow}>
              <Text style={styles.previousTitle}>Last Workout</Text>
              <TouchableOpacity
                testID={testID ? `${testID}-previous-session-info` : undefined}
                onPress={() =>
                  Alert.alert(
                    'Last Workout',
                    'Every set you logged for this exercise the last time you did it.',
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="About Last Workout"
                hitSlop={12}
              >
                <Feather name="info" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {onViewHistory ? (
              <TouchableOpacity
                testID={testID ? `${testID}-view-history` : undefined}
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
          <Text style={styles.previousDate}>{previousSession.dateDisplay}</Text>

          <View style={styles.previousSets}>
            {previousSession.sets.map((set) => (
              <View
                key={`${set.setNumber}-${set.side ?? 'none'}`}
                testID={testID ? `${testID}-previous-set-${set.setNumber}` : undefined}
                style={styles.previousSet}
              >
                <Text style={styles.previousSetNumber}>{set.setNumber}</Text>
                <Text style={styles.previousSetValue}>
                  {set.weightDisplay} {set.unit} × {set.reps}
                  {set.side ? ` (${set.side === 'left' ? 'L' : 'R'})` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {hasRows ? (
        <View style={styles.setHeaderRow}>
          <Text style={styles.setHeaderIndex}>Set</Text>
          <Text style={styles.setHeaderInput}>Weight</Text>
          <Text style={styles.setHeaderInput}>Reps</Text>
          <View style={styles.setHeaderComplete} />
        </View>
      ) : null}

      {isUnilateral
        ? unilateralSets.map((set) => (
            <UnilateralSetRow
              key={set.setIndex}
              testID={testID ? `${testID}-set-${set.setIndex}` : undefined}
              setIndex={set.setIndex}
              left={set.left}
              right={set.right}
              completed={set.left.completed && set.right.completed}
              canComplete={set.left.canComplete && set.right.canComplete}
              onChangeWeight={(side, text) => onChangeUnilateralWeight(set.setIndex, side, text)}
              onChangeReps={(side, text) => onChangeUnilateralReps(set.setIndex, side, text)}
              onToggleComplete={() => onToggleUnilateralComplete(set.setIndex)}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          ))
        : sets.map((set) => (
            <SetRow
              key={set.id}
              testID={testID ? `${testID}-set-${set.id}` : undefined}
              setIndex={set.setIndex}
              weight={set.weight}
              reps={set.reps}
              completed={set.completed}
              canComplete={set.canComplete}
              onChangeWeight={(text) => onChangeWeight(set.id, text)}
              onChangeReps={(text) => onChangeReps(set.id, text)}
              onToggleComplete={() => onToggleComplete(set.id)}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          ))}

      <View style={styles.addSet}>
        <SecondaryButton
          testID={testID ? `${testID}-add-set` : undefined}
          size="md"
          label="+ Add Set"
          accessibilityLabel="Add Set"
          onPress={onAddSet}
        />
      </View>
    </View>
  );
}

function setsEqual(a: ExerciseCardSet[], b: ExerciseCardSet[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((set, i) => {
    const other = b[i];
    return (
      set.id === other.id &&
      set.setIndex === other.setIndex &&
      set.weight === other.weight &&
      set.reps === other.reps &&
      set.completed === other.completed &&
      set.canComplete === other.canComplete
    );
  });
}

function unilateralSideEqual(
  a: UnilateralExerciseCardSet['left'],
  b: UnilateralExerciseCardSet['left'],
): boolean {
  return (
    a.weight === b.weight &&
    a.reps === b.reps &&
    a.completed === b.completed &&
    a.canComplete === b.canComplete
  );
}

function unilateralSetsEqual(
  a: UnilateralExerciseCardSet[],
  b: UnilateralExerciseCardSet[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((set, i) => {
    const other = b[i];
    return (
      set.setIndex === other.setIndex &&
      unilateralSideEqual(set.left, other.left) &&
      unilateralSideEqual(set.right, other.right)
    );
  });
}

function previousSessionEqual(
  a: PreviousSessionDisplay | null | undefined,
  b: PreviousSessionDisplay | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.dateDisplay !== b.dateDisplay) return false;
  if (a.sets.length !== b.sets.length) return false;
  return a.sets.every((set, i) => {
    const other = b.sets[i];
    return (
      set.setNumber === other.setNumber &&
      set.weightDisplay === other.weightDisplay &&
      set.unit === other.unit &&
      set.reps === other.reps &&
      set.side === other.side
    );
  });
}

// ActiveWorkoutScreen rebuilds `sets`/`unilateralSets`/`previousSession` as
// fresh array/object literals on every render (they're derived from a
// single flat setInputs map covering every exercise in the workout), so a
// default reference-equality memo would never actually skip a re-render --
// typing into one exercise's set would still re-render every OTHER
// exercise's card too. This comparator checks those three props by value
// instead. The set-mutation callbacks (onChangeWeight, onToggleComplete,
// onAddSet, ...) are deliberately not compared: each is either a pure
// functional state update (reads no stale closure state) or closes over
// this exercise/set, which the value checks above already confirm is
// unchanged -- so an old closure reference behaves identically to a new
// one. onMoveUp/onMoveDown are the one exception (see ActiveWorkoutScreen's
// own comment on why they're kept genuinely stable per position) and ARE
// compared, via React.memo's own default shallow check on every other prop.
function arePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.exerciseName === next.exerciseName &&
    prev.muscleGroup === next.muscleGroup &&
    prev.movementType === next.movementType &&
    prev.divider === next.divider &&
    prev.accentColor === next.accentColor &&
    prev.onAccentColor === next.onAccentColor &&
    prev.testID === next.testID &&
    prev.onMoveUp === next.onMoveUp &&
    prev.onMoveDown === next.onMoveDown &&
    previousSessionEqual(prev.previousSession, next.previousSession) &&
    setsEqual(prev.sets, next.sets) &&
    unilateralSetsEqual(prev.unilateralSets, next.unilateralSets)
  );
}

export const ExerciseCard = memo(ExerciseCardComponent, arePropsEqual);
