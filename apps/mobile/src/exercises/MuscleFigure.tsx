import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useProfileIfAny } from '../profile/profileContext';
import type { MuscleGroup } from './muscleGroups';
import { figureSexFor } from './MuscleBrowseStrip';
import { MUSCLE_TILES } from './muscleTiles.generated';

/**
 * Harbir's figure of a muscle group (a man's or a woman's, by the person's sex), on a clear
 * background, for a card to show behind or beside its words: the grey body, and -- with
 * `accentColor` -- its muscles tinted in it over the body, the theme's colour with every muscle's
 * shading kept (tools/muscle-tiles/cut.py's two layers). Decoration only: hidden from assistive
 * tech, and never in the way of a tap. Nothing for a group with no figure (Full Body, Other).
 */
export function MuscleFigure({
  group,
  accentColor,
  width,
  height,
  style,
  testID,
}: {
  group: MuscleGroup;
  /** Its muscles in this colour; without it, the figure alone, all grey. */
  accentColor?: string;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const sex = figureSexFor(useProfileIfAny()?.gender);
  const tile = MUSCLE_TILES[sex][group];
  if (!tile) return null;
  const layer = { width, height } as const;
  return (
    <View
      testID={testID}
      style={[styles.wrap, layer, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={tile.figure} style={[styles.layer, layer]} contentFit="contain" />
      {accentColor ? (
        <Image
          source={tile.muscle}
          style={[styles.layer, layer]}
          contentFit="contain"
          tintColor={accentColor}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
