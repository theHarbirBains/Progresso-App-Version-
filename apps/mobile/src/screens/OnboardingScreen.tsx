import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Text } from '../design/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { IconButton } from '../design/IconButton';
import { LoadingState } from '../design/LoadingState';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { CountryStep } from '../onboarding/CountryStep';
import {
  CreateAccountStep,
  type CreateAccountFields,
  type GoogleSignUpFields,
} from '../onboarding/CreateAccountStep';
import { clampToLatest, latestBirthday, toDateStringUTC } from '../onboarding/dateWheelValues';
import { DateWheelPicker } from '../onboarding/DateWheelPicker';
import { GoalSelector } from '../onboarding/GoalSelector';
import { HeightWheelPicker } from '../onboarding/HeightWheelPicker';
import {
  AVERAGE_WORKOUT_LENGTH_OPTIONS,
  GENDER_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
  WORKOUT_FREQUENCY_OPTIONS,
} from '../onboarding/onboardingOptions';
import {
  computeStartStepIndex,
  EMPTY_DRAFT,
  isOldEnough,
  isStepAnswered,
  MIN_SIGNUP_AGE,
  nextStepIndex,
  STEP_ORDER,
  stepsAsked,
  submitOnboardingDraft,
  MAX_FITNESS_GOALS,
  type OnboardingDraft,
  type OnboardingStep,
  type StepContext,
} from '../onboarding/onboardingDraft';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '../onboarding/onboardingDraftStorage';
import { MembershipCards } from '../membership/MembershipCards';
import { RankExplainerPage } from '../achievements/RankExplainerPage';
import { askForSteps, stepsAccess } from '../health/steps';
import { ACTIVITY_LEVELS } from '../nutrition/calorieEstimationInput';
import { NutritionTargetsStep } from '../onboarding/NutritionTargetsStep';
import { setWelcomeStage } from '../onboarding/welcomeStage';
import { TextInput } from '../design/TextInput';
import { OnboardingOptionCard } from '../onboarding/OnboardingOptionCard';
import { OnboardingProgress } from '../onboarding/OnboardingProgress';
import { PermissionStep } from '../onboarding/PermissionStep';
import { WeightField } from '../onboarding/WeightField';
import { TrainingComfortSelector } from '../onboarding/TrainingComfortSelector';
import { requestNotificationPermission } from '../lib/pushNotifications';
import { useAppTheme } from '../theme/appThemeContext';
import { WorkoutSplitPresetPicker } from '../workouts/WorkoutSplitPresetPicker';
import { onboardingStyles as styles } from './onboardingStyles';

interface Props {
  onSwitchToSignIn: () => void;
}

// Steps with no single tap that answers them -- the birthday and height wheels, and the weight
// box -- confirmed by the shared footer Continue button below. Every pick-one question moves on
// by itself as an answer is tapped (choose, below); the rest have their own terminal controls
// (Allow/Not Now, a preset card or Skip for now, the Create Account button).
const CONTINUE_STEPS = new Set<OnboardingStep>([
  'birthday',
  'weight',
  'height',
  // Several goals can be picked, so a tap can't be the answer.
  'fitnessGoal',
  // The trainer's code is typed.
  'trainerCode',
  // How ranks work is read, then moved on from.
  'ranks',
]);

// How long a tapped answer shows as chosen before the next question takes its place.
const CHOSEN_PAUSE_MS = 250;

// These steps each render either a WheelPicker or a FlatList (country's own
// search results), both virtualized -- nesting either inside the outer
// vertical ScrollView triggers React Native's "VirtualizedLists should
// never be nested inside plain ScrollViews with the same orientation"
// warning (and its real windowing cost). Every other step keeps the
// ScrollView since option lists can genuinely run long on a small device.
const NO_OUTER_SCROLL_STEPS = new Set<OnboardingStep>(['country', 'birthday', 'height']);

const DEFAULT_BIRTH_YEAR = new Date().getFullYear() - 25;

// Onboarding runs entirely pre-auth now -- account creation is the LAST
// step (see onboarding/onboardingDraft.ts's own header comment for the
// full reasoning), so every answer lives in local draft state until
// CreateAccountStep's own submit, which is the one point this screen
// touches the network for real profile data. A local on-device draft (see
// onboardingDraftStorage) is what makes this resumable across an app kill,
// the same guarantee the old profile-backed flow had.
export function OnboardingScreen({ onSwitchToSignIn }: Props) {
  const { accent } = useAppTheme();
  const { signUpWithPassword, signInWithProvider } = useAuth();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [restoringDraft, setRestoringDraft] = useState(true);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [ranksOpen, setRanksOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');

  const [birthdayMonth, setBirthdayMonth] = useState(0);
  const [birthdayDay, setBirthdayDay] = useState(1);
  const [birthdayYear, setBirthdayYear] = useState(DEFAULT_BIRTH_YEAR);

  // Whether Apple Health is here to ask about (an iPhone, in a copy of the app that has it).
  const [healthAvailable, setHealthAvailable] = useState(false);
  useEffect(() => {
    let mounted = true;
    stepsAccess()
      .then((access) => {
        if (mounted) setHealthAvailable(access !== 'unavailable');
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  const context: StepContext = { healthAvailable };
  // The latest of each, for a tapped answer's move on to read once it's shown as chosen.
  const latest = useRef({ draft, context });
  latest.current = { draft, context };

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
          // One later than the wheels go (13 years ago today) comes back as that latest date.
          const [y, m, d] = stored.draft.birthday.split('-').map(Number);
          const shown = clampToLatest(
            { year: y, month: m - 1, day: d },
            latestBirthday(MIN_SIGNUP_AGE),
          );
          setBirthdayYear(shown.year);
          setBirthdayMonth(shown.month);
          setBirthdayDay(shown.day);
          if (!isOldEnough(stored.draft.birthday)) {
            stored.draft = {
              ...stored.draft,
              birthday: toDateStringUTC(shown.month, shown.day, shown.year),
            };
            setDraft(stored.draft);
          }
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

  /** The nearest step asked, a way from this one -- a step that doesn't apply is passed by. */
  function stepFrom(index: number, direction: 1 | -1): number {
    return nextStepIndex(index, direction, latest.current.draft, latest.current.context);
  }

  // A tapped answer's move to the next question, waiting out CHOSEN_PAUSE_MS.
  const pendingAdvance = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelPendingAdvance() {
    if (pendingAdvance.current) clearTimeout(pendingAdvance.current);
    pendingAdvance.current = null;
  }
  useEffect(() => cancelPendingAdvance, []);

  function goBackStep() {
    cancelPendingAdvance();
    goToStep(stepFrom(stepIndex, -1));
  }

  function advance() {
    cancelPendingAdvance();
    // How ranks work is answered by moving on from it.
    if (STEP_ORDER[stepIndex] === 'ranks') updateDraft({ ranksSeen: true });
    goToStep(stepFrom(stepIndex, 1));
  }

  /**
   * Saves a tapped answer and moves on to the next question once it's shown as chosen. Tapping
   * another answer first only changes the answer; going back first stays back.
   */
  function choose(patch: Partial<OnboardingDraft>) {
    updateDraft(patch);
    cancelPendingAdvance();
    const from = stepIndex;
    pendingAdvance.current = setTimeout(() => {
      pendingAdvance.current = null;
      // The answer's in by now, so a step it rules out (Nutrition's, without it) is passed by.
      setStepIndex((current) => (current === from ? stepFrom(from, 1) : current));
    }, CHOSEN_PAUSE_MS);
  }

  function canContinue(step: OnboardingStep): boolean {
    // How ranks work is only read.
    return step === 'ranks' || isStepAnswered(step, draft);
  }

  async function handleCreateAccount(fields: CreateAccountFields) {
    setSaving(true);
    setError(null);
    // Written into the draft (not just kept as this function's own local
    // fields) so it survives the email-confirmation gap below -- see
    // OnboardingDraft's own comment on pendingUsername/pendingDisplayName.
    updateDraft({
      pendingUsername: fields.username,
      pendingDisplayName: fields.displayName,
      pendingLastName: fields.lastName,
      pendingPhoneNumber: fields.phoneNumber,
    });

    // The app waits while the answers save, then welcomes them (onboarding/welcomeStage.ts).
    setWelcomeStage('saving');
    try {
      if (!accountCreatedRef.current) {
        const result = await signUpWithPassword(fields.email, fields.password);
        if (result.error) {
          setWelcomeStage('none');
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
          setWelcomeStage('none');
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
        {
          ...draft,
          pendingUsername: fields.username,
          pendingDisplayName: fields.displayName,
          pendingLastName: fields.lastName,
          pendingPhoneNumber: fields.phoneNumber,
        },
      );
      await clearOnboardingDraft();
      setWelcomeStage('welcome');
      // No explicit navigation: signUpWithPassword already established the
      // session above, so AuthProvider's status flips to 'signedIn'
      // shortly after (via its own onAuthStateChange listener), and
      // App.tsx's Root swaps this whole screen for the real, signed-in app
      // on its own.
    } catch (err) {
      setWelcomeStage('none');
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
      pendingLastName: fields.lastName,
      pendingPhoneNumber: fields.phoneNumber,
    };
    updateDraft({
      pendingUsername: fields.username,
      pendingDisplayName: fields.displayName,
      pendingLastName: fields.lastName,
      pendingPhoneNumber: fields.phoneNumber,
    });
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
  // The progress bar counts only the steps asked.
  const asked = stepsAsked(draft, context);

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
            currentIndex={Math.max(0, asked.indexOf(step))}
            totalSteps={asked.length}
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
                  onPress={() => choose({ referralSource: option.value })}
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
              onChange={(code) => choose({ country: code })}
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
                  onPress={() => choose({ gender: option.value })}
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
                // Nobody younger than 13: the wheels end on their 13th birthday's date.
                latest={latestBirthday(MIN_SIGNUP_AGE)}
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
            <WeightField
              testID="onboarding-step-weight"
              unit={draft.weightUnit}
              weightKg={draft.weightValue}
              onChangeUnit={(weightUnit) => updateDraft({ weightUnit })}
              onChangeWeightKg={(weightValue) => updateDraft({ weightValue })}
            />
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
            <Text style={styles.stepTitle}>What are your fitness goals?</Text>
            <Text style={styles.stepExplanation}>Pick up to {MAX_FITNESS_GOALS}.</Text>
            <GoalSelector
              testID="onboarding-step-fitness-goal"
              value={draft.fitnessGoals}
              onChange={(fitnessGoals) => updateDraft({ fitnessGoals })}
              max={MAX_FITNESS_GOALS}
            />
          </>
        ) : null}

        {step === 'trainingComfort' ? (
          <>
            <Text style={styles.stepTitle}>
              How comfortable are you with planning and progressing your workouts?
            </Text>
            <TrainingComfortSelector
              testID="onboarding-step-training-comfort"
              value={draft.trainingComfort}
              onChange={(trainingComfort) => choose({ trainingComfort })}
            />
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
                  onPress={() => choose({ workoutFrequencyDays: option.value })}
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
                  onPress={() => choose({ averageWorkoutLength: option.value })}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 'membership' ? (
          <>
            <Text style={styles.stepTitle}>Choose your membership</Text>
            <Text style={styles.stepExplanation}>
              All free for now. You can change it any time in Settings.
            </Text>
            <MembershipCards
              testID="onboarding-step-membership"
              value={draft.membershipTier}
              onChoose={(membershipTier) => choose({ membershipTier })}
            />
          </>
        ) : null}

        {step === 'activityLevel' ? (
          <>
            <Text style={styles.stepTitle}>How active are you?</Text>
            <Text style={styles.stepExplanation}>
              On a typical week, counting your workouts. It sets your daily calories.
            </Text>
            <View testID="onboarding-step-activity-level">
              {ACTIVITY_LEVELS.map((option) => (
                <OnboardingOptionCard
                  key={option.value}
                  testID={`onboarding-activity-${option.value}`}
                  label={option.label}
                  description={option.description}
                  selected={draft.activityLevel === option.value}
                  onPress={() => choose({ activityLevel: option.value })}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 'nutritionTargets' ? (
          <>
            <Text style={styles.stepTitle}>Your daily targets</Text>
            <Text style={styles.stepExplanation}>
              Worked out from what you&apos;ve told us. Use them as they are, change any of them, or
              set them later.
            </Text>
            <NutritionTargetsStep
              testID="onboarding-step-nutrition-targets"
              gender={draft.gender}
              birthday={draft.birthday}
              weightKg={draft.weightValue}
              heightCm={draft.heightValue}
              activityLevel={draft.activityLevel}
              fitnessGoals={draft.fitnessGoals}
              value={draft.nutritionTargets}
              onUse={(nutritionTargets) => {
                updateDraft({ nutritionTargets, skippedNutritionTargets: false });
                advance();
              }}
              onSkip={() => {
                updateDraft({ nutritionTargets: null, skippedNutritionTargets: true });
                advance();
              }}
            />
          </>
        ) : null}

        {step === 'ranks' ? (
          <>
            <Text style={styles.stepTitle}>How ranks work</Text>
            <View testID="onboarding-step-ranks">
              <Text style={styles.stepExplanation}>
                Everything you do in Progresso earns points toward a rank that&apos;s yours for
                life, from Bronze to Legacy.
              </Text>
              {/* The full explanation is a page of its own, opened from here. */}
              <SecondaryButton
                testID="onboarding-ranks-open"
                label="See How Ranks Work"
                icon="info"
                onPress={() => setRanksOpen(true)}
              />
            </View>
            <RankExplainerPage visible={ranksOpen} onClose={() => setRanksOpen(false)} />
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
              theme={accent}
              materializeImmediately={false}
              onPresetActivated={(presetId) => {
                updateDraft({
                  selectedSplitPresetId: presetId,
                  wantsCustomSplit: false,
                  skippedSplit: false,
                });
                advance();
              }}
              onCreateOwn={() => {
                updateDraft({
                  selectedSplitPresetId: null,
                  wantsCustomSplit: true,
                  skippedSplit: false,
                });
                advance();
              }}
              createOwnHelperText="You'll build this right after your account is created"
            />
            {/* No split for now: Start Workout asks for one the first time it's needed. */}
            <View style={styles.footer}>
              <TextButton
                testID="onboarding-skip-workout-split"
                label="Skip for now"
                onPress={() => {
                  updateDraft({
                    selectedSplitPresetId: null,
                    wantsCustomSplit: false,
                    skippedSplit: true,
                  });
                  advance();
                }}
              />
            </View>
          </>
        ) : null}

        {step === 'emailPreference' ? (
          <>
            <Text style={styles.stepTitle}>Would you like to receive emails from Progresso?</Text>
            <View testID="onboarding-step-email-preference">
              <OnboardingOptionCard
                testID="onboarding-email-yes"
                label="Yes"
                selected={draft.emailOptIn === true}
                onPress={() => choose({ emailOptIn: true })}
              />
              <OnboardingOptionCard
                testID="onboarding-email-no"
                label="No"
                selected={draft.emailOptIn === false}
                onPress={() => choose({ emailOptIn: false })}
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
            connectBusy={requestingNotifications}
            onConnect={() => {
              setRequestingNotifications(true);
              void requestNotificationPermission()
                .catch(() => false)
                .then((granted) => {
                  // Saves what iOS actually allowed, so Settings never shows push on without permission.
                  updateDraft({ pushNotificationsOptIn: granted });
                  setRequestingNotifications(false);
                  advance();
                });
            }}
            onSkip={() => {
              updateDraft({ pushNotificationsOptIn: false });
              advance();
            }}
          />
        ) : null}

        {step === 'appleHealth' ? (
          <PermissionStep
            testID="onboarding-step-apple-health"
            icon="heart"
            title="Count your steps"
            description="Allow Apple Health so Progresso can show today's steps on Feed and your last four weeks in Progress. Progresso only reads your steps -- it never changes anything in Apple Health or keeps them."
            connectLabel="Allow"
            skipLabel="Not Now"
            onConnect={() => {
              // Apple Health's own sheet; whatever's chosen there, move on once it's answered.
              void askForSteps()
                .catch(() => undefined)
                .then(() => {
                  updateDraft({ appleHealthAsked: true });
                  advance();
                });
            }}
            onSkip={() => {
              updateDraft({ appleHealthAsked: false });
              advance();
            }}
          />
        ) : null}

        {step === 'trainerCode' ? (
          <>
            <Text style={styles.stepTitle}>Has a trainer been logging your workouts?</Text>
            <Text style={styles.stepExplanation}>
              If a trainer tracked your workouts in Progresso, they gave you a code. Enter it and
              that history becomes yours -- your trainer keeps seeing it too.
            </Text>
            <View testID="onboarding-step-trainer-code">
              <TextInput
                testID="onboarding-trainer-code-input"
                label="Trainer's code"
                placeholder="e.g. ABCD-2345"
                value={draft.trainerCode ?? ''}
                onChangeText={(text) =>
                  updateDraft({ trainerCode: text, hasTrainerCode: text.trim() ? true : null })
                }
                autoCapitalize="characters"
                maxLength={12}
              />
              <View style={styles.footer}>
                <TextButton
                  testID="onboarding-no-trainer-code"
                  label="No, I don't have one"
                  onPress={() => {
                    updateDraft({ hasTrainerCode: false, trainerCode: null });
                    advance();
                  }}
                />
                <TextButton
                  testID="onboarding-trainer-code-later"
                  label="Do this later"
                  onPress={() => {
                    updateDraft({ hasTrainerCode: false, trainerCode: null });
                    advance();
                  }}
                />
                <Text style={styles.footnote}>
                  You can enter it any time in Settings &gt; Trainer Code.
                </Text>
              </View>
            </View>
          </>
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
                country={draft.country}
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

      {CONTINUE_STEPS.has(step) ? (
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
