import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { DEFAULT_NUTRITION_COLOR } from '../theme/accentColor';
import { AccentColorPickerScreen } from './AccentColorPickerScreen';
import { LoadingState } from '../design/LoadingState';

type Props = RootStackScreenProps<'NutritionColorSettings'>;

export function NutritionColorScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [loading, setLoading] = useState(true);
  const [currentColor, setCurrentColor] = useState(DEFAULT_NUTRITION_COLOR);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!accessToken) return;
      try {
        const profile = await getMyProfile(accessToken);
        if (mounted) setCurrentColor(profile.nutritionAccentColor ?? DEFAULT_NUTRITION_COLOR);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  async function handleSave(hex: string) {
    if (!accessToken) return;
    setSaveError(null);
    setSaving(true);
    try {
      await updateMyProfile(accessToken, { nutritionAccentColor: hex });
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
      initialColor={currentColor}
      previewKind="nutrition"
      saving={saving}
      saveError={saveError}
      onSave={handleSave}
      onBack={() => navigation.goBack()}
    />
  );
}
