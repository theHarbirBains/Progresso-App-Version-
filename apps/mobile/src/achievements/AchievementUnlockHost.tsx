import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import { AnimatedBar } from '../design/AnimatedBar';
import { PrimaryButton, TextButton } from '../design/Button';
import { GlassBackground } from '../design/GlassBackground';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useProgressTheme } from '../progress/useProgressTheme';
import { useAppTheme } from '../theme/appThemeContext';
import { withAlpha } from '../theme/accentColor';
import { achievementStatuses, goalText, type AchievementStatus } from './achievementProgress';
import type { AchievementDefinition } from './achievementQueries';
import { useAchievements, type UnlockBatch } from './achievementsContext';
import { AchievementEmblem } from './AchievementEmblem';
import { RankEmblem } from './RankEmblem';
import { rankForPoints } from './ranks';

/** While one of these is open, unlocks wait: a live workout is never interrupted. */
const LIVE_ROUTES = new Set(['ActiveWorkout', 'GroupSession', 'TrainerLiveWorkout']);
/** More than this at once shows as a summary, not one by one. */
const LISTED = 4;

/** One achievement's part of a batch: the level it was at, the level it's reached, its AP. */
interface LevelUp {
  definition: AchievementDefinition;
  from: number;
  to: number;
  ap: number;
}

function levelUps(batch: UnlockBatch): LevelUp[] {
  const byId = new Map<string, LevelUp>();
  for (const { award, definition } of batch.awards) {
    const seen = byId.get(definition.id);
    if (seen) {
      seen.from = Math.min(seen.from, award.level - 1);
      seen.to = Math.max(seen.to, award.level);
      seen.ap += award.ap;
    } else {
      byId.set(definition.id, { definition, from: award.level - 1, to: award.level, ap: award.ap });
    }
  }
  return [...byId.values()];
}

/** "Level 2 → Level 3", "Level 1", or for a single unlock, "Unlocked". */
function stepText(up: LevelUp): string {
  if (up.definition.kind === 'single') return 'Unlocked';
  return up.from > 0 ? `Level ${up.from} → Level ${up.to}` : `Level ${up.to}`;
}

/**
 * Shows each batch of newly awarded levels as it comes in -- never over a live workout, where it
 * waits until you've left it. A new tier comes first, on its own: the emblem rising in, "New
 * Rank" and its name. Then the achievements: one with its emblem, name, the level it was at and
 * the one it's reached, the AP, and how far to its next level; several as a list, each with its
 * new level and AP, and the total. Under them the rank bar shows where you are now. Continue
 * goes on to the next batch; See Achievements opens the page.
 */
export function AchievementUnlockHost({
  currentRouteName,
  onOpenAchievements,
}: {
  currentRouteName: string | undefined;
  onOpenAchievements: () => void;
}) {
  const { unlocks, dismissUnlock, awards, progress } = useAchievements();
  const accent = useAppTheme().accent;
  const { weightUnit } = useProgressTheme();
  const reduceMotion = useReduceMotionPreference();
  const batch = unlocks[0];
  const live = LIVE_ROUTES.has(currentRouteName ?? '');
  const visible = Boolean(batch) && !live && currentRouteName !== undefined;

  const before = batch ? rankForPoints(batch.pointsBefore) : null;
  const after = batch ? rankForPoints(batch.pointsAfter) : null;
  const tierUp = Boolean(before && after && after.tierIndex > before.tierIndex);
  const [step, setStep] = useState<'rank' | 'achievements'>('achievements');
  useEffect(() => {
    setStep(tierUp ? 'rank' : 'achievements');
  }, [batch?.id, tierUp]);

  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    rise.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) {
      Animated.spring(rise, {
        toValue: 1,
        stiffness: 160,
        damping: 18,
        mass: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, step, batch?.id, reduceMotion, rise]);

  if (!batch || !before || !after) return null;
  const total = batch.pointsAfter - batch.pointsBefore;
  const ups = levelUps(batch);
  const single = ups.length === 1 ? ups[0]! : null;
  // Where the one achievement stands now, toward its next level.
  const now: AchievementStatus | null = single
    ? (achievementStatuses([single.definition], awards, progress, weightUnit)[0] ?? null)
    : null;
  const motion = {
    opacity: rise,
    transform: [
      { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
      { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
    ],
  };

  function finish() {
    dismissUnlock();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.scrim}>
        <Animated.View testID="achievement-unlock" style={[styles.card, motion]}>
          <GlassBackground />
          {step === 'rank' ? (
            <View
              testID="achievement-unlock-rank"
              style={styles.rankUp}
              accessible
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.eyebrow}>New Rank</Text>
              <RankEmblem
                tierIndex={after.tierIndex}
                divisionIndex={after.divisionIndex}
                size={120}
              />
              <Text
                style={[styles.rankName, { color: after.tier.palette.primary }]}
                accessibilityRole="header"
              >
                {after.tier.name}
              </Text>
              <Text style={styles.rankLine}>
                {after.label} · {after.points.toLocaleString('en-US')} AP
              </Text>
              <View style={styles.actions}>
                <PrimaryButton
                  testID="achievement-unlock-continue"
                  label="Continue"
                  onPress={() => setStep('achievements')}
                  accentColor={accent.accent}
                  onAccentColor={accent.onAccent}
                />
              </View>
            </View>
          ) : (
            <View testID="achievement-unlock-awards" accessible accessibilityLiveRegion="polite">
              <Text style={styles.eyebrow}>
                {single
                  ? single.definition.kind === 'single' || single.from === 0
                    ? 'Achievement Unlocked'
                    : 'Level Up'
                  : `${ups.length} Achievements Unlocked`}
              </Text>
              {single ? (
                <View style={styles.single}>
                  <AchievementEmblem
                    icon={single.definition.icon}
                    level={single.to}
                    levels={single.definition.levels.length}
                    accentColor={accent.accent}
                    size={76}
                  />
                  <Text style={styles.title} accessibilityRole="header">
                    {single.definition.title}
                  </Text>
                  <Text
                    testID="achievement-unlock-step"
                    style={[styles.step, { color: accent.accent }]}
                  >
                    {stepText(single)}
                  </Text>
                  <Text style={styles.description}>{single.definition.description}</Text>
                  {now?.next ? (
                    <View testID="achievement-unlock-next" style={styles.next}>
                      <AnimatedBar fraction={now.progress} color={accent.accent} />
                      <Text style={styles.rankLine}>
                        Level {now.next.level} at{' '}
                        {goalText(single.definition, now.next.goal, weightUnit)} · +{now.next.ap} AP
                      </Text>
                    </View>
                  ) : single.definition.kind === 'levels' &&
                    single.to >= single.definition.levels.length ? (
                    <Text style={styles.rankLine}>Every level reached</Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.list}>
                  {ups.slice(0, LISTED).map((up) => (
                    <View key={up.definition.id} style={styles.listRow}>
                      <AchievementEmblem
                        icon={up.definition.icon}
                        level={up.to}
                        levels={up.definition.levels.length}
                        accentColor={accent.accent}
                        size={34}
                      />
                      <View style={styles.listText}>
                        <Text style={styles.listTitle} numberOfLines={1}>
                          {up.definition.title}
                        </Text>
                        <Text style={styles.listStep}>{stepText(up)}</Text>
                      </View>
                      <Text style={styles.listAp}>+{up.ap}</Text>
                    </View>
                  ))}
                  {ups.length > LISTED ? (
                    <Text style={styles.more}>and {ups.length - LISTED} more</Text>
                  ) : null}
                </View>
              )}
              <Text testID="achievement-unlock-ap" style={[styles.ap, { color: accent.accent }]}>
                +{total.toLocaleString('en-US')} AP
              </Text>
              <View style={styles.rankRow}>
                <RankEmblem
                  tierIndex={after.tierIndex}
                  divisionIndex={after.divisionIndex}
                  size={40}
                />
                <View style={styles.rankText}>
                  <Text style={[styles.rankLabel, { color: after.tier.palette.primary }]}>
                    {after.label}
                    {after.label !== before.label ? '  ·  New division' : ''}
                  </Text>
                  <AnimatedBar
                    testID="achievement-unlock-bar"
                    fraction={after.progress}
                    color={after.tier.palette.primary}
                  />
                  <Text style={styles.rankLine}>
                    {(after.to - after.points).toLocaleString('en-US')} AP to{' '}
                    {rankForPoints(after.to).label}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <PrimaryButton
                  testID="achievement-unlock-continue"
                  label="Continue"
                  onPress={finish}
                  accentColor={accent.accent}
                  onAccentColor={accent.onAccent}
                />
                <TextButton
                  testID="achievement-unlock-open"
                  label="See Achievements"
                  onPress={() => {
                    finish();
                    onOpenAchievements();
                  }}
                />
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.surface, 0.92),
  },
  eyebrow: {
    ...typeScale.label,
    color: colors.textSecondaryBright,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  rankUp: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankName: {
    ...typeScale.screenTitle,
    marginTop: spacing.md,
  },
  single: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  step: {
    ...typeScale.label,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  next: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...typeScale.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  listStep: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  listAp: {
    ...typeScale.statSmall,
    color: colors.textSecondaryBright,
  },
  more: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  ap: {
    ...typeScale.statLarge,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  rankText: {
    flex: 1,
    gap: spacing.xs,
  },
  rankLabel: {
    ...typeScale.callout,
  },
  rankLine: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
});
