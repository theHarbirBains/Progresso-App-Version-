import type { SplitMuscleGroup } from './splitMuscleGroups';
import { WORKOUT_SPLIT_PRESETS } from './workoutSplitPresets';

/** A day the split builder can add in one tap: its name and the muscle groups it trains. */
export interface SplitDayTemplate {
  name: string;
  muscleGroups: SplitMuscleGroup[];
}

/**
 * The split builder's quick-add days: every day of the ready-made presets, each name once, in the
 * order the presets list them (Push, Pull, Legs, Upper, Lower, ...), with the same muscle groups
 * the preset gives it -- so a day added this way is exactly a preset's day.
 */
export const SPLIT_DAY_TEMPLATES: readonly SplitDayTemplate[] = WORKOUT_SPLIT_PRESETS.flatMap(
  (preset) => preset.days,
).filter((day, index, all) => all.findIndex((other) => other.name === day.name) === index);
