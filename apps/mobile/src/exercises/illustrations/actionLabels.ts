// What each position of an illustration is called in the pill under it: the first is where it
// starts, the last what the movement does to get there ("Start", "Press"). Named by the exercise's
// movement pattern (`exercises.movement_pattern`), and by the exercise itself where its frames go
// the other way (a deadlift lifts from the floor, a Romanian deadlift hinges down to it) or there
// are more than two.

/** What the last position does, by movement pattern. */
const PATTERN_ACTIONS: Record<string, string> = {
  anti_extension: 'Roll Out',
  calf_raise: 'Raise',
  carry: 'Walk',
  core_flexion: 'Crunch',
  core_rotation: 'Twist',
  curl: 'Curl',
  fly: 'Open',
  hinge: 'Hinge',
  hip_extension: 'Thrust',
  horizontal_pull: 'Row',
  horizontal_push: 'Press',
  lateral_flexion: 'Bend',
  lunge: 'Lower',
  pullover: 'Lower',
  raise: 'Raise',
  shrug: 'Shrug',
  squat: 'Squat',
  // Every lying, seated and overhead extension starts with the arms straight and bends them.
  triceps_extension: 'Lower',
  vertical_pull: 'Pull',
  vertical_push: 'Press',
  wrist: 'Curl',
};

/** Exercises whose positions aren't the pattern's: the last position's name, or every one's. */
const EXERCISE_LABELS: Record<string, string | readonly string[]> = {
  // Lifted from the floor (or the pins) to standing.
  'bb-deadlift': 'Lift',
  'bb-deficit-deadlift': 'Lift',
  'bb-rack-pull': 'Lift',
  'bb-snatch-grip-deadlift': 'Lift',
  'bb-stiff-leg-deadlift': 'Lift',
  'bb-sumo-deadlift': 'Lift',
  'db-deadlift': 'Lift',
  'db-stiff-leg-deadlift': 'Lift',
  'bb-pin-squat': 'Stand',
  'bw-push-up': 'Lower',
  'bw-pull-up': 'Pull Up',
  'bw-weighted-pull-up': 'Pull Up',
  'bw-hanging-leg-raise': 'Raise',
  'bw-sit-up': 'Sit Up',
  'db-sit-up': 'Sit Up',
  'db-dead-bug': 'Extend',
  'db-plank-drag': 'Drag',
  'bb-landmine-rotation': 'Rotate',
  'bb-landmine-woodchop': 'Chop',
  'db-woodchop': 'Chop',
  'bb-glute-bridge': 'Bridge',
  'db-glute-bridge': 'Bridge',
  'db-single-leg-glute-bridge': 'Bridge',
  'bw-nordic-hamstring-curl': 'Lower',
  'bb-windmill': 'Reach',
  'db-windmill': 'Reach',
  'bb-step-up': 'Step Up',
  'db-step-up': 'Step Up',
  'bb-reverse-lunge': 'Step Back',
  'db-reverse-lunge': 'Step Back',
  'db-forward-lunge': 'Step Forward',
  'bb-walking-lunge': ['Lunge', 'Next Step'],
  'db-walking-lunge': ['Lunge', 'Next Step'],
  'db-kickback': 'Extend',
  'db-pronation': 'Turn',
  'db-supination': 'Turn',
  'bb-push-press': ['Start', 'Dip', 'Press'],
  'bb-bradford-press': ['Start', 'Press Over', 'Lower Behind'],
  'db-cuban-press': ['Start', 'Rotate', 'Press'],
  'db-zottman-curl': ['Start', 'Curl', 'Lower'],
  'bb-finger-curl': ['Fingertips', 'Grip', 'Curl'],
  'db-finger-curl': ['Fingertips', 'Grip', 'Curl'],
  'bb-turkish-get-up': ['Start', 'Prop Up', 'Stand'],
  'db-turkish-get-up': ['Start', 'Prop Up', 'Stand'],
};

/**
 * What each of an exercise's `count` positions is called. One position is held; with more, the
 * first is the start and the last what the movement does, and any between (an exercise named above
 * always names them) is a step.
 */
export function actionLabels(slug: string, pattern: string, count: number): string[] {
  if (count <= 1) return ['Hold'];
  const own = EXERCISE_LABELS[slug];
  if (Array.isArray(own) && own.length === count) return [...own];
  const action = typeof own === 'string' ? own : (PATTERN_ACTIONS[pattern] ?? 'Finish');
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? 'Start' : i === count - 1 ? action : `Step ${i + 1}`,
  );
}
