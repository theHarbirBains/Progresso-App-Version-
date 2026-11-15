import type { Feather } from '@expo/vector-icons';
import type { ProfileStats } from '../lib/api';
import { fromKg } from '../lib/units';
import { RANKS, TOP_RANK } from './ranks';

// Achievements: each one climbs nine ranks, Bronze to Legacy (ranks.ts), worked out from the
// figures a profile already has -- never stored. The first ranks come in a person's first weeks;
// the last take years of training, so there's always a next one to chase. No streaks anywhere:
// missing a day or a week never takes a rank away. A profile shows the training and social
// ones; nutrition ones are yours alone, on your own Achievements page.

export type AchievementCategory = 'training' | 'consistency' | 'strength' | 'social' | 'nutrition';

export const CATEGORIES: { id: AchievementCategory; label: string }[] = [
  { id: 'training', label: 'Training' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'strength', label: 'Strength' },
  { id: 'social', label: 'Social' },
  { id: 'nutrition', label: 'Nutrition' },
];

/** Your own nutrition figures (my_nutrition_totals), for your nutrition achievements. */
export interface NutritionFigures {
  daysLogged: number;
  foodsLogged: number;
  proteinG: number;
  calories: number;
  recipes: number;
  savedMeals: number;
}

export interface AchievementFigures {
  stats: ProfileStats;
  followers: number;
  /** Only on your own Achievements page; nobody else ever sees these. */
  nutrition?: NutritionFigures | null;
}

/**
 * How a figure reads: a count of something, weight (kg), time (minutes or seconds), protein
 * (grams, shown as weight) or calories.
 */
type Measure =
  | { kind: 'count'; one: string; many: string }
  | { kind: 'weight' }
  | { kind: 'minutes' }
  | { kind: 'seconds' }
  | { kind: 'protein' }
  | { kind: 'calories' };

interface Definition {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  category: AchievementCategory;
  /** What it's for: "Finish workouts". */
  description: string;
  measure: Measure;
  /** Each rank's goal, Bronze to Legacy, in the measure's own unit (kg, minutes, seconds, g). */
  goals: readonly number[];
  value: (figures: AchievementFigures) => number | null;
}

const count = (one: string, many: string): Measure => ({ kind: 'count', one, many });
const HOUR = 60;

const DEFINITIONS: readonly Definition[] = [
  {
    id: 'workouts',
    title: 'Iron Regular',
    icon: 'activity',
    category: 'training',
    description: 'Finish workouts',
    measure: count('workout', 'workouts'),
    goals: [10, 50, 100, 200, 350, 500, 750, 1_000, 1_500],
    value: (f) => f.stats.workouts,
  },
  {
    id: 'volume',
    title: 'Tonnage',
    icon: 'layers',
    category: 'training',
    description: 'Lift weight in all',
    measure: { kind: 'weight' },
    goals: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000],
    value: (f) => f.stats.totalVolumeKg,
  },
  {
    id: 'sets',
    title: 'Set Grinder',
    icon: 'list',
    category: 'training',
    description: 'Finish sets',
    measure: count('set', 'sets'),
    goals: [100, 500, 1_000, 2_500, 5_000, 10_000, 20_000, 35_000, 50_000],
    value: (f) => f.stats.totalSets,
  },
  {
    id: 'reps',
    title: 'Rep Machine',
    icon: 'repeat',
    category: 'training',
    description: 'Do reps',
    measure: count('rep', 'reps'),
    goals: [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
    value: (f) => f.stats.totalReps,
  },
  {
    id: 'time',
    title: 'Time Served',
    icon: 'clock',
    category: 'training',
    description: 'Train for hours',
    measure: { kind: 'minutes' },
    goals: [10, 50, 100, 250, 500, 750, 1_000, 1_500, 2_500].map((hours) => hours * HOUR),
    value: (f) => f.stats.trainingMinutes,
  },
  {
    id: 'session',
    title: 'Big Session',
    icon: 'trending-up',
    category: 'training',
    description: 'Lift weight in one workout',
    measure: { kind: 'weight' },
    goals: [2_000, 4_000, 6_000, 8_000, 10_000, 13_000, 16_000, 20_000, 25_000],
    value: (f) => f.stats.bestSessionVolumeKg,
  },
  {
    id: 'month',
    title: 'Monthly Grind',
    icon: 'calendar',
    category: 'consistency',
    description: 'Finish workouts in one month',
    measure: count('workout', 'workouts'),
    goals: [4, 8, 12, 15, 18, 21, 24, 27, 30],
    value: (f) => f.stats.bestMonthWorkouts,
  },
  {
    id: 'weeks',
    title: 'Consistency Club',
    icon: 'zap',
    category: 'consistency',
    description: 'Have weeks with 3 or more workouts',
    measure: count('week', 'weeks'),
    goals: [1, 5, 10, 25, 50, 100, 200, 300, 500],
    value: (f) => f.stats.strongWeeks,
  },
  {
    id: 'committed',
    title: 'Committed',
    icon: 'check-circle',
    category: 'consistency',
    description: 'Have months with 12 or more workouts',
    measure: count('month', 'months'),
    goals: [1, 3, 6, 12, 24, 36, 60, 84, 120],
    value: (f) => f.stats.committedMonths,
  },
  {
    id: 'prs',
    title: 'Record Breaker',
    icon: 'award',
    category: 'strength',
    description: 'Hold personal records',
    measure: count('PR', 'PRs'),
    goals: [1, 10, 25, 50, 100, 200, 350, 500, 750],
    value: (f) => f.stats.prCount,
  },
  {
    id: 'maxes',
    title: 'True Strength',
    icon: 'target',
    category: 'strength',
    description: 'Hold true 1RMs -- a single on an exercise',
    measure: count('1RM', '1RMs'),
    goals: [1, 3, 5, 10, 15, 20, 30, 40, 50],
    value: (f) => f.stats.oneRepMaxCount,
  },
  {
    id: 'exercises',
    title: 'Explorer',
    icon: 'compass',
    category: 'strength',
    description: 'Do different exercises',
    measure: count('exercise', 'exercises'),
    goals: [5, 15, 25, 40, 60, 80, 100, 125, 150],
    value: (f) => f.stats.exerciseCount,
  },
  {
    id: 'bodyweight',
    title: 'Bodyweight Hero',
    icon: 'user',
    category: 'strength',
    description: 'Do bodyweight reps',
    measure: count('rep', 'reps'),
    goals: [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000],
    value: (f) => f.stats.bodyweightReps,
  },
  {
    id: 'timed',
    title: 'Iron Core',
    icon: 'watch',
    category: 'strength',
    description: 'Hold timed sets',
    measure: { kind: 'seconds' },
    goals: [5, 15, 30, 60, 120, 300, 600, 1_200, 3_000].map((minutes) => minutes * 60),
    value: (f) => f.stats.timedSeconds,
  },
  {
    id: 'groups',
    title: 'Squad Goals',
    icon: 'users',
    category: 'social',
    description: 'Train in group workouts',
    measure: count('group workout', 'group workouts'),
    goals: [1, 5, 10, 25, 50, 100, 200, 350, 500],
    value: (f) => f.stats.groupWorkouts,
  },
  {
    id: 'followers',
    title: 'Crowd Favourite',
    icon: 'user-plus',
    category: 'social',
    description: 'Gain followers',
    measure: count('follower', 'followers'),
    goals: [1, 5, 10, 25, 50, 100, 250, 500, 1_000],
    value: (f) => f.followers,
  },
  {
    id: 'likes-received',
    title: 'Hype Magnet',
    icon: 'heart',
    category: 'social',
    description: 'Get likes on your workouts',
    measure: count('like', 'likes'),
    goals: [1, 10, 50, 100, 250, 500, 1_000, 2_500, 5_000],
    value: (f) => f.stats.likesReceived,
  },
  {
    id: 'likes-given',
    title: 'Cheerleader',
    icon: 'thumbs-up',
    category: 'social',
    description: "Like your friends' workouts",
    measure: count('like', 'likes'),
    goals: [1, 10, 50, 100, 250, 500, 1_000, 2_500, 5_000],
    value: (f) => f.stats.likesGiven,
  },
  {
    id: 'food-days',
    title: 'Fuel Logger',
    icon: 'book-open',
    category: 'nutrition',
    description: 'Log food on different days',
    measure: count('day', 'days'),
    goals: [1, 7, 30, 60, 100, 200, 365, 730, 1_095],
    value: (f) => f.nutrition?.daysLogged ?? null,
  },
  {
    id: 'foods',
    title: 'Food Diary',
    icon: 'edit-3',
    category: 'nutrition',
    description: 'Log foods',
    measure: count('food', 'foods'),
    goals: [10, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 20_000],
    value: (f) => f.nutrition?.foodsLogged ?? null,
  },
  {
    id: 'protein',
    title: 'Protein Stack',
    icon: 'battery-charging',
    category: 'nutrition',
    description: 'Log protein in all',
    measure: { kind: 'protein' },
    goals: [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 200_000, 350_000, 500_000],
    value: (f) => f.nutrition?.proteinG ?? null,
  },
  {
    id: 'calories',
    title: 'Fuel Tank',
    icon: 'sun',
    category: 'nutrition',
    description: 'Log calories in all',
    measure: { kind: 'calories' },
    goals: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 3_500_000, 5_000_000],
    value: (f) => f.nutrition?.calories ?? null,
  },
  {
    id: 'recipes',
    title: 'Home Chef',
    icon: 'coffee',
    category: 'nutrition',
    description: 'Make recipes',
    measure: count('recipe', 'recipes'),
    goals: [1, 3, 5, 10, 20, 35, 50, 75, 100],
    value: (f) => f.nutrition?.recipes ?? null,
  },
  {
    id: 'meals',
    title: 'Meal Prepper',
    icon: 'package',
    category: 'nutrition',
    description: 'Save meals',
    measure: count('saved meal', 'saved meals'),
    goals: [1, 3, 5, 10, 20, 35, 50, 75, 100],
    value: (f) => f.nutrition?.savedMeals ?? null,
  },
];

export interface Achievement {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  category: AchievementCategory;
  description: string;
  value: number;
  /** -1 before the first rank, then 0 (Bronze) to 8 (Legacy). */
  rank: number;
  /** Where they are: "142 workouts". */
  valueLabel: string;
  /** What each rank takes, Bronze to Legacy: "10 workouts". */
  goalLabels: string[];
  /** Toward the next rank, 0 to 1 -- 1 once Legacy. */
  progress: number;
}

/** 42800 -> "42.8K", 1250000 -> "1.25M", 950 -> "950". */
export function compactNumber(value: number): string {
  const whole = Math.floor(value);
  const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));
  if (whole >= 1_000_000) return `${trim(whole / 1_000_000, 2)}M`;
  if (whole >= 1_000) return `${trim(whole / 1_000, 1)}K`;
  return String(whole);
}

/** Commas up to 10,000, then compact: "1,250", "42.8K". */
function countText(value: number): string {
  const whole = Math.floor(value);
  return whole < 10_000 ? whole.toLocaleString('en-US') : compactNumber(whole);
}

/** Two significant figures, so a goal in the other unit reads round: 22046 -> 22000. */
function roughly(value: number): number {
  if (value < 10) return Number(value.toFixed(1));
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

/** A weight already in the reader's unit: "2.2", "450", "22K". */
function weightText(value: number): string {
  if (value < 10) return String(Number(value.toFixed(1)));
  return compactNumber(value);
}

function hoursText(minutes: number): string {
  const hours = minutes / 60;
  const text = hours < 10 ? String(Number(hours.toFixed(1))) : countText(hours);
  return `${text} ${text === '1' ? 'hour' : 'hours'}`;
}

/**
 * How a figure reads in this measure -- a goal (`goal`) rounded so it reads round in the other
 * unit, a person's own figure as it is.
 */
function label(measure: Measure, value: number, unit: 'kg' | 'lb', goal: boolean): string {
  switch (measure.kind) {
    case 'count':
      return `${countText(value)} ${Math.floor(value) === 1 ? measure.one : measure.many}`;
    case 'weight': {
      const inUnit = fromKg(value, unit);
      return `${weightText(goal && unit !== 'kg' ? roughly(inUnit) : inUnit)} ${unit}`;
    }
    case 'protein': {
      const inUnit = fromKg(value / 1000, unit);
      return `${weightText(goal && unit !== 'kg' ? roughly(inUnit) : inUnit)} ${unit}`;
    }
    case 'minutes':
      return hoursText(value);
    case 'seconds':
      return value < 3600 ? `${Math.floor(value / 60)} min` : hoursText(value / 60);
    case 'calories':
      return `${countText(value)} cal`;
  }
}

/** The rank a figure has reached: -1 before Bronze, up to 8 for Legacy. */
export function rankFor(goals: readonly number[], value: number): number {
  let rank = -1;
  goals.forEach((goal, index) => {
    if (value >= goal) rank = index;
  });
  return rank;
}

/**
 * Every achievement these figures rank, in order -- nutrition ones only when the figures carry
 * them (your own page).
 */
export function achievementsFor(figures: AchievementFigures, unit: 'kg' | 'lb'): Achievement[] {
  return DEFINITIONS.flatMap((definition): Achievement[] => {
    const raw = definition.value(figures);
    if (raw === null) return [];
    const value = Math.max(0, raw);
    const rank = rankFor(definition.goals, value);
    const from = rank >= 0 ? definition.goals[rank]! : 0;
    const to = definition.goals[rank + 1];
    return [
      {
        id: definition.id,
        title: definition.title,
        icon: definition.icon,
        category: definition.category,
        description: definition.description,
        value,
        rank,
        valueLabel: label(definition.measure, value, unit, false),
        goalLabels: definition.goals.map((goal) => label(definition.measure, goal, unit, true)),
        progress:
          rank >= TOP_RANK || to === undefined
            ? 1
            : Math.min(1, Math.max(0, (value - from) / (to - from))),
      },
    ];
  });
}

/** Every rank earned across these, counting each achievement's ranks up to its own. */
export function ranksEarned(achievements: Achievement[]): number {
  return achievements.reduce((sum, achievement) => sum + achievement.rank + 1, 0);
}

/** For each rank, Bronze to Legacy, how many of these have reached it. */
export function reachedPerRank(achievements: Achievement[]): number[] {
  return RANKS.map((_, index) => achievements.filter((a) => a.rank >= index).length);
}

/** The highest rank first, then in their usual order. */
export function byRank(achievements: Achievement[]): Achievement[] {
  return achievements
    .map((achievement, index) => ({ achievement, index }))
    .sort((a, b) => b.achievement.rank - a.achievement.rank || a.index - b.index)
    .map(({ achievement }) => achievement);
}
