import { dayFromKey, dayKey } from '../../lib/dayKey';
import { shiftDay } from '../logDay';
import { hasData, nutrientIntake, progressOf } from './intake';
import type { NutrientAmounts, NutrientId } from './nutrients';
import type { NutrientDefinition, ReferenceRow } from './nutrientTypes';

// The Micronutrients pages' weekly tracker: each day of a week, Sunday to Saturday (the week the
// Nutrition screen's budget counts), with what it logged. Pure.
//
// A day ahead isn't counted until it comes; a day with nothing logged is missing, never a day of
// eating none; and a nutrient no food that day has data for is unknown that day, never 0.

type Logs = readonly { micronutrients?: NutrientAmounts | null }[];

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface WeekDay {
  key: string;
  /** "S", "M", ... */
  letter: string;
  /** After today: nothing to count yet. */
  future: boolean;
  /** The day's logs; empty when nothing was logged (or it's ahead, or not read yet). */
  logs: Logs;
}

/** `day`'s week, Sunday to Saturday, each day with its logs from what was read (`readDays`). */
export function weekOf(
  day: string,
  readDays: readonly string[],
  readLogs: readonly Logs[] | null,
  now: Date = new Date(),
): WeekDay[] {
  const sunday = shiftDay(day, -dayFromKey(day).getDay());
  const today = dayKey(now);
  const byDay = new Map(readDays.map((key, index) => [key, readLogs?.[index] ?? []]));
  return LETTERS.map((letter, index) => {
    const key = shiftDay(sunday, index);
    return { key, letter, future: key > today, logs: byDay.get(key) ?? [] };
  });
}

export interface NutrientWeekDay {
  key: string;
  letter: string;
  future: boolean;
  /** Anything logged that day. */
  logged: boolean;
  /** The day's total; null when nothing logged that day has data for it. */
  amount: number | null;
  /** Of its reference value; null without an amount or a reference. */
  percent: number | null;
  /** How full its bar is, 0-1, never past full. */
  fraction: number | null;
}

/** One nutrient across the week: each day's total against its reference value. */
export function nutrientWeekDays(
  nutrient: NutrientDefinition,
  week: readonly WeekDay[],
  reference: ReferenceRow | null,
): NutrientWeekDay[] {
  const target = reference?.value ?? null;
  return week.map((day) => {
    const intake = nutrientIntake(day.logs, nutrient.id as NutrientId);
    const amount = hasData(intake) ? intake.amount : null;
    const { percent, fraction } = progressOf(amount ?? 0, target);
    const known = amount !== null && target !== null;
    return {
      key: day.key,
      letter: day.letter,
      future: day.future,
      logged: day.logs.length > 0,
      amount,
      percent: known ? percent : null,
      fraction: known ? fraction : null,
    };
  });
}

export interface WeekSummaryDay {
  key: string;
  letter: string;
  future: boolean;
  logged: boolean;
  /** How many of the nutrients with a daily reference value reached it that day. */
  reached: number;
  /** How many nutrients have a daily reference value for the person. */
  tracked: number;
}

/**
 * The whole week at a glance: each day, how many nutrients reached their daily reference value
 * (an RDA or an AI; the fats with guidance and no number aren't counted) -- out of all of them.
 */
export function weekSummary(
  nutrients: readonly NutrientDefinition[],
  week: readonly WeekDay[],
  referenceFor: (nutrientId: string) => ReferenceRow | null,
): WeekSummaryDay[] {
  const withTarget = nutrients
    .map((nutrient) => ({ nutrient, reference: referenceFor(nutrient.id) }))
    .filter(({ nutrient, reference }) => !nutrient.guidance && reference?.value != null);
  return week.map((day) => {
    let reached = 0;
    for (const { nutrient, reference } of withTarget) {
      const intake = nutrientIntake(day.logs, nutrient.id as NutrientId);
      if (hasData(intake) && intake.amount >= (reference!.value as number)) reached += 1;
    }
    return {
      key: day.key,
      letter: day.letter,
      future: day.future,
      logged: day.logs.length > 0,
      reached,
      tracked: withTarget.length,
    };
  });
}
