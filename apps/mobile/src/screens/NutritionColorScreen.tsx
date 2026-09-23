import { useState } from 'react';
import { useProfile } from '../profile/ProfileProvider';
import type { RootStackScreenProps } from '../navigation/types';
import { DEFAULT_NUTRITION_COLOR } from '../theme/accentColor';
import { AccentColorPickerScreen } from './AccentColorPickerScreen';
import { LoadingState } from '../design/LoadingState';

type Props = RootStackScreenProps<'NutritionColorSettings'>;

export function NutritionColorScreen({ navigation }: Props) {
  const { profile, loading, updateProfile } = useProfile();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave(hex: string) {
    setSaveError(null);
    setSaving(true);
    try {
      await updateProfile({ nutritionAccentColor: hex });
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState testID="nutrition-color-loading" />;
  }

  return (
    <AccentColorPickerScreen
      title="Nutrition Mode Color"
      subtitle="Choose the accent color for your Nutrition experience."
      initialColor={profile?.nutritionAccentColor ?? DEFAULT_NUTRITION_COLOR}
      previewKind="nutrition"
      saving={saving}
      saveError={saveError}
      onSave={handleSave}
      onBack={() => navigation.goBack()}
    />
  );
}
