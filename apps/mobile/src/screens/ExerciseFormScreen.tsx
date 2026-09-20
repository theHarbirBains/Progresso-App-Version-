import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { SegmentedControl } from '../design/SegmentedControl';
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
import { liveWorkoutStyles } from './liveWorkoutStyles';
import { exerciseFormStyles } from './exerciseFormStyles';

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
  /** Defaults to 'screen' (ExerciseLibraryScreen's existing full-screen
   * swap, unchanged). 'sheet' drops the full-screen container and scrolls,
   * for use inside a BottomSheet (e.g. Create Custom Exercise from an
   * active workout). */
  presentation?: 'screen' | 'sheet';
  /** The user's current Workout accent -- omit to fall back to the shared
   * default accent token. */
  accentColor?: string;
  onAccentColor?: string;
};

type Props =
  ({ mode: 'create' } & CommonProps) | ({ mode: 'edit'; exercise: ExerciseRow } & CommonProps);

// Only reachable from ExerciseLibraryScreen for the user's own custom
// exercises (built-ins never open in edit mode) — the backend enforces
// this too, but the UI never offers the path in the first place.
export function ExerciseFormScreen(props: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const presentation = props.presentation ?? 'screen';
  const accentColor = props.accentColor ?? colors.accent;
  const onAccentColor = props.onAccentColor ?? colors.onAccent;
  const insets = useSafeAreaInsets();

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

  if (presentation === 'sheet') {
    return (
      // Keyboard avoidance for this presentation lives one level up, in
      // BottomSheet.tsx -- it wraps the whole sheet in a KeyboardAvoidingView
      // and caps the sheet's height, which is what gives this ScrollView an
      // actual bounded box to scroll a focused field into view within. A
      // second KeyboardAvoidingView here would double up on the same push/
      // shrink behavior for no benefit.
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={liveWorkoutStyles.header}>
          <Text style={liveWorkoutStyles.headerTitle}>
            {props.mode === 'create' ? 'Create Custom Exercise' : 'Edit Exercise'}
          </Text>
          <TouchableOpacity
            testID="exercise-form-cancel"
            style={liveWorkoutStyles.headerIconButton}
            onPress={props.onCancel}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Feather name="x" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={sheetStyles.label}>Exercise Name</Text>
        <TextInput
          testID="exercise-form-name"
          style={liveWorkoutStyles.searchInput}
          placeholder="e.g. Smith Machine Shoulder Press"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={sheetStyles.label}>Muscle Group</Text>
        <MuscleGroupChips
          value={muscleGroup}
          onChange={setMuscleGroup}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
          chipBorderColor={colors.border}
          chipTextColor={colors.textSecondary}
        />

        <Text style={sheetStyles.label}>Exercise Type</Text>
        <SegmentedControl
          testID="exercise-form-movement-type"
          options={MOVEMENT_TYPE_OPTIONS}
          value={movementType}
          onChange={handleChangeMovementType}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
        <Text style={formHelperStyles.helperText}>{MOVEMENT_TYPE_DESCRIPTIONS[movementType]}</Text>

        {movementType === 'unilateral' ? (
          <>
            <Text style={sheetStyles.label}>Logging Style</Text>
            <SegmentedControl
              testID="exercise-form-logging-style"
              options={LOGGING_STYLE_OPTIONS}
              value={loggingStyle ?? 'single_side'}
              onChange={setLoggingStyle}
              accentColor={accentColor}
              onAccentColor={onAccentColor}
            />
            <Text style={formHelperStyles.helperText}>
              {LOGGING_STYLE_DESCRIPTIONS[loggingStyle ?? 'single_side']}
            </Text>
          </>
        ) : null}

        {error ? (
          <Text testID="exercise-form-error" style={sheetStyles.error}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          testID="exercise-form-save"
          style={[
            sheetStyles.saveButton,
            { backgroundColor: accentColor },
            !canSave && sheetStyles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Save Exercise"
          accessibilityState={{ disabled: !canSave }}
        >
          {saving ? (
            <ActivityIndicator color={onAccentColor} />
          ) : (
            <Text style={[sheetStyles.saveButtonText, { color: onAccentColor }]}>
              Save Exercise
            </Text>
          )}
        </TouchableOpacity>

        {props.mode === 'edit' ? (
          <TouchableOpacity
            testID="exercise-form-toggle-active"
            style={isActive ? sheetStyles.deactivateButton : sheetStyles.reactivateButton}
            onPress={handleToggleActive}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={isActive ? 'Deactivate exercise' : 'Reactivate exercise'}
            accessibilityState={{ disabled: saving }}
          >
            <Text
              style={isActive ? sheetStyles.deactivateButtonText : sheetStyles.reactivateButtonText}
            >
              {isActive ? 'Deactivate' : 'Reactivate'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  }

  const styles = exerciseFormStyles;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="exercise-form-scroll"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {props.mode === 'create' ? 'New Exercise' : 'Edit Exercise'}
          </Text>
          {props.mode === 'create' ? (
            <Text style={styles.headerSubtitle}>
              Add exercise details to track your progress accurately.
            </Text>
          ) : null}
          <TouchableOpacity
            testID="exercise-form-cancel"
            style={styles.headerCancel}
            onPress={props.onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.headerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Exercise Name</Text>
        <TextInput
          testID="exercise-form-name"
          style={styles.input}
          placeholder="Exercise name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Muscle Group</Text>
        <MuscleGroupChips
          value={muscleGroup}
          onChange={setMuscleGroup}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
          chipBorderColor={colors.border}
          chipTextColor={colors.textSecondary}
        />

        <Text style={styles.label}>Exercise Type</Text>
        <SegmentedControl
          testID="exercise-form-movement-type"
          options={MOVEMENT_TYPE_OPTIONS}
          value={movementType}
          onChange={handleChangeMovementType}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
        <Text style={styles.helperText}>{MOVEMENT_TYPE_DESCRIPTIONS[movementType]}</Text>

        {movementType === 'unilateral' ? (
          <>
            <Text style={styles.label}>Logging Style</Text>
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
          </>
        ) : null}

        {props.mode === 'create' ? (
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionTitle}>Machine / Equipment</Text>
            <Text style={styles.sectionSubtitle}>
              Optional — add this if you train on a specific machine you want to identify later.
            </Text>

            {machinePhotoUri ? (
              <View style={styles.photoPreviewRow}>
                <Image
                  testID="exercise-form-machine-photo-preview"
                  source={{ uri: machinePhotoUri }}
                  style={styles.photoPreviewImage}
                />
                <TouchableOpacity
                  testID="exercise-form-machine-photo-remove"
                  onPress={() => setMachinePhotoUri(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove machine photo"
                >
                  <Text style={styles.photoPreviewRemove}>Remove Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                testID="exercise-form-machine-photo-add"
                style={styles.photoButton}
                onPress={handlePickMachinePhoto}
                accessibilityRole="button"
                accessibilityLabel="Add machine photo"
              >
                <Feather name="camera" size={22} color={colors.textSecondary} />
                <Text style={styles.photoButtonTitle}>Add Machine Photo</Text>
                <Text style={styles.photoButtonSubtitle}>
                  Take a photo or choose from your gallery
                </Text>
              </TouchableOpacity>
            )}
            {machinePhotoError ? (
              <Text testID="exercise-form-machine-photo-error" style={styles.photoError}>
                {machinePhotoError}
              </Text>
            ) : null}

            <AppCard style={styles.infoCard}>
              <View style={styles.infoCardHeaderRow}>
                <Feather name="info" size={16} color={colors.textSecondary} />
                <Text style={styles.infoCardTitle}>Why add a machine photo?</Text>
              </View>
              <Text style={styles.infoCardBody}>
                Different machines and equipment can have different resistance characteristics, even
                for the same exercise. A photo helps you identify and compare the specific equipment
                you used — it does not change how this exercise is logged.
              </Text>
            </AppCard>

            <AppCard style={styles.proTipCard}>
              <Feather name="zap" size={14} color={colors.textSecondary} />
              <Text style={styles.proTipText}>
                <Text style={styles.proTipBold}>Pro Tip: </Text>
                For cable or pulley machines, capture both the pulley and the weight stack so the
                setup is easy to recognize later.
              </Text>
            </AppCard>

            <Text style={styles.label}>
              Machine Name{machineProfileEngaged ? '' : ' (Optional)'}
            </Text>
            <TextInput
              testID="exercise-form-machine-name"
              style={styles.input}
              placeholder="e.g. Cable Machine 3"
              placeholderTextColor={colors.textMuted}
              value={machineName}
              onChangeText={setMachineName}
            />

            <Text style={styles.label}>Gym (Optional)</Text>
            <TextInput
              testID="exercise-form-gym"
              style={styles.input}
              placeholder="e.g. Downtown Gym"
              placeholderTextColor={colors.textMuted}
              value={gym}
              onChangeText={setGym}
            />
          </View>
        ) : null}

        {error ? (
          <Text testID="exercise-form-error" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          testID="exercise-form-save"
          style={[
            styles.button,
            { backgroundColor: accentColor },
            !canSave && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Save Exercise"
          accessibilityState={{ disabled: !canSave }}
        >
          {saving ? (
            <ActivityIndicator color={onAccentColor} />
          ) : (
            <Text style={[styles.buttonText, { color: onAccentColor }]}>Save Exercise</Text>
          )}
        </TouchableOpacity>

        {props.mode === 'edit' ? (
          <TouchableOpacity
            testID="exercise-form-toggle-active"
            style={isActive ? styles.deactivateButton : styles.reactivateButton}
            onPress={handleToggleActive}
            disabled={saving}
          >
            <Text style={isActive ? styles.deactivateButtonText : styles.reactivateButtonText}>
              {isActive ? 'Deactivate' : 'Reactivate'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Shared by the sheet presentation -- the brief "what does this mean"
// caption under Exercise Type/Logging Style. The screen presentation now
// has its own equivalent (exerciseFormStyles.helperText) since it moved off
// the legacy exerciseStyles.
const formHelperStyles = StyleSheet.create({
  helperText: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});

// Sheet-presentation-only styles (Create Custom Exercise from Active
// Workout) -- layout/typography here, on the same theme.ts tokens the rest
// of Progresso uses. Reuses liveWorkoutStyles' header/input shapes directly
// (same Add Exercise flow, same visual language) rather than redefining
// them here.
const sheetStyles = StyleSheet.create({
  label: {
    ...typeScale.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  error: {
    ...typeScale.caption,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
  saveButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  deactivateButton: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  deactivateButtonText: {
    color: colors.destructive,
    fontSize: 15,
    fontWeight: '600',
  },
  reactivateButton: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  reactivateButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
