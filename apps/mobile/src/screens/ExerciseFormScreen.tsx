import { useState } from 'react';
import { Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { DestructiveButton, PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { PhotoLightbox } from '../design/PhotoLightbox';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { TextInput } from '../design/TextInput';
import { Toggle } from '../design/Toggle';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MuscleGroupSelect } from '../exercises/MuscleGroupSelect';
import type { MuscleGroup } from '../exercises/muscleGroups';
import type { MovementType } from '../exercises/movementTypes';
import { createExercise, updateExercise } from '../lib/api';
import { uploadEquipmentPhoto } from '../lib/equipmentPhotoUpload';

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
// field, pick from a sheet, rather than a filter-style chip row), whether
// it's unilateral (one plain yes/no toggle -- logging_style, which only
// distinguishes HOW a unilateral exercise's sets are entered and never
// changes any actual behavior, is set to 'single_side' automatically rather
// than asked as a second question), and an optional photo of the
// machine/equipment, shown as a thumbnail in the Exercise Library. The photo
// is editable at any time, not just at create -- unlike the rest of this
// form, its own section renders identically for both modes.
export function ExerciseFormScreen(props: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const accentColor = props.accentColor ?? colors.accent;
  const onAccentColor = props.onAccentColor ?? colors.onAccent;

  const [name, setName] = useState(props.mode === 'edit' ? props.exercise.name : '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(
    props.mode === 'edit' ? props.exercise.muscleGroup : null,
  );
  const [isUnilateral, setIsUnilateral] = useState(
    props.mode === 'edit' ? props.exercise.movementType === 'unilateral' : false,
  );
  const [isActive] = useState(props.mode === 'edit' ? props.exercise.isActive : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A freshly picked photo (a local file, uploaded on Save), or the photo
  // this exercise already has -- which "Remove Photo" clears on Save. Same
  // three-state convention FoodFormScreen's own photo field uses.
  const existingPhotoUrl = props.mode === 'edit' ? props.exercise.photoUrl : null;
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const shownPhoto = photoUri ?? (photoRemoved ? null : existingPhotoUrl);

  const canSave = name.trim().length > 0 && muscleGroup !== null && !saving;

  async function handlePickPhoto() {
    setPhotoError(null);
    Alert.alert('Machine Photo', undefined, [
      { text: 'Take Photo', onPress: () => void pickPhoto('camera') },
      { text: 'Choose from Library', onPress: () => void pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pickPhoto(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError(
        source === 'camera'
          ? 'Camera permission is required to take a photo.'
          : 'Photo library permission is required to choose a photo.',
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

    setPhotoUri(result.assets[0].uri);
    setPhotoRemoved(false);
  }

  function handleRemovePhoto() {
    setPhotoUri(null);
    setPhotoRemoved(true);
  }

  async function handleSave() {
    if (!accessToken || !muscleGroup || !canSave) return;
    setError(null);
    setSaving(true);
    try {
      // undefined leaves the stored photo alone; null clears it.
      let photoUrl: string | null | undefined;
      if (photoUri && userId) {
        photoUrl = await uploadEquipmentPhoto(userId, photoUri);
      } else if (photoRemoved) {
        photoUrl = null;
      }

      const movementType: MovementType = isUnilateral ? 'unilateral' : 'bilateral';

      if (props.mode === 'create') {
        await createExercise(accessToken, {
          name: name.trim(),
          muscleGroup,
          movementType,
          // Only meaningful for a unilateral exercise -- see the file
          // comment. Always 'single_side' since this form never asks.
          ...(isUnilateral ? { loggingStyle: 'single_side' as const } : {}),
          ...(photoUrl !== undefined ? { photoUrl: photoUrl ?? undefined } : {}),
        });
      } else {
        await updateExercise(accessToken, props.exercise.id, {
          name: name.trim(),
          muscleGroup,
          movementType,
          ...(isUnilateral ? { loggingStyle: 'single_side' as const } : {}),
          isActive,
          ...(photoUrl !== undefined ? { photoUrl } : {}),
        });
      }

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
          placeholder="Exercise name"
          value={name}
          onChangeText={setName}
        />

        <MuscleGroupSelect
          testID="exercise-form-muscle-group"
          value={muscleGroup}
          onChange={setMuscleGroup}
          accentColor={accentColor}
        />

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

      <Section title="Machine Photo (Optional)">
        <View style={styles.photo}>
          <Text style={styles.helperText}>Shown next to this exercise in your library.</Text>

          {shownPhoto ? (
            <View style={styles.photoPreviewRow}>
              <TouchableOpacity
                onPress={() => setPhotoLightboxOpen(true)}
                accessibilityRole="imagebutton"
                accessibilityLabel="View machine photo"
              >
                <Image
                  testID="exercise-form-photo-preview"
                  source={{ uri: shownPhoto }}
                  style={styles.photoPreviewImage}
                />
              </TouchableOpacity>
              <View style={styles.photoActions}>
                <SecondaryButton
                  testID="exercise-form-photo-change"
                  size="sm"
                  label="Change Photo"
                  accessibilityLabel="Change machine photo"
                  onPress={handlePickPhoto}
                />
                <TextButton
                  testID="exercise-form-photo-remove"
                  label="Remove Photo"
                  accessibilityLabel="Remove machine photo"
                  destructive
                  onPress={handleRemovePhoto}
                />
              </View>
            </View>
          ) : (
            <SecondaryButton
              testID="exercise-form-photo-add"
              label="Add Photo"
              accessibilityLabel="Add machine photo"
              onPress={handlePickPhoto}
            />
          )}
          {photoError ? (
            <Text testID="exercise-form-photo-error" style={styles.errorText}>
              {photoError}
            </Text>
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
        uri={shownPhoto}
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
