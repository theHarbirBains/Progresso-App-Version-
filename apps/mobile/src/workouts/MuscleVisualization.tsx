import { View } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';
import { colors } from '../design/theme';
import type { SplitMuscleGroup } from './splitMuscleGroups';

// Maps Progresso's general split-day muscle-group vocabulary (public.
// split_muscle_group, see splitMuscleGroups.ts) onto react-native-body-
// highlighter's anatomical region slugs. Each general category covers
// several of the library's finer regions (e.g. "Back" highlights lats,
// upper-back, and trapezius together), so this is a one-to-many mapping.
const MUSCLE_GROUP_TO_SLUGS: Record<SplitMuscleGroup, Slug[]> = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back', 'trapezius'],
  shoulders: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  abs: ['abs', 'obliques'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
};

export function muscleGroupsToSlugs(muscleGroups: SplitMuscleGroup[]): Slug[] {
  return Array.from(new Set(muscleGroups.flatMap((group) => MUSCLE_GROUP_TO_SLUGS[group])));
}

interface Props {
  muscleGroups: SplitMuscleGroup[];
  /** Always the user's Workout Mode accent color -- never hardcoded per split/day. */
  accentColor: string;
  side: 'front' | 'back';
  scale?: number;
  testID?: string;
}

/**
 * Dynamic anatomical figure highlighting exactly the given muscle groups in
 * the current accent color. Built on react-native-body-highlighter (MIT,
 * built on react-native-svg, already installed) rather than a hand-authored
 * SVG -- no anatomical asset previously existed in this project.
 */
export function MuscleVisualization({ muscleGroups, accentColor, side, scale = 1, testID }: Props) {
  const data: ExtendedBodyPart[] = muscleGroupsToSlugs(muscleGroups).map((slug) => ({
    slug,
    color: accentColor,
  }));

  return (
    <View testID={testID}>
      <Body
        data={data}
        side={side}
        gender="male"
        scale={scale}
        defaultFill={colors.surfaceRaised}
        defaultStroke={colors.border}
        defaultStrokeWidth={1}
      />
    </View>
  );
}
