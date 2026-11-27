import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { figureSexFor } from '../exercises/MuscleBrowseStrip';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { colors } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useProfileIfAny } from '../profile/profileContext';
import { mixHex } from '../theme/accentColor';
import { ACTIVITY_LEVEL_LABELS, type ActivityLevel, type GroupActivity } from './muscleActivity';
import { MUSCLE_HEATMAP, TAP_CODES, type HeatmapSide } from './muscleHeatmap.generated';

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

/** How far round a tap in a gap between muscles looks for one, in tap-map cells. */
const TAP_REACH = 2;
/** The other muscles' colour while one is chosen: still there, but quiet. */
const DIMMED = 0.3;

/** Harbir's figure for the person's sex, or the other's where that one isn't drawn yet. */
function heatmapFor(sex: 'male' | 'female'): Record<FigureSide, HeatmapSide> | null {
  return MUSCLE_HEATMAP[sex] ?? MUSCLE_HEATMAP.male ?? MUSCLE_HEATMAP.female ?? null;
}

/**
 * The muscle group at a point of the figure (0-1 across and down), from its tap map: the group
 * there, or -- in a gap between muscles -- the nearest within a cell or two.
 */
export function groupAt(side: HeatmapSide, x: number, y: number): MuscleGroup | null {
  const rows = side.tapRows;
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const row = Math.floor(y * height);
  const col = Math.floor(x * width);
  const at = (r: number, c: number) =>
    r >= 0 && r < height && c >= 0 && c < width ? rows[r]![c]! : '.';
  for (let reach = 0; reach <= TAP_REACH; reach += 1) {
    for (let dr = -reach; dr <= reach; dr += 1) {
      for (let dc = -reach; dc <= reach; dc += 1) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== reach) continue;
        const code = at(row + dr, col + dc);
        if (code !== '.') return TAP_CODES[code] ?? null;
      }
    }
  }
  return null;
}

/**
 * Muscle Activity's heat map, from the front or behind: Harbir's figure (a man's or a woman's, by
 * the person's sex), the body in grey with each muscle group's muscles over it in the colour of its
 * level (levelColors), a soft glow round them; a group chosen stands out -- in its colour, or a
 * light grey if it's had no recent training -- the rest quieter; a tap on a muscle chooses its
 * group. Turning it round plays a short turn -- narrowing and fading out, then back in from the
 * other side -- and new colours (another period) come in with a soft fade; neither under Reduce
 * Motion.
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
  const reduceMotion = useReduceMotionPreference();
  const art = heatmapFor(figureSexFor(useProfileIfAny()?.gender));
  const palette = useMemo(() => levelColors(accentColor), [accentColor]);
  const levelOf = useMemo(
    () => new Map(activity.map((group) => [group.group, group.level])),
    [activity],
  );

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

  // A new period's colours come in softly: the figure dips and returns as they change.
  const settle = useRef(new Animated.Value(1)).current;
  const firstColors = useRef(true);
  useEffect(() => {
    if (firstColors.current) {
      firstColors.current = false;
      return undefined;
    }
    if (reduceMotion) return undefined;
    settle.setValue(0.35);
    const animation = Animated.timing(settle, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [levelOf, reduceMotion, settle]);

  if (!art) return null;
  const view = art[shown];
  const width = Math.round(height * view.aspect);
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

  const layers = (Object.keys(view.layers) as MuscleGroup[]).flatMap((group) => {
    const color =
      palette[levelOf.get(group) ?? 'none'] ?? (group === selected ? colors.textSecondary : null);
    if (!color) return [];
    return [{ group, source: view.layers[group]!, color }];
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={{
          opacity: Animated.multiply(turn, settle),
          transform: [{ scaleX: turn.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
        }}
      >
        <Pressable
          testID={`${testID}-${shown}`}
          style={{ width, height }}
          onPress={(event) => {
            const group = groupAt(
              view,
              event.nativeEvent.locationX / width,
              event.nativeEvent.locationY / height,
            );
            if (group) onSelect(group);
          }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image
              testID={`${testID}-body`}
              source={view.body}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              accessibilityElementsHidden
            />
            {layers.map(({ group, source, color }) => (
              <Image
                key={group}
                testID={`${testID}-layer-${group}`}
                source={source}
                tintColor={color}
                style={[
                  StyleSheet.absoluteFill,
                  { opacity: selected && group !== selected ? DIMMED : 1 },
                ]}
                contentFit="contain"
                transition={reduceMotion ? 0 : 200}
              />
            ))}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
});
