import { fromKg } from '../lib/units';
import type {
  AchievementAward,
  AchievementCategory,
  AchievementDefinition,
  AchievementLevel,
  AchievementProgressRow,
} from './achievementQueries';

// How each achievement stands for you, from the catalogue, your awards and your progress: the
// level reached, how far to the next, what it takes and what it's worth. Pure.

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  workouts: 'Workouts',
  consistency: 'Consistency',
  strength: 'Strength',
  muscles: 'Muscles',
  progression: 'Progression',
  exploration: 'Exploration',
  volume: 'Volume',
  nutrition: 'Nutrition',
  social: 'Social',
};

export const CATEGORY_ORDER: AchievementCategory[] = [
  'workouts',
  'muscles',
  'strength',
  'progression',
  'volume',
  'consistency',
  'exploration',
  'social',
  'nutrition',
];

export interface AchievementStatus {
  definition: AchievementDefinition;
  /** The level reached: 0 before the first. */
  level: number;
  levels: number;
  earned: boolean;
  /** Every level reached. */
  maxed: boolean;
  /** The figure it's measured on, now. */
  value: number;
  /** The next level, or null once maxed. */
  next: AchievementLevel | null;
  /** Toward the next level, 0 to 1 (from the last goal reached) -- 1 once maxed. */
  progress: number;
  /** "125,400 / 300,000 lb" -- where you are against the next goal. */
  progressLabel: string;
  /** "300,000 lb lifted on biceps" -- the next goal, in your unit. */
  nextGoalLabel: string | null;
  /** AP its levels have brought in all. */
  apEarned: number;
  firstAwardedAt: string | null;
  lastAwardedAt: string | null;
}

function count(value: number): string {
  return Math.floor(value).toLocaleString('en-US');
}

/**
 * A figure in its unit -- weight to the nearest whole in the reader's own, so a goal set in
 * pounds reads as it was set.
 */
export function figureText(
  value: number,
  unit: AchievementDefinition['unit'],
  weightUnit: 'kg' | 'lb',
): string {
  if (unit === 'kg') return `${count(Math.round(fromKg(value, weightUnit)))} ${weightUnit}`;
  if (unit === 'percent') return `${Number(value.toFixed(1))}%`;
  return count(value);
}

/** A level's goal with what it counts: "250 workouts", "300,000 lb lifted on biceps". */
export function goalText(
  definition: AchievementDefinition,
  goal: number,
  weightUnit: 'kg' | 'lb',
): string {
  return `${figureText(goal, definition.unit, weightUnit)} ${definition.goalLabel}`.trim();
}

/** "Level 3 of 8", or for a single unlock, "Unlocked". */
export function levelText(
  status: Pick<AchievementStatus, 'definition' | 'level' | 'levels'>,
): string {
  if (status.definition.kind === 'single') return status.level > 0 ? 'Unlocked' : 'Locked';
  return status.level > 0 ? `Level ${status.level} of ${status.levels}` : 'Not started';
}

export function achievementStatuses(
  definitions: AchievementDefinition[],
  awards: AchievementAward[],
  progress: AchievementProgressRow[],
  weightUnit: 'kg' | 'lb',
): AchievementStatus[] {
  const where = new Map(progress.map((row) => [row.achievementId, row]));
  return definitions.map((definition) => {
    const mine = awards.filter((award) => award.achievementId === definition.id);
    const stood = where.get(definition.id);
    const value = stood?.value ?? 0;
    // Never below a level already awarded, however the figure has changed since.
    const level = Math.max(stood?.level ?? 0, ...mine.map((award) => award.level), 0);
    const levels = definition.levels.length;
    const next = definition.levels.find((l) => l.level === level + 1) ?? null;
    const from = definition.levels.find((l) => l.level === level)?.goal ?? 0;
    const shownValue = next ? Math.min(value, next.goal) : value;
    const currentText =
      definition.unit === 'kg'
        ? count(Math.round(fromKg(shownValue, weightUnit)))
        : figureText(shownValue, definition.unit, weightUnit);
    return {
      definition,
      level,
      levels,
      earned: level > 0,
      maxed: levels > 0 && level >= levels,
      value,
      next,
      progress: next ? Math.min(1, Math.max(0, (value - from) / (next.goal - from))) : 1,
      // The unit once, at the end: "4,409 / 10,000 lb".
      progressLabel: next
        ? `${currentText} / ${figureText(next.goal, definition.unit, weightUnit)}`
        : figureText(value, definition.unit, weightUnit),
      nextGoalLabel: next ? goalText(definition, next.goal, weightUnit) : null,
      apEarned: mine.reduce((sum, award) => sum + award.ap, 0),
      firstAwardedAt: mine[0]?.awardedAt ?? null,
      lastAwardedAt: mine.at(-1)?.awardedAt ?? null,
    };
  });
}

/** Lifetime AP: the sum of every award. */
export function lifetimePoints(awards: AchievementAward[]): number {
  return awards.reduce((sum, award) => sum + award.ap, 0);
}
