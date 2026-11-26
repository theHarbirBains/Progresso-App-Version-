import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Frame, usePrefix } from '../exercises/illustrations/ExerciseIllustration';
import {
  regionsOf,
  renderAnatomySide,
  type MuscleMapView,
} from '../exercises/illustrations/muscleMap';
import {
  MUSCLE_REGIONS,
  REGION_GROUP,
  type MuscleRegion,
} from '../exercises/illustrations/muscles';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { colors } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { mixHex } from '../theme/accentColor';
import { ACTIVITY_LEVEL_LABELS, type ActivityLevel, type GroupActivity } from './muscleActivity';

export type FigureSide = 'front' | 'back';

/**
 * Each level's colour on the figure, from the accent: full for recently trained, softer for
 * frequently, faint for less, and none (the figure's own grey) for no recent training -- so more
 * colour always means more training, in any theme.
 */
export function levelColors(accent: string): Record<ActivityLevel, string | null> {
  const grey = '#8C8984';
  return {
    recent: accent,
    frequent: mixHex(accent, grey, 0.35),
    less: mixHex(accent, grey, 0.72),
    none: null,
  };
}

const drawn = new Map<string, MuscleMapView>();

/** The figure from one side with each muscle in its group's colour, drawn once per look. */
function figureFor(side: FigureSide, regionColors: Partial<Record<MuscleRegion, string>>) {
  const key = `${side}:${JSON.stringify(regionColors)}`;
  let view = drawn.get(key);
  if (!view) {
    view = renderAnatomySide(side, { primary: [], secondary: [], colors: regionColors });
    drawn.set(key, view);
    // A handful of looks a session at most; never let it grow without end.
    if (drawn.size > 24) drawn.delete(drawn.keys().next().value as string);
  }
  return view;
}

/**
 * Muscle Activity's anatomy figure, from the front or behind: every muscle in the colour of its
 * group's level (levelColors), the chosen group outlined, and a tap on a muscle choosing its group.
 * Turning it round plays a short turn -- narrowing and fading out, then back in from the other
 * side -- or none under Reduce Motion.
 */
export function MuscleActivityFigure({
  activity,
  side,
  selected,
  onSelect,
  accentColor,
  height,
  testID = 'muscle-activity-figure',
}: {
  activity: readonly GroupActivity[];
  side: FigureSide;
  selected: MuscleGroup | null;
  onSelect: (group: MuscleGroup) => void;
  accentColor: string;
  height: number;
  testID?: string;
}) {
  const prefix = usePrefix();
  const reduceMotion = useReduceMotionPreference();
  const palette = useMemo(() => levelColors(accentColor), [accentColor]);
  const levelOf = useMemo(
    () => new Map(activity.map((group) => [group.group, group.level])),
    [activity],
  );
  const regionColors = useMemo(() => {
    const out: Partial<Record<MuscleRegion, string>> = {};
    for (const region of MUSCLE_REGIONS) {
      const color = palette[levelOf.get(REGION_GROUP[region]) ?? 'none'];
      if (color) out[region] = color;
    }
    return out;
  }, [palette, levelOf]);

  // The side drawn, which follows `side` once the turn is halfway.
  const [shown, setShown] = useState<FigureSide>(side);
  const turn = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (side === shown) return;
    if (reduceMotion) {
      setShown(side);
      return;
    }
    Animated.timing(turn, {
      toValue: 0,
      duration: 130,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setShown(side);
      Animated.timing(turn, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [side, shown, reduceMotion, turn]);

  const view = figureFor(shown, regionColors);
  const outlined = useMemo(
    () => new Set<MuscleRegion>(selected ? regionsOf(selected) : []),
    [selected],
  );
  const width = Math.round((height * view.viewBox.width) / view.viewBox.height);
  const trained = activity.filter((group) => group.level !== 'none');
  const label =
    `Muscle activity from the ${shown}. ` +
    (trained.length > 0
      ? trained
          .map(
            (group) => `${MUSCLE_GROUP_LABELS[group.group]}: ${ACTIVITY_LEVEL_LABELS[group.level]}`,
          )
          .join('. ')
      : 'Nothing trained in this period.');

  return (
    <View style={styles.wrap}>
      <Animated.View
        testID={`${testID}-${shown}`}
        style={{
          opacity: turn,
          transform: [{ scaleX: turn.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
        }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        <Frame
          frame={view.frame}
          viewBox={view.viewBox}
          width={width}
          height={height}
          prefix={prefix}
          onPressRegion={(region) => onSelect(REGION_GROUP[region])}
          outlined={outlined}
          outlineColor={colors.textPrimary}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
});
