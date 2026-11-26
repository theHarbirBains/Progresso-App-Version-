import { useEffect, useState } from 'react';
import { HOME_EQUIPMENT_LABELS, type HomeEquipment } from '../programs/homeEquipment';
import { useAuth } from '../auth/AuthProvider';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Toggle } from '../design/Toggle';
import { colors, spacing, typeScale } from '../design/theme';
import type { TrainingComfort, UpdateProfileInput } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import {
  TRAINING_COMFORT_OPTIONS,
  WORKOUT_FREQUENCY_OPTIONS,
} from '../onboarding/onboardingOptions';
import { TrainingComfortSelector } from '../onboarding/TrainingComfortSelector';
import { useProfile } from '../profile/ProfileProvider';
import { RepRangeSheet } from '../settings/RepRangeSheet';
import { settingsStyles as styles } from '../settings/settingsStyles';
import {
  fetchExerciseSettings,
  type ExerciseProgressionSetting,
} from '../workouts/exerciseSettingsQueries';
import { formatRepRange, type RepRange } from '../workouts/progression';
import { HomeEquipmentTiles, ExclusionTiles, PriorityTiles } from '../programs/PriorityChoices';
import {
  EQUIPMENT_ACCESS_OPTIONS,
  MAX_PRIORITIES,
  PRIORITY_LABELS,
  TRAINING_EXCLUSION_LABELS,
} from '../programs/programs';
import type { EquipmentAccess, PriorityArea, TrainingExclusion } from '../programs/programTypes';
import { useAppTheme } from '../theme/appThemeContext';

// Any range from 1 rep up to 50, as the database allows: the bottom never above the top. A
// range of one number (5-5) is a fixed target.

type Props = RootStackScreenProps<'SettingsWorkoutPreferences'>;

/**
 * Workout Preferences: the weekly workout goal collected at onboarding
 * (workoutFrequencyDays), and progression -- how comfortable you are planning
 * and progressing your training (onboarding's comfort question), the one rep
 * range every exercise is trained to, and whether the live workout suggests
 * when to go heavier or make an exercise harder (workouts/progression.ts).
 * Each saves through the same updateProfile call onboarding uses. Changing the
 * comfort answer doesn't change the range: onboarding only starts it from
 * there. Rest-timer, set-logging, and workout-completion preferences aren't
 * built into the app yet, so there's nothing real to add for them here.
 * Program Recommendations: what to prioritize, where they train and what to leave out --
 * onboarding's questions, answered or changed here (programs/recommendations.ts).
 */
export function SettingsWorkoutPreferencesScreen({ navigation }: Props) {
  const { profile, loading, updateProfile } = useProfile();
  const { user } = useAuth();
  const userId = user?.id;
  // How many exercises have their own range or weight step: the count beside Rep Range
  // Exceptions, which has its own page.
  const [exerciseSettings, setExerciseSettings] = useState<ExerciseProgressionSetting[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExerciseSettings(userId)
      .then((settings) => {
        if (!cancelled) {
          setExerciseSettings(
            [...settings.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [comfortSheetOpen, setComfortSheetOpen] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<RepRange | null>(null);
  // An open sheet's picks, saved with its Save button (null: closed).
  const [prioritiesDraft, setPrioritiesDraft] = useState<PriorityArea[] | null>(null);
  const [exclusionsDraft, setExclusionsDraft] = useState<TrainingExclusion[] | null | undefined>(
    undefined,
  );
  const [equipmentSheetOpen, setEquipmentSheetOpen] = useState(false);
  // What they have at home, while its sheet is open (null: closed).
  const [homeDraft, setHomeDraft] = useState<HomeEquipment[] | null>(null);
  const { accent } = useAppTheme();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selected = WORKOUT_FREQUENCY_OPTIONS.find(
    (option) => option.value === profile?.workoutFrequencyDays,
  );
  const comfort = TRAINING_COMFORT_OPTIONS.find(
    (option) => option.value === profile?.trainingComfort,
  );
  const range: RepRange = { min: profile?.repRangeMin ?? 8, max: profile?.repRangeMax ?? 12 };

  async function save(updates: UpdateProfileInput) {
    setSaveError(null);
    setSaving(true);
    try {
      await updateProfile(updates);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSelect(value: number) {
    setSheetOpen(false);
    await save({ workoutFrequencyDays: value });
  }

  async function handleSelectComfort(value: TrainingComfort) {
    setComfortSheetOpen(false);
    await save({ trainingComfort: value });
  }

  async function handleSavePriorities(next: PriorityArea[]) {
    setPrioritiesDraft(null);
    const exclusions = profile?.trainingExclusions ?? [];
    const kept = exclusions.filter((area) => !(next as string[]).includes(area));
    // Putting an area first takes it off what's left out, in the same save.
    await save(
      kept.length === exclusions.length
        ? { trainingPriorities: next }
        : { trainingPriorities: next, trainingExclusions: kept },
    );
  }

  async function handleSelectEquipment(value: EquipmentAccess) {
    setEquipmentSheetOpen(false);
    await save({ equipmentAccess: value });
  }

  async function handleSaveHomeEquipment(next: HomeEquipment[]) {
    setHomeDraft(null);
    await save({ homeEquipment: next });
  }

  async function handleSaveExclusions(next: TrainingExclusion[]) {
    setExclusionsDraft(undefined);
    await save({ trainingExclusions: next });
  }

  const priorities = profile?.trainingPriorities ?? [];
  const homeEquipment = (profile?.homeEquipment ?? []) as HomeEquipment[];
  const exclusions = profile?.trainingExclusions ?? [];
  const equipment = EQUIPMENT_ACCESS_OPTIONS.find(
    (option) => option.value === profile?.equipmentAccess,
  );

  async function handleSaveRange(next: RepRange) {
    setRangeDraft(null);
    await save({ repRangeMin: next.min, repRangeMax: next.max });
  }

  if (loading) {
    return <LoadingState testID="settings-workout-preferences-loading" />;
  }

  return (
    <Screen
      testID="settings-workout-preferences-screen"
      scrollTestID="settings-workout-preferences-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-workout-preferences-header"
          title="Workout Preferences"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="Goal">
        <ListRow
          testID="open-weekly-workout-goal"
          icon="target"
          title="Weekly Workout Goal"
          value={selected ? selected.label : 'Not set'}
          onPress={() => setSheetOpen(true)}
          disabled={saving}
        />
      </Section>

      <Section title="Progression">
        <ListRow
          testID="open-training-comfort"
          icon="compass"
          title="Training Comfort"
          subtitle={comfort ? comfort.label : 'Not set'}
          onPress={() => setComfortSheetOpen(true)}
          disabled={saving}
        />
        <ListRow
          testID="open-rep-range"
          icon="repeat"
          title="Rep Range"
          subtitle="Unless an exercise has its own"
          value={formatRepRange(range)}
          onPress={() => setRangeDraft(range)}
          disabled={saving}
          divider
        />
        <ListRow
          testID="open-exercise-ranges"
          icon="sliders"
          title="Rep Range Exceptions"
          subtitle="Exercises you train outside your range"
          value={String(exerciseSettings.length)}
          onPress={() => navigation.navigate('RepRangeExceptions')}
          chevron
          divider
        />
        <ListRow
          testID="progression-tips-row"
          icon="trending-up"
          title="Progression Tips"
          subtitle="Say when to go heavier or make an exercise harder"
          divider
          trailing={
            <Toggle
              testID="progression-tips-toggle"
              value={profile?.progressionCuesEnabled ?? true}
              onValueChange={(value) => void save({ progressionCuesEnabled: value })}
              disabled={saving}
              accessibilityLabel="Progression Tips"
            />
          }
        />
      </Section>

      <Section title="Program Recommendations">
        <ListRow
          testID="open-training-priorities"
          icon="crosshair"
          title="Training Priorities"
          subtitle={
            priorities.length > 0
              ? priorities.map((area) => PRIORITY_LABELS[area]).join(', ')
              : 'Not set'
          }
          onPress={() => setPrioritiesDraft(priorities)}
          disabled={saving}
        />
        <ListRow
          testID="open-equipment-access"
          icon="map-pin"
          title="Where You Train"
          value={equipment ? equipment.label : 'Not set'}
          onPress={() => setEquipmentSheetOpen(true)}
          disabled={saving}
          divider
        />
        <ListRow
          testID="open-home-equipment"
          icon="home"
          title="Home Equipment"
          subtitle={
            homeEquipment.length > 0
              ? homeEquipment.map((item) => HOME_EQUIPMENT_LABELS[item]).join(', ')
              : 'Not set'
          }
          onPress={() => setHomeDraft(homeEquipment)}
          disabled={saving}
          divider
        />
        <ListRow
          testID="open-training-exclusions"
          icon="slash"
          title="Leave Out"
          subtitle={
            exclusions.length > 0
              ? exclusions.map((area) => TRAINING_EXCLUSION_LABELS[area]).join(', ')
              : 'Nothing'
          }
          onPress={() => setExclusionsDraft(exclusions)}
          disabled={saving}
          divider
        />
      </Section>

      {saveError ? (
        <Text testID="settings-workout-preferences-error" style={styles.errorText}>
          {saveError}
        </Text>
      ) : null}

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        testID="weekly-workout-goal-sheet"
      >
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Weekly Workout Goal</Text>
        {WORKOUT_FREQUENCY_OPTIONS.map((option, index) => (
          <ListRow
            key={option.value}
            testID={`weekly-workout-goal-${option.value}`}
            title={option.label}
            chevron={false}
            divider={index > 0}
            trailing={
              option.value === profile?.workoutFrequencyDays ? (
                <Text style={{ color: colors.textSecondary }}>✓</Text>
              ) : undefined
            }
            onPress={() => void handleSelect(option.value)}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={comfortSheetOpen}
        onClose={() => setComfortSheetOpen(false)}
        testID="training-comfort-sheet"
      >
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
          How confident are you in planning and progressing your workouts?
        </Text>
        <View style={localStyles.comfortOptions}>
          <TrainingComfortSelector
            testID="training-comfort"
            value={profile?.trainingComfort ?? null}
            onChange={(value) => void handleSelectComfort(value)}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={prioritiesDraft !== null}
        onClose={() => setPrioritiesDraft(null)}
        testID="training-priorities-sheet"
      >
        <ScrollView>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
            What would you like to prioritize in the gym?
          </Text>
          <Text style={localStyles.sheetLine}>
            Up to {MAX_PRIORITIES}. They get extra attention in the programs we suggest -- you still
            train everything.
          </Text>
          <View style={localStyles.sheetBody}>
            <PriorityTiles
              testID="training-priorities"
              tilePrefix="training-priority"
              value={prioritiesDraft ?? []}
              onChange={setPrioritiesDraft}
            />
          </View>
          <PrimaryButton
            testID="training-priorities-save"
            label="Save"
            onPress={() => void handleSavePriorities(prioritiesDraft ?? [])}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={equipmentSheetOpen}
        onClose={() => setEquipmentSheetOpen(false)}
        testID="equipment-access-sheet"
      >
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Where do you train?</Text>
        {EQUIPMENT_ACCESS_OPTIONS.map((option, index) => (
          <ListRow
            key={option.value}
            testID={`equipment-access-${option.value}`}
            icon={option.icon}
            title={option.label}
            subtitle={option.description}
            chevron={false}
            divider={index > 0}
            trailing={
              option.value === profile?.equipmentAccess ? (
                <Text style={{ color: colors.textSecondary }}>✓</Text>
              ) : undefined
            }
            onPress={() => void handleSelectEquipment(option.value)}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={homeDraft !== null}
        onClose={() => setHomeDraft(null)}
        testID="home-equipment-sheet"
      >
        <ScrollView>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
            What equipment do you have at home?
          </Text>
          <Text style={localStyles.sheetLine}>
            Home programs that use it are recommended; every one can still be browsed.
          </Text>
          <View style={localStyles.sheetBody}>
            <HomeEquipmentTiles
              testID="home-equipment"
              tilePrefix="home-equipment"
              value={homeDraft ?? []}
              onChange={setHomeDraft}
            />
          </View>
          <PrimaryButton
            testID="home-equipment-save"
            label="Save"
            onPress={() => void handleSaveHomeEquipment(homeDraft ?? [])}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={exclusionsDraft !== undefined}
        onClose={() => setExclusionsDraft(undefined)}
        testID="training-exclusions-sheet"
      >
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
          Anything you&apos;d rather not train directly?
        </Text>
        <Text style={localStyles.sheetLine}>
          Programs that leave it out are suggested first. An area you prioritize can&apos;t be left
          out.
        </Text>
        <View style={localStyles.sheetBody}>
          <ExclusionTiles
            testID="training-exclusions"
            tilePrefix="training-exclusion"
            value={exclusionsDraft ?? null}
            priorities={priorities}
            onChange={(next) => setExclusionsDraft(next)}
          />
        </View>
        <PrimaryButton
          testID="training-exclusions-save"
          label="Save"
          onPress={() => void handleSaveExclusions(exclusionsDraft ?? [])}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
      </BottomSheet>

      <RepRangeSheet
        draft={rangeDraft}
        onChangeDraft={setRangeDraft}
        onClose={() => setRangeDraft(null)}
        onSave={(next) => void handleSaveRange(next)}
      />
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  comfortOptions: {
    marginTop: spacing.md,
  },
  sheetLine: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sheetBody: {
    marginVertical: spacing.md,
  },
});
