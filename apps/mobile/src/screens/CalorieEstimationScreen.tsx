import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { SegmentedControl } from '../design/SegmentedControl';
import { colors } from '../design/theme';
import type { Gender, HeightUnit } from '../lib/api';
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
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
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
  label: string;
  /** A hairline above the row -- every row but the first. */
  divider?: boolean;
  children?: ReactNode;
}

// One field: its label on the left and its control(s) on the right, separated
// from the next by a hairline. Local to this screen since nothing else needs
// it yet (see CLAUDE.md's no-premature-abstraction rule).
function FieldRow({ testID, label, divider, children }: FieldRowProps) {
  return (
    <View testID={testID} style={[styles.fieldRow, divider && styles.fieldDivider]}>
      <Text style={styles.fieldRowLabel} numberOfLines={1}>
        {label}
      </Text>
      {children ? <View style={styles.fieldRowControl}>{children}</View> : null}
    </View>
  );
}

// A value that opens its picker sheet: the current value, then a disclosure
// chevron, as one 44pt-tall target.
function ValueButton({
  testID,
  valueTestID,
  accessibilityLabel,
  value,
  onPress,
}: {
  testID: string;
  valueTestID: string;
  accessibilityLabel: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      style={styles.valueButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text testID={valueTestID} style={styles.valueText}>
        {value}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
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
//
// Layout: the shared Screen with two widgets `widgetGap` apart -- one row per
// field (label left, control right) separated by hairlines, then one filled
// Save.
export function CalorieEstimationScreen({ navigation }: Props) {
  const { openMenu } = useAppMenu();
  const { nutritionTheme: theme } = useProgressTheme();
  const { profile, loading, updateProfile } = useProfile();

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

  // Seeds the form from the shared profile cache exactly once, the first
  // time it resolves -- not on every later change to `profile` (e.g. this
  // screen's own Save below), which would fight the user's in-progress edits.
  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (!profile || hasSeededRef.current) return;
    hasSeededRef.current = true;
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
  }, [profile]);

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
    if (!gender || !activityLevel) return;
    setSaveError(null);
    setSaving(true);
    try {
      await updateProfile({
        gender,
        birthday: toDateStringUTC(birthdayMonth, birthdayDay, birthdayYear),
        heightValue: heightCm,
        heightUnit,
        weightValue: weightKg,
        weightUnit,
        activityLevel,
      });
      // Nutrition Goals reads these values reactively off the same shared
      // profile cache, so it recalculates automatically -- nothing more to
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
    <>
      <Screen
        keyboardAvoiding
        scrollTestID="calorie-estimation-scroll"
        contentContainerStyle={styles.content}
        header={
          <AppHeader
            title="Personal Information"
            subtitle="Used to calculate your personalized calorie targets on Nutrition Goals."
            leftAction={{
              icon: 'menu',
              onPress: () => openMenu(),
              accessibilityLabel: 'Open menu',
              testID: 'calorie-estimation-open-menu',
            }}
            testID="calorie-estimation-header"
          />
        }
      >
        <AppCard testID="calorie-estimation-fields">
          <FieldRow testID="calorie-estimation-gender-card" label="Gender">
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

          <FieldRow testID="calorie-estimation-birthday-card" label="Birthday" divider>
            <ValueButton
              testID="calorie-estimation-birthday-expand"
              valueTestID="calorie-estimation-birthday-value"
              accessibilityLabel="Edit birthday"
              value={formatMonthDayYear(new Date(birthdayYear, birthdayMonth, birthdayDay))}
              onPress={() => setBirthdaySheetOpen(true)}
            />
          </FieldRow>
          {submitted && errors.birthday ? (
            <Text testID="calorie-estimation-birthday-error" style={styles.fieldError}>
              {errors.birthday}
            </Text>
          ) : null}

          <FieldRow testID="calorie-estimation-height-card" label="Height" divider>
            <ValueButton
              testID="calorie-estimation-height-expand"
              valueTestID="calorie-estimation-height-value"
              accessibilityLabel="Edit height"
              value={formatHeight(heightCm, heightUnit)}
              onPress={() => setHeightSheetOpen(true)}
            />
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

          <FieldRow testID="calorie-estimation-weight-card" label="Weight" divider>
            <ValueButton
              testID="calorie-estimation-weight-expand"
              valueTestID="calorie-estimation-weight-value"
              accessibilityLabel="Edit weight"
              value={formatWeight(weightKg, weightUnit)}
              onPress={() => setWeightSheetOpen(true)}
            />
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

          <FieldRow testID="calorie-estimation-activity-card" label="Activity Level" divider>
            <Pressable
              testID="calorie-estimation-activity-summary"
              style={styles.valueButton}
              onPress={() => setActivitySheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Select activity level"
            >
              <Text style={styles.valueText} numberOfLines={1}>
                {selectedActivity ? selectedActivity.label : 'Select your activity level'}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          </FieldRow>
          {submitted && errors.activityLevel ? (
            <Text testID="calorie-estimation-activity-error" style={styles.fieldError}>
              {errors.activityLevel}
            </Text>
          ) : null}
        </AppCard>

        <AppCard testID="calorie-estimation-actions" style={styles.actions}>
          {saveError ? (
            <Text testID="calorie-estimation-save-error" style={styles.fieldError}>
              {saveError}
            </Text>
          ) : null}

          <PrimaryButton
            testID="calorie-estimation-save"
            label="Save"
            onPress={handleSave}
            loading={saving}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
          />

          <Text style={styles.footnote}>
            Used by Nutrition Goals to calculate your calorie targets, via the Mifflin-St Jeor
            equation.
          </Text>
        </AppCard>
      </Screen>

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
    </>
  );
}
