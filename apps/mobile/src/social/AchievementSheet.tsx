import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { AchievementBadge } from './AchievementBadge';
import type { Achievement } from './achievements';
import { RANKS, TOP_RANK } from './ranks';

/** "Gold", or before the first rank, "No rank yet". */
export function rankName(achievement: Achievement): string {
  return achievement.rank >= 0 ? RANKS[achievement.rank]!.name : 'No rank yet';
}

/** The rank's colour -- muted before the first. */
export function rankColor(achievement: Achievement): string {
  return achievement.rank >= 0 ? RANKS[achievement.rank]!.color : colors.textMuted;
}

/**
 * How far to the next rank: a bar filling in that rank's colour and "Gold at 200 workouts" --
 * or, at Legacy, that it's the top.
 */
export function RankProgress({
  achievement,
  testID,
}: {
  achievement: Achievement;
  testID?: string;
}) {
  const next = achievement.rank + 1;
  const top = achievement.rank >= TOP_RANK;
  const nextRank = RANKS[Math.min(next, TOP_RANK)]!;
  return (
    <View testID={testID} style={styles.progress}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(achievement.progress * 100)}%`,
              backgroundColor: top ? RANKS[TOP_RANK]!.color : nextRank.color,
            },
          ]}
        />
      </View>
      <Text style={styles.progressLabel} numberOfLines={1}>
        {top
          ? 'Legacy -- the top rank'
          : `${achievement.valueLabel} · ${nextRank.name} at ${achievement.goalLabels[next]}`}
      </Text>
    </View>
  );
}

/**
 * One achievement's nine ranks, Bronze to Legacy: what each takes, which are reached (in their
 * colours, ticked) and which is next.
 */
export function AchievementSheet({
  achievement,
  onClose,
  testID = 'achievement-sheet',
}: {
  achievement: Achievement | null;
  onClose: () => void;
  testID?: string;
}) {
  return (
    <BottomSheet visible={achievement !== null} onClose={onClose} testID={testID}>
      {achievement ? (
        <>
          <View style={styles.head}>
            <AchievementBadge icon={achievement.icon} rank={achievement.rank} size={64} />
            <View style={styles.headText}>
              <Text style={styles.title} accessibilityRole="header">
                {achievement.title}
              </Text>
              <Text style={[styles.rank, { color: rankColor(achievement) }]}>
                {rankName(achievement)}
              </Text>
              <Text style={styles.description}>{achievement.description}</Text>
            </View>
          </View>
          <RankProgress achievement={achievement} testID={`${testID}-progress`} />
          <ScrollView style={styles.list}>
            {RANKS.map((rank, index) => {
              const reached = achievement.rank >= index;
              const isNext = index === achievement.rank + 1;
              return (
                <View
                  key={rank.id}
                  testID={`${testID}-rank-${rank.id}`}
                  style={[styles.row, index > 0 && styles.rowDivider]}
                  accessible
                  accessibilityLabel={`${rank.name}: ${achievement.goalLabels[index]}. ${
                    reached ? 'Reached' : isNext ? 'Next' : 'Not reached yet'
                  }`}
                >
                  <AchievementBadge icon={achievement.icon} rank={index} size={30} dim={!reached} />
                  <Text
                    style={[styles.rowName, { color: reached ? rank.color : colors.textSecondary }]}
                  >
                    {rank.name}
                  </Text>
                  <Text style={styles.rowGoal}>{achievement.goalLabels[index]}</Text>
                  {reached ? (
                    <Feather name="check" size={18} color={rank.color} />
                  ) : isNext ? (
                    <Text style={styles.next}>Next</Text>
                  ) : (
                    <View style={styles.rowEnd} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  rank: {
    ...typeScale.label,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  description: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  progress: {
    gap: spacing.xs,
  },
  track: {
    height: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.sm,
  },
  progressLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  list: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowName: {
    ...typeScale.callout,
    width: 84,
  },
  rowGoal: {
    ...typeScale.secondary,
    color: colors.textPrimary,
    flex: 1,
  },
  next: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rowEnd: {
    width: 18,
  },
});
