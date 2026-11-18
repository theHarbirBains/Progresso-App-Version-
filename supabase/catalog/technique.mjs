// Technique & Setup -- How to Do It's second page -- for every built-in exercise. See ./README.md.
//
// Page 1 teaches the movement; this page teaches what makes this exercise, or this variation of it,
// what it is: its grip, the attachment on the cable, where the feet go, how the body is set, the
// bench's angle. Each card is a short title, a line or two in plain words and one simple picture:
//
//   { kind: 'grip', grip: 'overhand' | 'underhand' | 'neutral' | 'angled', width? }  the hands
//   { kind: 'closeup', focus, frame, mark? }  a close look at the exercise's own drawing (frame 0
//       its first position, 1 its second) around the hands, feet, knee, hips, torso or head, with
//       a straight-back `line`, a knee `angle` or a `plumb` line where that's the point
//   { kind: 'platform', placement: 'low' | 'middle' | 'high' | 'edge', width }  feet on a plate
//   { kind: 'stance', stance: 'hip' | 'shoulder' | 'wide' | 'split' }  the feet from above
//   { kind: 'bench', angle }  the bench's angle, degrees (negative: a decline)
//
// Only what applies is shown: an exercise with nothing particular to its grip gets no grip card.
// generate.mjs checks every active built-in has at least one card and writes them into the app.

const grip = (g, width) => ({ kind: 'grip', grip: g, ...(width ? { width } : {}) });
const closeup = (focus, frame = 0, mark) => ({
  kind: 'closeup',
  focus,
  frame,
  ...(mark ? { mark } : {}),
});
const platform = (placement, width = 'hip') => ({ kind: 'platform', placement, width });
const stance = (s) => ({ kind: 'stance', stance: s });
const bench = (angle) => ({ kind: 'bench', angle });
const card = (title, text, visual) => ({ title, text, visual });

// ------------------------------------------------------------------------------------------- Grips

const GRIP_TITLES = {
  overhand: 'Overhand Grip',
  underhand: 'Underhand Grip',
  neutral: 'Neutral Grip',
  angled: 'Angled Grip',
};

const GRIP_LINES = {
  overhand: 'Palms facing down, away from you.',
  underhand: 'Palms facing up, toward you.',
  neutral: 'Palms facing each other.',
  angled: 'Hands on the angled part of the bar, palms turned slightly in.',
};

// Why the grip matters, by grip and movement.
const GRIP_WHY = {
  'underhand:curl': 'Turning your palms up puts your biceps in their strongest line of pull.',
  'overhand:curl': 'Palms down shifts the work to your forearms and the muscle under your biceps.',
  'neutral:curl': 'Palms in brings your forearms and the muscle under your biceps in with them.',
  'angled:curl': 'The angled grips are easier on your wrists than a straight bar.',
  'underhand:horizontal_pull':
    'Your elbows stay tight to your sides, so your lats and biceps do more.',
  'overhand:horizontal_pull':
    'Your elbows can flare a little, so your upper back does more of the work.',
  'neutral:horizontal_pull': 'Palms in keeps your elbows close, so your lats do more of the work.',
  'angled:horizontal_pull':
    'The angled grips keep your elbows close without straining your wrists.',
  'overhand:vertical_pull': 'Your lats do most of the work as your elbows drive down.',
  'underhand:vertical_pull': 'Your biceps help more, and your elbows stay in front of you.',
  'neutral:vertical_pull': 'Palms in is easy on your shoulders and keeps your elbows close.',
  'overhand:horizontal_push': 'Wrap your thumbs around the bar and keep your wrists straight.',
  'underhand:horizontal_push': 'Palms toward you tucks your elbows and brings in more upper chest.',
  'neutral:horizontal_push': 'Palms in keeps your elbows tucked and is easier on your shoulders.',
  'overhand:vertical_push': 'Stack your wrists right over your elbows.',
  'neutral:vertical_push': 'Palms in is easier on your shoulders and keeps your elbows forward.',
  'overhand:triceps_extension': 'Keep your wrists straight and your thumbs around the bar.',
  'underhand:triceps_extension': 'Palms up keeps your elbows pinned and your wrists out of it.',
  'neutral:triceps_extension': 'Palms in lets you lock out fully with your elbows in.',
  'angled:triceps_extension': 'The angled grips are easier on your wrists and elbows.',
  'overhand:hinge': 'Use straps if your grip gives out before your back and legs do.',
  'neutral:hinge': 'Handles at your sides keep the weight right over your feet.',
  'overhand:shrug': 'Let it hang on straight arms; your shoulders do the lifting.',
  'neutral:shrug': 'Palms facing your sides lets your shoulders rise straight up.',
  'overhand:raise': 'Keep your wrists straight and your thumbs toward each other.',
  'underhand:wrist': 'Rest your forearms; only your wrists move.',
  'overhand:wrist': 'Rest your forearms; only your wrists move.',
};

const WIDTH_LINES = {
  close: 'Hands about shoulder-width or a little closer.',
  shoulder: 'Hands just outside your shoulders.',
  wide: 'Hands well outside your shoulders.',
};

function gripCard(g, pattern, width, extra) {
  const why = GRIP_WHY[`${g}:${pattern}`];
  const lines = [
    pattern === 'hinge' && g === 'overhand'
      ? 'Palms facing your legs, thumbs wrapped around the bar.'
      : GRIP_LINES[g],
    width ? WIDTH_LINES[width] : null,
    extra ?? why ?? null,
  ].filter(Boolean);
  return card(GRIP_TITLES[g], lines.join(' '), grip(g, width));
}

// The catalogue's own grip (Create Exercise's words) as a grip and a width.
const CATALOGUE_GRIPS = {
  'Close neutral': ['neutral', 'close'],
  'Wide overhand': ['overhand', 'wide'],
  'Wide neutral': ['neutral', 'wide'],
  Neutral: ['neutral'],
  Underhand: ['underhand'],
  'Medium overhand': ['overhand', 'shoulder'],
  'Medium neutral': ['neutral', 'shoulder'],
  Overhand: ['overhand'],
  'Angled overhand': ['angled'],
  'Horizontal handles': ['overhand'],
  'Vertical handles': ['neutral'],
};

/** The exercise's grip and width, from its catalogue grip, its name, or how it's usually held. */
export function gripOf(ex) {
  const name = ex.name;
  if (ex.grip && CATALOGUE_GRIPS[ex.grip]) return CATALOGUE_GRIPS[ex.grip];
  const width = /Wide/.test(name) ? 'wide' : /Close|Narrow/.test(name) ? 'close' : undefined;
  if (/EZ/.test(name)) return ['angled', width];
  if (/Reverse.*Curl|Reverse.*Wrist/.test(name)) return ['overhand', width];
  if (/Reverse-Grip|Underhand|Chin-Up/.test(name)) return ['underhand', width];
  if (/Hammer|Neutral|Rope|V-Handle|Parallel|Trap Bar/.test(name)) return ['neutral', width];
  return [null, width];
}

// ----------------------------------------------------------------------------------- Attachments

const ATTACHMENT_LINES = {
  Rope: ['Rope', 'Hold the rope just above the knots and pull the ends apart as you finish.'],
  'V-handle': ['V-Handle', 'Your hands sit close together with your palms facing each other.'],
  'Straight bar': ['Straight Bar', 'Hold it overhand, hands about shoulder-width.'],
  'EZ bar': ['EZ Bar', 'Hold the angled grips; they’re easier on your wrists.'],
  'D-handle': ['D-Handle', 'One handle in one hand, so each side works on its own.'],
  'D-handles': ['D-Handles', 'A handle in each hand, so each side works on its own.'],
  'Lat pulldown bar': ['Lat Pulldown Bar', 'Grip it where it bends, well outside your shoulders.'],
  'MAG grip': ['MAG Grip', 'A fixed handle that sets your hands at one spacing every time.'],
  'V-bar': ['V-Bar', 'Hold the angled ends with your thumbs on top.'],
  'Wide neutral-grip bar': [
    'Wide Neutral Bar',
    'Palms facing each other, hands wider than your shoulders.',
  ],
  'Narrow neutral-grip handle': [
    'Narrow Neutral Handle',
    'Palms facing each other, hands close together.',
  ],
  'Ankle strap': ['Ankle Strap', 'Wrap it snug around your ankle and clip it to the cable.'],
  'Cable ends': ['Cable Ends', 'Hold the ends of the cables, one in each hand.'],
};

const PULLEY_LINES = {
  high: 'Clip it to a high pulley.',
  low: 'Clip it to a low pulley.',
  mid: 'Set the pulley at chest height.',
};

function attachmentCard(ex) {
  const known = ATTACHMENT_LINES[ex.attachment];
  if (!known) return null;
  const [title, line] = known;
  const pulley = PULLEY_LINES[ex.pulley] ?? '';
  return card(
    title,
    `${pulley} ${line}`.trim(),
    closeup(ex.attachment === 'Ankle strap' ? 'feet' : 'hands', 0),
  );
}

// ------------------------------------------------------------------------- Bodies, feet, benches

const BENCH = {
  inclinePress: card(
    'Bench Angle',
    'Set the bench to about 30–45°. Any steeper and it turns into a shoulder press.',
    bench(35),
  ),
  incline: card(
    'Bench Angle',
    'Set the bench to about 30–45° and keep your back flat on it.',
    bench(35),
  ),
  decline: card(
    'Bench Angle',
    'Set the bench about 15–30° head-down and hook your legs in before you lie back.',
    bench(-20),
  ),
  flat: card(
    'Flat Bench',
    'Eyes under the bar, feet flat, shoulder blades pulled together and pinned to the bench.',
    bench(0),
  ),
  upright: card(
    'Back Upright',
    'Set the back pad upright, almost straight up, and keep your back flat against it.',
    bench(85),
  ),
};

const SQUAT_STANCE = card(
  'Stance',
  'Feet about shoulder-width, toes turned out a little. Your knees follow your toes all the way down.',
  stance('shoulder'),
);
const SQUAT_DEPTH = card(
  'Depth',
  'Sit down until your thighs are at least level with the floor, keeping your back flat.',
  closeup('knee', 1, 'angle'),
);
const HINGE = card(
  'Hip Hinge',
  'Push your hips back with a soft bend in your knees. Your back stays flat from head to hips.',
  closeup('torso', 1, 'line'),
);
const ROW_ANGLE = card(
  'Torso Angle',
  'Hinge forward to about 45° or lower and keep your back flat the whole set.',
  closeup('torso', 0, 'line'),
);
const SPLIT = card(
  'Split Stance',
  'Take a step long enough that both knees bend to about 90° at the bottom.',
  stance('split'),
);
const SHINS = card(
  'Shins Vertical',
  'At the top, your knees are bent about 90° with your shins straight up and down.',
  closeup('knee', 1, 'angle'),
);
const CALF_EDGE = card(
  'Balls of Your Feet',
  'Only the balls of your feet on the edge, so your heels can sink below it.',
  closeup('feet', 0),
);
const SEAT_CHEST = card(
  'Seat Height',
  'Set the seat so the handles line up with the middle of your chest.',
  closeup('torso', 0),
);
const SEAT_SHOULDER = card(
  'Seat Height',
  'Set the seat so the handles start level with your shoulders.',
  closeup('torso', 0),
);
const KNEE_PIVOT = card(
  'Knee at the Pivot',
  'Line your knees up with the machine’s pivot so the pad moves in the same arc as your legs.',
  closeup('knee', 0),
);
const THIGH_PAD = card(
  'Thigh Pad',
  'Lock your thighs snug under the pad so your body stays down as you pull.',
  closeup('hips', 0),
);
const CHEST_PAD = card(
  'Chest Pad',
  'Set the pad so you can just reach the handles with straight arms and your chest on it.',
  closeup('torso', 0),
);
const TALL = card(
  'Stand Tall',
  'Stay tall with your shoulders level and your ribs down the whole walk.',
  closeup('torso', 0, 'plumb'),
);
const BODY_LINE = card(
  'Straight Line',
  'Keep one straight line from your head to your heels, hips level.',
  closeup('torso', 1, 'line'),
);
const SOFT_ELBOWS = card(
  'Soft Elbows',
  'Keep a slight bend in your elbows that stays the same from start to finish.',
  closeup('hands', 1),
);
const EYES_UP = card(
  'Eyes on the Weight',
  'Keep your arm locked and your eyes on the weight overhead the whole time.',
  closeup('hands', 1),
);
const NECK = card(
  'Relaxed Neck',
  'Hands lightly by your head; curl your ribs up rather than pulling on your neck.',
  closeup('head', 1),
);
const PELVIS = card(
  'Curl Your Pelvis',
  'Finish by curling your pelvis up, so your abs, not just your hip flexors, do the work.',
  closeup('hips', 1),
);
const TWIST_LEAN = card(
  'Lean Back',
  'Lean back to about 45° with a straight back, and turn from your ribs, not just your arms.',
  closeup('torso', 0, 'line'),
);

// Per-exercise cards, where a rule below would miss what makes it what it is.
const OWN = {
  // Chest
  'bb-bench-press': [
    BENCH.flat,
    card(
      'Touch Point',
      'The bar touches your mid-chest with your elbows about 45° from your body.',
      closeup('torso', 0),
    ),
  ],
  'bb-guillotine-press': [
    card(
      'Touch Point',
      'Lower toward the base of your neck with your elbows out. Keep it light.',
      closeup('head', 0),
    ),
    gripCard('overhand', 'horizontal_push', 'wide'),
  ],
  'db-squeeze-press': [
    card(
      'Squeeze',
      'Press the dumbbells into each other the whole time; that squeeze is the point.',
      closeup('hands', 0),
    ),
    gripCard('neutral', 'horizontal_push'),
  ],
  'db-close-grip-press': [gripCard('neutral', 'horizontal_push', 'close')],
  'db-chest-fly': [SOFT_ELBOWS],
  'db-incline-chest-fly': [BENCH.incline, SOFT_ELBOWS],
  'db-decline-chest-fly': [BENCH.decline, SOFT_ELBOWS],
  'bb-pullover': [
    card(
      'Narrow Grip',
      'Hold the bar overhand, hands about shoulder-width or a little closer.',
      grip('overhand', 'close'),
    ),
  ],
  'db-pullover': [
    card(
      'Hold the End',
      'Cup the top plate of one dumbbell with both palms, thumbs around the handle.',
      closeup('hands', 0),
    ),
  ],
  // Back
  'bb-t-bar-row': [
    card(
      'Handle',
      'Hold the handle with your palms facing each other, chest over the bar.',
      grip('neutral', 'close'),
    ),
    ROW_ANGLE,
  ],
  'bb-meadows-row': [
    card(
      'Fat End',
      'Grip the end of the bar overhand, side-on to it in a staggered stance.',
      closeup('hands', 0),
    ),
  ],
  'db-single-arm-row': [
    card(
      'Support',
      'One knee and hand on the bench, back flat and level, the other foot planted.',
      closeup('torso', 0, 'line'),
    ),
  ],
  'db-chest-supported-row': [
    card('Bench Angle', 'Lie chest-down on a bench set to about 30°, feet planted.', bench(30)),
  ],
  'db-renegade-row': [
    card(
      'Plank Base',
      'Hold a plank on the dumbbells with your feet wide for balance.',
      closeup('torso', 0, 'line'),
    ),
  ],
  'bw-inverted-row': [BODY_LINE],
  'mc-assisted-pull-up': [
    card(
      'Knee Pad',
      'Kneel on the pad. More weight on the stack means more help.',
      closeup('knee', 0),
    ),
  ],
  'cb-face-pull': [
    card(
      'Rope',
      'Clip a rope to a high pulley and pull it toward your forehead, ends apart.',
      closeup('hands', 1),
    ),
  ],
  // Shoulders
  'bb-overhead-press': [
    card(
      'Grip',
      'Hands just outside your shoulders, wrists stacked over your elbows.',
      grip('overhand', 'shoulder'),
    ),
    card(
      'Bar Path',
      'Press straight up over your mid-foot: head back, then through as the bar passes.',
      closeup('head', 1, 'plumb'),
    ),
  ],
  'bb-push-press': [
    card(
      'The Dip',
      'A short dip of a few inches with your torso upright, then drive straight up.',
      closeup('knee', 1, 'angle'),
    ),
  ],
  'db-arnold-press': [
    card(
      'Palms Turn',
      'Start with your palms facing you and turn them forward as you press.',
      closeup('hands', 0),
    ),
  ],
  'bb-landmine-press': [
    card(
      'Hold the End',
      'Hold the end of the bar at your shoulder, in a staggered stance.',
      closeup('hands', 0),
    ),
  ],
  'db-lateral-raise': [
    card(
      'Elbows Lead',
      'A slight bend in your elbows, hands never higher than them.',
      closeup('hands', 1),
    ),
  ],
  'db-leaning-lateral-raise': [
    card(
      'Lean Away',
      'Hold something sturdy and lean away from it; the raise starts sooner.',
      closeup('torso', 0, 'line'),
    ),
  ],
  'db-seated-lateral-raise': [
    card(
      'Elbows Lead',
      'Sit tall on the end of a bench and lead with your elbows.',
      closeup('hands', 1),
    ),
  ],
  'db-y-raise': [
    card(
      'Y Shape',
      'Raise your arms up and out into a Y, thumbs pointing up.',
      closeup('hands', 1),
    ),
  ],
  'cb-y-raise': [
    card(
      'Y Shape',
      'Cross the cables, then raise your arms up and out into a Y, thumbs up.',
      closeup('hands', 1),
    ),
  ],
  'db-rear-delt-fly': [
    card(
      'Torso Angle',
      'Hinge until your torso is nearly level, back flat, arms hanging.',
      closeup('torso', 0, 'line'),
    ),
  ],
  'db-incline-rear-delt-fly': [
    card('Bench Angle', 'Lie chest-down on a bench set low, about 30°.', bench(30)),
  ],
  'mc-lateral-raise': [
    card(
      'Pads',
      'Pads on the outside of your arms just above the elbows, shoulders level with the pivots.',
      closeup('hands', 0),
    ),
  ],
  'pt-front-raise': [
    card(
      'Hold the Plate',
      'Hold the plate at 3 and 9 o’clock with straight arms.',
      closeup('hands', 1),
    ),
  ],
  // Arms
  'bb-drag-curl': [
    card(
      'Drag It Up',
      'Pull your elbows back so the bar stays against your body all the way up.',
      closeup('hands', 1),
    ),
  ],
  'bb-preacher-curl': [
    card(
      'Pad Height',
      'Set the seat so your armpits sit snug on the top of the pad.',
      closeup('torso', 0),
    ),
  ],
  'db-preacher-curl': [
    card(
      'Pad Height',
      'Set the seat so your armpit sits snug on the top of the pad.',
      closeup('torso', 0),
    ),
  ],
  'mc-preacher-curl': [
    card(
      'Pad Height',
      'Set the seat so your armpits sit snug on the top of the pad.',
      closeup('torso', 0),
    ),
  ],
  'cb-preacher-curl': [
    card(
      'Pad Height',
      'Set the seat so your armpits sit snug on the top of the pad.',
      closeup('torso', 0),
    ),
  ],
  'bb-spider-curl': [
    card(
      'Chest on the Bench',
      'Lie chest-down on an incline bench so your arms hang straight down.',
      bench(45),
    ),
  ],
  'db-spider-curl': [
    card(
      'Chest on the Bench',
      'Lie chest-down on an incline bench so your arms hang straight down.',
      bench(45),
    ),
  ],
  'db-incline-curl': [
    card(
      'Bench Angle',
      'Sit back on a bench set to about 45° so your arms hang behind you for a big stretch.',
      bench(45),
    ),
  ],
  'db-concentration-curl': [
    card(
      'Brace Your Elbow',
      'Rest the back of your upper arm against your inner thigh.',
      closeup('hands', 0),
    ),
  ],
  'db-waiter-curl': [
    card(
      'Like a Tray',
      'Hold the top plate of the dumbbell flat in your palms, like a tray.',
      closeup('hands', 1),
    ),
  ],
  'cb-high-cable-curl': [
    card(
      'Arms Level',
      'Stand between two high pulleys with your upper arms level with your shoulders.',
      closeup('hands', 0),
    ),
  ],
  'cb-bayesian-curl': [
    card(
      'Elbow Back',
      'Face away from a low pulley so your elbow starts behind your body for a big stretch.',
      closeup('hands', 0),
    ),
  ],
  'db-overhead-triceps-extension': [
    card(
      'Hold the End',
      'Cup the top plate of one dumbbell with both palms, elbows pointing up.',
      closeup('hands', 1),
    ),
  ],
  'db-seated-triceps-extension': [
    card(
      'Hold the End',
      'Cup the top plate of one dumbbell with both palms, elbows pointing up.',
      closeup('hands', 1),
    ),
  ],
  'db-single-arm-overhead-extension': [
    card(
      'Elbow Up',
      'Keep your elbow pointing up beside your head while your forearm moves.',
      closeup('hands', 1),
    ),
  ],
  'db-kickback': [
    card(
      'Upper Arm Level',
      'Hinge forward and keep your upper arm level with your back the whole time.',
      closeup('torso', 1, 'line'),
    ),
  ],
  'cb-triceps-kickback': [
    card(
      'Upper Arm Level',
      'Hinge forward and keep your upper arm level with your back the whole time.',
      closeup('torso', 1, 'line'),
    ),
  ],
  'db-pronation': [
    card(
      'Hold One End',
      'Hold the dumbbell at one end with your forearm resting on your thigh.',
      closeup('hands', 0),
    ),
  ],
  'db-supination': [
    card(
      'Hold One End',
      'Hold the dumbbell at one end with your forearm resting on your thigh.',
      closeup('hands', 0),
    ),
  ],
  'bb-behind-back-wrist-curl': [
    card(
      'Behind You',
      'Hold the bar behind your thighs, palms facing back, arms straight.',
      closeup('hands', 0),
    ),
  ],
  // Legs
  'bb-front-squat': [
    card(
      'Front Rack',
      'The bar rests on your shoulders with your fingertips under it and your elbows high.',
      closeup('hands', 0),
    ),
    SQUAT_DEPTH,
  ],
  'bb-high-bar-squat': [
    card(
      'Bar on Your Traps',
      'The bar sits high on your traps, so your torso stays upright and your knees travel forward.',
      closeup('torso', 1, 'line'),
    ),
    SQUAT_DEPTH,
  ],
  'bb-low-bar-squat': [
    card(
      'Bar Lower',
      'The bar sits lower, across the backs of your shoulders: you lean further forward and sit back more.',
      closeup('torso', 1, 'line'),
    ),
    SQUAT_DEPTH,
  ],
  'bb-box-squat': [
    card(
      'Box Height',
      'A box that puts your thighs about level when you sit. Sit back to it, stay tight, drive up.',
      closeup('hips', 1),
    ),
  ],
  'bb-pause-squat': [
    SQUAT_STANCE,
    card(
      'The Pause',
      'Hold the bottom for two to three seconds, braced, without relaxing.',
      closeup('knee', 1, 'angle'),
    ),
  ],
  'bb-heels-elevated-squat': [
    card(
      'Heels Raised',
      'Heels on a plate or wedge lets your knees travel further forward, so your quads work harder.',
      closeup('feet', 0),
    ),
    SQUAT_DEPTH,
  ],
  'db-heels-elevated-squat': [
    card(
      'Heels Raised',
      'Heels on a plate or wedge lets your knees travel further forward, so your quads work harder.',
      closeup('feet', 0),
    ),
    SQUAT_DEPTH,
  ],
  'db-goblet-squat': [
    card(
      'Goblet Hold',
      'Hold one dumbbell upright against your chest, hands cupping its top end.',
      closeup('hands', 0),
    ),
    SQUAT_DEPTH,
  ],
  'kb-goblet-squat': [
    card(
      'Goblet Hold',
      'Hold the bell by its horns against your chest, elbows tucked.',
      closeup('hands', 0),
    ),
    SQUAT_DEPTH,
  ],
  'bb-landmine-squat': [
    card(
      'Hold the End',
      'Hold the end of the bar at your chest with both hands.',
      closeup('hands', 0),
    ),
    SQUAT_DEPTH,
  ],
  'sm-squat': [
    card(
      'Feet Forward',
      'Set your feet a little in front of the bar so you can sit straight down.',
      stance('shoulder'),
    ),
    SQUAT_DEPTH,
  ],
  'bb-sumo-squat': [
    card(
      'Wide Stance',
      'Feet wide with your toes turned out; your knees push out over them.',
      stance('wide'),
    ),
  ],
  'db-sumo-squat': [
    card(
      'Wide Stance',
      'Feet wide with your toes turned out; hold the dumbbell hanging between your legs.',
      stance('wide'),
    ),
  ],
  'db-single-leg-squat': [
    card(
      'One Leg',
      'Stand on one leg with your heel down; sit back to a box if you need a target.',
      closeup('knee', 1, 'angle'),
    ),
  ],
  'pl-belt-squat': [
    card(
      'Belt',
      'The belt sits around your hips, so your legs work without loading your back.',
      closeup('hips', 0),
    ),
    SQUAT_DEPTH,
  ],
  'pl-leg-press': [
    card(
      'Foot Placement',
      'Feet hip-width in the middle of the plate. Higher works glutes and hamstrings more; lower works quads more.',
      platform('middle'),
    ),
    card(
      'Keep Heels Down',
      'Keep your whole foot flat on the plate; don’t let your heels lift at the bottom.',
      closeup('feet', 0),
    ),
    card(
      'Depth',
      'Lower until your knees reach about 90°, before your lower back lifts off the pad.',
      closeup('knee', 0, 'angle'),
    ),
  ],
  'mc-seated-leg-press': [
    card(
      'Foot Placement',
      'Feet hip-width in the middle of the plate, heels flat.',
      platform('middle'),
    ),
    card(
      'Depth',
      'Let your knees come back to about 90°, hips staying on the seat.',
      closeup('knee', 0, 'angle'),
    ),
  ],
  'pl-hack-squat': [
    card(
      'Foot Placement',
      'Feet shoulder-width, a little forward on the platform, toes slightly out.',
      platform('middle', 'shoulder'),
    ),
    card(
      'Depth',
      'Squat until your thighs are about level, back flat on the pad.',
      closeup('knee', 1, 'angle'),
    ),
  ],
  'pl-pendulum-squat': [
    card(
      'Foot Placement',
      'Feet hip-width in the middle of the platform, heels flat.',
      platform('middle'),
    ),
    card(
      'Depth',
      'Go as deep as you can control with your back against the pad.',
      closeup('knee', 1, 'angle'),
    ),
  ],
  'pl-leg-press-calf-raise': [
    card(
      'Balls of Your Feet',
      'Only the balls of your feet on the bottom edge of the plate, so your heels can drop.',
      platform('edge'),
    ),
  ],
  'db-tibialis-raise': [
    card(
      'Heels Down',
      'Sit with your heels on the floor and a dumbbell across your toes.',
      closeup('feet', 0),
    ),
  ],
  'bb-seated-calf-raise': [
    card(
      'Bar on Your Knees',
      'Rest the padded bar across your lower thighs, balls of your feet on a step.',
      closeup('knee', 0),
    ),
  ],
  'db-seated-calf-raise': [
    card(
      'Weight on Your Knees',
      'Rest the dumbbells on your lower thighs, balls of your feet on a step.',
      closeup('knee', 0),
    ),
  ],
  'pl-seated-calf-raise': [
    card(
      'Pad on Your Thighs',
      'Set the pad snug on your lower thighs, balls of your feet on the footplate.',
      closeup('knee', 0),
    ),
  ],
  'bb-bulgarian-split-squat': [
    card(
      'Back Foot',
      'Laces down on the bench behind you; your front leg does the work.',
      closeup('feet', 0),
    ),
  ],
  'db-bulgarian-split-squat': [
    card(
      'Back Foot',
      'Laces down on the bench behind you; your front leg does the work.',
      closeup('feet', 0),
    ),
  ],
  'sm-bulgarian-split-squat': [
    card(
      'Back Foot',
      'Laces down on the bench behind you; your front leg does the work.',
      closeup('feet', 0),
    ),
  ],
  'bb-step-up': [
    card(
      'Whole Foot on the Box',
      'Your whole foot on the box; drive through its heel.',
      closeup('feet', 0),
    ),
  ],
  'db-step-up': [
    card(
      'Whole Foot on the Box',
      'Your whole foot on the box; drive through its heel.',
      closeup('feet', 0),
    ),
  ],
  'bb-lateral-lunge': [
    card(
      'Step Wide',
      'Step wide to one side and sit into that hip; the other leg stays straight.',
      stance('wide'),
    ),
  ],
  'db-lateral-lunge': [
    card(
      'Step Wide',
      'Step wide to one side and sit into that hip; the other leg stays straight.',
      stance('wide'),
    ),
  ],
  'db-goblet-lateral-lunge': [
    card(
      'Step Wide',
      'Step wide to one side and sit into that hip; the other leg stays straight.',
      stance('wide'),
    ),
  ],
  'bb-hip-thrust': [
    card(
      'Bar Position',
      'The bar across your hip crease on a pad, upper back on the bench just below your shoulder blades.',
      closeup('hips', 0),
    ),
    SHINS,
  ],
  'mc-leg-extension': [
    KNEE_PIVOT,
    card('Pad Position', 'Set the roller just above your ankles.', closeup('feet', 0)),
  ],
  'mc-single-leg-extension': [
    KNEE_PIVOT,
    card('Pad Position', 'Set the roller just above your ankle.', closeup('feet', 0)),
  ],
  'mc-seated-leg-curl': [
    KNEE_PIVOT,
    card('Thigh Pad', 'Set the thigh pad snug just above your knees.', closeup('knee', 1)),
  ],
  'mc-lying-leg-curl': [
    KNEE_PIVOT,
    card('Hips Down', 'Keep your hips pressed into the pad as you curl.', closeup('hips', 1)),
  ],
  'mc-standing-leg-curl': [KNEE_PIVOT],
  'mc-hip-abduction': [
    card(
      'Pads Outside',
      'Pads on the outside of your knees, back against the pad.',
      closeup('knee', 0),
    ),
  ],
  'mc-hip-adduction': [
    card(
      'Pads Inside',
      'Pads on the inside of your knees, back against the pad.',
      closeup('knee', 0),
    ),
  ],
  'mc-glute-kickback': [
    card(
      'Hips Square',
      'Chest on the pad, hips square; only your working leg moves.',
      closeup('hips', 1),
    ),
  ],
  'bw-glute-ham-raise': [
    card(
      'Pad Position',
      'Knees just behind the pad and ankles locked in, hips straight.',
      closeup('knee', 0),
    ),
  ],
  'bw-back-extension': [
    card(
      'Pad Height',
      'Set the pad just below your hips so you can hinge freely over it.',
      closeup('hips', 0, 'line'),
    ),
  ],
  'mc-back-extension': [
    card(
      'Pad Position',
      'The pad sits across your upper back; hinge at your hips.',
      closeup('hips', 0, 'line'),
    ),
  ],
  // Hinges
  'bb-sumo-deadlift': [
    card('Wide Stance', 'Feet wide with your toes out, hands inside your knees.', stance('wide')),
    gripCard('overhand', 'hinge'),
  ],
  'bb-snatch-grip-deadlift': [
    card(
      'Wide Grip',
      'Hands wide enough that the bar sits in your hip crease at the top.',
      grip('overhand', 'wide'),
    ),
    card(
      'Flat Back',
      'With the wider grip you start lower; keep your back flat and chest up.',
      closeup('torso', 0, 'line'),
    ),
  ],
  'bb-rack-pull': [
    card(
      'Pin Height',
      'Set the pins around knee height; the bar starts there.',
      closeup('hands', 0),
    ),
    gripCard('overhand', 'hinge'),
  ],
  'tb-deadlift': [
    card(
      'Stand in the Centre',
      'Step inside the bar so the handles are level with the middle of your feet.',
      stance('hip'),
    ),
    gripCard('neutral', 'hinge'),
  ],
  'tb-shrug': [gripCard('neutral', 'shrug')],
  'kb-swing': [
    card(
      'Hike & Snap',
      'Hike the bell back high between your legs, then snap your hips forward.',
      closeup('hips', 0, 'line'),
    ),
  ],
  'kb-single-arm-swing': [
    card(
      'Hike & Snap',
      'Hike the bell back high between your legs, then snap your hips forward.',
      closeup('hips', 0, 'line'),
    ),
  ],
  'kb-clean': [
    card(
      'Rack Position',
      'The bell rests on the back of your forearm at your shoulder, wrist straight.',
      closeup('hands', 1),
    ),
  ],
  'kb-snatch': [
    card(
      'Lockout',
      'Punch through at the top so the bell lands softly on your forearm, arm locked.',
      closeup('hands', 1),
    ),
  ],
  // Core and carries
  'bw-plank': [BODY_LINE],
  'bw-side-plank': [
    card(
      'Stack',
      'Shoulder right over your elbow, hips high, one straight line to your feet.',
      closeup('torso', 1, 'line'),
    ),
  ],
  'bw-hollow-hold': [
    card(
      'Back Down',
      'Press your lower back into the floor; arms and legs reach long.',
      closeup('hips', 1),
    ),
  ],
  'db-dead-bug': [
    card('Back Down', 'Press your lower back into the floor the whole time.', closeup('hips', 0)),
  ],
  'db-plank-drag': [BODY_LINE],
  'bb-rollout': [
    card(
      'Hips Tucked',
      'Squeeze your glutes and keep your hips tucked so your lower back can’t sag.',
      closeup('torso', 1, 'line'),
    ),
  ],
  'bw-ab-wheel-rollout': [
    card(
      'Hips Tucked',
      'Squeeze your glutes and keep your hips tucked so your lower back can’t sag.',
      closeup('torso', 1, 'line'),
    ),
  ],
  'st-pike': [
    card(
      'Hips High',
      'Lift your hips into an upside-down V with your arms straight.',
      closeup('hips', 1, 'line'),
    ),
  ],
  'cb-pallof-press': [
    card(
      'Side-On',
      'Stand side-on to the column, feet shoulder-width, handle at your chest.',
      stance('shoulder'),
    ),
  ],
  'cb-crunch': [
    card(
      'Rope',
      'Kneel facing a high pulley and hold the rope beside your head.',
      closeup('hands', 0),
    ),
  ],
  'db-side-bend': [
    card(
      'Straight Sideways',
      'Bend straight to the side; don’t lean forward or back.',
      closeup('torso', 1, 'plumb'),
    ),
  ],
  'db-suitcase-carry': [
    card(
      'One Side',
      'The weight in one hand only; stay tall and don’t lean toward it.',
      closeup('torso', 0, 'plumb'),
    ),
  ],
  'bb-overhead-carry': [EYES_UP],
  'db-overhead-carry': [EYES_UP],
  'bb-windmill': [EYES_UP],
  'db-windmill': [EYES_UP],
  'kb-windmill': [EYES_UP],
  'bb-turkish-get-up': [EYES_UP],
  'db-turkish-get-up': [EYES_UP],
  'kb-turkish-get-up': [EYES_UP],
  // Dips and push-ups
  'bw-chest-dip': [
    card(
      'Lean Forward',
      'Lean forward about 30° to put your chest to work.',
      closeup('torso', 1, 'line'),
    ),
  ],
  'bw-triceps-dip': [
    card(
      'Stay Upright',
      'Keep your torso upright to keep the work on your triceps.',
      closeup('torso', 1, 'plumb'),
    ),
  ],
  'bw-weighted-dip': [
    card(
      'Weight Hangs Low',
      'The belt’s weight hangs between your legs; lean forward slightly.',
      closeup('hips', 0),
    ),
  ],
  'bw-bench-dip': [
    card(
      'Hands on the Edge',
      'Hands on the bench edge beside your hips, fingers forward.',
      closeup('hands', 0),
    ),
  ],
  'mc-assisted-dip': [
    card(
      'Knee Pad',
      'Kneel on the pad. More weight on the stack means more help.',
      closeup('knee', 0),
    ),
  ],
  'mc-seated-dip': [
    card(
      'Handles',
      'Hold the handles beside your hips, elbows pointing back.',
      closeup('hands', 0),
    ),
  ],
  'bw-push-up': [
    card(
      'Hand Position',
      'Hands just wider than your shoulders, under your chest.',
      closeup('hands', 0),
    ),
  ],
  'bw-diamond-push-up': [
    card(
      'Diamond',
      'Touch your thumbs and index fingers together under your chest.',
      closeup('hands', 0),
    ),
  ],
  'bw-wide-push-up': [
    card('Wide Hands', 'Hands well outside your shoulders for more chest.', closeup('hands', 0)),
  ],
  'bw-decline-push-up': [
    card(
      'Feet Up',
      'Feet on a bench puts more of the work on your upper chest and shoulders.',
      closeup('feet', 0),
    ),
  ],
  'bw-incline-push-up': [
    card('Hands Up', 'Hands on a bench makes it easier than the floor.', closeup('hands', 0)),
  ],
  'bw-pike-push-up': [
    card(
      'Hips High',
      'Hips high in an upside-down V, so you press down with your shoulders.',
      closeup('hips', 0, 'line'),
    ),
  ],
};

// -------------------------------------------------------------------------------------- The rules

/** Every card for an exercise: its own where it has them, else by what it is. */
export function techniqueFor(ex) {
  const cards = [];
  // Never two cards with the same picture: one grip, one stance, one bench, one look at each spot.
  const pictureOf = (v) => (v.kind === 'closeup' ? `closeup:${v.focus}:${v.frame}` : v.kind);
  const has = (c) =>
    cards.some((o) => o.title === c.title || pictureOf(o.visual) === pictureOf(c.visual));
  const add = (c) => {
    if (c && !has(c) && cards.length < 3) cards.push(c);
  };
  (OWN[ex.slug] ?? []).forEach(add);
  const [g, width] = gripOf(ex);
  const pattern = ex.pattern;
  const name = ex.name;

  // A cable exercise's attachment comes first.
  if (ex.equipment === 'cable') add(attachmentCard(ex));

  // Benches.
  if (/Incline/.test(name) && !/Push-Up/.test(name)) {
    add(pattern === 'horizontal_push' ? BENCH.inclinePress : BENCH.incline);
  }
  if (/Decline/.test(name) && !/Push-Up/.test(name)) add(BENCH.decline);
  if (/^Seated (Barbell|Dumbbell) Shoulder Press/.test(name) || ex.slug === 'sm-shoulder-press')
    add(BENCH.upright);

  switch (pattern) {
    case 'horizontal_push':
      if (ex.slug.startsWith('mc-') || ex.slug.startsWith('pl-')) add(SEAT_CHEST);
      if (ex.equipment === 'barbell' || ex.slug.startsWith('sm-')) {
        add(
          gripCard(g ?? 'overhand', pattern, width ?? (/Close/.test(name) ? 'close' : 'shoulder')),
        );
      } else if (ex.equipment === 'dumbbell') {
        add(
          gripCard(
            g ?? 'overhand',
            pattern,
            undefined,
            g ? undefined : 'Palms facing toward your feet, wrists stacked over your elbows.',
          ),
        );
      } else if (g && ex.equipment !== 'cable') {
        add(gripCard(g, pattern));
      }
      break;
    case 'vertical_push':
      if (ex.slug.startsWith('mc-') || ex.slug.startsWith('pl-')) add(SEAT_SHOULDER);
      if (/Arnold|Landmine/.test(name)) break;
      if (ex.equipment === 'barbell' || ex.equipment === 'dumbbell' || ex.slug.startsWith('sm-')) {
        add(
          gripCard(g ?? 'overhand', pattern, ex.equipment === 'dumbbell' ? undefined : 'shoulder'),
        );
      } else if (g) add(gripCard(g, pattern));
      break;
    case 'horizontal_pull':
      if (
        /Chest-Supported|Low Row|Seated Row/.test(name) &&
        (ex.slug.startsWith('mc-') || ex.slug.startsWith('pl-'))
      )
        add(CHEST_PAD);
      if (
        (['barbell', 'dumbbell', 'kettlebell'].includes(ex.equipment) ||
          ex.slug.startsWith('sm-')) &&
        !/Chest-Supported|Renegade/.test(name)
      ) {
        add(ROW_ANGLE);
      }
      if (ex.equipment !== 'cable' && ex.equipment !== 'bodyweight') {
        add(
          gripCard(
            g ??
              (ex.equipment === 'dumbbell' || ex.equipment === 'kettlebell'
                ? 'neutral'
                : 'overhand'),
            pattern,
            width,
          ),
        );
      }
      if (ex.equipment === 'cable' && /Seated Cable Row/.test(name)) {
        add(
          card(
            'Sit Tall',
            'Feet on the plate with soft knees; sit tall without rocking back.',
            closeup('torso', 1, 'plumb'),
          ),
        );
      }
      break;
    case 'vertical_pull':
      if (/Pulldown/.test(name) && ex.equipment !== 'cable') add(THIGH_PAD);
      if (/Upright Row/.test(name) && ex.equipment !== 'cable') {
        add(
          gripCard(
            'overhand',
            'raise',
            'close',
            'Lead with your elbows and stop when they reach shoulder height.',
          ),
        );
      } else if (ex.equipment !== 'cable') {
        add(gripCard(g ?? 'overhand', pattern, width));
      } else if (/Pulldown/.test(name)) add(THIGH_PAD);
      break;
    case 'curl':
      if (ex.equipment !== 'cable' && ex.slug !== 'db-waiter-curl')
        add(gripCard(g ?? 'underhand', pattern, width));
      break;
    case 'triceps_extension':
      if (ex.equipment === 'barbell') add(gripCard(g ?? 'overhand', pattern, 'close'));
      if (/Skull Crusher/.test(name)) {
        add(
          card(
            'Elbows Up',
            'Point your elbows at the ceiling and lower toward your forehead.',
            closeup('head', 1),
          ),
        );
      }
      if (/JM Press/.test(name)) {
        add(
          card(
            'Elbows Forward',
            'Let your elbows roll forward as you lower toward your chin.',
            closeup('head', 1),
          ),
        );
      }
      if (
        /Overhead|Incline/.test(name) &&
        ex.equipment !== 'cable' &&
        ex.slug !== 'db-single-arm-overhead-extension'
      ) {
        add(
          card(
            'Elbows In',
            'Keep your elbows close to your head, pointing forward.',
            closeup('head', 1),
          ),
        );
      }
      if (ex.equipment === 'dumbbell' && /Kickback|Skull|Incline|JM/.test(name))
        add(gripCard(g ?? 'neutral', pattern));
      if (ex.equipment === 'cable' && /Pushdown/.test(name)) {
        add(
          card(
            'Elbows Pinned',
            'Elbows at your sides; only your forearms move.',
            closeup('torso', 1),
          ),
        );
      }
      if (ex.slug === 'mc-triceps-extension') {
        add(
          card(
            'Elbows on the Pad',
            'Rest your elbows on the pad, lined up with the machine’s pivot.',
            closeup('hands', 0),
          ),
        );
      }
      if (ex.equipment === 'cable' && /Overhead/.test(name)) {
        add(
          card(
            'Face Away',
            'Face away from the column in a staggered stance, elbows by your head.',
            stance('split'),
          ),
        );
      }
      break;
    case 'wrist':
      if (ex.slug === 'bb-behind-back-wrist-curl') break;
      add(
        card(
          'Forearms Rested',
          'Rest your forearms on your thighs or a bench with your wrists just past the edge.',
          closeup('hands', 0),
        ),
      );
      if (!/Pronation|Supination/.test(name)) add(gripCard(g ?? 'underhand', pattern));
      break;
    case 'shrug':
      if (ex.equipment === 'cable') break;
      add(
        gripCard(
          g ?? (ex.equipment === 'dumbbell' ? 'neutral' : 'overhand'),
          pattern,
          ex.equipment === 'barbell' ? 'shoulder' : undefined,
        ),
      );
      break;
    case 'raise':
      if (/Front Raise/.test(name) && ex.equipment !== 'cable' && !ex.slug.startsWith('pt-'))
        add(gripCard('overhand', pattern));
      if (/Rear Delt|Reverse/.test(name)) add(SOFT_ELBOWS);
      if (/Lateral/.test(name))
        add(
          card(
            'Elbows Lead',
            'A slight bend in your elbows, hands never higher than them.',
            closeup('hands', 1),
          ),
        );
      if (ex.equipment === 'cable' && /Lateral/.test(name)) {
        add(
          card(
            'Side-On',
            'Stand side-on to a low pulley, the cable crossing in front of you.',
            stance('shoulder'),
          ),
        );
      }
      break;
    case 'fly':
      if (ex.equipment === 'cable' && !/Rear/.test(name))
        add(
          card(
            'Staggered Stance',
            'Step forward into a staggered stance, chest up, between the pulleys.',
            stance('split'),
          ),
        );
      if (ex.equipment === 'cable' && /Rear/.test(name))
        add(
          card(
            'Cables Crossed',
            'Stand between two pulleys at shoulder height, holding the cables crossed.',
            closeup('hands', 0),
          ),
        );
      if (ex.slug === 'mc-reverse-pec-deck') {
        add(
          card(
            'Seat Height',
            'Set the seat so the handles are level with your shoulders, chest on the pad.',
            closeup('torso', 0),
          ),
        );
      } else if (ex.slug.startsWith('mc-')) {
        add(
          card(
            'Seat Height',
            'Set the seat so the handles are level with your chest.',
            closeup('torso', 0),
          ),
        );
      }
      add(SOFT_ELBOWS);
      break;
    case 'pullover':
      if (ex.equipment === 'cable')
        add(
          card(
            'Straight Arms',
            'Hinge forward slightly and keep your arms straight with a soft bend.',
            closeup('torso', 0, 'line'),
          ),
        );
      if (ex.slug.startsWith('mc-'))
        add(
          card(
            'Seat Height',
            'Set the seat so your shoulders line up with the machine’s pivot.',
            closeup('torso', 0),
          ),
        );
      break;
    case 'squat':
      if (ex.slug.startsWith('mc-') || ex.slug.startsWith('pl-')) break;
      if (!/Single-Leg/.test(name)) add(SQUAT_STANCE);
      add(SQUAT_DEPTH);
      break;
    case 'hinge':
      if (/Romanian|Stiff-Leg|Good Morning|Pull-Through/.test(name) || /rdl/.test(ex.slug))
        add(HINGE);
      if (/Deadlift/.test(name) && !/Romanian|Stiff/.test(name)) {
        add(
          card(
            'Stance',
            'Feet hip-width with the weight over the middle of your feet.',
            stance('hip'),
          ),
        );
        add(
          card(
            'Flat Back',
            'From the floor, keep your back flat and your chest up as you push away.',
            closeup('torso', 0, 'line'),
          ),
        );
      }
      if (ex.equipment === 'barbell' && !/Good Morning/.test(name))
        add(gripCard('overhand', 'hinge'));
      if (/Good Morning/.test(name) && ex.equipment === 'barbell')
        add(
          card(
            'Bar on Your Back',
            'The bar sits on your upper back, just like a squat.',
            closeup('head', 0),
          ),
        );
      if (/Good Morning/.test(name) && ex.equipment === 'dumbbell')
        add(
          card(
            'Weight at Your Chest',
            'Hug the dumbbell to your chest so it moves with you.',
            closeup('hands', 0),
          ),
        );
      break;
    case 'lunge':
      if (!/Lateral|Step-Up/.test(name)) add(SPLIT);
      add(
        card(
          'Front Knee',
          'Your front knee tracks over your toes and your front heel stays down.',
          closeup('knee', 1, 'angle'),
        ),
      );
      break;
    case 'hip_extension':
      if (/Thrust|Bridge|Glute Drive/.test(name)) add(SHINS);
      if (/Kickback/.test(name))
        add(
          card(
            'Hips Square',
            'Hips square and back flat; only your working leg moves.',
            closeup('hips', 1),
          ),
        );
      break;
    case 'calf_raise':
      if (/Tibialis/.test(name)) break;
      add(CALF_EDGE);
      add(
        card(
          'Knees Still',
          'Keep your knees still; let your ankles do all the work.',
          closeup('knee', 1),
        ),
      );
      break;
    case 'knee_flexion':
    case 'knee_extension':
      if (ex.slug.startsWith('mc-')) add(KNEE_PIVOT);
      if (ex.equipment === 'cable')
        add(
          card(
            'Hips Still',
            'Hold the frame and keep your hips still; only your lower leg moves.',
            closeup('hips', 1),
          ),
        );
      break;
    case 'hip_abduction':
    case 'hip_adduction':
      add(card('Upright Torso', 'Keep your torso still; only your leg moves.', closeup('hips', 1)));
      break;
    case 'core_rotation':
      if (/Russian Twist/.test(name)) add(TWIST_LEAN);
      if (/Woodchop|Landmine|Rotation/.test(name))
        add(
          card(
            'Pivot',
            'Pivot your back foot as you turn, so the turn comes from your hips and torso.',
            closeup('feet', 1),
          ),
        );
      if (/Bicycle/.test(name)) add(NECK);
      if (ex.slug === 'mc-rotary-torso')
        add(card('Hips Locked', 'Lock your legs in so only your torso turns.', closeup('hips', 0)));
      break;
    case 'core_flexion':
      if (/Leg Raise|Knee Raise|Toes-to-Bar/.test(name)) add(PELVIS);
      else if (ex.equipment === 'dumbbell')
        add(
          card(
            'Weight on Your Chest',
            'Hold the dumbbell against your chest so it doesn’t pull you forward.',
            closeup('hands', 0),
          ),
        );
      else if (/Crunch|Sit-Up/.test(name) && ex.equipment === 'bodyweight') add(NECK);
      if (ex.slug === 'mc-ab-crunch')
        add(
          card(
            'Seat Height',
            'Set the seat so the handles sit by your shoulders.',
            closeup('torso', 0),
          ),
        );
      break;
    case 'carry':
      add(TALL);
      if (ex.equipment !== 'barbell' || ex.slug === 'tb-farmers-carry')
        add(
          card(
            'Grip Hard',
            'Grip the handles hard; a strong grip keeps your shoulders packed.',
            closeup('hands', 0),
          ),
        );
      break;
    case 'dip':
    case 'anti_extension':
    case 'lateral_flexion':
    case 'get_up':
    case 'hold':
      break;
  }
  // A grip card says it all for a pull-up's hands.
  return cards;
}
