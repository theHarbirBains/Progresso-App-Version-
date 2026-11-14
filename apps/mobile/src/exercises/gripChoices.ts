import type { MuscleGroup } from './muscleGroups';

/**
 * How an exercise is held or set up -- the part of a machine's identity a beginner most often
 * misses. Where the hands go, or the handle clipped on, changes which muscles work most (on a
 * row, wide works the upper back more; close or neutral, the lats) and how much can be lifted;
 * on a leg machine it's where the feet go. Saved as the exercise's `attachment` (its Grip or
 * Handle), as plain text, so anything can be typed -- these are only the common ones to tap.
 */
export interface GripField {
  label: string;
  placeholder: string;
  /** Why it matters, in one or two plain sentences. */
  helper: string;
  /** What the less obvious choices mean, when there's anything to say. */
  glossary: string | null;
  choices: string[];
}

const LEG_MUSCLES: ReadonlySet<MuscleGroup> = new Set([
  'quadriceps',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
]);

const HANDS: GripField = {
  label: 'Grip or Handle',
  placeholder: 'e.g. Wide grip, V-handle',
  helper:
    'How you hold it: where your hands go on the machine, or the handle you clip on. It changes which muscles work most and how much you can lift. On a row, a wide grip works your upper back more; a close or neutral grip, your lats.',
  glossary: 'Neutral: palms face each other. Overhand: palms down. Underhand: palms up.',
  choices: [
    'Wide grip',
    'Close grip',
    'Neutral grip',
    'Overhand',
    'Underhand',
    'V-handle',
    'Rope',
    'Straight bar',
    'Single handle',
  ],
};

const FEET: GripField = {
  label: 'Foot Position',
  placeholder: 'e.g. Feet high',
  helper:
    'Where your feet go. It changes which muscles work most and how much you can lift. On a leg press, feet high works your glutes and hamstrings more; feet low, your quads.',
  glossary: null,
  choices: ['Feet high', 'Feet low', 'Feet wide', 'Feet close', 'Toes out', 'Toes in'],
};

/** The field for an exercise of this muscle group: foot position for legs, grip otherwise. */
export function gripFieldFor(muscleGroup: MuscleGroup | null): GripField {
  return muscleGroup !== null && LEG_MUSCLES.has(muscleGroup) ? FEET : HANDS;
}

/** The choice the typed text is, if it's one of them (case and spaces aside); '' otherwise. */
export function chosenGrip(field: GripField, text: string): string {
  const wanted = text.trim().toLowerCase();
  return field.choices.find((choice) => choice.toLowerCase() === wanted) ?? '';
}
