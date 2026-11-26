import { StyleSheet, View } from 'react-native';
import { radii } from '../design/theme';
import { OnboardingTiles } from '../onboarding/OnboardingTiles';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';
import { ProgramFigure } from './ProgramFigure';
import {
  PRIORITY_AREAS,
  PRIORITY_GROUPS,
  PRIORITY_LABELS,
  PRIORITY_SIDE,
  priorityFull,
  togglePriority,
  TRAINING_EXCLUSIONS,
} from './programs';
import { HOME_EQUIPMENT_OPTIONS, toggleHomeEquipment, type HomeEquipment } from './homeEquipment';
import type { PriorityArea, TrainingExclusion } from './programTypes';

/** The anatomy figure with an area's muscles in gold, on a tile's well. */
function AreaFigure({
  groups,
  side,
}: {
  groups: readonly SplitMuscleGroup[];
  side: 'front' | 'back';
}) {
  const accent = useAppTheme().accent.accent;
  return (
    <View style={[styles.well, { backgroundColor: withAlpha(accent, 0.08) }]}>
      <ProgramFigure groups={groups} height={56} sides={side} />
    </View>
  );
}

/**
 * What to prioritize in the gym, as tiles two across -- each its area on the anatomy figure --
 * up to three in the order tapped, or Balanced Development on its own. An area left out
 * (`exclusions`) can't be picked.
 */
export function PriorityTiles({
  value,
  onChange,
  exclusions = [],
  testID,
  tilePrefix,
}: {
  value: PriorityArea[];
  onChange: (next: PriorityArea[]) => void;
  exclusions?: readonly TrainingExclusion[];
  testID: string;
  tilePrefix: string;
}) {
  return (
    <OnboardingTiles<PriorityArea>
      testID={testID}
      tilePrefix={tilePrefix}
      options={PRIORITY_AREAS.map((area) => ({
        value: area,
        label: PRIORITY_LABELS[area],
        art: <AreaFigure groups={PRIORITY_GROUPS[area]} side={PRIORITY_SIDE[area]} />,
      }))}
      isSelected={(area) => value.includes(area)}
      isDisabled={(area) =>
        priorityFull(value, area) || (exclusions as readonly string[]).includes(area)
      }
      onPress={(area) => onChange(togglePriority(value, area))}
    />
  );
}

/** What someone would rather not train directly: Chest, Glutes, or Train Everything. */
export type ExclusionChoice = TrainingExclusion | 'none';

/**
 * Areas to leave out, as tiles -- each on the figure -- and Train Everything, which is its own
 * answer. An area they prioritize can't be left out. `value` null is unanswered.
 */
export function ExclusionTiles({
  value,
  onChange,
  priorities = [],
  testID,
  tilePrefix,
}: {
  value: TrainingExclusion[] | null;
  onChange: (next: TrainingExclusion[] | null, tapped: ExclusionChoice) => void;
  priorities?: readonly PriorityArea[];
  testID: string;
  tilePrefix: string;
}) {
  return (
    <OnboardingTiles<ExclusionChoice>
      testID={testID}
      tilePrefix={tilePrefix}
      options={[
        ...TRAINING_EXCLUSIONS.map((area) => ({
          value: area,
          label: `No Direct ${PRIORITY_LABELS[area]}`,
          art: <AreaFigure groups={PRIORITY_GROUPS[area]} side={PRIORITY_SIDE[area]} />,
        })),
        { value: 'none' as const, label: 'Train Everything', icon: 'check-circle' as const },
      ]}
      isSelected={(choice) =>
        choice === 'none' ? value !== null && value.length === 0 : (value ?? []).includes(choice)
      }
      isDisabled={(choice) =>
        choice !== 'none' && (priorities as readonly string[]).includes(choice)
      }
      onPress={(choice) => {
        if (choice === 'none') {
          onChange([], choice);
          return;
        }
        const current = value ?? [];
        const next = current.includes(choice)
          ? current.filter((area) => area !== choice)
          : [...current, choice];
        // The last one taken off is no answer yet, never Train Everything.
        onChange(next.length > 0 ? next : null, choice);
      }}
    />
  );
}

/**
 * What someone has at home, as tiles two across -- each its glyph -- as many as they have, or No
 * Equipment on its own (it replaces the rest, and any other replaces it).
 */
export function HomeEquipmentTiles({
  value,
  onChange,
  testID,
  tilePrefix,
}: {
  value: readonly HomeEquipment[];
  onChange: (next: HomeEquipment[]) => void;
  testID: string;
  tilePrefix: string;
}) {
  return (
    <OnboardingTiles<HomeEquipment>
      testID={testID}
      tilePrefix={tilePrefix}
      options={HOME_EQUIPMENT_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        icon: option.icon,
      }))}
      isSelected={(item) => value.includes(item)}
      onPress={(item) => onChange(toggleHomeEquipment(value, item))}
    />
  );
}

const styles = StyleSheet.create({
  well: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
