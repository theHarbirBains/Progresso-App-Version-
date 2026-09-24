import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { IconButton } from '../design/IconButton';
import { LoadingState } from '../design/LoadingState';
import { PrimaryButton } from '../design/Button';
import { spacing } from '../design/theme';
import type {
  AppleHealthPreference,
  FitnessGoal,
  Gender,
  TrainingExperience,
  TrainingStylePreference,
  UpdateProfileInput,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { useProgressTheme } from '../progress/useProgressTheme';
import { toDateStringUTC } from '../onboarding/dateWheelValues';
import { DateWheelPicker } from '../onboarding/DateWheelPicker';
import { GoalSelector } from '../onboarding/GoalSelector';
import { HeightWheelPicker } from '../onboarding/HeightWheelPicker';
import {
  GENDER_OPTIONS,
  TRAINING_EXPERIENCE_OPTIONS,
  WORKOUT_FREQUENCY_OPTIONS,
} from '../onboarding/onboardingOptions';
import {
  computeStartStepIndex,
  STEP_ORDER,
  type OnboardingStep,
} from '../onboarding/onboardingSteps';
import { OnboardingOptionCard } from '../onboarding/OnboardingOptionCard';
import { OnboardingProgress } from '../onboarding/OnboardingProgress';
import { PermissionStep } from '../onboarding/PermissionStep';
import { WeightWheelPicker } from '../onboarding/WeightWheelPicker';
import { WorkoutPreferenceSelector } from '../onboarding/WorkoutPreferenceSelector';
import { WorkoutSplitPresetPicker } from '../workouts/WorkoutSplitPresetPicker';
import { onboardingStyles as styles } from './onboardingStyles';

type Props = RootStackScreenProps<'Onboarding'>;

// Steps whose selection is just local draft state, confirmed by the shared
// footer Continue button below. Steps not in this set (appleHealth,
// workoutSplit, pushNotifications, completion) have their own terminal
// controls (Connect/Not Now, a preset card, Start Training) and render no
// footer.
const GENERIC_CONTINUE_STEPS = new Set<OnboardingStep>([
  'gender',
  'birthday',
  'weight',
  'height',
  'fitnessGoal',
  'trainingExperience',
  'workoutFrequency',
  'trainingStyle',
  'emailPreference',
]);

// These three steps render a WheelPicker, which is itself a virtualized
// FlatList -- nesting that inside the outer vertical ScrollView triggers
// React Native's "VirtualizedLists should never be nested inside plain
// ScrollViews with the same orientation" warning (and its real windowing
// risks). Their content (title + one fixed-height wheel + footer) is
// compact and bounded by design, so these steps render in a plain View
// instead; every other step keeps the ScrollView since option lists can
// genuinely run long on a small device.
const WHEEL_PICKER_STEPS = new Set<OnboardingStep>(['birthday', 'weight', 'height']);

const DEFAULT_BIRTH_YEAR = new Date().getFullYear() - 25;

export function OnboardingScreen({ navigation }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { theme, activeWorkoutSplitId } = useProgressTheme();
  const { profile, loading: profileLoading, error: profileError, updateProfile } = useProfile();
  const insets = useSafeAreaInsets();

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gender, setGender] = useState<Gender | null>(null);
  const [birthdayMonth, setBirthdayMonth] = useState(0);
  const [birthdayDay, setBirthdayDay] = useState(1);
  const [birthdayYear, setBirthdayYear] = useState(DEFAULT_BIRTH_YEAR);
  const [weightKg, setWeightKg] = useState(70);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [heightCm, setHeightCm] = useState(170);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft_in'>('cm');
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal | null>(null);
  const [trainingExperience, setTrainingExperience] = useState<TrainingExperience | null>(null);
  const [workoutFrequencyDays, setWorkoutFrequencyDays] = useState<number | null>(null);
  const [trainingStylePreference, setTrainingStylePreference] =
    useState<TrainingStylePreference | null>(null);
  const [emailOptIn, setEmailOptIn] = useState<boolean | null>(null);

  const awaitingSplitCreationRef = useRef(false);
  // Seeds the local draft fields, and the step to resume at, from the
  // shared profile cache exactly once, the first time it resolves -- not on
  // every later change to `profile` (e.g. after this screen's own saves
  // below), which would otherwise fight the step-by-step local edits this
  // screen makes as the user answers each question.
  const hasSeededRef = useRef(false);

  useEffect(() => {
    if (!profile || hasSeededRef.current) return;
    hasSeededRef.current = true;
    setGender(profile.gender);
    if (profile.birthday) {
      const [y, m, d] = profile.birthday.split('-').map(Number);
      setBirthdayYear(y);
      setBirthdayMonth(m - 1);
      setBirthdayDay(d);
    }
    if (profile.weightValue != null) setWeightKg(profile.weightValue);
    setWeightUnit(profile.weightUnit);
    if (profile.heightValue != null) setHeightCm(profile.heightValue);
    setHeightUnit(profile.heightUnit);
    setFitnessGoal(profile.fitnessGoal);
    setTrainingExperience(profile.trainingExperience);
    setWorkoutFrequencyDays(profile.workoutFrequencyDays);
    setTrainingStylePreference(profile.trainingStylePreference);
    setEmailOptIn(profile.emailOptIn);
    setStepIndex(computeStartStepIndex(profile));
  }, [profile]);

  // Returning here from WorkoutSplitFormScreen (Create Your Own): that
  // screen's own save already went through the same shared updateProfile
  // below, so activeWorkoutSplitId above is already current by the time
  // this focus fires -- no fetch of its own needed.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!awaitingSplitCreationRef.current) return;
      awaitingSplitCreationRef.current = false;
      if (activeWorkoutSplitId) {
        goToStep(STEP_ORDER.indexOf('workoutSplit') + 1);
      }
    });
    return unsubscribe;
  }, [navigation, activeWorkoutSplitId]);

  function goToStep(index: number) {
    setStepIndex(Math.min(STEP_ORDER.length - 1, Math.max(0, index)));
  }

  function goBackStep() {
    goToStep(stepIndex - 1);
  }

  async function saveAndAdvance(updates: UpdateProfileInput) {
    setSaving(true);
    setError(null);
    try {
      await updateProfile(updates);
      goToStep(stepIndex + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleAppleHealthChoice(value: AppleHealthPreference) {
    await saveAndAdvance({ appleHealthPreference: value });
  }

  async function handlePushChoice(value: boolean) {
    await saveAndAdvance({ pushNotificationsOptIn: value });
  }

  async function handleSplitPresetActivated(splitId: string) {
    await updateProfile({ activeWorkoutSplitId: splitId });
    goToStep(stepIndex + 1);
  }

  function handleCreateOwnSplit() {
    awaitingSplitCreationRef.current = true;
    navigation.navigate('WorkoutSplitForm', { activateOnCreate: true });
  }

  async function handleStartTraining() {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ onboardingCompleted: true });
      navigation.reset({ index: 0, routes: [{ name: 'Feed' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
      setSaving(false);
    }
  }

  function canContinue(step: OnboardingStep): boolean {
    switch (step) {
      case 'gender':
        return gender !== null;
      case 'fitnessGoal':
        return fitnessGoal !== null;
      case 'trainingExperience':
        return trainingExperience !== null;
      case 'workoutFrequency':
        return workoutFrequencyDays !== null;
      case 'trainingStyle':
        return trainingStylePreference !== null;
      case 'emailPreference':
        return emailOptIn !== null;
      default:
        return true;
    }
  }

  function handleGenericContinue(step: OnboardingStep) {
    switch (step) {
      case 'gender':
        return saveAndAdvance({ gender: gender ?? undefined });
      case 'birthday':
        return saveAndAdvance({
          birthday: toDateStringUTC(birthdayMonth, birthdayDay, birthdayYear),
        });
      case 'weight':
        return saveAndAdvance({ weightValue: Math.round(weightKg * 100) / 100, weightUnit });
      case 'height':
        return saveAndAdvance({ heightValue: Math.round(heightCm * 10) / 10, heightUnit });
      case 'fitnessGoal':
        return saveAndAdvance({ fitnessGoal: fitnessGoal ?? undefined });
      case 'trainingExperience':
        return saveAndAdvance({ trainingExperience: trainingExperience ?? undefined });
      case 'workoutFrequency':
        return saveAndAdvance({ workoutFrequencyDays: workoutFrequencyDays ?? undefined });
      case 'trainingStyle':
        return saveAndAdvance({ trainingStylePreference: trainingStylePreference ?? undefined });
      case 'emailPreference':
        return saveAndAdvance({ emailOptIn: emailOptIn ?? undefined });
      default:
        return undefined;
    }
  }

  if (profileLoading) {
    return <LoadingState testID="onboarding-loading" />;
  }

  const displayError = error ?? profileError;
  const step = STEP_ORDER[stepIndex];

  if (step === 'completion') {
    return (
      <View
        testID="onboarding-step-completion"
        style={[
          styles.screen,
          { paddingTop: insets.top + spacing.xxl, paddingHorizontal: spacing.xxl },
        ]}
      >
        <View style={styles.completionContainer}>
          <Text style={styles.completionTitle}>You&apos;re all set.</Text>
          <Text style={styles.completionSubtitle}>Let&apos;s get to work.</Text>
          {displayError ? (
            <Text testID="onboarding-error" style={styles.errorText}>
              {displayError}
            </Text>
          ) : null}
          <PrimaryButton
            testID="onboarding-start-training"
            label={saving ? 'Starting...' : 'Start Training'}
            onPress={handleStartTraining}
            disabled={saving}
          />
        </View>
      </View>
    );
  }

  const isWheelStep = WHEEL_PICKER_STEPS.has(step);

  const content = (
    <>
      <View style={styles.header}>
        {stepIndex > 0 ? (
          <IconButton
            testID="onboarding-back"
            icon="arrow-left"
            onPress={goBackStep}
            accessibilityLabel="Back"
          />
        ) : null}
        <View style={styles.progress}>
          <OnboardingProgress
            testID="onboarding-progress"
            currentIndex={stepIndex}
            totalSteps={STEP_ORDER.length - 1}
          />
        </View>
      </View>

      {displayError ? (
        <Text testID="onboarding-error" style={styles.errorText}>
          {displayError}
        </Text>
      ) : null}

      <View style={styles.body}>
        {step === 'appleHealth' ? (
          <PermissionStep
            testID="onboarding-step-apple-health"
            icon="heart"
            title="Connect Apple Health"
            description="Sync activity and workouts with Apple Health. You can connect this later from Settings."
            connectLabel="Connect Apple Health"
            skipLabel="Not Now"
            onConnect={() => handleAppleHealthChoice('connected')}
            onSkip={() => handleAppleHealthChoice('not_now')}
          />
        ) : null}

        {step === 'gender' ? (
          <>
            <Text style={styles.stepTitle}>What is your gender?</Text>
            <View testID="onboarding-step-gender">
              {GENDER_OPTIONS.map((option) => (
                <OnboardingOptionCard
                  key={option.value}
                  testID={`onboarding-gender-${option.value}`}
                  label={option.label}
                  selected={gender === option.value}
                  onPress={() => setGender(option.value)}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 'birthday' ? (
          <>
            <Text style={styles.stepTitle}>When&apos;s your birthday?</Text>
            <View style={styles.wheelArea}>
              <DateWheelPicker
                testID="onboarding-step-birthday"
                month={birthdayMonth}
                day={birthdayDay}
                year={birthdayYear}
                onChange={({ month, day, year }) => {
                  setBirthdayMonth(month);
                  setBirthdayDay(day);
                  setBirthdayYear(year);
                }}
              />
            </View>
          </>
        ) : null}

        {step === 'weight' ? (
          <>
            <Text style={styles.stepTitle}>What&apos;s your weight?</Text>
            <View style={styles.wheelArea}>
              <WeightWheelPicker
                testID="onboarding-step-weight"
                unit={weightUnit}
                weightKg={weightKg}
                onChangeUnit={setWeightUnit}
                onChangeWeightKg={setWeightKg}
              />
            </View>
          </>
        ) : null}

        {step === 'height' ? (
          <>
            <Text style={styles.stepTitle}>What&apos;s your height?</Text>
            <View style={styles.wheelArea}>
              <HeightWheelPicker
                testID="onboarding-step-height"
                unit={heightUnit}
                heightCm={heightCm}
                onChangeUnit={setHeightUnit}
                onChangeHeightCm={setHeightCm}
              />
            </View>
          </>
        ) : null}

        {step === 'fitnessGoal' ? (
          <>
            <Text style={styles.stepTitle}>What is your main fitness goal?</Text>
            <GoalSelector
              testID="onboarding-step-fitness-goal"
              value={fitnessGoal}
              onChange={setFitnessGoal}
            />
          </>
        ) : null}

        {step === 'trainingExperience' ? (
          <>
            <Text style={styles.stepTitle}>What&apos;s your experience with training?</Text>
            <View testID="onboarding-step-training-experience">
              {TRAINING_EXPERIENCE_OPTIONS.map((option) => (
                <OnboardingOptionCard
                  key={option.value}
                  testID={`onboarding-experience-${option.value}`}
                  label={option.label}
                  selected={trainingExperience === option.value}
                  onPress={() => setTrainingExperience(option.value)}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 'workoutFrequency' ? (
          <>
            <Text style={styles.stepTitle}>How often do you usually want to train?</Text>
            <View testID="onboarding-step-workout-frequency">
              {WORKOUT_FREQUENCY_OPTIONS.map((option) => (
                <OnboardingOptionCard
                  key={option.value}
                  testID={`onboarding-frequency-${option.value}`}
                  label={option.label}
                  selected={workoutFrequencyDays === option.value}
                  onPress={() => setWorkoutFrequencyDays(option.value)}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 'trainingStyle' ? (
          <>
            <Text style={styles.stepTitle}>How would you like to train?</Text>
            <WorkoutPreferenceSelector
              testID="onboarding-step-training-style"
              value={trainingStylePreference}
              onChange={setTrainingStylePreference}
            />
          </>
        ) : null}

        {step === 'workoutSplit' ? (
          <>
            <Text style={styles.stepTitle}>Choose your workout split</Text>
            <WorkoutSplitPresetPicker
              testID="onboarding-step-workout-split"
              userId={userId}
              theme={theme}
              onPresetActivated={handleSplitPresetActivated}
              onCreateOwn={handleCreateOwnSplit}
            />
          </>
        ) : null}

        {step === 'emailPreference' ? (
          <>
            <Text style={styles.stepTitle}>Would you like to receive emails from Progresso?</Text>
            <View testID="onboarding-step-email-preference">
              <OnboardingOptionCard
                testID="onboarding-email-yes"
                label="Yes"
                selected={emailOptIn === true}
                onPress={() => setEmailOptIn(true)}
              />
              <OnboardingOptionCard
                testID="onboarding-email-no"
                label="No"
                selected={emailOptIn === false}
                onPress={() => setEmailOptIn(false)}
              />
            </View>
          </>
        ) : null}

        {step === 'pushNotifications' ? (
          <PermissionStep
            testID="onboarding-step-push-notifications"
            icon="bell"
            title="Stay in the loop"
            description="Would you like Progresso to send you notifications? You can change this later from Settings."
            connectLabel="Allow"
            skipLabel="Not Now"
            onConnect={() => handlePushChoice(true)}
            onSkip={() => handlePushChoice(false)}
          />
        ) : null}
      </View>

      {GENERIC_CONTINUE_STEPS.has(step) ? (
        <View style={styles.footer}>
          <PrimaryButton
            testID="onboarding-continue"
            label={saving ? 'Saving...' : 'Continue'}
            onPress={() => handleGenericContinue(step)}
            disabled={!canContinue(step) || saving}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {isWheelStep ? (
        <View style={styles.scrollContent}>{content}</View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="onboarding-scroll"
        >
          {content}
        </ScrollView>
      )}
    </View>
  );
}
