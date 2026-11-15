import { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { ErrorState } from '../design/ErrorState';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonCards } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { getPersonProfile, type ProfileStats } from '../lib/api';
import { useMembership } from '../membership/useMembership';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import { AchievementBadge } from '../social/AchievementBadge';
import { fetchMyNutritionFigures } from '../social/achievementQueries';
import {
  achievementsFor,
  CATEGORIES,
  ranksEarned,
  reachedPerRank,
  type Achievement,
  type NutritionFigures,
} from '../social/achievements';
import { AchievementSheet, RankProgress, rankColor, rankName } from '../social/AchievementSheet';
import { RANKS } from '../social/ranks';
import { achievementsStyles as styles } from './achievementsStyles';

type Props = RootStackScreenProps<'Achievements'>;

interface Figures {
  stats: ProfileStats;
  followers: number;
  /** Null when Nutrition isn't in the membership; 'failed' when it couldn't be read. */
  nutrition: NutritionFigures | null | 'failed';
}

/**
 * Your achievements, from the side menu: every one of them and the rank it has reached, Bronze
 * to Legacy, with how far to the next -- training, consistency, strength and social ones (the
 * ones the people who follow you see on your profile) and, with Nutrition in your membership,
 * nutrition ones only you see. A summary at the top counts the ranks you've earned and how many
 * achievements have reached each. Tapping one lists its nine ranks. Read every time it opens.
 */
export function AchievementsScreen({ navigation }: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const { weightUnit } = useProgressTheme();
  const { nutrition: includesNutrition } = useMembership();

  const [figures, setFigures] = useState<Figures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Achievement | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !userId) return;
    setError(null);
    try {
      const [me, nutrition] = await Promise.all([
        getPersonProfile(accessToken, userId),
        includesNutrition
          ? fetchMyNutritionFigures().catch(() => 'failed' as const)
          : Promise.resolve(null),
      ]);
      if (!me.stats) throw new Error('Could not read your training');
      setFigures({ stats: me.stats, followers: me.followerCount, nutrition });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your achievements');
    }
  }, [accessToken, userId, includesNutrition]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  const achievements = useMemo(
    () =>
      figures
        ? achievementsFor(
            {
              stats: figures.stats,
              followers: figures.followers,
              nutrition: figures.nutrition === 'failed' ? null : figures.nutrition,
            },
            weightUnit,
          )
        : [],
    [figures, weightUnit],
  );

  function renderRow(achievement: Achievement, index: number) {
    return (
      <TouchableOpacity
        key={achievement.id}
        testID={`achievement-${achievement.id}`}
        style={[styles.row, index > 0 && styles.rowDivider]}
        onPress={() => setOpen(achievement)}
        accessibilityRole="button"
        accessibilityLabel={`${achievement.title}, ${rankName(achievement)}. ${achievement.description}: ${achievement.valueLabel}`}
      >
        <AchievementBadge icon={achievement.icon} rank={achievement.rank} size={52} />
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {achievement.title}
            </Text>
            <Text style={[styles.rowRank, { color: rankColor(achievement) }]}>
              {rankName(achievement)}
            </Text>
          </View>
          <Text style={styles.rowDescription} numberOfLines={1}>
            {achievement.description}
          </Text>
          <RankProgress
            achievement={achievement}
            testID={`achievement-${achievement.id}-progress`}
          />
        </View>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  const earned = ranksEarned(achievements);
  const perRank = reachedPerRank(achievements);

  return (
    <Screen
      scrollTestID="achievements-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title="Achievements"
          onBack={() => navigation.goBack()}
          testID="achievements-header"
        />
      }
    >
      {error && !figures ? (
        <ErrorState testID="achievements-error" message={error} onRetry={() => void load()} />
      ) : !figures ? (
        <SkeletonCards testID="achievements-loading" heights={[180, 260, 260]} />
      ) : (
        <>
          <AppCard hero testID="achievements-summary">
            <View style={styles.summaryTop}>
              <Text style={styles.summaryFigure}>{earned}</Text>
              <Text style={styles.summaryOf}>
                of {achievements.length * RANKS.length} ranks earned
              </Text>
            </View>
            <Text style={styles.summaryNote}>
              Every achievement climbs nine ranks, Bronze to Legacy. The first come quickly --
              Legacy takes years.
            </Text>
            <View style={styles.ladder}>
              {RANKS.map((rank, index) => (
                <View
                  key={rank.id}
                  testID={`achievements-ladder-${rank.id}`}
                  style={styles.ladderStep}
                  accessible
                  accessibilityLabel={`${rank.name}: ${perRank[index]} ${
                    perRank[index] === 1 ? 'achievement' : 'achievements'
                  }`}
                >
                  <AchievementBadge
                    icon="award"
                    rank={index}
                    size={28}
                    dim={perRank[index] === 0}
                  />
                  <Text style={[styles.ladderCount, { color: rank.color }]}>{perRank[index]}</Text>
                </View>
              ))}
            </View>
          </AppCard>

          {CATEGORIES.map((category) => {
            const inCategory = achievements.filter((a) => a.category === category.id);
            const nutritionFailed = category.id === 'nutrition' && figures.nutrition === 'failed';
            if (inCategory.length === 0 && !nutritionFailed) return null;
            return (
              <View key={category.id} style={styles.section} testID={`achievements-${category.id}`}>
                <View style={styles.sectionHeader}>
                  <SectionHeader label={category.label} />
                  {category.id === 'nutrition' ? (
                    <Text style={styles.sectionNote}>Only you see these</Text>
                  ) : null}
                </View>
                <AppCard>
                  {nutritionFailed ? (
                    <Text testID="achievements-nutrition-error" style={styles.error}>
                      Your nutrition achievements couldn&apos;t be read. Open this page again to try
                      again.
                    </Text>
                  ) : (
                    inCategory.map(renderRow)
                  )}
                </AppCard>
              </View>
            );
          })}
        </>
      )}
      <AchievementSheet
        achievement={open}
        onClose={() => setOpen(null)}
        testID="achievements-sheet"
      />
    </Screen>
  );
}
