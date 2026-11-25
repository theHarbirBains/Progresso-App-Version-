import type { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { ChoiceTile } from '../design/ChoiceTile';
import { GlyphWell } from '../design/GlyphWell';
import { RiseIn } from '../design/RiseIn';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';
import { includesNutrition, membershipOption } from '../membership/membershipTiers';
import { useAppTheme } from '../theme/appThemeContext';
import {
  equipmentLabel,
  PRIORITY_LABELS,
  programById,
  splitNameFor,
  TRAINING_EXCLUSION_LABELS,
  variationById,
} from '../programs/programs';
import { WORKOUT_SPLIT_PRESETS } from '../workouts/workoutSplitPresets';
import type { OnboardingDraft, OnboardingStep } from './onboardingDraft';
import {
  AVERAGE_WORKOUT_LENGTH_OPTIONS,
  FITNESS_GOAL_OPTIONS,
  TRAINING_COMFORT_OPTIONS,
  WORKOUT_FREQUENCY_OPTIONS,
} from './onboardingOptions';

interface Item {
  step: OnboardingStep;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  /** Across the whole row. */
  wide?: boolean;
}

/** What each answer reads as here; nothing for one not given. */
function itemsFor(draft: OnboardingDraft): Item[] {
  const items: Item[] = [];
  // In the order picked.
  const goals = draft.fitnessGoals
    .map((goal) => FITNESS_GOAL_OPTIONS.find((option) => option.value === goal))
    .filter((option) => option !== undefined);
  if (goals.length > 0) {
    items.push({
      step: 'fitnessGoal',
      icon: 'target',
      label: goals.length === 1 ? 'Goal' : 'Goals',
      value: goals.map((goal) => goal.label).join(', '),
      wide: true,
    });
  }
  const frequency = WORKOUT_FREQUENCY_OPTIONS.find(
    (option) => option.value === draft.workoutFrequencyDays,
  );
  if (frequency) {
    items.push({
      step: 'workoutFrequency',
      icon: 'calendar',
      label: 'Training',
      value: `${frequency.label} a week`,
    });
  }
  const length = AVERAGE_WORKOUT_LENGTH_OPTIONS.find(
    (option) => option.value === draft.averageWorkoutLength,
  );
  if (length) {
    items.push({
      step: 'averageWorkoutLength',
      icon: 'clock',
      label: 'Workouts',
      value: length.label,
    });
  }
  const comfort = TRAINING_COMFORT_OPTIONS.find((option) => option.value === draft.trainingComfort);
  if (comfort) {
    items.push({
      step: 'trainingComfort',
      icon: 'bar-chart-2',
      label: 'Experience',
      value: comfort.label,
      wide: true,
    });
  }
  if (draft.trainingPriorities.length > 0) {
    items.push({
      step: 'trainingPriorities',
      icon: 'crosshair',
      label: draft.trainingPriorities.length === 1 ? 'Priority' : 'Priorities',
      value: draft.trainingPriorities.map((area) => PRIORITY_LABELS[area]).join(', '),
      wide: true,
    });
  }
  if (draft.equipmentAccess) {
    items.push({
      step: 'equipmentAccess',
      icon: 'map-pin',
      label: 'Where You Train',
      value: equipmentLabel(draft.equipmentAccess),
    });
  }
  if (draft.trainingExclusions) {
    items.push({
      step: 'trainingExclusions',
      icon: 'slash',
      label: 'Left Out',
      value:
        draft.trainingExclusions.length > 0
          ? draft.trainingExclusions.map((area) => TRAINING_EXCLUSION_LABELS[area]).join(', ')
          : 'Nothing',
    });
  }
  const preset = WORKOUT_SPLIT_PRESETS.find((p) => p.id === draft.selectedSplitPresetId);
  const program = draft.selectedProgram ? programById(draft.selectedProgram.programId) : null;
  items.push({
    step: 'workoutSplit',
    icon: program ? 'award' : 'grid',
    label: program ? 'Program' : 'Split',
    value:
      program && draft.selectedProgram
        ? splitNameFor(program, variationById(program, draft.selectedProgram.variationId))
        : preset
          ? preset.name
          : draft.wantsCustomSplit
            ? 'Your own'
            : 'Choose later',
  });
  if (draft.membershipTier) {
    items.push({
      step: 'membership',
      icon: membershipOption(draft.membershipTier).icon,
      label: 'Membership',
      value: membershipOption(draft.membershipTier).name,
    });
  }
  if (draft.membershipTier && includesNutrition(draft.membershipTier)) {
    const targets = draft.nutritionTargets;
    items.push({
      step: 'nutritionTargets',
      icon: 'zap',
      label: 'Daily Targets',
      value: targets
        ? [
            targets.calories != null ? `${targets.calories.toLocaleString('en-US')} cal` : null,
            targets.proteinG != null ? `${targets.proteinG} g protein` : null,
            targets.carbsG != null ? `${targets.carbsG} g carbs` : null,
            targets.fatG != null ? `${targets.fatG} g fat` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : 'Set them later',
      wide: true,
    });
  }
  return items;
}

/** Lays the items out two to a row, a wide one on a row of its own. */
function rowsOf(items: Item[]): Item[][] {
  const rows: Item[][] = [];
  let pending: Item | null = null;
  for (const item of items) {
    if (item.wide) {
      rows.push([item]);
    } else if (pending) {
      rows.push([pending, item]);
      pending = null;
    } else {
      pending = item;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

interface Props {
  testID: string;
  draft: OnboardingDraft;
  /** Back to an answer's own step, to change it. */
  onEdit: (step: OnboardingStep) => void;
}

/**
 * Your plan is ready: what they chose, at a glance, before the account is made -- each answer a
 * widget tile (its glyph, what it is in `caption`, the answer), two to a row, the longer ones
 * (goals, experience, daily targets) across the row. A tap goes back to that question to change
 * it, and on from there comes straight back here.
 */
export function PlanSummary({ testID, draft, onEdit }: Props) {
  const accent = useAppTheme().accent.accent;
  return (
    <View testID={testID} style={styles.grid}>
      {rowsOf(itemsFor(draft)).map((row) => (
        <RiseIn key={row.map((item) => item.step).join('-')}>
          <View style={styles.row}>
            {row.map((item) => (
              <ChoiceTile
                key={item.step}
                testID={`${testID}-${item.step}`}
                onPress={() => onEdit(item.step)}
                accessibilityLabel={`${item.label}: ${item.value}. Change`}
                style={styles.cell}
              >
                <View style={styles.tile}>
                  <GlyphWell icon={item.icon} accentColor={accent} size={32} />
                  <View style={styles.text}>
                    <Text style={styles.label}>{item.label}</Text>
                    <Text style={styles.value}>{item.value}</Text>
                  </View>
                </View>
              </ChoiceTile>
            ))}
            {row.length === 1 && !row[0]!.wide ? <View style={styles.cell} /> : null}
          </View>
        </RiseIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  value: {
    ...typeScale.callout,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
});
