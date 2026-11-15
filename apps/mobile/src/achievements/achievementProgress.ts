import { fromKg } from '../lib/units';
import type {
  AchievementAward,
  AchievementCategory,
  AchievementDefinition,
  AchievementMetrics,
} from './achievementQueries';

// How each achievement stands for you, from the catalogue, your awards and your figures --
// earned (when, how many times), or how far along. Pure.

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  workouts: 'Workouts',
  consistency: 'Consistency',
  strength: 'Strength',
  nutrition: 'Nutrition',
  progression: 'Progression',
  exploration: 'Exploration',
  volume: 'Volume',
  social: 'Social',
};

export const CATEGORY_ORDER: AchievementCategory[] = [
  'workouts',
  'consistency',
  'strength',
  'progression',
  'exploration',
  'volume',
  'social',
  'nutrition',
];

export interface AchievementStatus {
  definition: AchievementDefinition;
  earned: boolean;
  /** 1 for a one-time achievement earned; a repeatable one's weeks or months. */
  times: number;
  firstAwardedAt: string | null;
  lastAwardedAt: string | null;
  /** AP it has brought in all. */
  apEarned: number;
  /** Where you are toward it (a repeatable one: this week or month), and what it takes. */
  current: number;
  target: number;
  progress: number;
  /** "12 / 25", "4,200 / 10,000 lb", "6.5% / 10%". */
  progressLabel: string;
}

function count(value: number): string {
  return Math.floor(value).toLocaleString('en-US');
}

/** A figure in its unit -- weight in the reader's own. */
export function figureText(
  value: number,
  unit: AchievementDefinition['unit'],
  weightUnit: 'kg' | 'lb',
): string {
  // Weight to the nearest whole, so a goal set in pounds reads as it was set.
  if (unit === 'kg') return `${count(Math.round(fromKg(value, weightUnit)))} ${weightUnit}`;
  if (unit === 'percent') return `${Number(value.toFixed(1))}%`;
  return count(value);
}

/** What it takes, a weight in the reader's own unit: "Lift 4,536 kg in all". */
export function describe(definition: AchievementDefinition, weightUnit: 'kg' | 'lb'): string {
  return definition.unit === 'kg'
    ? `Lift ${figureText(definition.threshold, 'kg', weightUnit)} in all`
    : definition.description;
}

/** What a repeatable achievement measures this week or month, against what it takes. */
function periodProgress(
  definition: AchievementDefinition,
  metrics: AchievementMetrics,
): { current: number; target: number } {
  switch (definition.metric) {
    case 'week_goal':
      return { current: metrics.week_workouts ?? 0, target: metrics.goal ?? 3 };
    case 'month_workouts':
      return { current: metrics.month_workouts ?? 0, target: definition.threshold };
    case 'week_food_days':
      return { current: metrics.week_food_days ?? 0, target: definition.threshold };
    default:
      // Monthly Dedication: every week of the month, so this week's goal is the step to watch.
      return { current: metrics.week_workouts ?? 0, target: metrics.goal ?? 3 };
  }
}

export function achievementStatuses(
  definitions: AchievementDefinition[],
  awards: AchievementAward[],
  metrics: AchievementMetrics,
  weightUnit: 'kg' | 'lb',
): AchievementStatus[] {
  return definitions.map((definition) => {
    const mine = awards.filter((award) => award.achievementId === definition.id);
    const { current, target } =
      definition.repeats === 'once'
        ? { current: metrics[definition.metric] ?? 0, target: definition.threshold }
        : periodProgress(definition, metrics);
    const shownUnit = definition.repeats === 'once' ? definition.unit : 'count';
    return {
      definition,
      earned: mine.length > 0,
      times: mine.length,
      firstAwardedAt: mine[0]?.awardedAt ?? null,
      lastAwardedAt: mine.at(-1)?.awardedAt ?? null,
      apEarned: mine.reduce((sum, award) => sum + award.ap, 0),
      current,
      target,
      progress: target > 0 ? Math.min(1, Math.max(0, current / target)) : 0,
      // The unit once, at the end: "4,409 / 10,000 lb".
      progressLabel: `${
        shownUnit === 'kg'
          ? count(Math.round(fromKg(Math.min(current, target), weightUnit)))
          : figureText(Math.min(current, target), shownUnit, weightUnit)
      } / ${figureText(target, shownUnit, weightUnit)}`,
    };
  });
}

/** Lifetime AP: the sum of every award. */
export function lifetimePoints(awards: AchievementAward[]): number {
  return awards.reduce((sum, award) => sum + award.ap, 0);
}
