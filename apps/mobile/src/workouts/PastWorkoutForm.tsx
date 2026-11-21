import { TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { SecondaryButton } from '../design/Button';
import { toLocalDateKey } from '../design/calendarGrid';
import { Card } from '../design/Card';
import { ListRow } from '../design/ListRow';
import { MonthCalendar } from '../design/MonthCalendar';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { liveWorkoutStyles } from '../screens/liveWorkoutStyles';
import { logPastWorkoutStyles as styles } from '../screens/logPastWorkoutStyles';
import { AddExerciseButton } from './AddExerciseButton';
import { setLabels } from './dropSets';
import { CreateCustomExerciseButton } from './CreateCustomExerciseButton';
import { DurationInput } from './DurationInput';
import { PastSetRow } from './PastSetRow';
import { PastUnilateralSetRow } from './PastUnilateralSetRow';
import type {
  PastDraftExercise,
  PastDraftSet,
  PastSetField,
  PastWorkoutDate,
  PastWorkoutDraft,
} from './pastWorkoutDraft';
import { PER_SIDE_NOTE, SetColumnHeader } from './SetColumnHeader';
import { groupUnilateralSets, isValidDraft } from './setInputDrafts';
import { formatCardDate } from './workoutFormat';

// The parts Log a Past Workout and Edit Workout share. Each takes the page's
// testID prefix ("log-past-workout", "edit-workout"), so its parts keep their
// own page's names.

// The date picker has nothing to mark -- there's no per-day dot/meaning
// here the way Workout History's own calendar has completed-workout dots.
const NO_MARKED_DATES = new Set<string>();

interface DetailsProps {
  testID: string;
  when: PastWorkoutDate;
  name: string;
  onChangeName: (text: string) => void;
  /** Left out where the workout has no duration to set. */
  duration?: {
    hours: string;
    minutes: string;
    onChangeHours: (text: string) => void;
    onChangeMinutes: (text: string) => void;
  };
}

/** The workout's own card: its date (tapped, the date picker), its name and its duration. */
export function PastWorkoutDetailsCard({
  testID,
  when,
  name,
  onChangeName,
  duration,
}: DetailsProps) {
  const dateLabel = formatCardDate(when.date.toISOString());
  return (
    <Card testID={`${testID}-details`} style={styles.cardBody}>
      <SectionHeader label="Workout" />
      <ListRow
        testID={`${testID}-date`}
        title="Date"
        value={dateLabel}
        onPress={when.openPicker}
        accessibilityLabel={`Date, ${dateLabel}`}
      />

      <TextInput
        testID={`${testID}-name`}
        label="Workout name"
        placeholder="e.g. Push Day"
        value={name}
        onChangeText={onChangeName}
        autoCapitalize="words"
        returnKeyType="done"
      />

      {duration ? <DurationInput testID={`${testID}-duration`} {...duration} /> : null}
    </Card>
  );
}

interface ExerciseProps {
  testID: string;
  exercise: PastDraftExercise;
  draft: PastWorkoutDraft;
  accentColor: string;
}

/**
 * One exercise's card: its name and muscle group, a remove button, its sets -- a unilateral
 * exercise's as left/right pairs -- and Add Set. As in the live workout, tapping a set's number
 * marks it a warm-up, and a weighted exercise's Drop Set adds a drop under the last set filled in.
 */
export function PastExerciseCard({ testID, exercise, draft, accentColor }: ExerciseProps) {
  const isUnilateral = exercise.movementType === 'unilateral';
  const unilateralRows = isUnilateral ? groupUnilateralSets(exercise.sets) : [];
  const orderedSets = isUnilateral
    ? []
    : [...exercise.sets].sort((a, b) => a.setIndex - b.setIndex);
  const hasRows = isUnilateral ? unilateralRows.length > 0 : exercise.sets.length > 0;
  const prefix = `${testID}-exercise-${exercise.localId}`;
  const change = (setLocalId: string, field: PastSetField, text: string) =>
    draft.changeSet(exercise.localId, setLocalId, field, text);
  // Working sets numbered by position; a drop set under the set it drops from, with no number.
  const labels = setLabels(
    isUnilateral ? unilateralRows.map((row) => ({ isDrop: row.left.isDrop })) : orderedSets,
  );
  const filled = (set: PastDraftSet) => isValidDraft(set, exercise.measurementType);
  const canDrop =
    exercise.measurementType === 'weight_reps' &&
    (isUnilateral
      ? unilateralRows.some((row) => !row.left.isWarmup && filled(row.left) && filled(row.right))
      : orderedSets.some((set) => !set.isWarmup && filled(set)));

  return (
    <Card testID={prefix}>
      <View style={liveWorkoutStyles.exerciseHeader}>
        <View style={liveWorkoutStyles.exerciseTitleBlock}>
          <Text style={liveWorkoutStyles.exerciseName}>{exercise.exerciseName}</Text>
          <Text style={liveWorkoutStyles.exerciseMuscle}>
            {MUSCLE_GROUP_LABELS[exercise.muscleGroup]}
          </Text>
          {isUnilateral ? (
            <Text style={liveWorkoutStyles.perSideNote}>
              {PER_SIDE_NOTE[exercise.measurementType]}
            </Text>
          ) : null}
        </View>
        <View style={liveWorkoutStyles.exerciseActions}>
          <TouchableOpacity
            testID={`${prefix}-remove`}
            style={liveWorkoutStyles.exerciseAction}
            onPress={() => draft.removeExercise(exercise.localId)}
            accessibilityRole="button"
            accessibilityLabel="Remove exercise"
          >
            <Text style={styles.removeExerciseGlyph}>×</Text>
          </TouchableOpacity>
        </View>
      </View>

      {hasRows ? <SetColumnHeader measurementType={exercise.measurementType} /> : null}

      {isUnilateral
        ? unilateralRows.map((row, position) => {
            const sideId = (side: 'left' | 'right') =>
              side === 'left' ? row.left.localId : row.right.localId;
            const label = labels[position];
            return (
              <PastUnilateralSetRow
                key={row.left.localId}
                testID={`${prefix}-set-${row.setIndex}`}
                setIndex={label.number}
                left={row.left}
                right={row.right}
                onChangeWeight={(side, text) => change(sideId(side), 'weight', text)}
                onChangeReps={(side, text) => change(sideId(side), 'reps', text)}
                onChangeDuration={(side, text) => change(sideId(side), 'duration', text)}
                measurementType={exercise.measurementType}
                onRemove={() => draft.removeUnilateralSet(exercise, row.setIndex)}
                warmup={row.left.isWarmup === true}
                drop={label.drop}
                onToggleWarmup={
                  label.drop ? undefined : () => draft.toggleWarmup(exercise.localId, row.setIndex)
                }
                accentColor={accentColor}
              />
            );
          })
        : orderedSets.map((set, position) => (
            <PastSetRow
              key={set.localId}
              testID={`${prefix}-set-${set.setIndex}`}
              setIndex={labels[position].number}
              weight={set.weight}
              reps={set.reps}
              duration={set.duration}
              measurementType={exercise.measurementType}
              onChangeDuration={(text) => change(set.localId, 'duration', text)}
              onChangeWeight={(text) => change(set.localId, 'weight', text)}
              onChangeReps={(text) => change(set.localId, 'reps', text)}
              onRemove={() => draft.removeSet(exercise, set.localId)}
              warmup={set.isWarmup === true}
              drop={labels[position].drop}
              onToggleWarmup={
                labels[position].drop
                  ? undefined
                  : () => draft.toggleWarmup(exercise.localId, set.setIndex)
              }
              accentColor={accentColor}
            />
          ))}

      <View style={[liveWorkoutStyles.addSet, canDrop ? liveWorkoutStyles.addSetRow : null]}>
        <View style={canDrop ? liveWorkoutStyles.addSetButton : undefined}>
          <SecondaryButton
            testID={`${prefix}-add-set`}
            size="md"
            label="+ Add Set"
            accessibilityLabel="Add Set"
            onPress={() => draft.addSet(exercise)}
          />
        </View>
        {canDrop ? (
          <View style={liveWorkoutStyles.addSetButton}>
            <SecondaryButton
              testID={`${prefix}-add-drop-set`}
              size="md"
              icon="corner-down-right"
              label="Drop Set"
              accessibilityLabel="Add a drop set under the last set"
              onPress={() => draft.addDropSet(exercise)}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

interface AddCardProps {
  testID: string;
  onAddExercise: () => void;
  onCreateCustom: () => void;
  /** A line above the buttons, while there's nothing yet. */
  emptyHint?: string;
}

/** The card at the end of the exercises: Add Exercise, and Create Custom Exercise. */
export function PastWorkoutAddCard({
  testID,
  onAddExercise,
  onCreateCustom,
  emptyHint,
}: AddCardProps) {
  return (
    <Card testID={`${testID}-add-card`} style={styles.cardBody}>
      {emptyHint ? (
        <Text testID={`${testID}-empty`} style={styles.hint}>
          {emptyHint}
        </Text>
      ) : null}
      <AddExerciseButton testID={`${testID}-add-exercise`} onPress={onAddExercise} />
      <CreateCustomExerciseButton testID={`${testID}-create-custom`} onPress={onCreateCustom} />
    </Card>
  );
}

interface DateSheetProps {
  testID: string;
  when: PastWorkoutDate;
  accentColor: string;
  onAccentColor: string;
}

/** The date picker: a month calendar in a bottom sheet, the day picked closing it. */
export function PastWorkoutDateSheet({ testID, when, accentColor, onAccentColor }: DateSheetProps) {
  return (
    <BottomSheet
      visible={when.pickerOpen}
      onClose={when.closePicker}
      testID={`${testID}-date-sheet`}
    >
      <MonthCalendar
        testID={`${testID}-calendar`}
        year={when.calendarYear}
        month={when.calendarMonth}
        markedDateKeys={NO_MARKED_DATES}
        markedDescription=""
        selectedDateKey={toLocalDateKey(when.date)}
        todayKey={toLocalDateKey(new Date())}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
        onSelectDate={when.pick}
        onPrevMonth={() => when.moveMonth(-1)}
        onNextMonth={() => when.moveMonth(1)}
      />
    </BottomSheet>
  );
}
