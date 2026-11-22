import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { GlyphWell } from '../design/GlyphWell';
import { RiseIn, RiseInGroup } from '../design/RiseIn';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { IconButton } from '../design/IconButton';
import { PrimaryButton, SecondaryButton, TextButton } from '../design/Button';
import { CountryStep } from '../onboarding/CountryStep';
import {
  CreateAccountStep,
  type CreateAccountFields,
  type GoogleSignUpFields,
} from '../onboarding/CreateAccountStep';
import {
  clampToLatest,
  latestBirthday,
  MONTH_NAMES,
  toDateStringUTC,
} from '../onboarding/dateWheelValues';
import { DateWheelPicker } from '../onboarding/DateWheelPicker';
import { GoalSelector } from '../onboarding/GoalSelector';
import { HeightWheelPicker } from '../onboarding/HeightWheelPicker';
import {
  ACTIVITY_GUIDES,
  AVERAGE_WORKOUT_LENGTH_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
  SEX_OPTIONS,
  WORKOUT_FREQUENCY_OPTIONS,
} from '../onboarding/onboardingOptions';
import {
  computeStartStepIndex,
  EMPTY_DRAFT,
  isOldEnough,
  isStepAnswered,
  MIN_SIGNUP_AGE,
  nextStepIndex,
  stepApplies,
  STEP_ORDER,
  stepPlace,
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
import { MembershipChoices } from '../membership/MembershipChoices';
import { RankExplainerPage } from '../achievements/RankExplainerPage';
import { RankClimb } from '../achievements/RankClimb';
import { askForSteps, stepsAccess } from '../health/steps';
import { ACTIVITY_LEVELS, ageFromBirthday } from '../nutrition/calorieEstimationInput';
import { ChoiceCard } from '../onboarding/ChoiceCard';
import { countryFromLocation, locationAvailable } from '../onboarding/countryFromLocation';
import { GetStartedIntro } from '../onboarding/GetStartedIntro';
import { NutritionTargetsStep } from '../onboarding/NutritionTargetsStep';
import { OnboardingTiles } from '../onboarding/OnboardingTiles';
import { PlanSummary } from '../onboarding/PlanSummary';
import { setWelcomeStage } from '../onboarding/welcomeStage';
import { TextInput } from '../design/TextInput';
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
  // Your plan is ready is looked over, then moved on from.
  'summary',
]);

// Steps with a button of their own that moves on (Allow / Not Now, Use These Targets, Create
// Account) never add Continue, even once answered: one filled button a screen. Every other step
// come back to with its answer shows Continue, so going back never means answering again.
const OWN_FORWARD_STEPS = new Set<OnboardingStep>([
  'location',
  'nutritionTargets',
  'pushNotifications',
  'appleHealth',
  'createAccount',
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
  // "Let's get you started!" over everything as onboarding opens (GetStartedIntro): showing on
  // its own, then opening onto the first question (which rises in beneath it), then gone.
  const [intro, setIntro] = useState<'showing' | 'opening' | 'done'>('showing');
  const [resumed, setResumed] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [locating, setLocating] = useState(false);
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
  const context: StepContext = { healthAvailable, locationAvailable: locationAvailable() };
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
        setResumed(true);
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

  // Set when an answer is opened from Your plan is ready: moving on from it goes straight back
  // there -- by way of any question it newly asks (Nutrition's, once it's in the membership).
  const editingFromSummary = useRef(false);

  /** The nearest step asked, a way from this one -- a step that doesn't apply is passed by. */
  function stepFrom(index: number, direction: 1 | -1): number {
    const { draft: current, context: here } = latest.current;
    if (direction === 1 && editingFromSummary.current) {
      const summary = STEP_ORDER.indexOf('summary');
      for (let i = index + 1; i < summary; i += 1) {
        const next = STEP_ORDER[i];
        if (stepApplies(next, current, here) && !isStepAnswered(next, current)) return i;
      }
      editingFromSummary.current = false;
      return summary;
    }
    return nextStepIndex(index, direction, current, here);
  }

  function editFromSummary(target: OnboardingStep) {
    cancelPendingAdvance();
    editingFromSummary.current = true;
    goToStep(STEP_ORDER.indexOf(target));
  }

  // Whether the step showing already had its answer when it was reached -- come back to with Back,
  // or picked up from a saved draft -- so Continue can take it forward again.
  const arrival = useRef<{ index: number; answered: boolean } | null>(null);

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
    // How ranks work and Your plan is ready are answered by moving on from them.
    if (STEP_ORDER[stepIndex] === 'ranks') updateDraft({ ranksSeen: true });
    if (STEP_ORDER[stepIndex] === 'summary') updateDraft({ summarySeen: true });
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
    // How ranks work and Your plan is ready are only read.
    return step === 'ranks' || step === 'summary' || isStepAnswered(step, draft);
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
    // A moment's read from the phone; the intro follows at once, so nothing shows meanwhile.
    return <View testID="onboarding-loading" style={styles.screen} />;
  }

  const step = STEP_ORDER[stepIndex];
  const isNoScrollStep = NO_OUTER_SCROLL_STEPS.has(step);
  // The progress bar and "About You · 2 of 6" count only the steps asked.
  const asked = stepsAsked(draft, context);
  const place = stepPlace(step, asked);
  if (arrival.current?.index !== stepIndex) {
    arrival.current = { index: stepIndex, answered: isStepAnswered(step, draft) };
  }
  // A question answered as it shows moves on by itself; one already answered when it was reached
  // has Continue, so going back to look never means answering again to go forward.
  const showContinue =
    CONTINUE_STEPS.has(step) ||
    (!OWN_FORWARD_STEPS.has(step) && arrival.current.answered && isStepAnswered(step, draft));

  // Shown under the birthday wheels as they turn.
  const age = draft.birthday ? ageFromBirthday(draft.birthday) : null;

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
          <OnboardingProgress testID="onboarding-progress" sections={place.progress} />
        </View>
      </View>

      {/* Where this question is, in words: which part, and how far through it. */}
      <Text
        testID="onboarding-section"
        style={styles.sectionLabel}
        accessibilityLabel={`${place.section}, step ${place.stepInSection} of ${place.stepsInSection}`}
      >
        {place.section} · {place.stepInSection} of {place.stepsInSection}
      </Text>

      {error ? (
        <Text testID="onboarding-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      {/* Each question is its own set of widgets, rising in as it opens. */}
      <RiseInGroup key={step}>
        <View style={styles.body}>
          {step === 'referralSource' ? (
            <>
              <Text style={styles.stepTitle}>Where did you hear about us?</Text>
              {/* The very first screen: what's ahead, and that nothing here is final. */}
              <Text testID="onboarding-intro" style={styles.stepExplanation}>
                A few quick questions to set up Progresso. You can change any answer later in
                Settings.
              </Text>
              <OnboardingTiles
                testID="onboarding-step-referral-source"
                tilePrefix="onboarding-referral-source"
                options={REFERRAL_SOURCE_OPTIONS}
                isSelected={(value) => draft.referralSource === value}
                onPress={(referralSource) => choose({ referralSource })}
              />
            </>
          ) : null}

          {step === 'location' ? (
            <PermissionStep
              testID="onboarding-step-location"
              icon="map-pin"
              title="Find your country"
              description="Allow your location and the country you're in goes to the top of the list."
              points={[
                { icon: 'navigation', text: 'Your country first, ready to tap' },
                { icon: 'clock', text: 'Used just this once, while you sign up' },
                { icon: 'shield', text: 'Never sent to Progresso or kept' },
              ]}
              connectLabel="Allow"
              skipLabel="Not Now"
              connectBusy={locating}
              onConnect={() => {
                setLocating(true);
                void countryFromLocation()
                  .catch(() => ({ status: 'unknown' as const }))
                  .then((result) => {
                    updateDraft({
                      locationAsked: true,
                      locatedCountry: result.status === 'found' ? result.country : null,
                    });
                    setLocating(false);
                    advance();
                  });
              }}
              onSkip={() => {
                updateDraft({ locationAsked: false, locatedCountry: null });
                advance();
              }}
            />
          ) : null}

          {step === 'country' ? (
            <>
              <Text style={styles.stepTitle}>Where are you from?</Text>
              <CountryStep
                testID="onboarding-step-country"
                value={draft.country}
                located={draft.locatedCountry}
                onChange={(code) => choose({ country: code })}
              />
            </>
          ) : null}

          {step === 'gender' ? (
            <>
              <Text style={styles.stepTitle}>What is your sex?</Text>
              <Text style={styles.stepExplanation}>
                It&apos;s used to work out your calorie and nutrient targets.
              </Text>
              <OnboardingTiles
                testID="onboarding-step-gender"
                tilePrefix="onboarding-gender"
                options={SEX_OPTIONS.map((option) => ({
                  ...option,
                  art: (
                    <View
                      style={[local.sexWell, { backgroundColor: withAlpha(accent.accent, 0.14) }]}
                    >
                      <MaterialCommunityIcons
                        name={option.value === 'male' ? 'gender-male' : 'gender-female'}
                        size={24}
                        color={accent.accent}
                      />
                    </View>
                  ),
                }))}
                isSelected={(value) => draft.gender === value}
                onPress={(gender) => choose({ gender })}
              />
            </>
          ) : null}

          {step === 'birthday' ? (
            <>
              <Text style={styles.stepTitle}>When&apos;s your birthday?</Text>
              <RiseIn>
                <AppCard style={local.wheelCard}>
                  {/* The date the wheels give, and the age it makes, above them. */}
                  <View style={local.birthdayHead}>
                    <View style={local.birthdayHeadText}>
                      <Text style={local.kicker}>YOUR BIRTHDAY</Text>
                      <Text testID="onboarding-birthday-date" style={local.birthdayDate}>
                        {MONTH_NAMES[birthdayMonth]} {birthdayDay}, {birthdayYear}
                      </Text>
                    </View>
                    {age !== null ? (
                      <View
                        testID="onboarding-birthday-age"
                        style={[local.agePill, { backgroundColor: withAlpha(accent.accent, 0.14) }]}
                      >
                        <Text style={[local.agePillText, { color: accent.accent }]}>
                          {age} years old
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <DateWheelPicker
                    testID="onboarding-step-birthday"
                    month={birthdayMonth}
                    day={birthdayDay}
                    year={birthdayYear}
                    // Nobody younger than 13: the wheels end on their 13th birthday's date.
                    latest={latestBirthday(MIN_SIGNUP_AGE)}
                    showPreview={false}
                    onChange={({ month, day, year }) => {
                      setBirthdayMonth(month);
                      setBirthdayDay(day);
                      setBirthdayYear(year);
                      updateDraft({ birthday: toDateStringUTC(month, day, year) });
                    }}
                  />
                </AppCard>
              </RiseIn>
            </>
          ) : null}

          {step === 'weight' ? (
            <>
              <Text style={styles.stepTitle}>What&apos;s your weight?</Text>
              <RiseIn>
                <AppCard>
                  <WeightField
                    testID="onboarding-step-weight"
                    unit={draft.weightUnit}
                    weightKg={draft.weightValue}
                    onChangeUnit={(weightUnit) => updateDraft({ weightUnit })}
                    onChangeWeightKg={(weightValue) => updateDraft({ weightValue })}
                  />
                </AppCard>
              </RiseIn>
            </>
          ) : null}

          {step === 'height' ? (
            <>
              <Text style={styles.stepTitle}>What&apos;s your height?</Text>
              <RiseIn>
                <AppCard style={local.wheelCard}>
                  <HeightWheelPicker
                    testID="onboarding-step-height"
                    unit={draft.heightUnit}
                    heightCm={draft.heightValue ?? 170}
                    onChangeUnit={(heightUnit) => updateDraft({ heightUnit })}
                    onChangeHeightCm={(heightValue) => updateDraft({ heightValue })}
                  />
                </AppCard>
              </RiseIn>
            </>
          ) : null}

          {step === 'fitnessGoal' ? (
            <>
              <Text style={styles.stepTitle}>What are your fitness goals?</Text>
              <Text style={styles.stepExplanation}>
                Pick up to {MAX_FITNESS_GOALS}.
                {draft.fitnessGoals.length > 0
                  ? ` ${draft.fitnessGoals.length} of ${MAX_FITNESS_GOALS} picked.`
                  : ''}
              </Text>
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
                How confident are you in planning and progressing your workouts?
              </Text>
              <Text style={styles.stepExplanation}>
                Choose the option that best describes your experience.
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
              <Text style={styles.stepExplanation}>Days a week.</Text>
              <OnboardingTiles
                testID="onboarding-step-workout-frequency"
                tilePrefix="onboarding-frequency"
                columns={3}
                options={WORKOUT_FREQUENCY_OPTIONS.map((option) => ({
                  ...option,
                  unit: 'days',
                }))}
                isSelected={(value) => draft.workoutFrequencyDays === value}
                onPress={(workoutFrequencyDays) => choose({ workoutFrequencyDays })}
              />
            </>
          ) : null}

          {step === 'averageWorkoutLength' ? (
            <>
              <Text style={styles.stepTitle}>What&apos;s your average workout length?</Text>
              <OnboardingTiles
                testID="onboarding-step-average-workout-length"
                tilePrefix="onboarding-workout-length"
                options={AVERAGE_WORKOUT_LENGTH_OPTIONS.map((option) => ({
                  ...option,
                  unit: 'minutes',
                }))}
                isSelected={(value) => draft.averageWorkoutLength === value}
                onPress={(averageWorkoutLength) => choose({ averageWorkoutLength })}
              />
            </>
          ) : null}

          {step === 'membership' ? (
            <>
              <Text style={styles.stepTitle}>Choose your membership</Text>
              <Text style={styles.stepExplanation}>
                All free for now. You can change it any time in Settings.
              </Text>
              <MembershipChoices
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
                On a typical day, counting your workouts. It sets your daily calories.
              </Text>
              <View testID="onboarding-step-activity-level" style={local.cards}>
                {ACTIVITY_LEVELS.map((option) => {
                  const guide = ACTIVITY_GUIDES[option.value];
                  return (
                    <RiseIn key={option.value}>
                      <ChoiceCard
                        testID={`onboarding-activity-${option.value}`}
                        leading={
                          <GlyphWell icon={guide.icon} accentColor={accent.accent} size={40} />
                        }
                        title={option.label}
                        pill={guide.steps}
                        description={guide.examples}
                        selected={draft.activityLevel === option.value}
                        onPress={() => choose({ activityLevel: option.value })}
                      />
                    </RiseIn>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 'nutritionTargets' ? (
            <>
              <Text style={styles.stepTitle}>Your daily targets</Text>
              <Text style={styles.stepExplanation}>
                Worked out from your answers. Change any of them, or set them later.
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
                <RankClimb testID="onboarding-rank" />
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
              <Text style={styles.stepExplanation}>
                Start from a ready-made split, or build your own.
              </Text>
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
                presetsLabel="Start From a Preset"
                selectedPresetId={draft.selectedSplitPresetId}
                createOwnSelected={draft.wantsCustomSplit}
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
                createOwnHelperText="Name your own days and choose every exercise. It opens as soon as your account is made."
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
              <Text style={styles.stepExplanation}>You can change this any time in Settings.</Text>
              <OnboardingTiles
                testID="onboarding-step-email-preference"
                tilePrefix="onboarding-email"
                options={[
                  { value: 'yes', label: 'Yes, please', icon: 'mail' },
                  { value: 'no', label: 'No, thanks', icon: 'x' },
                ]}
                isSelected={(value) =>
                  draft.emailOptIn !== null && draft.emailOptIn === (value === 'yes')
                }
                onPress={(value) => choose({ emailOptIn: value === 'yes' })}
              />
            </>
          ) : null}

          {step === 'pushNotifications' ? (
            <PermissionStep
              testID="onboarding-step-push-notifications"
              icon="bell"
              title="Stay in the loop"
              description="Would you like Progresso to send you notifications? You can change this later from Settings."
              points={[
                { icon: 'calendar', text: 'Reminders to train, and a weekly summary' },
                { icon: 'award', text: 'A cheer when you set a new record' },
                { icon: 'heart', text: 'Likes, comments and follow requests' },
              ]}
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
              description="Allow Apple Health so Progresso can show your steps. Progresso only reads your steps -- it never changes anything in Apple Health or keeps them."
              points={[
                { icon: 'activity', text: "Today's steps on Feed" },
                { icon: 'bar-chart-2', text: 'Your last four weeks in Progress' },
                { icon: 'shield', text: 'Read on your phone, never kept' },
              ]}
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
              <View testID="onboarding-step-trainer-code">
                <RiseIn>
                  <AppCard>
                    <View style={local.cardHead}>
                      <GlyphWell icon="clipboard" accentColor={accent.accent} size={40} />
                      <Text style={local.cardTitle}>Got a code from your trainer?</Text>
                    </View>
                    <Text style={local.cardLine}>
                      If a trainer tracked your workouts in Progresso, they gave you a code. Enter
                      it and that history becomes yours -- your trainer keeps seeing it too.
                    </Text>
                    <TextInput
                      testID="onboarding-trainer-code-input"
                      label="Trainer's code"
                      placeholder="e.g. ABCD-2345"
                      value={draft.trainerCode ?? ''}
                      onChangeText={(text) =>
                        updateDraft({
                          trainerCode: text,
                          hasTrainerCode: text.trim() ? true : null,
                        })
                      }
                      autoCapitalize="characters"
                      maxLength={12}
                    />
                  </AppCard>
                </RiseIn>
                {/* One way past it: "no" and "later" did the same thing. */}
                <View style={styles.footer}>
                  <TextButton
                    testID="onboarding-no-trainer-code"
                    label="Skip: I Don't Have One"
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

          {step === 'summary' ? (
            <>
              <Text style={styles.stepTitle}>Your plan is ready</Text>
              <Text style={styles.stepExplanation}>
                Here&apos;s what you chose. Tap any of it to change it.
              </Text>
              <PlanSummary
                testID="onboarding-step-summary"
                draft={draft}
                onEdit={editFromSummary}
              />
            </>
          ) : null}

          {step === 'createAccount' ? (
            confirmationSent ? (
              <View testID="onboarding-step-create-account-confirmation">
                <Text style={styles.stepTitle}>Check your email</Text>
                <RiseIn>
                  <AppCard>
                    <View style={local.cardHead}>
                      <GlyphWell icon="mail" accentColor={accent.accent} size={40} />
                      <Text style={local.cardTitle}>Confirm your email</Text>
                    </View>
                    <Text style={local.cardLine}>
                      We sent a confirmation link to {confirmationEmail}. Confirm your email, then
                      sign in -- everything you answered is saved and will finish setting up your
                      account automatically.
                    </Text>
                  </AppCard>
                </RiseIn>
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
                <RiseIn>
                  <AppCard>
                    <CreateAccountStep
                      testID="onboarding-step-create-account"
                      country={draft.country}
                      submitting={saving}
                      error={error}
                      onSubmit={handleCreateAccount}
                      onGoogleSignUp={handleGoogleSignUp}
                      googleSubmitting={googleSubmitting}
                    />
                  </AppCard>
                </RiseIn>
              </>
            )
          ) : null}
        </View>
      </RiseInGroup>

      {showContinue ? (
        <View style={styles.footer}>
          <PrimaryButton
            testID="onboarding-continue"
            label={step === 'summary' ? 'Looks Good' : 'Continue'}
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
      {intro !== 'showing' ? (
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
      ) : null}
      {intro !== 'done' ? (
        <GetStartedIntro
          returning={resumed}
          onReveal={() => setIntro((current) => (current === 'showing' ? 'opening' : current))}
          onFinish={() => setIntro('done')}
        />
      ) : null}
    </View>
  );
}

const local = StyleSheet.create({
  sexWell: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The wheels take the card's whole width; each picker centres what it holds itself.
  wheelCard: {
    paddingVertical: spacing.xl,
  },
  birthdayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  birthdayHeadText: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    ...typeScale.caption,
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  birthdayDate: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  agePill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  agePillText: {
    ...typeScale.label,
  },
  cards: {
    gap: spacing.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  cardLine: {
    ...typeScale.callout,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
