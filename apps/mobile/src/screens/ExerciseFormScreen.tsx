import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import { MuscleGroupChips } from '../exercises/MuscleGroupChips';
import type { MuscleGroup } from '../exercises/muscleGroups';
import { createExercise, updateExercise } from '../lib/api';
import { exerciseStyles as styles } from './exerciseStyles';

type Props =
  | { mode: 'create'; onDone: () => void; onCancel: () => void }
  | { mode: 'edit'; exercise: ExerciseRow; onDone: () => void; onCancel: () => void };

// Only reachable from ExerciseLibraryScreen for the user's own custom
// exercises (built-ins never open in edit mode) — the backend enforces
// this too, but the UI never offers the path in the first place.
export function ExerciseFormScreen(props: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [name, setName] = useState(props.mode === 'edit' ? props.exercise.name : '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(
    props.mode === 'edit' ? props.exercise.muscleGroup : null,
  );
  const [isActive, setIsActive] = useState(props.mode === 'edit' ? props.exercise.isActive : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && muscleGroup !== null && !saving;

  async function handleSave() {
    if (!accessToken || !muscleGroup) return;
    setError(null);
    setSaving(true);
    try {
      if (props.mode === 'create') {
        await createExercise(accessToken, { name: name.trim(), muscleGroup });
      } else {
        await updateExercise(accessToken, props.exercise.id, {
          name: name.trim(),
          muscleGroup,
          isActive,
        });
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {props.mode === 'create' ? 'New Exercise' : 'Edit Exercise'}
        </Text>
        <TouchableOpacity testID="exercise-form-cancel" onPress={props.onCancel}>
          <Text style={styles.backLink}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        testID="exercise-form-name"
        style={styles.input}
        placeholder="Exercise name"
        placeholderTextColor="#6B6B75"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Muscle group</Text>
      <MuscleGroupChips value={muscleGroup} onChange={setMuscleGroup} />

      {error ? (
        <Text testID="exercise-form-error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="exercise-form-save"
        style={[styles.button, !canSave && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={!canSave}
      >
        {saving ? (
          <ActivityIndicator color="#0B0B0F" />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
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
    </View>
  );
}
