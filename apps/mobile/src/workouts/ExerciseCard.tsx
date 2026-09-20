import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
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
  /** This set's weight as a fraction (0-1) of the heaviest set in the same
   * session -- purely a visual proportion bar, never a stored/derived stat. */
  relativeWeight: number;
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
  accentColor: string;
  onAccentColor: string;
  testID?: string;
}

// No exercise image anywhere -- a plain icon box stands in for it, per the
// approved design direction. Every exercise uses the same "activity" icon
// (already the app's established generic workout icon, e.g. the bottom nav
// Workouts tab) rather than inventing a whole per-muscle-group icon set.
export function ExerciseCard({
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
  accentColor,
  onAccentColor,
  testID,
}: Props) {
  const isUnilateral = movementType === 'unilateral';
  const hasRows = isUnilateral ? unilateralSets.length > 0 : sets.length > 0;
  return (
    <AppCard testID={testID} style={styles.exerciseCard}>
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseIconBox}>
          <Feather name="activity" size={18} color={accentColor} />
        </View>
        <View style={styles.exerciseTitleBlock}>
          <Text style={styles.exerciseName}>{exerciseName}</Text>
          <Badge
            label={MUSCLE_GROUP_LABELS[muscleGroup]}
            color={accentColor}
            testID={testID ? `${testID}-muscle-group` : undefined}
          />
          {isUnilateral ? (
            <Text
              testID={testID ? `${testID}-per-side-note` : undefined}
              style={styles.perSideNote}
            >
              Weight is per side
            </Text>
          ) : null}
        </View>
        <View style={styles.exerciseHeaderActions}>
          {onMoveUp ? (
            <TouchableOpacity
              testID={testID ? `${testID}-move-up` : undefined}
              style={styles.exerciseIconAction}
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
              style={styles.exerciseIconAction}
              onPress={onMoveDown}
              accessibilityLabel="Move exercise down"
              accessibilityRole="button"
            >
              <Feather name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            testID={testID ? `${testID}-remove` : undefined}
            style={styles.exerciseIconAction}
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
          <View style={styles.previousSessionHeaderRow}>
            <View style={styles.previousSessionTitleRow}>
              <Text style={styles.previousSessionTitle}>Last Workout</Text>
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
                hitSlop={8}
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
              >
                <View style={styles.previousSessionViewHistory}>
                  <Text style={[styles.previousSessionViewHistoryText, { color: accentColor }]}>
                    View History
                  </Text>
                  <Feather name="chevron-right" size={14} color={accentColor} />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.previousSessionDate}>{previousSession.dateDisplay}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.previousSessionCardsScroll}
            contentContainerStyle={styles.previousSessionCardsRow}
          >
            {previousSession.sets.map((set) => (
              <View
                key={`${set.setNumber}-${set.side ?? 'none'}`}
                testID={testID ? `${testID}-previous-set-${set.setNumber}` : undefined}
                style={styles.previousSessionCard}
              >
                <View style={[styles.previousSessionBadge, { backgroundColor: accentColor }]}>
                  <Text style={[styles.previousSessionBadgeText, { color: onAccentColor }]}>
                    {set.setNumber}
                  </Text>
                </View>
                <Text style={styles.previousSessionCardWeight}>
                  {set.weightDisplay} {set.unit}
                </Text>
                <Text style={styles.previousSessionCardReps}>
                  x {set.reps} reps{set.side ? ` (${set.side === 'left' ? 'L' : 'R'})` : ''}
                </Text>
                <View style={styles.previousSessionBarTrack}>
                  <View
                    style={[
                      styles.previousSessionBarFill,
                      {
                        backgroundColor: accentColor,
                        width: `${Math.max(0, Math.min(1, set.relativeWeight)) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
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

      <TouchableOpacity
        testID={testID ? `${testID}-add-set` : undefined}
        style={styles.addSetButton}
        onPress={onAddSet}
      >
        <Feather name="plus" size={16} color={colors.textSecondary} />
        <Text style={styles.addSetButtonText}>Add Set</Text>
      </TouchableOpacity>
    </AppCard>
  );
}
