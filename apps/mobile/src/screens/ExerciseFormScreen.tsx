import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { DestructiveButton, PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { IconButton } from '../design/IconButton';
import { Screen } from '../design/Screen';
import { SegmentedControl } from '../design/SegmentedControl';
import { Section } from '../design/Section';
import { TextInput } from '../design/TextInput';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import type { MuscleGroup } from '../exercises/muscleGroups';
import {
  LOGGING_STYLE_DESCRIPTIONS,
  LOGGING_STYLE_LABELS,
  LOGGING_STYLES,
  MOVEMENT_TYPE_DESCRIPTIONS,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPES,
  type LoggingStyle,
  type MovementType,
} from '../exercises/movementTypes';
import { createEquipmentProfile, createExercise, updateExercise } from '../lib/api';
import { uploadEquipmentPhoto } from '../lib/equipmentPhotoUpload';

const MOVEMENT_TYPE_OPTIONS = MOVEMENT_TYPES.map((value) => ({
  label: MOVEMENT_TYPE_LABELS[value],
  value,
}));
const LOGGING_STYLE_OPTIONS = LOGGING_STYLES.map((value) => ({
  label: LOGGING_STYLE_LABELS[value],
  value,
}));

type CommonProps = {
  onDone: () => void;
  onCancel: () => void;
  /** Defaults to 'screen' (the full-screen swap). 'sheet' drops the
   * screen frame and scrolls, for use inside a BottomSheet. */
  presentation?: 'screen' | 'sheet';
  /** The user's current Workout accent -- omit to fall back to the shared
   * default accent token. */
  accentColor?: string;
  onAccentColor?: string;
};

type Props =
  ({ mode: 'create' } & CommonProps) | ({ mode: 'edit'; exercise: ExerciseRow } & CommonProps);

// Create Custom Exercise (from an active workout or the Exercise Library) and
// edit for the user's own custom exercises (built-ins never open in edit mode --
// the backend enforces this too, but the UI never offers the path in the
// first place).
//
// Layout: the shared Screen frame with a Cancel (X) in the header, the fields
// as labelled controls, an optional Machine / Equipment section (create only),
// then one filled Save button -- no cards. The 'sheet' presentation shares
// the same fields and actions inside a BottomSheet.
export function ExerciseFormScreen(props: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const presentation = props.presentation ?? 'screen';
  const accentColor = props.accentColor ?? colors.accent;
  const onAccentColor = props.onAccentColor ?? colors.onAccent;

  const [name, setName] = useState(props.mode === 'edit' ? props.exercise.name : '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(
    props.mode === 'edit' ? props.exercise.muscleGroup : null,
  );
  const [movementType, setMovementType] = useState<MovementType>(
    props.mode === 'edit' ? props.exercise.movementType : 'bilateral',
  );
  const [loggingStyle, setLoggingStyle] = useState<LoggingStyle | null>(
    props.mode === 'edit' ? props.exercise.loggingStyle : null,
  );
  const [isActive, setIsActive] = useState(props.mode === 'edit' ? props.exercise.isActive : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Machine/Equipment (New Exercise 'screen' presentation only, see the
  // section below) -- purely descriptive today, see the equipment_profiles
  // migration. A machine name is only required once the user has actually
  // engaged with this section (a gym or a photo), never for a plain
  // exercise that skips it entirely.
  const [machinePhotoUri, setMachinePhotoUri] = useState<string | null>(null);
  const [machinePhotoError, setMachinePhotoError] = useState<string | null>(null);
  const [machineName, setMachineName] = useState('');
  const [gym, setGym] = useState('');
  const machineProfileEngaged = gym.trim().length > 0 || machinePhotoUri !== null;
  const machineNameValid = !machineProfileEngaged || machineName.trim().length > 0;

  const canSave =
    name.trim().length > 0 &&
    muscleGroup !== null &&
    (movementType === 'bilateral' || loggingStyle !== null) &&
    machineNameValid &&
    !saving;

  function handleChangeMovementType(next: MovementType) {
    setMovementType(next);
    // A bilateral exercise never carries a logging style -- clear it
    // immediately rather than leaving a stale unilateral choice around that
    // would just get silently dropped on save.
    if (next === 'bilateral') {
      setLoggingStyle(null);
    } else {
      // The Logging Style control below renders 'single_side' as selected
      // when nothing has been chosen -- make the state match what's shown,
      // otherwise Save stays disabled with a visibly-selected option.
      setLoggingStyle((prev) => prev ?? 'single_side');
    }
  }

  async function handlePickMachinePhoto() {
    setMachinePhotoError(null);
    Alert.alert('Add Machine Photo', undefined, [
      { text: 'Take Photo', onPress: () => void pickMachinePhoto('camera') },
      { text: 'Choose from Library', onPress: () => void pickMachinePhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pickMachinePhoto(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMachinePhotoError(
        source === 'camera'
          ? 'Camera permission is required to take a machine photo.'
          : 'Photo library permission is required to choose a machine photo.',
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;

    setMachinePhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!accessToken || !muscleGroup) return;
    if (movementType === 'unilateral' && !loggingStyle) return;
    if (!machineNameValid) return;
    setError(null);
    setSaving(true);
    try {
      let exerciseId: string;
      if (props.mode === 'create') {
        const created = await createExercise(accessToken, {
          name: name.trim(),
          muscleGroup,
          movementType,
          ...(movementType === 'unilateral' ? { loggingStyle: loggingStyle! } : {}),
        });
        exerciseId = created.id;
      } else {
        await updateExercise(accessToken, props.exercise.id, {
          name: name.trim(),
          muscleGroup,
          movementType,
          ...(movementType === 'unilateral' ? { loggingStyle: loggingStyle! } : {}),
          isActive,
        });
        exerciseId = props.exercise.id;
      }

      // Machine/Equipment only exists on the New Exercise 'screen'
      // presentation -- machinePhotoUri/gym/machineName stay at their
      // initial empty values everywhere else, so machineProfileEngaged is
      // always false there and this never runs.
      if (props.mode === 'create' && machineProfileEngaged && userId) {
        try {
          // Uploaded only now (not the moment it's picked) so an abandoned
          // form never leaves an orphaned file in storage -- each upload
          // gets its own unique path (see equipmentPhotoUpload.ts), so
          // there's nothing to overwrite/clean up either way.
          const photoUrl = machinePhotoUri
            ? await uploadEquipmentPhoto(userId, machinePhotoUri)
            : undefined;
          await createEquipmentProfile(accessToken, {
            exerciseId,
            name: machineName.trim(),
            ...(gym.trim() ? { gym: gym.trim() } : {}),
            ...(photoUrl ? { photoUrl } : {}),
          });
        } catch (equipmentErr) {
          // The exercise itself already saved successfully -- don't trap
          // the user on this form over a secondary failure, just surface
          // what happened.
          setError(
            equipmentErr instanceof Error
              ? equipmentErr.message
              : 'Exercise saved, but the machine details failed to save',
          );
          setSaving(false);
          props.onDone();
          return;
        }
      }

      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save exercise');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!accessToken || props.mode !== 'edit') return;
    setError(null);
    setSaving(true);
    try {
      await updateExercise(accessToken, props.exercise.id, { isActive: !isActive });
      setIsActive((prev) => !prev);
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update exercise');
    } finally {
      setSaving(false);
    }
  }

  const title = props.mode === 'create' ? 'New Exercise' : 'Edit Exercise';

  // The fields shared by both presentations. Selecting a muscle group, the
  // exercise type and (for unilateral) the logging style is unchanged.
  const fields = (
    <View style={styles.fields}>
      <TextInput
        testID="exercise-form-name"
        label="Exercise Name"
        placeholder={
          presentation === 'sheet' ? 'e.g. Smith Machine Shoulder Press' : 'Exercise name'
        }
        value={name}
        onChangeText={setName}
      />

      <View>
        <Text style={styles.fieldLabel}>Muscle Group</Text>
        <MuscleGroupChips
          value={muscleGroup}
          onChange={setMuscleGroup}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
          chipBorderColor={colors.border}
          chipTextColor={colors.textSecondary}
        />
      </View>

      <View>
        <Text style={styles.fieldLabel}>Exercise Type</Text>
        <SegmentedControl
          testID="exercise-form-movement-type"
          options={MOVEMENT_TYPE_OPTIONS}
          value={movementType}
          onChange={handleChangeMovementType}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
        <Text style={styles.helperText}>{MOVEMENT_TYPE_DESCRIPTIONS[movementType]}</Text>
      </View>

      {movementType === 'unilateral' ? (
        <View>
          <Text style={styles.fieldLabel}>Logging Style</Text>
          <SegmentedControl
            testID="exercise-form-logging-style"
            options={LOGGING_STYLE_OPTIONS}
            value={loggingStyle ?? 'single_side'}
            onChange={setLoggingStyle}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
          <Text style={styles.helperText}>
            {LOGGING_STYLE_DESCRIPTIONS[loggingStyle ?? 'single_side']}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // One filled Save; Deactivate/Reactivate (edit only) is a quiet second
  // action beneath it.
  const actions = (
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

      {props.mode === 'edit' ? (
        isActive ? (
          <DestructiveButton
            testID="exercise-form-toggle-active"
            label="Deactivate"
            accessibilityLabel="Deactivate exercise"
            onPress={handleToggleActive}
            disabled={saving}
          />
        ) : (
          <SecondaryButton
            testID="exercise-form-toggle-active"
            label="Reactivate"
            accessibilityLabel="Reactivate exercise"
            onPress={handleToggleActive}
            disabled={saving}
          />
        )
      ) : null}
    </View>
  );

  if (presentation === 'sheet') {
    return (
      // Keyboard avoidance for this presentation lives one level up, in
      // BottomSheet.tsx -- it wraps the whole sheet in a KeyboardAvoidingView
      // and caps the sheet's height, which is what gives this ScrollView an
      // actual bounded box to scroll a focused field into view within. A
      // second KeyboardAvoidingView here would double up on the same push/
      // shrink behavior for no benefit.
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            {props.mode === 'create' ? 'Create Custom Exercise' : 'Edit Exercise'}
          </Text>
          <IconButton
            testID="exercise-form-cancel"
            icon="x"
            onPress={props.onCancel}
            accessibilityLabel="Close"
          />
        </View>
        {fields}
        {actions}
      </ScrollView>
    );
  }

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
      {fields}

      {props.mode === 'create' ? (
        <Section title="Machine / Equipment">
          <View style={styles.machine}>
            <Text style={styles.helperText}>
              Optional — add this if you train on a specific machine you want to identify later.
            </Text>

            {machinePhotoUri ? (
              <View style={styles.photoPreviewRow}>
                <Image
                  testID="exercise-form-machine-photo-preview"
                  source={{ uri: machinePhotoUri }}
                  style={styles.photoPreviewImage}
                />
                <TextButton
                  testID="exercise-form-machine-photo-remove"
                  label="Remove Photo"
                  accessibilityLabel="Remove machine photo"
                  destructive
                  onPress={() => setMachinePhotoUri(null)}
                />
              </View>
            ) : (
              <SecondaryButton
                testID="exercise-form-machine-photo-add"
                label="Add Machine Photo"
                accessibilityLabel="Add machine photo"
                onPress={handlePickMachinePhoto}
              />
            )}
            {machinePhotoError ? (
              <Text testID="exercise-form-machine-photo-error" style={styles.errorText}>
                {machinePhotoError}
              </Text>
            ) : null}

            <View>
              <Text style={styles.noteTitle}>Why add a machine photo?</Text>
              <Text style={styles.helperText}>
                Different machines and equipment can have different resistance characteristics, even
                for the same exercise. A photo helps you identify and compare the specific equipment
                you used — it does not change how this exercise is logged.
              </Text>
              <Text style={[styles.helperText, styles.noteTip]}>
                <Text style={styles.noteTipLead}>Pro Tip: </Text>
                For cable or pulley machines, capture both the pulley and the weight stack so the
                setup is easy to recognize later.
              </Text>
            </View>

            <TextInput
              testID="exercise-form-machine-name"
              label={`Machine Name${machineProfileEngaged ? '' : ' (Optional)'}`}
              placeholder="e.g. Cable Machine 3"
              value={machineName}
              onChangeText={setMachineName}
            />
            <TextInput
              testID="exercise-form-gym"
              label="Gym (Optional)"
              placeholder="e.g. Downtown Gym"
              value={gym}
              onChangeText={setGym}
            />
          </View>
        </Section>
      ) : null}

      {actions}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
  },
  fields: {
    gap: spacing.xl,
  },
  fieldLabel: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  helperText: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
  },
  machine: {
    gap: spacing.lg,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
  },
  noteTitle: {
    ...typeScale.callout,
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textPrimary,
  },
  noteTip: {
    marginTop: spacing.sm,
  },
  noteTipLead: {
    fontFamily: typeScale.cardTitle.fontFamily,
    color: colors.textSecondary,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
});
