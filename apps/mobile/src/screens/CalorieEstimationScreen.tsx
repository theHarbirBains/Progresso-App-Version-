import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { LoadingState } from '../design/LoadingState';
import { SegmentedControl } from '../design/SegmentedControl';
import { colors, spacing } from '../design/theme';
import { getMyProfile, updateMyProfile, type Gender, type HeightUnit } from '../lib/api';
import { useAppMenu } from '../navigation/AppMenuContext';
import type { RootStackScreenProps } from '../navigation/types';
import {
  ACTIVITY_LEVELS,
  ageFromBirthday,
  MAX_AGE,
  MIN_AGE,
  type ActivityLevel,
} from '../nutrition/calorieEstimationInput';
import { DateWheelPicker } from '../onboarding/DateWheelPicker';
import { formatMonthDayYear, toDateStringUTC } from '../onboarding/dateWheelValues';
import { HeightWheelPicker } from '../onboarding/HeightWheelPicker';
import { OnboardingOptionCard } from '../onboarding/OnboardingOptionCard';
import { WeightWheelPicker } from '../onboarding/WeightWheelPicker';
import { feetAndInchesFromCm, kgToLb } from '../onboarding/weightHeightConversion';
import { buildAccentTheme, DEFAULT_NUTRITION_THEME, type AccentTheme } from '../theme/accentColor';
import { calorieEstimationStyles as styles } from './calorieEstimationStyles';

type Props = RootStackScreenProps<'CalorieEstimation'>;

const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 70;
const DEFAULT_BIRTH_YEAR = new Date().getFullYear() - 25;

interface FormErrors {
  gender?: string;
  birthday?: string;
  activityLevel?: string;
}

function toFormGender(gender: Gender | null): 'male' | 'female' | null {
  return gender === 'male' || gender === 'female' ? gender : null;
}

function formatHeight(heightCm: number, unit: HeightUnit): string {
  if (unit === 'cm') return `${Math.round(heightCm)} cm`;
  const { feet, inches } = feetAndInchesFromCm(heightCm);
  return `${feet}' ${inches}"`;
}

function formatWeight(weightKg: number, unit: 'kg' | 'lb'): string {
  const value = unit === 'kg' ? weightKg : kgToLb(weightKg);
  return `${Math.round(value * 10) / 10} ${unit}`;
}

interface FieldRowProps {
  testID?: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  accentColor: string;
  children?: ReactNode;
}

// One compact "icon + label + inline control" row, the shape every field on
// this screen shares -- local to this screen since nothing else needs it yet
// (see CLAUDE.md's no-premature-abstraction rule).
function FieldRow({ testID, icon, label, accentColor, children }: FieldRowProps) {
  return (
    <View testID={testID} style={styles.fieldRow}>
      <View style={styles.fieldIconWrap}>
        <Feather name={icon} size={18} color={accentColor} />
      </View>
      <View style={styles.fieldRowBody}>
        <Text style={styles.fieldRowLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {children ? <View style={styles.fieldRowControl}>{children}</View> : null}
    </View>
  );
}

// The authoritative place to collect/edit the personal information Nutrition
// Goals' Mifflin-St Jeor calorie estimate needs -- gender, birthday, height,
// weight, activity level. This is the ONE source for each of those fields
// (see NutritionGoalsScreen's own "Based on your information" card + Edit
// button, which routes here rather than duplicating this form). Every field
// prefills from the profile's existing onboarding answers where present;
// activity level has no onboarding counterpart (workoutFrequencyDays is a
// workout-split concept, not this formula's activity multiplier) and always
// starts unselected until the user has set one.
//
// Height, Weight, and Activity Level each show a compact summary here and
// only mount their real picker (HeightWheelPicker/WeightWheelPicker/the
// activity option list) inside a BottomSheet once tapped open -- both because
// that's a closer match to this screen's compact-card reference, and because
// it keeps the wheel pickers' underlying FlatList out of this screen's own
// ScrollView (nesting a virtualized list inside a same-orientation ScrollView
// is a real RN warning/windowing bug; BottomSheet's Modal is a separate render
// tree, so it never nests inside this page's ScrollView at all). Birthday
// follows the exact same compact-summary + BottomSheet shape, reusing
// onboarding's own DateWheelPicker rather than a free-text age field --
// birthday (not a separately-stored age) is the one persisted value, same as
// every other screen that shows an age derived from it.
export function CalorieEstimationScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const insets = useSafeAreaInsets();
  const { openMenu } = useAppMenu();

  const [theme, setTheme] = useState<AccentTheme>(DEFAULT_NUTRITION_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [birthdayMonth, setBirthdayMonth] = useState(0);
  const [birthdayDay, setBirthdayDay] = useState(1);
  const [birthdayYear, setBirthdayYear] = useState(DEFAULT_BIRTH_YEAR);
  const [heightCm, setHeightCm] = useState(DEFAULT_HEIGHT_CM);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weightKg, setWeightKg] = useState(DEFAULT_WEIGHT_KG);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [birthdaySheetOpen, setBirthdaySheetOpen] = useState(false);
  const [heightSheetOpen, setHeightSheetOpen] = useState(false);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      try {
        const profile = await getMyProfile(accessToken);
        if (!mounted) return;
        setTheme(
          profile.nutritionAccentColor
            ? buildAccentTheme(profile.nutritionAccentColor)
            : DEFAULT_NUTRITION_THEME,
        );
        setGender(toFormGender(profile.gender));
        if (profile.birthday) {
          const [y, m, d] = profile.birthday.split('-').map(Number);
          setBirthdayYear(y);
          setBirthdayMonth(m - 1);
          setBirthdayDay(d);
        }
        if (profile.heightValue !== null) setHeightCm(profile.heightValue);
        setHeightUnit(profile.heightUnit);
        if (profile.weightValue !== null) setWeightKg(profile.weightValue);
        setWeightUnit(profile.weightUnit);
        setActivityLevel(profile.activityLevel);
      } catch {
        // Keep the defaults -- non-fatal, the user can still fill in the form.
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const age = ageFromBirthday(toDateStringUTC(birthdayMonth, birthdayDay, birthdayYear));
  const errors: FormErrors = {};
  if (gender === null) errors.gender = 'Select a gender';
  if (age === null || age < MIN_AGE || age > MAX_AGE) {
    errors.birthday = `Age must be between ${MIN_AGE} and ${MAX_AGE}`;
  }
  if (activityLevel === null) errors.activityLevel = 'Select an activity level';
  const selectedActivity = ACTIVITY_LEVELS.find((option) => option.value === activityLevel);

  async function handleSave() {
    if (Object.keys(errors).length > 0) {
      setSubmitted(true);
      return;
    }
    if (!accessToken || !gender || !activityLevel) return;
    setSaveError(null);
    setSaving(true);
    try {
      await updateMyProfile(accessToken, {
        gender,
        birthday: toDateStringUTC(birthdayMonth, birthdayDay, birthdayYear),
        heightValue: heightCm,
        heightUnit,
        weightValue: weightKg,
        weightUnit,
        activityLevel,
      });
      // Nutrition Goals re-fetches the profile on focus, so it picks up
      // these new values and recalculates automatically -- nothing more to
      // pass back through navigation.
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState testID="calorie-estimation-loading" />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <AppHeader
        title="Personal Information"
        leftAction={{
          icon: 'menu',
          onPress: () => openMenu('nutrition'),
          accessibilityLabel: 'Open menu',
          testID: 'calorie-estimation-open-menu',
        }}
        testID="calorie-estimation-header"
        safeArea={false}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="calorie-estimation-scroll"
      >
        <Text style={styles.intro}>
          Used to calculate your personalized calorie targets on Nutrition Goals.
        </Text>

        <AppCard testID="calorie-estimation-gender-card" style={styles.fieldCard}>
          <FieldRow icon="users" label="Gender" accentColor={theme.accent}>
            <SegmentedControl
              testID="calorie-estimation-gender"
              options={[
                { label: 'Male', value: 'male' },
                { label: 'Female', value: 'female' },
              ]}
              value={gender}
              onChange={setGender}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </FieldRow>
          {submitted && errors.gender ? (
            <Text testID="calorie-estimation-gender-error" style={styles.fieldError}>
              {errors.gender}
            </Text>
          ) : null}
        </AppCard>

        <AppCard testID="calorie-estimation-birthday-card" style={styles.fieldCard}>
          <FieldRow icon="calendar" label="Birthday" accentColor={theme.accent}>
            <Pressable
              testID="calorie-estimation-birthday-expand"
              style={styles.compactValueButton}
              onPress={() => setBirthdaySheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit birthday"
            >
              <Text testID="calorie-estimation-birthday-value" style={styles.compactValueText}>
                {formatMonthDayYear(new Date(birthdayYear, birthdayMonth, birthdayDay))}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>
          </FieldRow>
          {submitted && errors.birthday ? (
            <Text testID="calorie-estimation-birthday-error" style={styles.fieldError}>
              {errors.birthday}
            </Text>
          ) : null}
        </AppCard>

        <AppCard testID="calorie-estimation-height-card" style={styles.fieldCard}>
          <FieldRow icon="maximize-2" label="Height" accentColor={theme.accent}>
            <Pressable
              testID="calorie-estimation-height-expand"
              style={styles.compactValueButton}
              onPress={() => setHeightSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit height"
            >
              <Text testID="calorie-estimation-height-value" style={styles.compactValueText}>
                {formatHeight(heightCm, heightUnit)}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>
            <SegmentedControl
              testID="calorie-estimation-height-unit"
              options={[
                { label: 'ft/in', value: 'ft_in' as const },
                { label: 'cm', value: 'cm' as const },
              ]}
              value={heightUnit}
              onChange={setHeightUnit}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </FieldRow>
        </AppCard>

        <AppCard testID="calorie-estimation-weight-card" style={styles.fieldCard}>
          <FieldRow icon="disc" label="Weight" accentColor={theme.accent}>
            <Pressable
              testID="calorie-estimation-weight-expand"
              style={styles.compactValueButton}
              onPress={() => setWeightSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit weight"
            >
              <Text testID="calorie-estimation-weight-value" style={styles.compactValueText}>
                {formatWeight(weightKg, weightUnit)}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>
            <SegmentedControl
              testID="calorie-estimation-weight-unit"
              options={[
                { label: 'lb', value: 'lb' as const },
                { label: 'kg', value: 'kg' as const },
              ]}
              value={weightUnit}
              onChange={setWeightUnit}
              accentColor={theme.accent}
              onAccentColor={theme.onAccent}
            />
          </FieldRow>
        </AppCard>

        <AppCard testID="calorie-estimation-activity-card" style={styles.fieldCard}>
          <FieldRow icon="activity" label="Activity Level" accentColor={theme.accent} />
          <Pressable
            testID="calorie-estimation-activity-summary"
            style={styles.activitySummaryRow}
            onPress={() => setActivitySheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Select activity level"
          >
            <View style={styles.activitySummaryIconWrap}>
              <Feather name="activity" size={16} color={theme.accent} />
            </View>
            <View style={styles.activitySummaryBody}>
              <Text style={styles.activitySummaryLabel} numberOfLines={1}>
                {selectedActivity ? selectedActivity.label : 'Select your activity level'}
              </Text>
            </View>
            <Feather name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
          {submitted && errors.activityLevel ? (
            <Text testID="calorie-estimation-activity-error" style={styles.fieldError}>
              {errors.activityLevel}
            </Text>
          ) : null}
        </AppCard>

        <View style={styles.sectionSpacer} />

        {saveError ? (
          <Text testID="calorie-estimation-save-error" style={styles.fieldError}>
            {saveError}
          </Text>
        ) : null}

        <PrimaryButton
          testID="calorie-estimation-save"
          label={saving ? 'Saving…' : 'Save'}
          onPress={handleSave}
          disabled={saving}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />

        <Text style={styles.footnote}>
          Used by Nutrition Goals to calculate your calorie targets, via the Mifflin-St Jeor
          equation.
        </Text>
      </ScrollView>

      <BottomSheet
        visible={birthdaySheetOpen}
        onClose={() => setBirthdaySheetOpen(false)}
        testID="calorie-estimation-birthday-sheet"
      >
        <Text style={styles.sheetTitle}>Birthday</Text>
        <DateWheelPicker
          testID="calorie-estimation-birthday"
          month={birthdayMonth}
          day={birthdayDay}
          year={birthdayYear}
          onChange={({ month, day, year }) => {
            setBirthdayMonth(month);
            setBirthdayDay(day);
            setBirthdayYear(year);
          }}
        />
        <View style={styles.sheetDoneButton}>
          <PrimaryButton
            testID="calorie-estimation-birthday-done"
            label="Done"
            onPress={() => setBirthdaySheetOpen(false)}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={heightSheetOpen}
        onClose={() => setHeightSheetOpen(false)}
        testID="calorie-estimation-height-sheet"
      >
        <Text style={styles.sheetTitle}>Height</Text>
        <HeightWheelPicker
          testID="calorie-estimation-height"
          unit={heightUnit}
          heightCm={heightCm}
          onChangeUnit={setHeightUnit}
          onChangeHeightCm={setHeightCm}
        />
        <View style={styles.sheetDoneButton}>
          <PrimaryButton
            testID="calorie-estimation-height-done"
            label="Done"
            onPress={() => setHeightSheetOpen(false)}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={weightSheetOpen}
        onClose={() => setWeightSheetOpen(false)}
        testID="calorie-estimation-weight-sheet"
      >
        <Text style={styles.sheetTitle}>Weight</Text>
        <WeightWheelPicker
          testID="calorie-estimation-weight"
          unit={weightUnit}
          weightKg={weightKg}
          onChangeUnit={setWeightUnit}
          onChangeWeightKg={setWeightKg}
        />
        <View style={styles.sheetDoneButton}>
          <PrimaryButton
            testID="calorie-estimation-weight-done"
            label="Done"
            onPress={() => setWeightSheetOpen(false)}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={activitySheetOpen}
        onClose={() => setActivitySheetOpen(false)}
        testID="calorie-estimation-activity-sheet"
      >
        <Text style={styles.sheetTitle}>Activity Level</Text>
        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {ACTIVITY_LEVELS.map((option) => (
            <OnboardingOptionCard
              key={option.value}
              testID={`calorie-estimation-activity-${option.value}`}
              label={option.label}
              description={option.description}
              selected={activityLevel === option.value}
              onPress={() => {
                setActivityLevel(option.value);
                setActivitySheetOpen(false);
              }}
              accentColor={theme.accent}
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}
