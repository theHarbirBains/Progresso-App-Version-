import type { FitnessGoal } from '../lib/api';
import { equipmentFits, PRIORITY_LABELS, TRAINING_EXCLUSION_LABELS } from './programs';
import type {
  EquipmentAccess,
  PriorityArea,
  ProgramLevel,
  ProgramVariation,
  TrainingExclusion,
  WorkoutProgram,
} from './programTypes';

// Which programs to recommend, from what someone told us -- read only from each variation's
// catalogue profile and its days (programCatalog.ts, programContent.ts), never from anything
// made up about a program. Frequency, the main goal and the areas they put first count most;
// then what they'd rather not train directly, their experience, equipment and session length.

/** What a recommendation is worked out from: onboarding's answers, or the profile's. */
export interface ProgramPreferences {
  /** Days a week they want to train. */
  daysPerWeek: number | null;
  level: ProgramLevel | null;
  /** In the order picked: the first is their main goal. */
  goals: FitnessGoal[];
  priorities: PriorityArea[];
  equipment: EquipmentAccess | null;
  exclusions: TrainingExclusion[];
  /** How long a session they usually have. */
  sessionMinutes: { min: number; max: number } | null;
}

export const NO_PREFERENCES: ProgramPreferences = {
  daysPerWeek: null,
  level: null,
  goals: [],
  priorities: [],
  equipment: null,
  exclusions: [],
  sessionMinutes: null,
};

/** A program recommended, on its variation that fits best, with why in a few words each. */
export interface Recommendation {
  program: WorkoutProgram;
  variation: ProgramVariation;
  reasons: string[];
  score: number;
}

const GOAL_REASONS: Record<FitnessGoal, string> = {
  build_muscle: 'Built for muscle',
  get_stronger: 'Built for strength',
  lose_fat: 'Suits fat loss',
  improve_athletic_performance: 'For athletic performance',
  improve_fitness: 'For overall fitness',
  maintain_fitness: 'Keeps you fit',
  general_health: 'For overall health',
  other: 'Fits your goals',
};

/** "Chest", "Chest and Back", "Chest, Back and Arms". */
function listed(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** Whether there's anything to recommend from. */
export function hasPreferences(prefs: ProgramPreferences): boolean {
  return (
    prefs.daysPerWeek !== null ||
    prefs.level !== null ||
    prefs.goals.length > 0 ||
    prefs.priorities.length > 0 ||
    prefs.equipment !== null ||
    prefs.exclusions.length > 0
  );
}

/**
 * How well one variation fits, with its reasons -- or null where it doesn't fit at all: more days
 * than they have (or two fewer), equipment they haven't got, a level it isn't for, putting first
 * what they'd leave out, or leaving out what they put first.
 */
export function scoreVariation(
  variation: ProgramVariation,
  prefs: ProgramPreferences,
): { score: number; reasons: string[] } | null {
  const reasons: string[] = [];
  let score = variation.default ? 1 : 0;

  // Their days a week: exactly, or one fewer. 1-2 days a week is asked as 1.
  if (prefs.daysPerWeek !== null) {
    const days = Math.max(2, prefs.daysPerWeek);
    if (variation.daysPerWeek > days || variation.daysPerWeek < days - 1) return null;
    if (variation.daysPerWeek === days) {
      score += 40;
      reasons.push(`Fits your ${days} days a week`);
    } else {
      score += 15;
      reasons.push(`${variation.daysPerWeek} days a week`);
    }
  }

  if (prefs.equipment !== null && !equipmentFits(variation.equipment, prefs.equipment)) {
    return null;
  }
  if (
    prefs.level !== null &&
    variation.levels.length > 0 &&
    !variation.levels.includes(prefs.level)
  ) {
    return null;
  }
  if (variation.emphasis.some((area) => (prefs.exclusions as string[]).includes(area))) {
    return null;
  }
  if (variation.excludes.some((area) => (prefs.priorities as string[]).includes(area))) {
    return null;
  }

  // The main goal counts most; another of theirs, less.
  const [mainGoal, ...otherGoals] = prefs.goals;
  if (mainGoal && variation.goals.includes(mainGoal)) {
    score += 25;
    reasons.push(GOAL_REASONS[mainGoal]);
  } else {
    const other = otherGoals.find((goal) => variation.goals.includes(goal));
    if (other) {
      score += 10;
      reasons.push(GOAL_REASONS[other]);
    }
  }

  // What they put first.
  const specific: PriorityArea[] = prefs.priorities.filter((area) => area !== 'balanced');
  if (prefs.priorities.includes('balanced')) {
    if (variation.emphasis.length === 0) {
      score += 20;
      reasons.push('Balanced development');
    } else {
      score -= 10;
    }
  } else if (specific.length > 0) {
    const met = specific.filter((area) => variation.emphasis.includes(area));
    const unasked = variation.emphasis.filter((area) => !specific.includes(area));
    score += met.length * 12 - unasked.length * 4;
    if (met.length > 0) reasons.push(`Puts ${listed(met.map((a) => PRIORITY_LABELS[a]))} first`);
  } else if (variation.emphasis.length === 0) {
    score += 5;
  }

  // What they'd rather not train directly -- and what it leaves out they didn't ask it to.
  for (const exclusion of prefs.exclusions) {
    if (variation.excludes.includes(exclusion)) {
      score += 15;
      reasons.push(TRAINING_EXCLUSION_LABELS[exclusion]);
    } else {
      score -= 10;
    }
  }
  score -= variation.excludes.filter((area) => !prefs.exclusions.includes(area)).length * 8;

  if (prefs.level !== null) score += variation.levels.includes(prefs.level) ? 6 : 3;
  if (prefs.equipment !== null && prefs.equipment !== 'full_gym') {
    if (variation.equipment === prefs.equipment) {
      score += 3;
      reasons.push(prefs.equipment === 'dumbbells' ? 'Dumbbells only' : 'No equipment needed');
    }
  }

  if (prefs.sessionMinutes && variation.sessionMinutes) {
    const fits =
      variation.sessionMinutes.min <= prefs.sessionMinutes.max &&
      variation.sessionMinutes.max >= prefs.sessionMinutes.min;
    if (fits) {
      score += 5;
      reasons.push(`${variation.sessionMinutes.min}-${variation.sessionMinutes.max} min sessions`);
    } else if (variation.sessionMinutes.min > prefs.sessionMinutes.max) {
      score -= 6;
    }
  }

  return { score, reasons };
}

/** A program's variation that fits these preferences best, or null for none. */
export function bestVariation(
  program: WorkoutProgram,
  prefs: ProgramPreferences,
): { variation: ProgramVariation; score: number; reasons: string[] } | null {
  let best: { variation: ProgramVariation; score: number; reasons: string[] } | null = null;
  for (const variation of program.variations) {
    const fit = scoreVariation(variation, prefs);
    if (fit && (!best || fit.score > best.score)) best = { variation, ...fit };
  }
  return best;
}

/**
 * The programs to recommend, best first -- each once, on its variation that fits best -- or none
 * when there's nothing to go on. Ties keep the catalogue's order.
 */
export function recommendPrograms(
  programs: readonly WorkoutProgram[],
  prefs: ProgramPreferences,
  limit = 3,
): Recommendation[] {
  if (!hasPreferences(prefs)) return [];
  const fits: Recommendation[] = [];
  for (const program of programs) {
    const best = bestVariation(program, prefs);
    if (best) fits.push({ program, ...best });
  }
  return fits
    .map((fit, index) => ({ fit, index }))
    .sort((a, b) => b.fit.score - a.fit.score || a.index - b.index)
    .slice(0, limit)
    .map(({ fit }) => fit);
}
