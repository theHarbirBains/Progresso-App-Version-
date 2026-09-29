import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { IconButton } from '../design/IconButton';
import { LoadingState } from '../design/LoadingState';
import { PrimaryButton, TextButton } from '../design/Button';
import { CountryStep } from '../onboarding/CountryStep';
import {
  CreateAccountStep,
  type CreateAccountFields,
  type GoogleSignUpFields,
} from '../onboarding/CreateAccountStep';
import { toDateStringUTC } from '../onboarding/dateWheelValues';
import { DateWheelPicker } from '../onboarding/DateWheelPicker';
import { GoalSelector } from '../onboarding/GoalSelector';
import { HeightWheelPicker } from '../onboarding/HeightWheelPicker';
import {
  AVERAGE_WORKOUT_LENGTH_OPTIONS,
  GENDER_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
  TRAINING_EXPERIENCE_OPTIONS,
  WORKOUT_FREQUENCY_OPTIONS,
} from '../onboarding/onboardingOptions';
import {
  computeStartStepIndex,
  EMPTY_DRAFT,
  isStepAnswered,
  STEP_ORDER,
  submitOnboardingDraft,
  type OnboardingDraft,
  type OnboardingStep,
} from '../onboarding/onboardingDraft';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '../onboarding/onboardingDraftStorage';
import { OnboardingOptionCard } from '../onboarding/OnboardingOptionCard';
import { OnboardingProgress } from '../onboarding/OnboardingProgress';
import { PermissionStep } from '../onboarding/PermissionStep';
import { WeightWheelPicker } from '../onboarding/WeightWheelPicker';
import { WorkoutPreferenceSelector } from '../onboarding/WorkoutPreferenceSelector';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { WorkoutSplitPresetPicker } from '../workouts/WorkoutSplitPresetPicker';
import { onboardingStyles as styles } from './onboardingStyles';

interface Props {
  onSwitchToSignIn: () => void;
}

// Steps whose selection is just local draft state, confirmed by the shared
// footer Continue button below. Steps not in this set have their own
// terminal controls (Connect/Not Now, a preset card, the Create Account
// button) and render no footer.
const GENERIC_CONTINUE_STEPS = new Set<OnboardingStep>([
  'referralSource',
  'country',
  'gender',
  'birthday',
  'weight',
  'height',
  'fitnessGoal',
  'trainingExperience',
  'workoutFrequency',
  'averageWorkoutLength',
  'trainingStyle',
  'emailPreference',
]);

// These steps each render either a WheelPicker or a FlatList (country's own
// search results), both virtualized -- nesting either inside the outer
// vertical ScrollView triggers React Native's "VirtualizedLists should
// never be nested inside plain ScrollViews with the same orientation"
// warning (and its real windowing cost). Every other step keeps the
// ScrollView since option lists can genuinely run long on a small device.
const NO_OUTER_SCROLL_STEPS = new Set<OnboardingStep>(['country', 'birthday', 'weight', 'height']);

const DEFAULT_BIRTH_YEAR = new Date().getFullYear() - 25;

// Onboarding runs entirely pre-auth now -- account creation is the LAST
// step (see onboarding/onboardingDraft.ts's own header comment for the
// full reasoning), so every answer lives in local draft state until
// CreateAccountStep's own submit, which is the one point this screen
// touches the network for real profile data. A local on-device draft (see
// onboardingDraftStorage) is what makes this resumable across an app kill,
// the same guarantee the old profile-backed flow had.
export function OnboardingScreen({ onSwitchToSignIn }: Props) {
  const { signUpWithPassword, signInWithProvider } = useAuth();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [restoringDraft, setRestoringDraft] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');

  const [birthdayMonth, setBirthdayMonth] = useState(0);
  const [birthdayDay, setBirthdayDay] = useState(1);
  const [birthdayYear, setBirthdayYear] = useState(DEFAULT_BIRTH_YEAR);

  // Set once signUpWithPassword has actually created the auth account, so a
  // retry after a later failure (e.g. the profile PATCH itself fails)
  // re-attempts only that PATCH -- calling signUp a second time for the
  // same email would just fail with "already exists".
  const accountCreatedRef = useRef(false);
  const credsRef = useRef<{ accessToken: string; userId: string } | null>(null);

  // Restores a draft left on disk by a previous, killed-mid-flow session --
  // once, on mount. Nothing renders until this resolves, so the user never
  // sees a flash of step 0 before landing back where they left off.
  useEffect(() => {
    let mounted = true;
    loadOnboardingDraft().then((stored) => {
      if (!mounted) return;
      if (stored) {
        setDraft(stored.draft);
        if (stored.draft.birthday) {
          const [y, m, d] = stored.draft.birthday.split('-').map(Number);
          setBirthdayYear(y);
          setBirthdayMonth(m - 1);
          setBirthdayDay(d);
        }
        setStepIndex(computeStartStepIndex(stored.draft));
      }
      setRestoringDraft(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persists on every change, not just on step advance -- a selection on
  // the current step (before Continue is pressed) is still worth saving,
  // and this is cheap (a small JSON blob, AsyncStorage).
  useEffect(() => {
    if (restoringDraft) return;
    void saveOnboardingDraft(draft, stepIndex);
  }, [draft, stepIndex, restoringDraft]);

  function updateDraft(patch: Partial<OnboardingDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function goToStep(index: number) {
    setStepIndex(Math.min(STEP_ORDER.length - 1, Math.max(0, index)));
  }

  function goBackStep() {
    goToStep(stepIndex - 1);
  }

  function advance() {
    goToStep(stepIndex + 1);
  }

  function canContinue(step: OnboardingStep): boolean {
    return isStepAnswered(step, draft);
  }

  async function handleCreateAccount(fields: CreateAccountFields) {
    setSaving(true);
    setError(null);
    // Written into the draft (not just kept as this function's own local
    // fields) so it survives the email-confirmation gap below -- see
    // OnboardingDraft's own comment on pendingUsername/pendingDisplayName.
    updateDraft({ pendingUsername: fields.username, pendingDisplayName: fields.displayName });

    try {
      if (!accountCreatedRef.current) {
        const result = await signUpWithPassword(fields.email, fields.password);
        if (result.error) {
          setError(result.error);
          setSaving(false);
          return;
        }
        accountCreatedRef.current = true;

        if (result.requiresEmailConfirmation) {
          // No session yet -- the draft (already on disk, now including
          // pendingUsername/pendingDisplayName) stays there; App.tsx's Root
          // finishes this the moment a real session appears, once the user
          // confirms and signs in.
          setConfirmationEmail(fields.email);
          setConfirmationSent(true);
          setSaving(false);
          return;
        }
        if (result.accessToken && result.userId) {
          credsRef.current = { accessToken: result.accessToken, userId: result.userId };
        }
      }

      if (!credsRef.current) {
        throw new Error('Missing session after account creation.');
      }
      await submitOnboardingDraft(
        credsRef.current.accessToken,
        credsRef.current.userId,
        // draft's own state update above hasn't necessarily flushed into
        // this closure yet -- pass the fields through explicitly via a
        // fresh merge instead of relying on the next render's `draft`.
        { ...draft, pendingUsername: fields.username, pendingDisplayName: fields.displayName },
      );
      await clearOnboardingDraft();
      // No explicit navigation: signUpWithPassword already established the
      // session above, so AuthProvider's status flips to 'signedIn'
      // shortly after (via its own onAuthStateChange listener), and
      // App.tsx's Root swaps this whole screen for the real, signed-in app
      // on its own.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finish creating your account');
      setSaving(false);
    }
  }

  // Google replaces typing an email/password, nothing else: Display
  // Name/Username still come from this same step (Google's own profile
  // doesn't supply a Progresso username). Unlike signUpWithPassword, OAuth
  // establishes the session itself, so there's no separate "create the
  // account" call here -- just persist the draft (now including
  // pendingUsername/pendingDisplayName) and start the OAuth flow. App.tsx's
  // Root already submits a pending draft the moment a signed-in session
  // with no completed onboarding appears (see its own effect) -- the exact
  // same mechanism handleCreateAccount's requiresEmailConfirmation branch
  // relies on above, reused here rather than duplicated.
  async function handleGoogleSignUp(fields: GoogleSignUpFields) {
    setGoogleSubmitting(true);
    setError(null);
    const nextDraft: OnboardingDraft = {
      ...draft,
      pendingUsername: fields.username,
      pendingDisplayName: fields.displayName,
    };
    updateDraft({ pendingUsername: fields.username, pendingDisplayName: fields.displayName });
    await saveOnboardingDraft(nextDraft, stepIndex);

    const errorMessage = await signInWithProvider('google');
    if (errorMessage) {
      setError(errorMessage);
      setGoogleSubmitting(false);
    }
  }

  if (restoringDraft) {
    return <LoadingState testID="onboarding-loading" />;
  }

  const step = STEP_ORDER[stepIndex];
  const isNoScrollStep = NO_OUTER_SCROLL_STEPS.has(step);

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
            totalSteps={STEP_ORDER.length}
          />
        </View>
      </View>

      {error ? (
        <Text testID="onboarding-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <View style={styles.body}>
        {step === 'referralSource' ? (
          <>
            <Text style={styles.stepTitle}>Where did you hear about us?</Text>
            <View testID="onboarding-step-referral-source">
              {REFERRAL_SOURCE_OPTIONS.map((option) => (
                <OnboardingOptionCard
                  key={option.value}
                  testID={`onboarding-referral-source-${option.value}`}
                  label={option.label}
                  selected={draft.referralSource === option.value}
                  onPress={() => updateDraft({ referralSource: option.value })}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 'country' ? (
          <>
            <Text style={styles.stepTitle}>Where are you from?</Text>
            <CountryStep
              testID="onboarding-step-country"
              value={draft.country}
              onChange={(code) => updateDraft({ country: code })}
            />
          </>
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
                  selected={draft.gender === option.value}
                  onPress={() => updateDraft({ gender: option.value })}
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
                  updateDraft({ birthday: toDateStringUTC(month, day, year) });
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
                unit={draft.weightUnit}
                weightKg={draft.weightValue ?? 70}
                onChangeUnit={(weightUnit) => updateDraft({ weightUnit })}
                onChangeWeightKg={(weightValue) => updateDraft({ weightValue })}
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
                unit={draft.heightUnit}
                heightCm={draft.heightValue ?? 170}
                onChangeUnit={(heightUnit) => updateDraft({ heightUnit })}
                onChangeHeightCm={(heightValue) => updateDraft({ heightValue })}
              />
            </View>
          </>
        ) : null}

        {step === 'fitnessGoal' ? (
          <>
            <Text style={styles.stepTitle}>What is your main fitness goal?</Text>
            <GoalSelector
              testID="onboarding-step-fitness-goal"
              value={draft.fitnessGoal}
              onChange={(fitnessGoal) => updateDraft({ fitnessGoal })}
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
                  selected={draft.trainingExperience === option.value}
                  onPress={() => updateDraft({ trainingExperience: option.value })}
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
                  selected={draft.workoutFrequencyDays === option.value}
                  onPress={() => updateDraft({ workoutFrequencyDays: option.value })}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 'averageWorkoutLength' ? (
          <>
            <Text style={styles.stepTitle}>What&apos;s your average workout length?</Text>
            <View testID="onboarding-step-average-workout-length">
              {AVERAGE_WORKOUT_LENGTH_OPTIONS.map((option) => (
                <OnboardingOptionCard
                  key={option.value}
                  testID={`onboarding-workout-length-${option.value}`}
                  label={option.label}
                  selected={draft.averageWorkoutLength === option.value}
                  onPress={() => updateDraft({ averageWorkoutLength: option.value })}
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
              value={draft.trainingStylePreference}
              onChange={(trainingStylePreference) => updateDraft({ trainingStylePreference })}
            />
          </>
        ) : null}

        {step === 'workoutSplit' ? (
          <>
            <Text style={styles.stepTitle}>Choose your workout split</Text>
            {/* select-only: no account exists yet to own a real split
                against, so picking a preset only records which one was
                chosen -- see submitOnboardingDraft, which materializes it
                for real once the account does exist. "Create Custom Split"
                can't actually build one here for the same reason, so it
                just records the intent (wantsCustomSplit) and moves on;
                with no active split set afterward, NewWorkoutScreen's
                existing "no active split" gate gets them to a real, working
                custom-split builder the first time they go to start a
                workout. */}
            <WorkoutSplitPresetPicker
              testID="onboarding-step-workout-split"
              theme={DEFAULT_WORKOUT_THEME}
              materializeImmediately={false}
              onPresetActivated={(presetId) => {
                updateDraft({ selectedSplitPresetId: presetId, wantsCustomSplit: false });
                advance();
              }}
              onCreateOwn={() => {
                updateDraft({ selectedSplitPresetId: null, wantsCustomSplit: true });
                advance();
              }}
              createOwnHelperText="You'll build this right after your account is created"
            />
          </>
        ) : null}

        {step === 'appleHealth' ? (
          <PermissionStep
            testID="onboarding-step-apple-health"
            icon="heart"
            title="Connect Apple Health"
            description="Sync activity and workouts with Apple Health. You can connect this later from Settings."
            connectLabel="Connect Apple Health"
            skipLabel="Not Now"
            onConnect={() => {
              updateDraft({ appleHealthPreference: 'connected' });
              advance();
            }}
            onSkip={() => {
              updateDraft({ appleHealthPreference: 'not_now' });
              advance();
            }}
          />
        ) : null}

        {step === 'emailPreference' ? (
          <>
            <Text style={styles.stepTitle}>Would you like to receive emails from Progresso?</Text>
            <View testID="onboarding-step-email-preference">
              <OnboardingOptionCard
                testID="onboarding-email-yes"
                label="Yes"
                selected={draft.emailOptIn === true}
                onPress={() => updateDraft({ emailOptIn: true })}
              />
              <OnboardingOptionCard
                testID="onboarding-email-no"
                label="No"
                selected={draft.emailOptIn === false}
                onPress={() => updateDraft({ emailOptIn: false })}
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
            onConnect={() => {
              updateDraft({ pushNotificationsOptIn: true });
              advance();
            }}
            onSkip={() => {
              updateDraft({ pushNotificationsOptIn: false });
              advance();
            }}
          />
        ) : null}

        {step === 'createAccount' ? (
          confirmationSent ? (
            <View testID="onboarding-step-create-account-confirmation">
              <Text style={styles.stepTitle}>Check your email</Text>
              <Text style={styles.stepExplanation}>
                We sent a confirmation link to {confirmationEmail}. Confirm your email, then sign in
                -- everything you answered is saved and will finish setting up your account
                automatically.
              </Text>
              <TextButton
                testID="onboarding-create-account-back-to-sign-in"
                label="Back to sign in"
                onPress={onSwitchToSignIn}
              />
            </View>
          ) : (
            <>
              <Text style={styles.stepTitle}>Create your account</Text>
              <Text style={styles.stepExplanation}>
                Last step -- this saves everything you just answered.
              </Text>
              <CreateAccountStep
                testID="onboarding-step-create-account"
                submitting={saving}
                error={error}
                onSubmit={handleCreateAccount}
                onGoogleSignUp={handleGoogleSignUp}
                googleSubmitting={googleSubmitting}
              />
            </>
          )
        ) : null}
      </View>

      {GENERIC_CONTINUE_STEPS.has(step) ? (
        <View style={styles.footer}>
          <PrimaryButton
            testID="onboarding-continue"
            label="Continue"
            onPress={advance}
            disabled={!canContinue(step)}
          />
        </View>
      ) : null}

      {stepIndex === 0 && step === 'referralSource' ? (
        <View style={styles.footer}>
          <TextButton
            testID="onboarding-switch-to-sign-in"
            label="Already have an account? Sign In"
            onPress={onSwitchToSignIn}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isNoScrollStep ? (
          <View style={styles.scrollContent}>{content}</View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            testID="onboarding-scroll"
          >
            {content}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
