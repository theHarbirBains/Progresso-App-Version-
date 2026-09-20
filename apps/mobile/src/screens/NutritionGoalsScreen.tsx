import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { Badge } from '../design/Badge';
import { LoadingState } from '../design/LoadingState';
import { colors, spacing } from '../design/theme';
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
import {
  buildAccentTheme,
  DEFAULT_NUTRITION_THEME,
  withAlpha,
  type AccentTheme,
} from '../theme/accentColor';
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

interface OptionCardProps {
  testID: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  calories: number;
  delta: number;
  accentColor: string;
}

// One of the 4 calculated-option tiles -- purely informational (see the
// screen's own comment on why: no onPress, no selection state, no
// affordance suggesting it's tappable).
function OptionCard({
  testID,
  icon,
  title,
  subtitle,
  calories,
  delta,
  accentColor,
}: OptionCardProps) {
  const deltaLabel = delta === 0 ? '0' : delta > 0 ? `+${delta}` : String(delta);
  return (
    <AppCard testID={testID} style={styles.optionCard}>
      <View style={[styles.optionIconWrap, { backgroundColor: withAlpha(accentColor, 0.16) }]}>
        <Feather name={icon} size={18} color={accentColor} />
      </View>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionSubtitle}>{subtitle}</Text>
      <Text testID={`${testID}-value`} style={styles.optionValue}>
        {calories.toLocaleString()}
      </Text>
      <Text style={styles.optionValueUnit}>calories/day</Text>
      <View style={styles.optionDeltaRow}>
        <Badge
          label={deltaLabel}
          color={accentColor}
          backgroundColor={withAlpha(accentColor, 0.14)}
        />
        <Text style={styles.optionDeltaLabel}>vs. maintenance</Text>
      </View>
    </AppCard>
  );
}

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
export function NutritionGoalsScreen({ navigation }: Props) {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const insets = useSafeAreaInsets();
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <AppHeader
        title="Nutrition Goals"
        leftAction={{
          icon: 'menu',
          onPress: () => openMenu('nutrition'),
          accessibilityLabel: 'Open menu',
          testID: 'nutrition-goals-open-menu',
        }}
        testID="nutrition-goals-header"
        safeArea={false}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        testID="nutrition-goals-scroll"
      >
        <Text style={styles.subtitle}>Here are your estimated daily calorie targets.</Text>

        <AppCard testID="nutrition-goals-info-card" style={styles.infoCard}>
          <View style={[styles.infoIconWrap, { backgroundColor: withAlpha(theme.accent, 0.16) }]}>
            <Feather name="user" size={20} color={theme.accent} />
          </View>
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
          <TouchableOpacity
            testID="nutrition-goals-edit"
            style={[styles.editButton, { borderColor: theme.accent }]}
            onPress={() => navigation.navigate('CalorieEstimation')}
            accessibilityRole="button"
            accessibilityLabel="Edit personal information"
          >
            <Text style={[styles.editButtonText, { color: theme.accent }]}>Edit</Text>
          </TouchableOpacity>
        </AppCard>

        {targets ? (
          <View style={styles.optionsGrid}>
            <OptionCard
              testID="nutrition-goals-option-surplus"
              icon="trending-up"
              title="Weight Gain"
              subtitle="(Surplus)"
              calories={targets.surplus}
              delta={targets.surplus - targets.maintenance}
              accentColor={theme.accent}
            />
            <OptionCard
              testID="nutrition-goals-option-maintenance"
              icon="target"
              title="Maintenance"
              subtitle="(Maintenance)"
              calories={targets.maintenance}
              delta={0}
              accentColor={theme.accent}
            />
            <OptionCard
              testID="nutrition-goals-option-deficit"
              icon="trending-down"
              title="Weight Loss"
              subtitle="(Deficit)"
              calories={targets.deficit}
              delta={targets.deficit - targets.maintenance}
              accentColor={theme.accent}
            />
            <OptionCard
              testID="nutrition-goals-option-aggressive"
              icon="chevrons-down"
              title="Aggressive Loss"
              subtitle="(Aggressive Deficit)"
              calories={targets.aggressiveDeficit}
              delta={targets.aggressiveDeficit - targets.maintenance}
              accentColor={theme.accent}
            />
          </View>
        ) : (
          <AppCard testID="nutrition-goals-incomplete" style={styles.incompleteProfileCard}>
            <Text style={styles.incompleteProfileTitle}>Complete your information</Text>
            <Text style={styles.incompleteProfileBody}>
              Add your gender, birthday, height, weight, and activity level to see personalized
              calorie targets.
            </Text>
            <TouchableOpacity
              testID="nutrition-goals-complete-profile"
              style={[styles.editButton, { borderColor: theme.accent }]}
              onPress={() => navigation.navigate('CalorieEstimation')}
              accessibilityRole="button"
              accessibilityLabel="Add your information"
            >
              <Text style={[styles.editButtonText, { color: theme.accent }]}>Add Information</Text>
            </TouchableOpacity>
          </AppCard>
        )}

        <AppCard testID="nutrition-goals-custom-card" style={styles.customCard}>
          <Text style={styles.customTitle}>Custom Calorie Target</Text>
          <Text style={styles.customSubtitle}>Set your own daily calorie target.</Text>
          <View style={styles.customInputRow}>
            <TextInput
              testID="nutrition-goals-custom-input"
              style={styles.customInput}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={customInput}
              onChangeText={setCustomInput}
            />
            <Text style={styles.customInputUnit}>calories/day</Text>
          </View>
        </AppCard>

        {error ? (
          <Text testID="nutrition-goals-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
        {saved ? (
          <Text testID="nutrition-goals-saved" style={styles.errorText}>
            Saved
          </Text>
        ) : null}

        <TouchableOpacity
          testID="nutrition-goals-save"
          style={[
            styles.saveButton,
            { backgroundColor: theme.accent },
            !canSave && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          <Text style={[styles.saveButtonTitle, { color: theme.onAccent }]}>
            {saving
              ? 'Saving…'
              : parsedCustom !== null
                ? `Save ${parsedCustom.toLocaleString()} Calories`
                : 'Save Calories'}
          </Text>
          <Text style={[styles.saveButtonSubtitle, { color: withAlpha(theme.onAccent, 0.8) }]}>
            Set as my daily target
          </Text>
        </TouchableOpacity>

        <AppCard testID="nutrition-goals-notes" style={styles.notesCard}>
          <View style={styles.notesHeaderRow}>
            <Feather name="info" size={16} color={theme.accent} />
            <Text style={styles.notesTitle}>Important Notes</Text>
          </View>
          <Text style={styles.notesBullet}>
            • These are estimates and may vary based on your activity level and body composition.
          </Text>
          <Text style={styles.notesBullet}>• Adjust based on your progress and how you feel.</Text>
          <Text style={styles.notesBullet}>• You can always change your target later.</Text>
        </AppCard>
      </ScrollView>
    </View>
  );
}
