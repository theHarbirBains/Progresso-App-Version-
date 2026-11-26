import { memo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { Frame, usePrefix } from './illustrations/ExerciseIllustration';
import { groupFigure } from './illustrations/muscleMap';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

const FIGURE_HEIGHT = 78;

/** One muscle group on the anatomy figure, from the side that shows it. */
const GroupFigure = memo(function GroupFigure({ group }: { group: MuscleGroup }) {
  const prefix = usePrefix();
  const figure = groupFigure(group);
  if (!figure) {
    return (
      <View style={[styles.figure, styles.noFigure]}>
        <Feather name="grid" size={22} color={colors.textMuted} />
      </View>
    );
  }
  const width = Math.round((FIGURE_HEIGHT * figure.viewBox.width) / figure.viewBox.height);
  return (
    <View style={styles.figure}>
      <Frame
        frame={figure.frame}
        viewBox={figure.viewBox}
        width={width}
        height={FIGURE_HEIGHT}
        prefix={prefix}
      />
    </View>
  );
});

/**
 * The Exercise Library's Browse by Muscle: a sideways row of tiles, one for each muscle group with
 * exercises, each its muscles on the anatomy figure (in the guides' primary red), its name and how
 * many exercises are for it -- a tap shows just those (the Muscle filter). Shown above the list
 * while nothing is searched for and no muscle is chosen.
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
        {groups.map((group) => (
          <TouchableOpacity
            key={group}
            testID={`${testID}-${group}`}
            style={styles.tile}
            onPress={() => onChoose(group)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${MUSCLE_GROUP_LABELS[group]}, ${counts[group]} exercises`}
          >
            <GroupFigure group={group} />
            <Text style={styles.name} numberOfLines={1}>
              {MUSCLE_GROUP_LABELS[group]}
            </Text>
            <Text style={[styles.count, { color: accentColor }]}>{counts[group]}</Text>
          </TouchableOpacity>
        ))}
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
    width: 88,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  figure: {
    height: FIGURE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  noFigure: {
    width: FIGURE_HEIGHT * 0.6,
  },
  name: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  count: {
    ...typeScale.caption,
    fontFamily: fonts.mono,
  },
});
