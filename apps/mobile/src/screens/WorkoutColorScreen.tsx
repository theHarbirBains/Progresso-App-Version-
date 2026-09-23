import { useState } from 'react';
import { useProfile } from '../profile/ProfileProvider';
import type { RootStackScreenProps } from '../navigation/types';
import { DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { AccentColorPickerScreen } from './AccentColorPickerScreen';
import { LoadingState } from '../design/LoadingState';

type Props = RootStackScreenProps<'WorkoutColorSettings'>;

export function WorkoutColorScreen({ navigation }: Props) {
  const { profile, loading, updateProfile } = useProfile();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave(hex: string) {
    setSaveError(null);
    setSaving(true);
    try {
      await updateProfile({ workoutAccentColor: hex });
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState testID="workout-color-loading" />;
  }

  return (
    <AccentColorPickerScreen
      title="Workout Mode Color"
      subtitle="Choose the accent color for your Workout experience."
      initialColor={profile?.workoutAccentColor ?? DEFAULT_WORKOUT_COLOR}
      previewKind="workout"
      saving={saving}
      saveError={saveError}
      onSave={handleSave}
      onBack={() => navigation.goBack()}
    />
  );
}
