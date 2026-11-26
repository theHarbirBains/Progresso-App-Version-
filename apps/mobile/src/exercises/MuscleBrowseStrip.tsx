import { Image } from 'expo-image';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { useProfileIfAny } from '../profile/profileContext';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';
import { MUSCLE_TILES } from './muscleTiles.generated';

const TILE_WIDTH = 100;
const TILE_HEIGHT = 116;

/** Whose figures the tiles show: a woman's for a woman, a man's otherwise. */
export function figureSexFor(gender: string | null | undefined): 'male' | 'female' {
  return gender === 'female' ? 'female' : 'male';
}

/**
 * The library's and the picker's Browse by Muscle: a sideways row of tiles, one for each muscle
 * group with exercises -- Harbir's figure of that group, a man's or a woman's by the person's sex
 * (their profile's; a man's when it says neither), the group's name over its faded bottom and how
 * many exercises are for it in the accent -- a tap shows just those (the Muscle filter). Full Body
 * and Other, which have no figure, show a glyph. Shown above the list while nothing is searched
 * for and no muscle is chosen.
 */
export function MuscleBrowseStrip({
  counts,
  onChoose,
  accentColor,
  testID = 'muscle-browse',
}: {
  counts: Partial<Record<MuscleGroup, number>>;
  onChoose: (group: MuscleGroup) => void;
  accentColor: string;
  testID?: string;
}) {
  const sex = figureSexFor(useProfileIfAny()?.gender);
  const groups = MUSCLE_GROUPS.filter((group) => (counts[group] ?? 0) > 0);
  if (groups.length === 0) return null;
  return (
    <View testID={testID} style={styles.wrap}>
      <Text style={styles.kicker}>BROWSE BY MUSCLE</Text>
      <ScrollView
        keyboardDismissMode="on-drag"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {groups.map((group) => {
          const tile = MUSCLE_TILES[sex][group];
          return (
            <TouchableOpacity
              key={group}
              testID={`${testID}-${group}`}
              style={styles.tile}
              onPress={() => onChoose(group)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${MUSCLE_GROUP_LABELS[group]}, ${counts[group]} exercises`}
            >
              {tile ? (
                <Image
                  testID={`${testID}-${group}-${sex}`}
                  source={tile.image}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  contentPosition="top"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={styles.glyph}>
                  <Feather
                    name={group === 'full_body' ? 'user' : 'grid'}
                    size={28}
                    color={colors.textMuted}
                  />
                </View>
              )}
              <View style={styles.words}>
                <Text style={styles.name} numberOfLines={1}>
                  {MUSCLE_GROUP_LABELS[group]}
                </Text>
                <Text style={[styles.count, { color: accentColor }]}>{counts[group]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  row: {
    gap: spacing.sm,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  glyph: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  // The name and count over the figure's faded bottom, as on Harbir's tiles.
  words: {
    position: 'absolute',
    left: spacing.xs,
    right: spacing.xs,
    bottom: spacing.sm,
    alignItems: 'center',
  },
  name: {
    ...typeScale.label,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  count: {
    ...typeScale.caption,
    fontFamily: fonts.mono,
  },
});
