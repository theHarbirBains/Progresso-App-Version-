import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Frame, usePrefix } from '../exercises/illustrations/ExerciseIllustration';
import { renderMuscleMap, type MuscleMapView } from '../exercises/illustrations/muscleMap';
import type { MuscleRegion } from '../exercises/illustrations/muscles';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';
import { musclesText } from './programs';

// The regions of the anatomy figure each split muscle group covers.
const GROUP_REGIONS: Record<SplitMuscleGroup, readonly MuscleRegion[]> = {
  chest: ['chest'],
  back: ['lats', 'upperBack', 'traps', 'lowerBack'],
  shoulders: ['frontDelts', 'sideDelts', 'rearDelts'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  abs: ['abs', 'obliques'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  adductors: ['adductors'],
  glutes: ['glutes'],
  calves: ['calves'],
};

// Drawing a figure takes a moment; each set of muscles is drawn once a session.
const drawn = new Map<string, MuscleMapView[]>();

function viewsFor(groups: readonly SplitMuscleGroup[]): MuscleMapView[] {
  const key = [...groups].sort().join(',');
  let views = drawn.get(key);
  if (!views) {
    // Drawn in the figure's gold (its "secondary" tone): here it only says what's trained, so
    // there's no primary or secondary to tell apart.
    views = renderMuscleMap({
      primary: [],
      secondary: [...new Set(groups.flatMap((group) => GROUP_REGIONS[group]))],
    });
    drawn.set(key, views);
  }
  return views;
}

interface Props {
  groups: readonly SplitMuscleGroup[];
  /** The figure's height; each side is as wide as it needs. */
  height: number;
  /** One side, or front and back side by side (the default). */
  sides?: 'front' | 'back' | 'both';
  testID?: string;
}

/**
 * The grey anatomy figure with what a program, or one of its days, trains in gold -- from the
 * front and from behind -- in place of a photo on the program pages. One picture to VoiceOver,
 * naming the muscles.
 */
export const ProgramFigure = memo(function ProgramFigure({
  groups,
  height,
  sides = 'both',
  testID,
}: Props) {
  const prefix = usePrefix();
  const views = viewsFor(groups).filter((view) => sides === 'both' || view.side === sides);
  return (
    <View
      testID={testID}
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={groups.length > 0 ? `Trains ${musclesText(groups)}` : 'Anatomy figure'}
    >
      {views.map((view, i) => (
        <Frame
          key={view.side}
          frame={view.frame}
          viewBox={view.viewBox}
          width={Math.round((height * view.viewBox.width) / view.viewBox.height)}
          height={height}
          prefix={`${prefix}p${i}`}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
