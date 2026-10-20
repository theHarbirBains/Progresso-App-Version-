import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import { ACTIVITY_LEVELS, ageFromBirthday } from '../nutrition/calorieEstimationInput';
import {
  buildCalorieProfileInput,
  computeCalorieTargets,
  type CalorieTargets,
} from '../nutrition/calorieTargets';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import {
  draftFromTargets,
  editDraft,
  parseTargets,
  type TargetDraft,
} from '../nutrition/targetMath';
import { TargetsEditor } from '../nutrition/TargetsEditor';
import { feetAndInchesFromCm, kgToLb } from '../onboarding/weightHeightConversion';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
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

// The reference-image Nutrition Goals screen: real, profile-derived calorie
// estimates (Mifflin-St Jeor, see nutrition/calorieTargets.ts) and the
// person's own four daily targets (nutrition_goals -- the same row Nutrition
// Today reads). Personal data (gender/birthday/height/weight/activity level)
// is never edited here -- CalorieEstimationScreen is the one place that
// happens; "Edit" just navigates there, and this screen reads personal info
// from the shared profile cache, so an edit there shows here at once. The
// saved goals come from the shared NutritionGoalsProvider cache too, so a
// save here is reflected on Today with no re-fetch of its own.
//
// Nothing here is fixed or filled in behind the person's back: an estimate is
// only taken with its Use button, the protein/fat/carb suggestions live in
// TargetsEditor beside the fields, and saved targets never change unless the
// person saves new ones -- a new weight changes the suggestions, never the
// targets.
//
// Layout: a plain summary line with Edit, then Your Daily Targets right
// under it -- what Today's Edit Targets opens for, so the fields come first:
// the four fields with their suggestions and one filled Save -- then the four
// estimates as rows (name, how they differ from maintenance, the calories as
// a mono readout and a Use action that fills the calorie field), then the
// notes.
export function NutritionGoalsScreen({ navigation }: Props) {
  const { openMenu } = useAppMenu();
  const { nutritionTheme: theme } = useProgressTheme();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const { goals, loading: goalsLoading, error: goalsError, saveGoals } = useNutritionGoals();

  const [draft, setDraft] = useState<TargetDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The saved targets fill the fields once, when they first arrive. After that the fields are
  // the person's: a goals refresh (a save from here) never resets what they're typing.
  useEffect(() => {
    if (goals && draft === null) setDraft(draftFromTargets(goals));
  }, [goals, draft]);

  function change(next: TargetDraft) {
    setSaved(false);
    setDraft(next);
  }

  async function handleSave() {
    if (!draft) return;
    const { values, errors } = parseTargets(draft);
    if (Object.keys(errors).length > 0) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await saveGoals(values);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your daily targets');
    } finally {
      setSaving(false);
    }
  }

  if (profileLoading || goalsLoading) {
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

  const parsed = draft ? parseTargets(draft) : null;
  const canSave = parsed !== null && Object.keys(parsed.errors).length === 0 && !saving;
  const displayError = error ?? profileError ?? goalsError;

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

      <AppCard testID="nutrition-goals-custom-card">
        <Section title="Your Daily Targets">
          {draft ? (
            <TargetsEditor
              draft={draft}
              onChange={change}
              weightKg={profile?.weightValue ?? null}
              weightUnit={profile?.weightUnit ?? 'lb'}
              testIDPrefix="nutrition-goals"
            />
          ) : null}
        </Section>

        <View style={styles.actions}>
          {displayError ? (
            <Text testID="nutrition-goals-error" style={styles.errorText}>
              {displayError}
            </Text>
          ) : null}
          {saved ? (
            <Text testID="nutrition-goals-saved" style={styles.savedText}>
              Saved
            </Text>
          ) : null}
          <PrimaryButton
            testID="nutrition-goals-save"
            label="Save Targets"
            onPress={handleSave}
            loading={saving}
            disabled={!canSave && !saving}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
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
                  <TextButton
                    testID={`${option.testID}-use`}
                    label="Use"
                    accessibilityLabel={`Use ${calories.toLocaleString()} calories as your daily target`}
                    onPress={() => draft && change(editDraft(draft, 'calories', String(calories)))}
                  />
                </View>
              );
            })}
            <Text testID="nutrition-goals-estimate-note" style={styles.note}>
              Maintenance is estimated from your sex, age, height and weight (the Mifflin-St Jeor
              formula), times your activity level. Weight loss is 300 calories below it, aggressive
              loss 500 below, and weight gain 300 above.
            </Text>
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

      <AppCard testID="nutrition-goals-notes">
        <Section title="Important Notes">
          <Text style={styles.note}>
            • These are estimates and may vary based on your activity level and body composition.
          </Text>
          <Text style={styles.note}>• Adjust based on your progress and how you feel.</Text>
          <Text style={styles.note}>
            • Every target is yours: leave any blank, and change them any time. Nothing changes them
            for you.
          </Text>
        </Section>
      </AppCard>
    </Screen>
  );
}
