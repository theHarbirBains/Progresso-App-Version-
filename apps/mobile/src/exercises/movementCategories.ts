// What kind of movement an exercise is, for the Exercise Library's Movement filter and an
// exercise's page -- read from the built-in catalogue's own movement pattern
// (`exercises.movement_pattern`, what its illustration's last position does), never guessed from a
// name. A person's own exercise records no pattern, so it has no movement category and is only
// listed while no movement is chosen.

export const MOVEMENT_CATEGORIES = [
  'push',
  'pull',
  'squat',
  'lunge',
  'hinge',
  'isolation',
  'core',
  'carry_hold',
  'conditioning',
] as const;
export type MovementCategory = (typeof MOVEMENT_CATEGORIES)[number];

export const MOVEMENT_CATEGORY_LABELS: Record<MovementCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  squat: 'Squat',
  lunge: 'Lunge',
  hinge: 'Hinge',
  isolation: 'Isolation',
  core: 'Core',
  carry_hold: 'Carry & Hold',
  conditioning: 'Conditioning',
};

/** Each catalogue movement pattern's category. */
const PATTERN_CATEGORY: Record<string, MovementCategory> = {
  horizontal_push: 'push',
  vertical_push: 'push',
  dip: 'push',
  horizontal_pull: 'pull',
  vertical_pull: 'pull',
  pullover: 'pull',
  shrug: 'pull',
  squat: 'squat',
  lunge: 'lunge',
  hinge: 'hinge',
  hip_extension: 'hinge',
  curl: 'isolation',
  triceps_extension: 'isolation',
  fly: 'isolation',
  raise: 'isolation',
  calf_raise: 'isolation',
  knee_flexion: 'isolation',
  knee_extension: 'isolation',
  hip_abduction: 'isolation',
  hip_adduction: 'isolation',
  wrist: 'isolation',
  shoulder_rotation: 'isolation',
  core_rotation: 'core',
  core_flexion: 'core',
  anti_extension: 'core',
  lateral_flexion: 'core',
  hold: 'carry_hold',
  carry: 'carry_hold',
  get_up: 'carry_hold',
  conditioning: 'conditioning',
};

/** The categories every known pattern falls into (for tests: none is left out). */
export function knownMovementPatterns(): string[] {
  return Object.keys(PATTERN_CATEGORY);
}

/** An exercise's movement category, or null where it has no pattern (or one not known yet). */
export function movementCategoryOf(pattern: string | null | undefined): MovementCategory | null {
  return pattern ? (PATTERN_CATEGORY[pattern] ?? null) : null;
}

/** Whether an exercise is of a movement category (none chosen: every exercise is). */
export function matchesMovement(
  row: { movementPattern?: string | null },
  movement: MovementCategory | null | undefined,
): boolean {
  return !movement || movementCategoryOf(row.movementPattern) === movement;
}

/** A few patterns' words, where title case alone wouldn't read right. */
const PATTERN_WORDS: Record<string, string> = {
  anti_extension: 'Anti-Extension',
  get_up: 'Get-Up',
  hold: 'Static Hold',
  wrist: 'Wrist Curl',
};

/** A movement pattern as words: "horizontal_pull" -> "Horizontal Pull". */
export function movementPatternLabel(pattern: string | null | undefined): string | null {
  if (!pattern) return null;
  return (
    PATTERN_WORDS[pattern] ??
    pattern
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}
