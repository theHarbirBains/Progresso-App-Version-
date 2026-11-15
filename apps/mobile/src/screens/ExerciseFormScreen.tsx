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
import { chosenGrip, gripFieldFor } from '../exercises/gripChoices';
import {
  hasPulley,
  LOAD_TYPE_LABELS,
  LOAD_TYPES,
  PULLEY_LABELS,
  PULLEYS,
  type LoadType,
  type Pulley,
} from '../exercises/machineLoad';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { SegmentedControl } from '../design/SegmentedControl';
import { TextInput } from '../design/TextInput';
import { Toggle } from '../design/Toggle';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { invalidateExerciseCache, type ExerciseRow } from '../exercises/exerciseQueries';
import { MuscleGroupSelect } from '../exercises/MuscleGroupSelect';
import type { MuscleGroup } from '../exercises/muscleGroups';
import {
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_TYPES,
  type MeasurementType,
  type MovementType,
} from '../exercises/movementTypes';
import { usePhotoField } from '../lib/usePhotoField';
import { createExercise, updateExercise } from '../lib/api';
import { uploadEquipmentPhoto } from '../lib/equipmentPhotoUpload';
import { useAppTheme } from '../theme/appThemeContext';

type Props = {
  onDone: () => void;
  onCancel: () => void;
  /** The user's current Workout accent -- omit to fall back to the shared default accent token. */
  accentColor?: string;
  onAccentColor?: string;
} & ({ mode: 'create' } | { mode: 'edit'; exercise: ExerciseRow });

// Create Custom Exercise (from an active workout or the Exercise Library) and
// edit for the user's own custom exercises (built-ins never open in edit mode --
// the backend enforces this too, but the UI never offers the path in the
// first place).
//
// Deliberately minimal: a name, a muscle group (a real dropdown -- tap the
// field, pick from a sheet, rather than a filter-style chip row), what a set
// records (weight and reps, reps only, or a time -- a weighted version of a
// bodyweight exercise is its own exercise), whether
// it's unilateral (one plain yes/no toggle -- logging_style, which only
// distinguishes HOW a unilateral exercise's sets are entered and never
// changes any actual behavior, is set to 'single_side' automatically rather
// than asked as a second question), and, optionally, what tells this
// machine apart from look-alikes: its photo (shown beside it everywhere), its
// gym, how it's held -- a grip or handle, or for a leg machine where the
// feet go (exercises/gripChoices.ts) -- with the common ones to tap, how it's
// loaded (a single or double weight stack, or plates) and, on a stack, whether
// its pulley feels heavier or lighter (exercises/machineLoad.ts).
export function ExerciseFormScreen(props: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const themeAccent = useAppTheme().accent;
  const accentColor = props.accentColor ?? themeAccent.accent;
  const onAccentColor = props.onAccentColor ?? themeAccent.onAccent;

  const [name, setName] = useState(props.mode === 'edit' ? props.exercise.name : '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(
    props.mode === 'edit' ? props.exercise.muscleGroup : null,
  );
  const [isUnilateral, setIsUnilateral] = useState(
    props.mode === 'edit' ? props.exercise.movementType === 'unilateral' : false,
  );
  const [measurementType, setMeasurementType] = useState<MeasurementType>(
    props.mode === 'edit' ? props.exercise.measurementType : 'weight_reps',
  );
  const [isActive] = useState(props.mode === 'edit' ? props.exercise.isActive : true);
  // What sets this machine apart from others like it -- all optional. A note on how it feels,
  // saved by an older version, is left as it was: the photo does that job now.
  const [gym, setGym] = useState(props.mode === 'edit' ? (props.exercise.gym ?? '') : '');
  const [attachment, setAttachment] = useState(
    props.mode === 'edit' ? (props.exercise.attachment ?? '') : '',
  );
  const [loadType, setLoadType] = useState<LoadType | null>(
    props.mode === 'edit' ? (props.exercise.loadType ?? null) : null,
  );
  const [pulley, setPulley] = useState<Pulley | null>(
    props.mode === 'edit' ? (props.exercise.pulley ?? null) : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A freshly picked photo (a local file, uploaded on Save), or the photo
  // this exercise already has -- which "Remove Photo" clears on Save. Same
  // three-state convention FoodFormScreen's own photo field uses.
  const existingPhotoUrl = props.mode === 'edit' ? props.exercise.photoUrl : null;
  const photo = usePhotoField({
    title: 'Machine Photo',
    aspect: [4, 3],
    existingUrl: existingPhotoUrl,
  });
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);

  const canSave = name.trim().length > 0 && muscleGroup !== null && !saving;
  // Hands for most exercises; feet for a leg machine.
  const gripField = gripFieldFor(muscleGroup);

  async function handleSave() {
    if (!accessToken || !muscleGroup || !canSave) return;
    setError(null);
    setSaving(true);
    try {
      // undefined leaves the stored photo alone; null clears it.
      let photoUrl: string | null | undefined;
      if (photo.picked && userId) {
        photoUrl = await uploadEquipmentPhoto(userId, photo.picked);
      } else if (photo.removed) {
        photoUrl = null;
      }

      const movementType: MovementType = isUnilateral ? 'unilateral' : 'bilateral';
      // A blank box is nothing: cleared on an edit, left out on a new exercise.
      const details = {
        gym: gym.trim() || null,
        attachment: attachment.trim() || null,
        loadType,
        // Plates have no pulley to speak of.
        pulley: hasPulley(loadType) ? pulley : null,
      };

      if (props.mode === 'create') {
        await createExercise(accessToken, {
          name: name.trim(),
          muscleGroup,
          movementType,
          measurementType,
          // Only meaningful for a unilateral exercise -- see the file
          // comment. Always 'single_side' since this form never asks.
          ...(isUnilateral ? { loggingStyle: 'single_side' as const } : {}),
          ...(photoUrl !== undefined ? { photoUrl: photoUrl ?? undefined } : {}),
          // Only the details that were filled in.
          ...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== null)),
        });
      } else {
        await updateExercise(accessToken, props.exercise.id, {
          name: name.trim(),
          muscleGroup,
          movementType,
          measurementType,
          ...(isUnilateral ? { loggingStyle: 'single_side' as const } : {}),
          isActive,
          ...(photoUrl !== undefined ? { photoUrl } : {}),
          ...details,
        });
      }

      // The library/picker's cached exercise list no longer reflects what was just saved.
      if (userId) invalidateExerciseCache(userId);
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise');
    } finally {
      setSaving(false);
    }
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

      {/* Why the details below matter, before them: the setup is part of the exercise. */}
      <AppCard testID="exercise-form-setup-note">
        <View style={styles.note}>
          <Feather name="info" size={18} color={colors.textSecondaryBright} />
          <View style={styles.noteText}>
            <Text style={styles.noteTitle}>Why the following details can matter?</Text>
            <Text style={styles.noteBody}>
              Your equipment setup is part of the exercise. Changing the machine, gym, grip, handle,
              weight type or pulley configuration can change the resistance, mechanics and
              difficulty of a movement.
            </Text>
            <Text style={styles.noteBody}>
              For the most accurate progress tracking, keep your setup consistent. If you change any
              of these details, create a separate exercise rather than logging it under your
              existing one.
            </Text>
            <Text style={styles.noteBody}>
              These fields are optional, but filling them in can make a huge difference. They help
              Progresso keep your personal records, performance comparisons and long-term progress
              accurate.
            </Text>
          </View>
        </View>
      </AppCard>

      {/* Two machines can do the same thing but be heavier or lighter, and a different grip
          changes the muscles worked and the weight lifted -- so progress is only comparable on
          the same machine, held the same way. These tell look-alikes apart; two can even share a
          name. */}
      <Section title="Tell This Machine Apart (Optional)">
        <View style={styles.photo}>
          <Text style={styles.helperText}>
            Two machines can do the same thing but feel heavier or lighter. Add what makes this one
            yours, so you always compare the same machine.
          </Text>

          <Text style={styles.fieldLabel}>Photo</Text>
          <Text style={styles.helperText}>
            The easiest way to tell it apart. It shows next to this exercise everywhere.
          </Text>
          {photo.shown ? (
            <View style={styles.photoPreviewRow}>
              <TouchableOpacity
                onPress={() => setPhotoLightboxOpen(true)}
                accessibilityRole="imagebutton"
                accessibilityLabel="View machine photo"
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
                  accessibilityLabel="Change machine photo"
                  onPress={photo.pick}
                />
                <TextButton
                  testID="exercise-form-photo-remove"
                  label="Remove Photo"
                  accessibilityLabel="Remove machine photo"
                  destructive
                  onPress={photo.remove}
                />
              </View>
            </View>
          ) : (
            <SecondaryButton
              testID="exercise-form-photo-add"
              label="Add Photo"
              accessibilityLabel="Add machine photo"
              onPress={photo.pick}
            />
          )}
          {photo.error ? (
            <Text testID="exercise-form-photo-error" style={styles.errorText}>
              {photo.error}
            </Text>
          ) : null}

          <TextInput
            testID="exercise-form-gym"
            label="Gym"
            placeholder="e.g. Fit4Less Downtown"
            helperText="Where this machine is. It shows under the name."
            value={gym}
            onChangeText={setGym}
            maxLength={60}
          />

          <View style={styles.grip}>
            <TextInput
              testID="exercise-form-attachment"
              label={gripField.label}
              placeholder={gripField.placeholder}
              helperText={gripField.helper}
              value={attachment}
              onChangeText={setAttachment}
              maxLength={60}
            />
            {/* The common ones, to tap instead of typing; tapping the one chosen clears it. */}
            <FilterChips
              testID="exercise-form-grip-choices"
              options={gripField.choices.map((choice) => ({ value: choice, label: choice }))}
              value={chosenGrip(gripField, attachment)}
              onChange={(choice) =>
                setAttachment((current) =>
                  chosenGrip(gripField, current) === choice ? '' : choice,
                )
              }
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
            {gripField.glossary ? (
              <Text testID="exercise-form-grip-glossary" style={styles.helperText}>
                {gripField.glossary}
              </Text>
            ) : null}
          </View>

          {/* How it's loaded; tapping the one chosen clears it. */}
          <View style={styles.grip}>
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

          {hasPulley(loadType) ? (
            <View style={styles.grip}>
              <Text style={styles.fieldLabel}>Pulley</Text>
              <FilterChips
                testID="exercise-form-pulley"
                options={PULLEYS.map((value) => ({ value, label: PULLEY_LABELS[value] }))}
                value={pulley ?? ''}
                onChange={(choice) =>
                  setPulley((current) => (current === choice ? null : (choice as Pulley)))
                }
                accentColor={accentColor}
                onAccentColor={onAccentColor}
              />
              <Text style={styles.helperText}>
                On a cable machine, the pulley can make each plate on the stack feel heavier or
                lighter than on another machine.
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
  photo: {
    gap: spacing.md,
  },
  grip: {
    gap: spacing.sm,
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
