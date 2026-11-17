import type { MuscleGroup } from './muscleGroups';

/**
 * Two things that change a movement, kept apart: how it's held -- the grip (`exercises.grip`), or
 * on a leg machine where the feet go -- and what's held: the bar or handle clipped on (the
 * attachment, `exercises.attachment`). A rope held neutral and a straight bar held overhand are
 * different exercises, and so are a wide and a close grip on the same bar. Both are plain text, so
 * anything can be typed; these are only the common ones to tap.
 */
export interface ChoiceField {
  label: string;
  placeholder: string;
  /** What it is and why it matters, in a sentence or two. */
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

const HANDS: ChoiceField = {
  label: 'Grip',
  placeholder: 'e.g. Wide grip',
  helper:
    'How your hands hold it. A wide grip on a row works your upper back more; a close or neutral one, your lats.',
  glossary:
    'Neutral: palms face each other. Overhand: palms down. Underhand: palms up. Mixed: one of each.',
  choices: ['Wide grip', 'Close grip', 'Neutral grip', 'Overhand', 'Underhand', 'Mixed grip'],
};

const FEET: ChoiceField = {
  label: 'Foot Position',
  placeholder: 'e.g. Feet high',
  helper:
    'Where your feet go. On a leg press, feet high works your glutes and hamstrings more; feet low, your quads.',
  glossary: null,
  choices: ['Feet high', 'Feet low', 'Feet wide', 'Feet close', 'Toes out', 'Toes in'],
};

/** What's held: the bar or handle on a cable, or a machine's own. */
export const ATTACHMENT_FIELD: ChoiceField = {
  label: 'Attachment / Handle',
  placeholder: 'e.g. Rope',
  helper: 'What you hold -- the bar or handle clipped on. Your grip is how you hold it.',
  glossary: null,
  choices: ['Straight bar', 'EZ bar', 'Rope', 'D-handle', 'V-handle', 'Lat pulldown bar'],
};

/** The grip field for an exercise of this muscle group: foot position for legs, hands otherwise. */
export function gripFieldFor(muscleGroup: MuscleGroup | null): ChoiceField {
  return muscleGroup !== null && LEG_MUSCLES.has(muscleGroup) ? FEET : HANDS;
}

/** The choice the typed text is, if it's one of them (case and spaces aside); '' otherwise. */
export function chosenChoice(field: ChoiceField, text: string): string {
  const wanted = text.trim().toLowerCase();
  return field.choices.find((choice) => choice.toLowerCase() === wanted) ?? '';
}
