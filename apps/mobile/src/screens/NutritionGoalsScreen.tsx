import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { ChoiceTile } from '../design/ChoiceTile';
import { LoadingState } from '../design/LoadingState';
import { RiseIn } from '../design/RiseIn';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
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
  canSaveTargets,
  draftFromTargets,
  parseTargets,
  type TargetDraft,
} from '../nutrition/targetMath';
import { CalorieTargetField, MacroTargets } from '../nutrition/TargetsEditor';
import { feetAndInchesFromCm, kgToLb } from '../onboarding/weightHeightConversion';
import { useDailyTargets } from '../phases/PhaseProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { nutritionGoalsStyles as styles } from './nutritionGoalsStyles';

type Props = RootStackScreenProps<'NutritionGoals'>;

const SEX_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: '—',
};

const NO_TARGETS = { calories: null, proteinG: null, carbsG: null, fatG: null };

function formatHeight(heightCm: number, unit: 'cm' | 'ft_in'): string {
  if (unit === 'cm') return `${Math.round(heightCm)} cm`;
  const { feet, inches } = feetAndInchesFromCm(heightCm);
  return `${feet}' ${inches}"`;
}

function formatWeight(weightKg: number, unit: 'kg' | 'lb'): string {
  const value = unit === 'kg' ? weightKg : kgToLb(weightKg);
  return `${Math.round(value * 10) / 10} ${unit}`;
}

// The four estimates, from the most loss to gain, as a 2 x 2 grid of tiles.
const OPTIONS = [
  {
    key: 'aggressiveDeficit',
    testID: 'nutrition-goals-option-aggressive',
    title: 'Aggressive Loss',
    icon: 'chevrons-down',
  },
  {
    key: 'deficit',
    testID: 'nutrition-goals-option-deficit',
    title: 'Weight Loss',
    icon: 'chevron-down',
  },
  {
    key: 'maintenance',
    testID: 'nutrition-goals-option-maintenance',
    title: 'Maintenance',
    icon: 'minus',
  },
  {
    key: 'surplus',
    testID: 'nutrition-goals-option-surplus',
    title: 'Weight Gain',
    icon: 'chevron-up',
  },
] as const;

/** A numbered step's heading: the number in an accent-tinted circle, the title, one line under. */
function StepHeader({
  step,
  title,
  detail,
  accentColor,
  accentBg,
}: {
  step: number;
  title: string;
  detail: string;
  accentColor: string;
  accentBg: string;
}) {
  return (
    <View style={styles.stepHeader}>
      <View style={[styles.stepBadge, { backgroundColor: accentBg }]}>
        <Text style={[styles.stepNumber, { color: accentColor }]}>{step}</Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.stepDetail}>{detail}</Text>
      </View>
    </View>
  );
}

// Nutrition Goals (what Today's Edit Targets opens): the person's daily targets, set in three
// numbered steps with the guidance in plain sight rather than tucked beside a field.
//
// - Your Details (the hero): sex, age, height and weight as four tiles and the activity level,
//   with Edit -- CalorieEstimationScreen is the one place they're changed; this reads them from
//   the shared profile cache, so an edit there shows here at once.
// - 1, Choose your calories: the four Mifflin-St Jeor estimates (see nutrition/calorieTargets.ts)
//   as tiles; tapping one puts it in the Calories field under them, and the one matching the
//   field is shown chosen. The person can enter any number there.
// - 2, Your macros: protein 0.8 g and fat 0.3 g per lb of body weight, carbs the calories left
//   (nutrition/TargetsEditor.tsx's MacroTargets), each recommendation faded in its field.
// - 3, Save your targets: the four figures as Today shows them, and one filled Save Targets.
//
// A blank macro field is its recommendation -- what's shown faded is what's saved -- and any field
// can be typed over. A saved macro that is exactly its recommendation opens blank, so it keeps
// following the recommendation (a new weight or calorie target moves it) until the person types
// their own. A target is never changed by itself: nothing is saved until Save.
export function NutritionGoalsScreen({ navigation }: Props) {
  const { openMenu } = useAppMenu();
  const { nutritionTheme: theme } = useProgressTheme();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const { goals, loading: goalsLoading, error: goalsError, saveGoals } = useNutritionGoals();
  // An active phase with targets of its own is used in place of these while it's going.
  const { phaseName } = useDailyTargets();

  // What the person has typed; until they type, the fields are their saved targets.
  const [edited, setEdited] = useState<TargetDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const weightKg = profile?.weightValue ?? null;

  // The fields show the saved targets -- worked out on this render, so they're there the moment
  // the page is -- until the person types. From then on they're the person's: a goals refresh (a
  // save from here) never resets what they're typing.
  const draft =
    edited ??
    (goalsLoading || profileLoading
      ? null
      : draftFromTargets(goals ?? NO_TARGETS, weightKg, 'recommended'));

  function change(next: TargetDraft) {
    setSaved(false);
    setEdited(next);
  }

  async function handleSave() {
    if (!draft) return;
    const parsed = parseTargets(draft, weightKg, 'recommended');
    if (!canSaveTargets(parsed)) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await saveGoals(parsed.values);
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

  // A failed profile fetch is shown as an error (in step 3), not a stuck spinner -- the rest of
  // the page degrades to its "add your details" state (buildCalorieProfileInput returns null for
  // any field left null).
  const calorieInput = profile
    ? buildCalorieProfileInput({
        gender: profile.gender,
        birthday: profile.birthday,
        heightCm: profile.heightValue,
        weightKg: profile.weightValue,
        activityLevel: profile.activityLevel,
      })
    : null;
  const estimates: CalorieTargets | null = calorieInput
    ? computeCalorieTargets(calorieInput)
    : null;

  const age = profile?.birthday ? ageFromBirthday(profile.birthday) : null;
  const activityLabel = ACTIVITY_LEVELS.find((a) => a.value === profile?.activityLevel)?.label;
  const details = [
    { label: 'Sex', value: profile?.gender ? SEX_LABELS[profile.gender] : null },
    { label: 'Age', value: age !== null ? String(age) : null },
    {
      label: 'Height',
      value:
        profile?.heightValue != null ? formatHeight(profile.heightValue, profile.heightUnit) : null,
    },
    {
      label: 'Weight',
      value: weightKg !== null ? formatWeight(weightKg, profile?.weightUnit ?? 'lb') : null,
    },
  ];
  const anyDetails = details.some((detail) => detail.value !== null);

  const parsed = draft ? parseTargets(draft, weightKg, 'recommended') : null;
  const values = parsed?.values ?? NO_TARGETS;
  const canSave = parsed !== null && canSaveTargets(parsed) && !saving;
  const displayError = error ?? profileError ?? goalsError;
  const tileGrid = [OPTIONS.slice(0, 2), OPTIONS.slice(2)];

  return (
    <Screen
      scrollTestID="nutrition-goals-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title="Nutrition Goals"
          subtitle="Choose your calories; your macros follow from your weight."
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
        <View style={styles.infoHead}>
          <Text style={styles.infoTitle}>Your Details</Text>
          <TextButton
            testID="nutrition-goals-edit"
            label="Edit"
            accessibilityLabel="Edit personal information"
            onPress={() => navigation.navigate('CalorieEstimation')}
          />
        </View>
        {anyDetails ? (
          <View
            testID="nutrition-goals-summary"
            style={styles.detailGrid}
            accessible
            accessibilityLabel={details
              .map((detail) => `${detail.label} ${detail.value ?? 'not set'}`)
              .join(', ')}
          >
            {details.map((detail) => (
              <View key={detail.label} style={styles.detailTile}>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {detail.value ?? '—'}
                </Text>
                <Text style={styles.detailLabel}>{detail.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.infoIncomplete}>
            Add your sex, age, height and weight to get calorie estimates.
          </Text>
        )}
        {activityLabel ? (
          <View style={styles.activityRow}>
            <Feather name="activity" size={14} color={colors.textSecondary} />
            <Text testID="nutrition-goals-activity" style={styles.activityText}>
              {activityLabel}
            </Text>
          </View>
        ) : null}
      </AppCard>

      <AppCard testID="nutrition-goals-calories-card">
        <StepHeader
          step={1}
          title="Choose your calories"
          detail={
            estimates
              ? 'Estimated from your details. Tap one to use it.'
              : 'Your daily calorie target.'
          }
          accentColor={theme.accent}
          accentBg={theme.accentBg}
        />
        {estimates ? (
          <View testID="nutrition-goals-targets" style={styles.grid}>
            {tileGrid.map((pair) => (
              <View key={pair[0].key} style={styles.gridRow}>
                {pair.map((option) => {
                  const calories = estimates[option.key];
                  const delta = calories - estimates.maintenance;
                  const selected = values.calories === calories;
                  return (
                    <ChoiceTile
                      key={option.key}
                      testID={option.testID}
                      selected={selected}
                      onPress={() => draft && change({ ...draft, calories: String(calories) })}
                      accentColor={theme.accent}
                      onAccentColor={theme.onAccent}
                      accessibilityLabel={`${option.title}, ${calories.toLocaleString()} calories a day`}
                      style={styles.gridCell}
                    >
                      <Feather
                        name={option.icon}
                        size={16}
                        color={selected ? theme.accent : colors.textSecondary}
                      />
                      <Text style={styles.optionTitle}>{option.title}</Text>
                      <Text
                        testID={`${option.testID}-value`}
                        style={[styles.optionValue, selected && { color: theme.accent }]}
                      >
                        {calories.toLocaleString()}
                      </Text>
                      <Text style={styles.optionMeta}>
                        {option.key === 'maintenance'
                          ? 'Holds your weight'
                          : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} cal a day`}
                      </Text>
                    </ChoiceTile>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          <View testID="nutrition-goals-incomplete" style={styles.incomplete}>
            <Text style={styles.note}>
              Add your sex, age, height, weight and activity level, and four estimates are worked
              out for you here.
            </Text>
            <SecondaryButton
              testID="nutrition-goals-complete-profile"
              label="Add Your Details"
              accessibilityLabel="Add your information"
              onPress={() => navigation.navigate('CalorieEstimation')}
            />
          </View>
        )}
        {draft ? (
          <View style={styles.customField}>
            <CalorieTargetField draft={draft} onChange={change} testIDPrefix="nutrition-goals" />
          </View>
        ) : null}
        {estimates ? (
          <Text testID="nutrition-goals-estimate-note" style={styles.note}>
            Maintenance is worked out from your sex, age, height and weight (the Mifflin-St Jeor
            formula), times your activity. Weight loss is 300 below it, aggressive loss 500 below,
            and weight gain 300 above.
          </Text>
        ) : null}
      </AppCard>

      <AppCard testID="nutrition-goals-macros">
        <StepHeader
          step={2}
          title="Your macros"
          detail="Recommended from your weight and calories, each yours to change."
          accentColor={theme.accent}
          accentBg={theme.accentBg}
        />
        {draft ? (
          <MacroTargets
            draft={draft}
            onChange={change}
            weightKg={weightKg}
            weightUnit={profile?.weightUnit ?? 'lb'}
            blankMeans="recommended"
            accentColor={theme.accent}
            onAddWeight={() => navigation.navigate('CalorieEstimation')}
            testIDPrefix="nutrition-goals"
          />
        ) : null}
      </AppCard>

      <AppCard testID="nutrition-goals-save-card">
        <StepHeader
          step={3}
          title="Save your targets"
          detail="Today, This Week and Progress measure against these."
          accentColor={theme.accent}
          accentBg={theme.accentBg}
        />
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <StatBlock
              testID="nutrition-goals-summary-calories"
              value={values.calories !== null ? values.calories.toLocaleString() : '—'}
              label="Calories"
              valueColor={theme.accent}
            />
            <StatBlock
              testID="nutrition-goals-summary-protein"
              value={values.proteinG !== null ? `${Math.round(values.proteinG)} g` : '—'}
              label="Protein"
            />
          </View>
          <View style={styles.summaryRow}>
            <StatBlock
              testID="nutrition-goals-summary-carbs"
              value={values.carbsG !== null ? `${values.carbsG} g` : '—'}
              label="Carbs"
            />
            <StatBlock
              testID="nutrition-goals-summary-fat"
              value={values.fatG !== null ? `${Math.round(values.fatG)} g` : '—'}
              label="Fat"
            />
          </View>
        </View>

        {phaseName ? (
          <View testID="nutrition-goals-phase-note" style={styles.phaseNote}>
            <Text style={styles.note}>
              Your {phaseName} has targets of its own, used in place of these while it&apos;s going.
              These stay as they are and apply again when it ends.
            </Text>
            <TextButton
              testID="nutrition-goals-view-phase"
              label="View Phase"
              onPress={() => navigation.navigate('Phases')}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          {displayError ? (
            <Text testID="nutrition-goals-error" style={styles.errorText}>
              {displayError}
            </Text>
          ) : null}
          {saved ? (
            <RiseIn>
              <View testID="nutrition-goals-saved" style={styles.savedRow}>
                <Feather name="check-circle" size={16} color={theme.accent} />
                <Text style={styles.savedText}>Saved</Text>
              </View>
            </RiseIn>
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

      <AppCard testID="nutrition-goals-notes">
        <Section title="Important Notes">
          <Text style={styles.note}>
            • These are estimates and may vary with your activity and body composition.
          </Text>
          <Text style={styles.note}>• Adjust based on your progress and how you feel.</Text>
          <Text style={styles.note}>
            • Every target is yours: change protein or fat, or leave any blank, any time. Nothing
            changes them for you.
          </Text>
        </Section>
      </AppCard>
    </Screen>
  );
}
