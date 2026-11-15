import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AnimatedBar } from '../design/AnimatedBar';
import { PrimaryButton, TextButton } from '../design/Button';
import { GlassBackground } from '../design/GlassBackground';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useAppTheme } from '../theme/appThemeContext';
import { withAlpha } from '../theme/accentColor';
import { useAchievements } from './achievementsContext';
import { RankEmblem } from './RankEmblem';
import { rankForPoints } from './ranks';

/** While one of these is open, unlocks wait: a live workout is never interrupted. */
const LIVE_ROUTES = new Set(['ActiveWorkout', 'GroupSession', 'TrainerLiveWorkout']);
/** More than this at once shows as a summary, not one by one. */
const LISTED = 4;

/**
 * Shows each batch of newly awarded achievements as it comes in -- never over a live workout,
 * where it waits until you've left it. A new tier comes first, on its own: the emblem rising in,
 * "New Rank" and its name. Then the achievements: one with its glyph, name, what it was for and
 * the AP; several as a list with the total. Under them the rank bar fills from where it was to
 * where it is now. Continue goes on to the next batch; See Achievements opens the page.
 */
export function AchievementUnlockHost({
  currentRouteName,
  onOpenAchievements,
}: {
  currentRouteName: string | undefined;
  onOpenAchievements: () => void;
}) {
  const { unlocks, dismissUnlock } = useAchievements();
  const accent = useAppTheme().accent;
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
  const single = batch.awards.length === 1 ? batch.awards[0] : null;
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
                {single ? 'Achievement Unlocked' : `${batch.awards.length} Achievements Unlocked`}
              </Text>
              {single ? (
                <View style={styles.single}>
                  <View
                    style={[styles.iconWell, { backgroundColor: withAlpha(accent.accent, 0.16) }]}
                  >
                    <Feather name={single.definition.icon} size={30} color={accent.accent} />
                  </View>
                  <Text style={styles.title} accessibilityRole="header">
                    {single.definition.title}
                  </Text>
                  <Text style={styles.description}>{single.definition.description}</Text>
                </View>
              ) : (
                <View style={styles.list}>
                  {batch.awards.slice(0, LISTED).map(({ award, definition }) => (
                    <View key={`${award.achievementId}-${award.periodKey}`} style={styles.listRow}>
                      <Feather name={definition.icon} size={18} color={accent.accent} />
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {definition.title}
                      </Text>
                      <Text style={styles.listAp}>+{award.ap}</Text>
                    </View>
                  ))}
                  {batch.awards.length > LISTED ? (
                    <Text style={styles.more}>and {batch.awards.length - LISTED} more</Text>
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
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
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
  listTitle: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
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
