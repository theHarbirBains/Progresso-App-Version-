/**
 * How a machine is loaded, and its pulley -- two things that make machines training the same
 * muscles very different. One weight stack or two, or plates instead of a stack; and on a cable
 * machine, a pulley that makes each plate on the stack feel heavier or lighter than on another
 * machine, so the same number isn't the same weight. Saved as the exercise's `load_type` and
 * `pulley` (each optional), and part of what makes it one machine (exercise_machine_key).
 */
export const LOAD_TYPES = ['single_stack', 'double_stack', 'plate_loaded'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

export const PULLEYS = ['heavier', 'lighter'] as const;
export type Pulley = (typeof PULLEYS)[number];

/** As the form's choices show them. */
export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  single_stack: 'Single stack',
  double_stack: 'Double stack',
  plate_loaded: 'Plate loaded',
};

export const PULLEY_LABELS: Record<Pulley, string> = {
  heavier: 'Heavier',
  lighter: 'Lighter',
};

/** As a machine's line shows its pulley: "Lighter pulley". */
export function pulleyText(pulley: Pulley): string {
  return `${PULLEY_LABELS[pulley]} pulley`;
}

/** Only a weight stack has a pulley to speak of. */
export function hasPulley(loadType: LoadType | null): boolean {
  return loadType !== 'plate_loaded';
}
