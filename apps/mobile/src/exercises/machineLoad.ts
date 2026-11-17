/**
 * How a machine is loaded, and where its cable starts -- two things that make machines training
 * the same muscles very different. One weight stack or two, or plates instead of a stack; and on a
 * cable machine, a pulley high, low or in between changes the line of pull. Saved as the
 * exercise's `load_type` and `pulley_position` (each optional), and part of what makes it one
 * machine (exercise_machine_key).
 *
 * The old pulley -- heavier or lighter, a feeling rather than a reference point -- is no longer
 * offered. An exercise saved with one keeps it (`pulley`): it's still part of what tells it apart,
 * and its line still says it.
 */
export const LOAD_TYPES = ['single_stack', 'double_stack', 'plate_loaded'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

export const PULLEYS = ['heavier', 'lighter'] as const;
export type Pulley = (typeof PULLEYS)[number];

export const PULLEY_POSITIONS = ['high', 'mid', 'low', 'adjustable', 'other'] as const;
export type PulleyPosition = (typeof PULLEY_POSITIONS)[number];

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

export const PULLEY_POSITION_LABELS: Record<PulleyPosition, string> = {
  high: 'High',
  mid: 'Mid',
  low: 'Low',
  adjustable: 'Adjustable',
  other: 'Other / Unknown',
};

/** As a machine's line shows an old pulley: "Lighter pulley". */
export function pulleyText(pulley: Pulley): string {
  return `${PULLEY_LABELS[pulley]} pulley`;
}

/** As a machine's line shows where its cable starts: "High pulley"; nothing for other or unknown. */
export function pulleyPositionText(position: PulleyPosition): string | null {
  return position === 'other' ? null : `${PULLEY_POSITION_LABELS[position]} pulley`;
}
