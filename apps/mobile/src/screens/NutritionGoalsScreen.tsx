import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { TextInput } from '../design/TextInput';
import { getMyProfile, type ProfileResponse } from '../lib/api';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { ACTIVITY_LEVELS, ageFromBirthday } from '../nutrition/calorieEstimationInput';
import {
  buildCalorieProfileInput,
  computeCalorieTargets,
  type CalorieTargets,
} from '../nutrition/calorieTargets';
import {
  fetchNutritionGoals,
  saveNutritionGoals,
  type NutritionGoals,
} from '../nutrition/nutritionGoalQueries';
import { feetAndInchesFromCm, kgToLb } from '../onboarding/weightHeightConversion';
import { buildAccentTheme, DEFAULT_NUTRITION_THEME, type AccentTheme } from '../theme/accentColor';
import { nutritionGoalsStyles as styles } from './nutritionGoalsStyles';

type Props = RootStackScreenProps<'NutritionGoals'>;

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

function formatHeight(heightCm: number, unit: 'cm' | 'ft_in'): string {
  if (unit === 'cm') return `${Math.round(heightCm)} cm`;
  const { feet, inches } = feetAndInchesFromCm(heightCm);
  return `${feet}' ${inches}"`;
}

function formatWeight(weightKg: number, unit: 'kg' | 'lb'): string {
  const value = unit === 'kg' ? weightKg : kgToLb(weightKg);
  return `${Math.round(value * 10) / 10} ${unit}`;
}

// The four calculated targets, in the order they are shown -- purely
// informational rows (no press handler, no selection state).
const OPTIONS = [
  { key: 'surplus', testID: 'nutrition-goals-option-surplus', title: 'Weight Gain' },
  { key: 'maintenance', testID: 'nutrition-goals-option-maintenance', title: 'Maintenance' },
  { key: 'deficit', testID: 'nutrition-goals-option-deficit', title: 'Weight Loss' },
  {
    key: 'aggressiveDeficit',
    testID: 'nutrition-goals-option-aggressive',
    title: 'Aggressive Loss',
  },
] as const;

/** Whole numbers only (section 7's "whole-number input"), matching the
 * nutrition_goals.calories column's own integer type -- never a decimal. */
function parseWholeCalories(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

// The reference-image Nutrition Goals screen: real, profile-derived calorie
// recommendations (Mifflin-St Jeor, see nutrition/calorieTargets.ts) plus a
// custom target the user explicitly saves as their Daily Calorie Target
// (nutrition_goals.calories -- the same table/column Nutrition Mode's
// Dashboard already reads). Personal data (gender/birthday/height/weight/
// activity level) is never edited here -- CalorieEstimationScreen is the
// one place that happens; "Edit" just navigates there, and this screen
// re-fetches + recalculates whenever it regains focus, so an edit there is
// reflected the moment the user comes back.
//
// Layout: a plain summary line with Edit, the four estimates as rows (name,
// how they differ from maintenance, and the calories as a mono readout), the
// custom target as one labelled field, one filled Save, then the notes.
export function NutritionGoalsScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const { openMenu } = useAppMenu();

  const [theme, setTheme] = useState<AccentTheme>(DEFAULT_NUTRITION_THEME);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [existingGoals, setExistingGoals] = useState<NutritionGoals>({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Only the very first load shows the full-screen spinner -- returning
  // here after editing personal info on CalorieEstimation is a background
  // refresh, same convention as Dashboard/ProfileScreen.
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId || !accessToken) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);
    try {
      const [fetchedProfile, goals] = await Promise.all([
        getMyProfile(accessToken),
        fetchNutritionGoals(userId),
      ]);
      setProfile(fetchedProfile);
      setExistingGoals(goals);
      setTheme(
        fetchedProfile.nutritionAccentColor
          ? buildAccentTheme(fetchedProfile.nutritionAccentColor)
          : DEFAULT_NUTRITION_THEME,
      );

      // Prefill the custom target from whatever's actually saved -- never
      // silently replace an existing target with a freshly-calculated one
      // (see the screen's own comment on this). Only when nothing has ever
      // been saved does a real calculated maintenance value seed the field,
      // purely as a starting point the user can still change before saving.
      if (goals.calories !== null) {
        setCustomInput(String(goals.calories));
      } else {
        const calorieInput = buildCalorieProfileInput({
          gender: fetchedProfile.gender,
          birthday: fetchedProfile.birthday,
          heightCm: fetchedProfile.heightValue,
          weightKg: fetchedProfile.weightValue,
          activityLevel: fetchedProfile.activityLevel,
        });
        if (calorieInput) {
          setCustomInput(String(computeCalorieTargets(calorieInput).maintenance));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nutrition goals');
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [userId, accessToken]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  async function handleSave() {
    if (!userId) return;
    const calories = parseWholeCalories(customInput);
    if (calories === null) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const result = await saveNutritionGoals(userId, {
        calories,
        proteinG: existingGoals.proteinG,
        carbsG: existingGoals.carbsG,
        fatG: existingGoals.fatG,
      });
      setExistingGoals(result);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your daily target');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState testID="nutrition-goals-loading" />;
  }

  // A failed profile fetch is shown as an error banner (below), not a
  // permanently-stuck spinner -- the rest of the screen degrades to its
  // normal "incomplete profile" state (buildCalorieProfileInput already
  // returns null for every field left null here) rather than crashing.
  const calorieInput = profile
    ? buildCalorieProfileInput({
        gender: profile.gender,
        birthday: profile.birthday,
        heightCm: profile.heightValue,
        weightKg: profile.weightValue,
        activityLevel: profile.activityLevel,
      })
    : null;
  const targets: CalorieTargets | null = calorieInput ? computeCalorieTargets(calorieInput) : null;

  const age = profile?.birthday ? ageFromBirthday(profile.birthday) : null;
  const activityLabel = ACTIVITY_LEVELS.find((a) => a.value === profile?.activityLevel)?.label;
  const summaryParts = [
    profile?.gender ? GENDER_LABELS[profile.gender] : null,
    age !== null ? `${age} years` : null,
    profile?.heightValue !== null && profile?.heightValue !== undefined
      ? formatHeight(profile.heightValue, profile.heightUnit)
      : null,
    profile?.weightValue !== null && profile?.weightValue !== undefined
      ? formatWeight(profile.weightValue, profile.weightUnit)
      : null,
  ].filter((part): part is string => part !== null);

  const parsedCustom = parseWholeCalories(customInput);
  const canSave = parsedCustom !== null && !saving;

  return (
    <Screen
      scrollTestID="nutrition-goals-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title="Nutrition Goals"
          subtitle="Here are your estimated daily calorie targets."
          leftAction={{
            icon: 'menu',
            onPress: () => openMenu(),
            accessibilityLabel: 'Open menu',
            testID: 'nutrition-goals-open-menu',
          }}
          testID="nutrition-goals-header"
        />
      }
    >
      <AppCard hero topAccent={theme.accent} testID="nutrition-goals-info-card">
        <View style={styles.infoRow}>
          <View style={styles.infoBody}>
            {summaryParts.length > 0 ? (
              <Text testID="nutrition-goals-summary" style={styles.infoSummary}>
                {summaryParts.join(' • ')}
              </Text>
            ) : (
              <Text style={styles.infoIncomplete}>Add your information to see estimates</Text>
            )}
            {activityLabel ? <Text style={styles.infoActivity}>{activityLabel}</Text> : null}
          </View>
          <TextButton
            testID="nutrition-goals-edit"
            label="Edit"
            accessibilityLabel="Edit personal information"
            onPress={() => navigation.navigate('CalorieEstimation')}
          />
        </View>
      </AppCard>

      {targets ? (
        <AppCard testID="nutrition-goals-targets">
          <Section title="Estimated daily targets">
            {OPTIONS.map((option, index) => {
              const calories = targets[option.key];
              const delta = calories - targets.maintenance;
              return (
                <View
                  key={option.testID}
                  testID={option.testID}
                  style={[styles.optionRow, index > 0 && styles.optionDivider]}
                >
                  <View style={styles.optionBody}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionMeta}>
                      {option.key === 'maintenance'
                        ? 'Holds your current weight'
                        : `${delta > 0 ? '+' : ''}${delta} vs. maintenance`}
                    </Text>
                  </View>
                  <View style={styles.optionValueBlock}>
                    <Text testID={`${option.testID}-value`} style={styles.optionValue}>
                      {calories.toLocaleString()}
                    </Text>
                    <Text style={styles.optionUnit}>calories/day</Text>
                  </View>
                </View>
              );
            })}
          </Section>
        </AppCard>
      ) : (
        <AppCard testID="nutrition-goals-incomplete" style={styles.incomplete}>
          <Text style={styles.incompleteTitle}>Complete your information</Text>
          <Text style={styles.incompleteBody}>
            Add your gender, birthday, height, weight, and activity level to see personalized
            calorie targets.
          </Text>
          <SecondaryButton
            testID="nutrition-goals-complete-profile"
            label="Add Information"
            accessibilityLabel="Add your information"
            onPress={() => navigation.navigate('CalorieEstimation')}
          />
        </AppCard>
      )}

      <AppCard testID="nutrition-goals-custom-card">
        <Section title="Custom Calorie Target">
          <TextInput
            testID="nutrition-goals-custom-input"
            label="Daily calorie target"
            helperText="Set as your daily calorie target."
            placeholder="0"
            keyboardType="number-pad"
            value={customInput}
            onChangeText={setCustomInput}
            rightAccessory={<Text style={styles.inputUnit}>calories/day</Text>}
          />
        </Section>

        <View style={styles.actions}>
          {error ? (
            <Text testID="nutrition-goals-error" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
          {saved ? (
            <Text testID="nutrition-goals-saved" style={styles.savedText}>
              Saved
            </Text>
          ) : null}
          <PrimaryButton
            testID="nutrition-goals-save"
            label={
              parsedCustom !== null
                ? `Save ${parsedCustom.toLocaleString()} Calories`
                : 'Save Calories'
            }
            onPress={handleSave}
            loading={saving}
            disabled={!canSave && !saving}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </AppCard>

      <AppCard testID="nutrition-goals-notes">
        <Section title="Important Notes">
          <Text style={styles.note}>
            • These are estimates and may vary based on your activity level and body composition.
          </Text>
          <Text style={styles.note}>• Adjust based on your progress and how you feel.</Text>
          <Text style={styles.note}>• You can always change your target later.</Text>
        </Section>
      </AppCard>
    </Screen>
  );
}
