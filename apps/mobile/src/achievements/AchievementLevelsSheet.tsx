import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AnimatedBar } from '../design/AnimatedBar';
import { BottomSheet } from '../design/BottomSheet';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { goalText, levelText, type AchievementStatus } from './achievementProgress';
import { AchievementEmblem } from './AchievementEmblem';

/**
 * One achievement's levels, from the Achievements page: its emblem, name, level and what it's
 * for, the AP it's brought out of all it can, then every level as a divided row -- what it takes
 * and the AP it pays. Levels reached are ticked in the accent; the next one shows the bar toward
 * it and where you are; the rest are faded.
 */
export function AchievementLevelsSheet({
  status,
  weightUnit,
  accentColor,
  onClose,
  testID = 'achievement-levels',
}: {
  status: AchievementStatus | null;
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onClose: () => void;
  testID?: string;
}) {
  const definition = status?.definition;
  const available = definition?.levels.reduce((sum, level) => sum + level.ap, 0) ?? 0;
  return (
    <BottomSheet visible={status !== null} onClose={onClose} testID={testID}>
      {status && definition ? (
        <>
          <View style={styles.head}>
            <AchievementEmblem
              icon={definition.icon}
              level={status.level}
              levels={status.levels}
              accentColor={accentColor}
              size={64}
            />
            <View style={styles.headText}>
              <Text style={styles.title} accessibilityRole="header">
                {definition.title}
              </Text>
              <Text style={[styles.level, status.earned && { color: accentColor }]}>
                {levelText(status)}
              </Text>
              <Text style={styles.description}>{definition.description}</Text>
            </View>
          </View>
          <Text testID={`${testID}-total`} style={styles.total}>
            {status.apEarned.toLocaleString('en-US')} of {available.toLocaleString('en-US')} AP
            earned
          </Text>
          <ScrollView keyboardDismissMode="on-drag" style={styles.list}>
            {definition.levels.map((level, index) => {
              const reached = level.level <= status.level;
              const next = level.level === status.level + 1;
              // A single unlock says what it's for; a level, what it takes.
              const goal =
                definition.kind === 'single'
                  ? definition.description
                  : goalText(definition, level.goal, weightUnit);
              const name = definition.kind === 'single' ? 'Unlock' : `Level ${level.level}`;
              return (
                <View
                  key={level.level}
                  testID={`${testID}-level-${level.level}`}
                  style={[
                    styles.row,
                    index > 0 && styles.rowDivider,
                    !reached && !next && styles.ahead,
                  ]}
                  accessible
                  accessibilityLabel={`${name}: ${goal}, ${level.ap} AP. ${
                    reached
                      ? 'Reached'
                      : next
                        ? `Next -- ${status.progressLabel} so far`
                        : 'Not reached yet'
                  }`}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowName, reached && { color: accentColor }]}>{name}</Text>
                    <Text style={styles.rowGoal}>{goal}</Text>
                    {next ? (
                      <View style={styles.progress}>
                        <View style={styles.bar}>
                          <AnimatedBar fraction={status.progress} color={accentColor} />
                        </View>
                        <Text style={styles.progressLabel}>{status.progressLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.ap,
                      { color: reached || next ? accentColor : colors.textSecondary },
                    ]}
                  >
                    +{level.ap.toLocaleString('en-US')} AP
                  </Text>
                  <View style={styles.mark}>
                    {reached ? <Feather name="check" size={18} color={accentColor} /> : null}
                  </View>
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
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  level: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  description: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  total: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
    marginTop: spacing.md,
  },
  list: {
    marginTop: spacing.sm,
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
  ahead: {
    opacity: 0.55,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  rowGoal: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bar: {
    flex: 1,
  },
  progressLabel: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  ap: {
    ...typeScale.statSmall,
  },
  mark: {
    width: 18,
    alignItems: 'center',
  },
});
