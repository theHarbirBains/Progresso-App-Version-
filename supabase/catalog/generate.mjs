// Builds the built-in exercise library from the catalogue in this folder:
//   node supabase/catalog/generate.mjs        (npm run db:catalog)
// writes the migration that puts it in the database, and the app's generated catalogue (each
// exercise's highlighted muscles, for its illustration). Checks the catalogue first and stops on
// anything wrong. See README.md.
//
// 20261128100000_builtin_exercise_library.sql (the dumbbell and barbell library) is applied to
// production and is never written again; MIGRATION is the one this writes now.
import { readFileSync, writeFileSync } from 'node:fs';
import * as prettier from 'prettier';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dumbbell from './dumbbell.mjs';
import barbell from './barbell.mjs';
import bodyweight from './bodyweight.mjs';
import cable from './cable.mjs';
import machine from './machine.mjs';
import smith from './smith.mjs';
import kettlebell from './kettlebell.mjs';
import accessories from './accessories.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(here, '..', 'migrations', '20261129100000_complete_exercise_library.sql');
const APP_FILE = join(
  here,
  '..',
  '..',
  'apps',
  'mobile',
  'src',
  'exercises',
  'illustrations',
  'builtinCatalog.generated.ts',
);

const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'adductors',
  'glutes',
  'calves',
  'core',
];
const EQUIPMENT = ['dumbbell', 'barbell', 'kettlebell', 'cable', 'machine', 'bodyweight', 'other'];
const MEASURES = ['weight_reps', 'bodyweight', 'timed'];
export const PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'hinge',
  'squat',
  'lunge',
  'hip_extension',
  'fly',
  'pullover',
  'raise',
  'shrug',
  'curl',
  'triceps_extension',
  'wrist',
  'calf_raise',
  'carry',
  'core_flexion',
  'core_rotation',
  'anti_extension',
  'lateral_flexion',
  'get_up',
  'hold',
  'knee_extension',
  'knee_flexion',
  'hip_abduction',
  'hip_adduction',
  'shoulder_rotation',
  'dip',
  'conditioning',
];
const PULLEYS = ['high', 'mid', 'low', 'adjustable'];
const LOADS = ['single_stack', 'double_stack', 'plate_loaded'];
// Mirrors REGION_GROUP in apps/mobile/src/exercises/illustrations/muscles.ts (a test checks they agree).
const REGION_GROUP = {
  chest: 'chest',
  frontDelts: 'shoulders',
  sideDelts: 'shoulders',
  rearDelts: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  traps: 'back',
  upperBack: 'back',
  lats: 'back',
  lowerBack: 'back',
  abs: 'core',
  obliques: 'core',
  glutes: 'glutes',
  quads: 'quadriceps',
  hamstrings: 'hamstrings',
  adductors: 'adductors',
  calves: 'calves',
  tibialis: 'calves',
};
// The machine and cable built-ins already in the library (and logged against) before they had a
// guide: what each is, which a catalogue entry for it must keep -- its muscle group, weight and
// reps, both sides together -- so nothing logged reads differently.
const EXISTING_SHAPE = {
  'Cable Fly': 'chest',
  'Chest Press Machine': 'chest',
  'Lat Pulldown': 'back',
  'Seated Cable Row': 'back',
  'Machine Shoulder Press': 'shoulders',
  'Face Pull': 'shoulders',
  'Cable Curl': 'biceps',
  'Cable Triceps Pushdown': 'triceps',
  'Leg Press': 'quadriceps',
  'Hack Squat': 'quadriceps',
  'Leg Extension': 'quadriceps',
  'Seated Leg Curl': 'hamstrings',
  'Lying Leg Curl': 'hamstrings',
  'Glute Bridge': 'glutes',
  'Cable Kickback': 'glutes',
  'Standing Calf Raise': 'calves',
  'Seated Calf Raise': 'calves',
  'Cable Crunch': 'core',
};
// The built-ins already in the library before this catalogue (by their names then), so a rename
// can only ever point at one that exists.
const EXISTING = [
  'Barbell Bench Press',
  'Incline Barbell Bench Press',
  'Dumbbell Bench Press',
  'Push-Up',
  'Barbell Row',
  'Deadlift',
  'Pull-Up',
  'Weighted Pull-Up',
  'Single-Arm Dumbbell Row',
  'Overhead Press',
  'Dumbbell Lateral Raise',
  'Dumbbell Front Raise',
  'Dumbbell Rear Delt Fly',
  'Barbell Curl',
  'Dumbbell Curl',
  'Hammer Curl',
  'Preacher Curl',
  'EZ-Bar Skull Crusher',
  'Dumbbell Overhead Triceps Extension',
  'Close-Grip Bench Press',
  'Wrist Curl',
  'Reverse Wrist Curl',
  'Dead Hang',
  'Barbell Back Squat',
  'Bulgarian Split Squat',
  'Romanian Deadlift',
  'Good Morning',
  'Nordic Hamstring Curl',
  'Hip Thrust',
  'Sumo Deadlift',
  'Plank',
  'Hanging Leg Raise',
  'Ab Wheel Rollout',
  'Sit-Up',
  // The machine and cable built-ins, in the library from the start without a guide until now.
  ...Object.keys(EXISTING_SHAPE),
];

const all = [
  ...dumbbell,
  ...barbell,
  ...bodyweight,
  ...cable,
  ...machine,
  ...smith,
  ...kettlebell,
  ...accessories,
];
const problems = [];
const seenSlugs = new Set();
const seenNames = new Set();
for (const ex of all) {
  const where = ex.slug ?? ex.name ?? '?';
  const need = (cond, msg) => {
    if (!cond) problems.push(`${where}: ${msg}`);
  };
  need(/^[a-z]{2}-[a-z0-9-]+$/.test(ex.slug ?? ''), 'slug must look like "db-bench-press"');
  need(!seenSlugs.has(ex.slug), 'duplicate slug');
  seenSlugs.add(ex.slug);
  const key = (ex.name ?? '').toLowerCase();
  need(key.length > 0 && !seenNames.has(key), 'missing or duplicate name');
  seenNames.add(key);
  need(EQUIPMENT.includes(ex.equipment), `unknown equipment ${ex.equipment}`);
  need(MUSCLE_GROUPS.includes(ex.muscle), `unknown muscle ${ex.muscle}`);
  need(PATTERNS.includes(ex.pattern), `unknown pattern ${ex.pattern}`);
  need(MEASURES.includes(ex.measure ?? 'weight_reps'), `unknown measure ${ex.measure}`);
  need(
    ex.sides === undefined || ['single_side', 'alternating'].includes(ex.sides),
    `unknown sides ${ex.sides}`,
  );
  need(
    ex.was === undefined || EXISTING.includes(ex.was),
    `"was" ${ex.was} is not an existing built-in`,
  );
  if (ex.was in EXISTING_SHAPE) {
    need(ex.muscle === EXISTING_SHAPE[ex.was], `must keep ${ex.was}'s muscle group`);
    need(
      (ex.measure ?? 'weight_reps') === 'weight_reps' && ex.sides === undefined,
      `must keep ${ex.was}'s weight and reps, both sides`,
    );
  }
  // Its setup, as Create Exercise records a custom one's: what's held, how, the pulley, the load.
  for (const field of ['attachment', 'grip']) {
    need(
      ex[field] === undefined || (typeof ex[field] === 'string' && ex[field].length <= 60),
      `bad ${field}`,
    );
  }
  need(ex.pulley === undefined || PULLEYS.includes(ex.pulley), `unknown pulley ${ex.pulley}`);
  need(ex.load === undefined || LOADS.includes(ex.load), `unknown load ${ex.load}`);
  need(
    ex.action === undefined ||
      typeof ex.action === 'string' ||
      (Array.isArray(ex.action) && ex.action.every((a) => typeof a === 'string')),
    'bad action',
  );
  for (const tone of ['primary', 'secondary']) {
    for (const region of ex.highlight?.[tone] ?? [])
      need(region in REGION_GROUP, `unknown region ${region}`);
  }
  need((ex.highlight?.primary ?? []).length > 0, 'needs at least one primary muscle to highlight');
  need(typeof ex.summary === 'string' && ex.summary.length > 10, 'needs a summary');
  for (const field of ['setup', 'steps', 'mistakes']) {
    need(
      Array.isArray(ex[field]) &&
        ex[field].length > 0 &&
        ex[field].every((s) => typeof s === 'string' && s.length > 3),
      `needs ${field}`,
    );
  }
}
// A renamed built-in's new name must not be taken by a new one.
for (const ex of all.filter((e) => e.was)) {
  if (EXISTING.some((n) => n.toLowerCase() === ex.name.toLowerCase() && n !== ex.was))
    problems.push(`${ex.slug}: new name already exists`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

/** The muscle groups an exercise also works: every highlighted region's group, less its own. */
function secondaryGroups(ex) {
  const groups = new Set();
  for (const region of [...ex.highlight.primary, ...ex.highlight.secondary])
    groups.add(REGION_GROUP[region]);
  groups.delete(ex.muscle);
  return MUSCLE_GROUPS.filter((g) => groups.has(g));
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (items) =>
  items.length ? `array[${items.map(q).join(', ')}]::text[]` : `'{}'::text[]`;

const renames = all.filter((e) => e.was && e.was !== e.name);
const values = all.map((ex) => {
  const unilateral = ex.sides !== undefined;
  const opt = (v) => (v === undefined ? 'null' : q(v));
  return `  (${[
    q(ex.name),
    q(ex.slug),
    q(ex.muscle),
    q(ex.equipment),
    q(ex.measure ?? 'weight_reps'),
    q(unilateral ? 'unilateral' : 'bilateral'),
    unilateral ? q(ex.sides) : 'null',
    secondaryGroups(ex).length ? `array[${secondaryGroups(ex).map(q).join(', ')}]` : `'{}'`,
    q(ex.pattern),
    q(ex.summary),
    arr(ex.setup),
    arr(ex.steps),
    arr(ex.mistakes),
    arr(
      [...(ex.was ? [ex.was] : []), ...(ex.aliases ?? [])].filter(
        (a, i, list) => list.findIndex((b) => b.toLowerCase() === a.toLowerCase()) === i,
      ),
    ),
    opt(ex.grip),
    opt(ex.attachment),
    opt(ex.pulley),
    opt(ex.load),
  ].join(', ')})`;
});

const byEquipment = {};
for (const ex of all) byEquipment[ex.equipment] = (byEquipment[ex.equipment] ?? 0) + 1;
const attachmentVariants = all.filter((e) => e.attachment).length;

const sql = `-- The complete built-in exercise library: ${all.length} exercises -- ${Object.entries(
  byEquipment,
)
  .map(([k, n]) => `${n} ${k}`)
  .join(', ')}. Cables with each handle or attachment its own exercise (${attachmentVariants} with
-- an attachment), selectorized and plate-loaded machines, the Smith machine, kettlebells, more
-- bodyweight work, bands, suspension trainers, medicine balls, battle ropes, sleds and specialty
-- bars, each with its guide, its other names to search by, and its setup (equipment, grip,
-- attachment, pulley, how it's loaded).
--
-- GENERATED by supabase/catalog/generate.mjs from the catalogue in supabase/catalog -- change the
-- catalogue and run \`npm run db:catalog\`, never this file by hand once it's applied.
--
-- Safe for existing history: a built-in that was already here keeps its row (and so every
-- workout, set and record logged against it), its muscle group, its measurement and its sides.
-- The machine and cable built-ins that were here without a guide are renamed to say their
-- standard setup ("Lat Pulldown" -> "Lat Pulldown — Wide-Grip Straight Bar"), the old name kept
-- as a search alias. Everything else is new rows. Nothing is deleted, merged or moved, and no
-- one's own exercise is touched.

-- The new movement patterns: knee extension and flexion, hip abduction and adduction, shoulder
-- rotation, dips and conditioning.
alter table public.exercises drop constraint exercises_movement_pattern_known;
alter table public.exercises
  add constraint exercises_movement_pattern_known check (
    movement_pattern is null or movement_pattern in (${PATTERNS.map(q).join(', ')})
  );

-- 1. The built-ins already here, renamed to say what they're done with.
update public.exercises e
set name = v.new_name
from (values
${renames.map((e) => `  (${q(e.was)}, ${q(e.name)})`).join(',\n')}
) as v(old_name, new_name)
where e.created_by is null
  and e.name = v.old_name
  and not exists (
    select 1 from public.exercises taken
    where taken.created_by is null and lower(taken.name) = lower(v.new_name)
  );

-- 2. Everything in the catalogue that isn't here yet.
insert into public.exercises (name, muscle_group)
select v.name, v.muscle::public.muscle_group
from (values
${all.map((e) => `  (${q(e.name)}, ${q(e.muscle)})`).join(',\n')}
) as v(name, muscle)
where not exists (
  select 1 from public.exercises e
  where e.created_by is null and lower(e.name) = lower(v.name)
);

-- 3. Every catalogue exercise's details, guide and setup.
update public.exercises e
set slug = v.slug,
    muscle_group = v.muscle::public.muscle_group,
    equipment = v.equipment,
    measurement_type = v.measure::public.measurement_type,
    movement_type = v.movement::public.movement_type,
    logging_style = v.logging::public.logging_style,
    secondary_muscle_groups = v.secondary::public.muscle_group[],
    movement_pattern = v.pattern,
    instructions = v.summary,
    setup_steps = v.setup,
    execution_steps = v.steps,
    common_mistakes = v.mistakes,
    search_aliases = v.aliases,
    grip = v.grip,
    attachment = v.attachment,
    pulley_position = v.pulley,
    load_type = v.load,
    is_active = true
from (values
${values.join(',\n')}
) as v(name, slug, muscle, equipment, measure, movement, logging, secondary, pattern, summary, setup, steps, mistakes, aliases, grip, attachment, pulley, load)
where e.created_by is null
  and lower(e.name) = lower(v.name);
`;

writeFileSync(MIGRATION, sql);

const app = `// GENERATED by supabase/catalog/generate.mjs (npm run db:catalog) -- do not edit by hand.
// Every built-in exercise's name and the muscles its illustration highlights, keyed by its slug
// (\`exercises.slug\`). The poses are in exerciseArt.ts.
import type { MuscleHighlight } from './muscles';

export interface BuiltinCatalogEntry {
  name: string;
  /** The muscle group it's for (\`exercises.muscle_group\`). */
  muscle: string;
  equipment: string;
  highlight: MuscleHighlight;
  /** The muscle groups it also works (\`exercises.secondary_muscle_groups\`). */
  secondaryGroups: readonly string[];
  /** How it moves (\`exercises.movement_pattern\`): names what its illustration's last position does. */
  pattern: string;
  /** What its last position does, or every position's name, where its pattern's doesn't fit. */
  action?: string | readonly string[];
}

export const BUILTIN_CATALOG: Record<string, BuiltinCatalogEntry> = {
${all
  .map(
    (ex) =>
      `  '${ex.slug}': { name: ${JSON.stringify(ex.name)}, muscle: '${ex.muscle}', equipment: '${ex.equipment}', highlight: { primary: ${JSON.stringify(ex.highlight.primary)}, secondary: ${JSON.stringify(ex.highlight.secondary)} }, secondaryGroups: ${JSON.stringify(secondaryGroups(ex))}, pattern: '${ex.pattern}'${ex.action ? `, action: ${JSON.stringify(ex.action)}` : ''} },`,
  )
  .join('\n')}
};
`;
// Formatted as the rest of the app is, so a regenerated file only differs where the catalogue did.
const prettierConfig = JSON.parse(readFileSync(join(here, '..', '..', '.prettierrc.json'), 'utf8'));
writeFileSync(APP_FILE, await prettier.format(app, { ...prettierConfig, filepath: APP_FILE }));
console.log(
  `catalogue: ${all.length} exercises (${Object.entries(byEquipment)
    .map(([k, n]) => `${n} ${k}`)
    .join(', ')}); ${attachmentVariants} with an attachment; ${renames.length} renamed`,
);
console.log(`wrote ${MIGRATION}\nwrote ${APP_FILE}`);
