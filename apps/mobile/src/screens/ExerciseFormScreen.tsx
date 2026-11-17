import { useState } from 'react';
import { Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { DestructiveButton, PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { PhotoLightbox } from '../design/PhotoLightbox';
import { FilterChips } from '../design/FilterChips';
import {
  ATTACHMENT_FIELD,
  chosenChoice,
  gripFieldFor,
  type ChoiceField,
} from '../exercises/gripChoices';
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  setupChanged,
  setupFieldsFor,
  setupFieldShown,
  setupKey,
  type Equipment,
  type SetupField,
  type SetupIdentity,
} from '../exercises/equipment';
import {
  LOAD_TYPE_LABELS,
  LOAD_TYPES,
  PULLEY_POSITION_LABELS,
  PULLEY_POSITIONS,
  type LoadType,
  type PulleyPosition,
} from '../exercises/machineLoad';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SegmentedControl } from '../design/SegmentedControl';
import { TextInput } from '../design/TextInput';
import { Toggle } from '../design/Toggle';
import { colors, radii, spacing, typeScale } from '../design/theme';
import {
  countLoggedWorkouts,
  fetchAllExercises,
  invalidateExerciseCache,
  type ExerciseRow,
} from '../exercises/exerciseQueries';
import { MuscleGroupSelect } from '../exercises/MuscleGroupSelect';
import type { MuscleGroup } from '../exercises/muscleGroups';
import {
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_TYPES,
  type MeasurementType,
  type MovementType,
} from '../exercises/movementTypes';
import { usePhotoField } from '../lib/usePhotoField';
import { createExercise, updateExercise, type CreateExerciseInput } from '../lib/api';
import { uploadEquipmentPhoto } from '../lib/equipmentPhotoUpload';
import { useAppTheme } from '../theme/appThemeContext';

type Props = {
  onDone: () => void;
  onCancel: () => void;
  /** The user's current Workout accent -- omit to fall back to the shared default accent token. */
  accentColor?: string;
  onAccentColor?: string;
} & ({ mode: 'create' } | { mode: 'edit'; exercise: ExerciseRow });

// The setup notes worth a line on a machine, to start one with a tap.
const SETUP_PROMPTS = ['Seat height', 'Backrest', 'Chest pad', 'Leg pad', 'Foot placement'];
const SETUP_DETAILS_MAX = 300;

// What each setup detail is called, for More Details' line.
const FIELD_NAMES: Record<SetupField, string> = {
  gym: 'gym',
  grip: 'grip',
  attachment: 'attachment',
  loadType: 'weight type',
  pulleyPosition: 'pulley position',
  setupDetails: 'setup notes',
};

/** "gym, grip or setup notes". */
function listOf(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

// Create Custom Exercise (from an active workout or the Exercise Library) and
// edit for the user's own custom exercises (built-ins never open in edit mode --
// the backend enforces this too, but the UI never offers the path in the
// first place).
//
// Quick for an ordinary exercise, detailed where the equipment calls for it: a
// name, a muscle group (a real dropdown), what it's done with (Equipment,
// optional), what a set records, whether it's unilateral -- then the setup,
// all optional, asking only what fits the equipment (exercises/equipment.ts):
// a dumbbell curl offers its photo, with a gym, grip or setup notes behind
// More Details; a cable pushdown its gym, grip, attachment, weight type,
// pulley position and setup notes; a machine its gym, grip, weight type and
// setup notes, with a tap to start a line for its seat, backrest or pads. Grip
// (how it's held, or for a leg exercise where the feet go) and Attachment /
// Handle (what's held) are separate, each with the common ones to tap
// (exercises/gripChoices.ts). A detail with a value always shows, so nothing
// saved is ever out of sight.
//
// The setup is part of what an exercise is: its records and top sets are its
// own, never shared with another exercise of the same name. Changing the
// setup of an exercise with logged workouts asks first -- they'd now read as
// the new setup -- and offers to save it as a new exercise instead. A new one
// with the very same setup as one of theirs asks too, so nothing is doubled
// by accident.
export function ExerciseFormScreen(props: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const themeAccent = useAppTheme().accent;
  const accentColor = props.accentColor ?? themeAccent.accent;
  const onAccentColor = props.onAccentColor ?? themeAccent.onAccent;
  const existing = props.mode === 'edit' ? props.exercise : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(existing?.muscleGroup ?? null);
  const [isUnilateral, setIsUnilateral] = useState(existing?.movementType === 'unilateral');
  const [measurementType, setMeasurementType] = useState<MeasurementType>(
    existing?.measurementType ?? 'weight_reps',
  );
  const [isActive] = useState(existing?.isActive ?? true);
  // The setup -- all optional. A note on how it feels, saved by an older version, is left as it
  // was, and so is an old heavier/lighter pulley: still part of what tells it apart.
  const [equipment, setEquipment] = useState<Equipment | null>(existing?.equipment ?? null);
  const [gym, setGym] = useState(existing?.gym ?? '');
  const [grip, setGrip] = useState(existing?.grip ?? '');
  const [attachment, setAttachment] = useState(existing?.attachment ?? '');
  const [loadType, setLoadType] = useState<LoadType | null>(existing?.loadType ?? null);
  const [pulleyPosition, setPulleyPosition] = useState<PulleyPosition | null>(
    existing?.pulleyPosition ?? null,
  );
  const [setupDetails, setSetupDetails] = useState(existing?.setupDetails ?? '');
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A freshly picked photo (a local file, uploaded on Save), or the photo
  // this exercise already has -- which "Remove Photo" clears on Save. Same
  // three-state convention FoodFormScreen's own photo field uses.
  const photo = usePhotoField({
    title: 'Equipment Photo',
    aspect: [4, 3],
    existingUrl: existing?.photoUrl ?? null,
  });
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);

  const canSave = name.trim().length > 0 && muscleGroup !== null && !saving;
  // Hands for most exercises; feet for a leg exercise.
  const gripField = gripFieldFor(muscleGroup);

  // Which setup details show, for this equipment -- and any with a value, always.
  const rules = setupFieldsFor(equipment, measurementType);
  const values: Record<SetupField, boolean> = {
    gym: gym.trim().length > 0,
    grip: grip.trim().length > 0,
    attachment: attachment.trim().length > 0,
    loadType: loadType !== null,
    pulleyPosition: pulleyPosition !== null,
    setupDetails: setupDetails.trim().length > 0,
  };
  const shown = (field: SetupField) => setupFieldShown(rules[field], moreOpen, values[field]);
  const behindMore = (Object.keys(rules) as SetupField[]).filter(
    (field) => rules[field] === 'more' && !shown(field),
  );

  function identity(): SetupIdentity {
    return {
      name: name.trim(),
      equipment,
      gym: gym.trim() || null,
      grip: grip.trim() || null,
      attachment: attachment.trim() || null,
      loadType,
      pulleyPosition,
    };
  }

  // What's saved: a blank box is nothing -- cleared on an edit, left out of a new exercise.
  function setupInput() {
    return {
      equipment,
      gym: gym.trim() || null,
      grip: grip.trim() || null,
      attachment: attachment.trim() || null,
      loadType,
      pulleyPosition,
      setupDetails: setupDetails.trim() || null,
    };
  }

  async function uploadPhoto(): Promise<string | null | undefined> {
    // undefined leaves the stored photo alone; null clears it.
    if (photo.picked && userId) return uploadEquipmentPhoto(userId, photo.picked);
    if (photo.removed) return null;
    return undefined;
  }

  function basics() {
    const movementType: MovementType = isUnilateral ? 'unilateral' : 'bilateral';
    return {
      name: name.trim(),
      muscleGroup: muscleGroup as MuscleGroup,
      movementType,
      measurementType,
      // Only meaningful for a unilateral exercise; always 'single_side' since this form never asks.
      ...(isUnilateral ? { loggingStyle: 'single_side' as const } : {}),
    };
  }

  async function create(): Promise<void> {
    if (!accessToken) return;
    // Saved as a new exercise from an edit, it keeps the photo it had unless that was changed.
    const uploaded = await uploadPhoto();
    const photoUrl = uploaded === undefined ? (existing?.photoUrl ?? null) : uploaded;
    const input: CreateExerciseInput = {
      ...basics(),
      ...(photoUrl ? { photoUrl } : {}),
      // Only the details that were filled in.
      ...Object.fromEntries(Object.entries(setupInput()).filter(([, value]) => value !== null)),
    };
    await createExercise(accessToken, input);
  }

  async function update(): Promise<void> {
    if (!accessToken || props.mode !== 'edit') return;
    const photoUrl = await uploadPhoto();
    await updateExercise(accessToken, props.exercise.id, {
      ...basics(),
      isActive,
      ...(photoUrl !== undefined ? { photoUrl } : {}),
      ...setupInput(),
    });
  }

  async function run(work: () => Promise<void>) {
    setError(null);
    setSaving(true);
    try {
      await work();
      // The library/picker's cached exercise list no longer reflects what was just saved.
      if (userId) invalidateExerciseCache(userId);
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise');
    } finally {
      setSaving(false);
    }
  }

  // A choice of three, asked before saving: resolves to what to do.
  function ask(
    title: string,
    message: string,
    buttons: { text: string; style?: 'cancel' | 'destructive'; value: string }[],
  ): Promise<string> {
    return new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        buttons.map((button) => ({
          text: button.text,
          style: button.style,
          onPress: () => resolve(button.value),
        })),
        { cancelable: true, onDismiss: () => resolve('cancel') },
      );
    });
  }

  async function handleSave() {
    if (!accessToken || !muscleGroup || !canSave || !userId) return;
    setError(null);

    if (props.mode === 'create') {
      // The very same setup as one of theirs already: say so, rather than doubling it quietly.
      const key = setupKey(identity());
      // Only a nudge: a library that can't be read never stops the save.
      let twin: ExerciseRow | undefined;
      try {
        const mine = await fetchAllExercises({
          userId,
          search: name.trim(),
          muscleGroup: null,
          source: 'mine',
        });
        twin = mine.find((row) => row.createdBy === userId && setupKey(setupOf(row)) === key);
      } catch {
        twin = undefined;
      }
      if (twin) {
        const choice = await ask(
          'You already have this exercise',
          `${twin.name} with this same setup is already in your library. Its records and history are there.`,
          [
            { text: 'Cancel', style: 'cancel', value: 'cancel' },
            { text: 'Save Another', value: 'save' },
          ],
        );
        if (choice !== 'save') return;
      }
      await run(create);
      return;
    }

    // A new setup for an exercise with history: its past workouts would read as the new setup.
    if (setupChanged(setupOf(props.exercise), identity())) {
      // Unknown history (it couldn't be read) is asked about too: a change is the person's call.
      let logged: number;
      try {
        logged = await countLoggedWorkouts(userId, props.exercise.id);
      } catch {
        logged = 1;
      }
      if (logged > 0) {
        const workouts = `${logged} logged ${logged === 1 ? 'workout' : 'workouts'}`;
        const choice = await ask(
          'Change the setup?',
          `${props.exercise.name} has ${workouts}. Changing its equipment or setup changes it for all of them, so they'd be compared with the new setup. To track the new setup on its own, save it as a new exercise.`,
          [
            { text: 'Cancel', style: 'cancel', value: 'cancel' },
            { text: 'Change This One', value: 'change' },
            { text: 'Save as New Exercise', value: 'new' },
          ],
        );
        if (choice === 'new') {
          await run(create);
          return;
        }
        if (choice !== 'change') return;
      }
    }
    await run(update);
  }

  // Deleting deactivates the exercise: it leaves the library and the picker, and every past
  // workout keeps its history. Its name is free to use again.
  function confirmDelete() {
    if (props.mode !== 'edit') return;
    Alert.alert(
      'Delete this exercise?',
      `${name.trim() || 'It'} will be removed from your library. Past workouts keep their history.`,
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void handleDelete() },
      ],
    );
  }

  async function handleDelete() {
    if (!accessToken || props.mode !== 'edit') return;
    setError(null);
    setSaving(true);
    try {
      await updateExercise(accessToken, props.exercise.id, { isActive: false });
      if (userId) invalidateExerciseCache(userId);
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the exercise');
    } finally {
      setSaving(false);
    }
  }

  // A setup note started with a tap: "Seat height: " on a line of its own, unless it's there.
  function startSetupLine(prompt: string) {
    setSetupDetails((current) => {
      if (current.toLowerCase().includes(prompt.toLowerCase())) return current;
      const line = `${prompt}: `;
      const next = current.trim() ? `${current.trimEnd()}\n${line}` : line;
      return next.slice(0, SETUP_DETAILS_MAX);
    });
  }

  const title = props.mode === 'create' ? 'New Exercise' : 'Edit Exercise';

  return (
    <Screen
      keyboardAvoiding
      scrollTestID="exercise-form-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={title}
          subtitle={
            props.mode === 'create'
              ? 'Add exercise details to track your progress accurately.'
              : undefined
          }
          leftAction={{
            icon: 'x',
            onPress: props.onCancel,
            accessibilityLabel: 'Cancel',
            testID: 'exercise-form-cancel',
          }}
        />
      }
    >
      <View style={styles.fields}>
        <TextInput
          testID="exercise-form-name"
          label="Exercise Name"
          placeholder="e.g. Seated Row"
          helperText="The only thing you have to fill in."
          value={name}
          onChangeText={setName}
        />

        <MuscleGroupSelect
          testID="exercise-form-muscle-group"
          value={muscleGroup}
          onChange={setMuscleGroup}
          accentColor={accentColor}
        />

        {/* What it's done with decides which setup details are asked; tapping it again clears it. */}
        <View style={styles.choiceField}>
          <Text style={styles.fieldLabel}>Equipment (Optional)</Text>
          <FilterChips
            testID="exercise-form-equipment"
            options={EQUIPMENT.map((value) => ({ value, label: EQUIPMENT_LABELS[value] }))}
            value={equipment ?? ''}
            onChange={(choice) =>
              setEquipment((current) => (current === choice ? null : (choice as Equipment)))
            }
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
          <Text style={styles.helperText}>Only the setup details that apply to it are asked.</Text>
        </View>

        <View style={styles.measuredBy}>
          <Text style={styles.fieldLabel}>Measured By</Text>
          <SegmentedControl
            testID="exercise-form-measurement"
            options={MEASUREMENT_TYPES.map((type) => ({
              value: type,
              label: MEASUREMENT_TYPE_LABELS[type].label,
              accessibilityLabel: MEASUREMENT_TYPE_LABELS[type].spoken,
            }))}
            value={measurementType}
            onChange={setMeasurementType}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
          <Text testID="exercise-form-measurement-hint" style={styles.helperText}>
            {MEASUREMENT_TYPE_LABELS[measurementType].hint}
          </Text>
        </View>

        <View style={styles.unilateralRow}>
          <View style={styles.unilateralText}>
            <Text style={styles.fieldLabel}>Unilateral</Text>
            <Text style={styles.helperText}>One side at a time (e.g. single-arm exercises)</Text>
          </View>
          <Toggle
            testID="exercise-form-unilateral"
            value={isUnilateral}
            onValueChange={setIsUnilateral}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
            accessibilityLabel="Unilateral"
          />
        </View>
      </View>

      <Section title="Your Setup (Optional)">
        <View style={styles.setup}>
          {/* Why the details below matter, before them: the setup is part of the exercise. */}
          <AppCard testID="exercise-form-setup-note">
            <View style={styles.note}>
              <Feather name="info" size={18} color={colors.textSecondaryBright} />
              <View style={styles.noteText}>
                <Text style={styles.noteTitle}>Keep your setup consistent</Text>
                <Text style={styles.noteBody}>
                  Your equipment and setup directly affect how an exercise feels and how much you
                  can lift. Different machines, attachments, grips and pulley configurations can
                  change resistance and movement mechanics.
                </Text>
                <Text style={styles.noteBody}>
                  Record the details that matter so Progresso can track your performance against the
                  same setup over time. If you switch to equipment or a configuration that
                  meaningfully changes the exercise, create a separate entry.
                </Text>
                <Text style={styles.noteBody}>
                  These fields are optional, but the more accurately you describe your setup, the
                  more meaningful your progress tracking becomes.
                </Text>
              </View>
            </View>
          </AppCard>

          <View style={styles.choiceField}>
            <Text style={styles.fieldLabel}>Photo</Text>
            <Text style={styles.helperText}>
              The easiest way to tell it apart. It shows next to this exercise everywhere.
            </Text>
            {photo.shown ? (
              <View style={styles.photoPreviewRow}>
                <TouchableOpacity
                  onPress={() => setPhotoLightboxOpen(true)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="View equipment photo"
                >
                  <Image
                    testID="exercise-form-photo-preview"
                    source={{ uri: photo.shown }}
                    style={styles.photoPreviewImage}
                  />
                </TouchableOpacity>
                <View style={styles.photoActions}>
                  <SecondaryButton
                    testID="exercise-form-photo-change"
                    size="sm"
                    label="Change Photo"
                    accessibilityLabel="Change equipment photo"
                    onPress={photo.pick}
                  />
                  <TextButton
                    testID="exercise-form-photo-remove"
                    label="Remove Photo"
                    accessibilityLabel="Remove equipment photo"
                    destructive
                    onPress={photo.remove}
                  />
                </View>
              </View>
            ) : (
              <SecondaryButton
                testID="exercise-form-photo-add"
                label="Add Photo"
                accessibilityLabel="Add equipment photo"
                onPress={photo.pick}
              />
            )}
            {photo.error ? (
              <Text testID="exercise-form-photo-error" style={styles.errorText}>
                {photo.error}
              </Text>
            ) : null}
          </View>

          {shown('gym') ? (
            <TextInput
              testID="exercise-form-gym"
              label="Gym"
              placeholder="e.g. Fit4Less Downtown"
              helperText="Where this equipment is. It shows under the name."
              value={gym}
              onChangeText={setGym}
              maxLength={60}
            />
          ) : null}

          {shown('grip') ? (
            <ChoiceInput
              testID="exercise-form-grip"
              field={gripField}
              value={grip}
              onChange={setGrip}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          ) : null}

          {shown('attachment') ? (
            <ChoiceInput
              testID="exercise-form-attachment"
              field={ATTACHMENT_FIELD}
              value={attachment}
              onChange={setAttachment}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
          ) : null}

          {/* How it's loaded; tapping the one chosen clears it. */}
          {shown('loadType') ? (
            <View style={styles.choiceField}>
              <Text style={styles.fieldLabel}>Weight Type</Text>
              <FilterChips
                testID="exercise-form-load-type"
                options={LOAD_TYPES.map((value) => ({ value, label: LOAD_TYPE_LABELS[value] }))}
                value={loadType ?? ''}
                onChange={(choice) =>
                  setLoadType((current) => (current === choice ? null : (choice as LoadType)))
                }
                accentColor={accentColor}
                onAccentColor={onAccentColor}
              />
              <Text style={styles.helperText}>
                How the weight goes on. A single stack, a double stack and plates load the same
                muscles very differently, so the same number isn&apos;t the same weight.
              </Text>
            </View>
          ) : null}

          {/* Only for a cable exercise: where the cable starts. Tapping the one chosen clears it. */}
          {shown('pulleyPosition') ? (
            <View style={styles.choiceField}>
              <Text style={styles.fieldLabel}>Pulley Position</Text>
              <FilterChips
                testID="exercise-form-pulley-position"
                options={PULLEY_POSITIONS.map((value) => ({
                  value,
                  label: PULLEY_POSITION_LABELS[value],
                }))}
                value={pulleyPosition ?? ''}
                onChange={(choice) =>
                  setPulleyPosition((current) =>
                    current === choice ? null : (choice as PulleyPosition),
                  )
                }
                accentColor={accentColor}
                onAccentColor={onAccentColor}
              />
              <Text style={styles.helperText}>Where the cable starts on the machine.</Text>
            </View>
          ) : null}

          {shown('setupDetails') ? (
            <View style={styles.choiceField}>
              <TextInput
                testID="exercise-form-setup-details"
                label="Additional Setup Details"
                placeholder={'e.g. Seat height: 4\nBackrest: 2'}
                helperText="Any adjustment you'd need to set it up the same way next time."
                value={setupDetails}
                onChangeText={setSetupDetails}
                multiline
                maxLength={SETUP_DETAILS_MAX}
              />
              {/* On a machine: a line for its seat, backrest or pads, started with a tap. */}
              {equipment === 'machine' ? (
                <FilterChips
                  testID="exercise-form-setup-prompts"
                  options={SETUP_PROMPTS.map((prompt) => ({ value: prompt, label: `+ ${prompt}` }))}
                  value=""
                  onChange={startSetupLine}
                  accentColor={accentColor}
                  onAccentColor={onAccentColor}
                />
              ) : null}
            </View>
          ) : null}

          {behindMore.length > 0 ? (
            <View style={styles.more}>
              <TextButton
                testID="exercise-form-more"
                label="More Details"
                accessibilityLabel={`More details: ${listOf(behindMore.map((field) => FIELD_NAMES[field]))}`}
                onPress={() => setMoreOpen(true)}
              />
              <Text testID="exercise-form-more-hint" style={styles.helperText}>
                {`Add a ${listOf(behindMore.map((field) => FIELD_NAMES[field]))}, if it matters.`}
              </Text>
            </View>
          ) : null}
        </View>
      </Section>

      <View style={styles.actions}>
        {error ? (
          <Text testID="exercise-form-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          testID="exercise-form-save"
          label="Save Exercise"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave && !saving}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />

        {props.mode === 'edit' && isActive ? (
          <DestructiveButton
            testID="exercise-form-delete"
            label="Delete Exercise"
            accessibilityLabel="Delete exercise"
            onPress={confirmDelete}
            disabled={saving}
          />
        ) : null}
      </View>
      <PhotoLightbox
        testID="exercise-form-photo-lightbox"
        visible={photoLightboxOpen}
        uri={photo.shown}
        onClose={() => setPhotoLightboxOpen(false)}
      />
    </Screen>
  );
}

/** An exercise's setup as it's saved, to tell whether an edit changes it. */
function setupOf(exercise: ExerciseRow): SetupIdentity {
  return {
    name: exercise.name,
    equipment: exercise.equipment ?? null,
    gym: exercise.gym ?? null,
    grip: exercise.grip ?? null,
    attachment: exercise.attachment ?? null,
    loadType: exercise.loadType ?? null,
    pulleyPosition: exercise.pulleyPosition ?? null,
  };
}

/**
 * A typed field with its common answers to tap -- Grip, Foot Position, Attachment / Handle.
 * Tapping the one chosen clears it; typing anything else is fine too.
 */
function ChoiceInput({
  testID,
  field,
  value,
  onChange,
  accentColor,
  onAccentColor,
}: {
  testID: string;
  field: ChoiceField;
  value: string;
  onChange: (next: string) => void;
  accentColor: string;
  onAccentColor: string;
}) {
  return (
    <View style={styles.choiceField}>
      <TextInput
        testID={testID}
        label={field.label}
        placeholder={field.placeholder}
        helperText={field.helper}
        value={value}
        onChangeText={onChange}
        maxLength={60}
      />
      <FilterChips
        testID={`${testID}-choices`}
        options={field.choices.map((choice) => ({ value: choice, label: choice }))}
        value={chosenChoice(field, value)}
        onChange={(choice) => onChange(chosenChoice(field, value) === choice ? '' : choice)}
        accentColor={accentColor}
        onAccentColor={onAccentColor}
      />
      {field.glossary ? (
        <Text testID={`${testID}-glossary`} style={styles.helperText}>
          {field.glossary}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  fields: {
    gap: spacing.xl,
  },
  fieldLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  helperText: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  // Why the setup details matter: an info glyph beside a title and its paragraphs.
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  noteText: {
    flex: 1,
    gap: spacing.sm,
  },
  noteTitle: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  noteBody: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  measuredBy: {
    gap: spacing.sm,
  },
  unilateralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  unilateralText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: spacing.sm,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  setup: {
    gap: spacing.lg,
  },
  choiceField: {
    gap: spacing.sm,
  },
  more: {
    alignItems: 'flex-start',
    gap: 2,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoActions: {
    flex: 1,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  photoPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
  },
});
