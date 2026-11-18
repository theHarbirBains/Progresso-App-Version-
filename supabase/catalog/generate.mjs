// Builds the built-in exercise library from the catalogue in this folder:
//   node supabase/catalog/generate.mjs        (npm run db:catalog)
// writes the migration that puts it in the database, and the app's generated catalogue (each
// exercise's highlighted muscles, for its illustration). Checks the catalogue first and stops on
// anything wrong. See README.md.
import { readFileSync, writeFileSync } from 'node:fs';
import * as prettier from 'prettier';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dumbbell from './dumbbell.mjs';
import barbell from './barbell.mjs';
import bodyweight from './bodyweight.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(here, '..', 'migrations', '20261128100000_builtin_exercise_library.sql');
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
];
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
];

const all = [...dumbbell, ...barbell, ...bodyweight];
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
  ].join(', ')})`;
});

const counts = {
  dumbbell: all.filter((e) => e.equipment === 'dumbbell').length,
  barbell: all.filter((e) => e.equipment === 'barbell').length,
  other: all.filter((e) => !['dumbbell', 'barbell'].includes(e.equipment)).length,
};

const sql = `-- The built-in dumbbell and barbell exercise library (${counts.dumbbell} dumbbell and ${counts.barbell} barbell
-- exercises), with a guide for every built-in in use: secondary muscles, movement pattern, how to
-- set up and do it, the common mistakes, and other names to search by.
--
-- GENERATED by supabase/catalog/generate.mjs from the catalogue in supabase/catalog -- change the
-- catalogue and run \`npm run db:catalog\`, never this file by hand once it's applied.
--
-- Safe for existing history: a built-in that was already here keeps its row (and so every
-- workout, set and record logged against it) and its muscle group, measurement and sides; at most
-- it's renamed to say what it's done with ("Dumbbell Curl" -> "Standing Dumbbell Bicep Curl"),
-- its old name kept as a search alias. Everything else is new rows. Nothing is deleted.
--
-- Each exercise's illustration is drawn in the app from its slug (apps/mobile/src/exercises/
-- illustrations); illustration_url lets a hosted image take its place later without an app update.

alter table public.exercises
  add column slug text,
  add column secondary_muscle_groups public.muscle_group[] not null default '{}',
  add column movement_pattern text,
  add column instructions text,
  add column setup_steps text[] not null default '{}',
  add column execution_steps text[] not null default '{}',
  add column common_mistakes text[] not null default '{}',
  add column search_aliases text[] not null default '{}',
  add column illustration_url text;

-- Only built-ins have a slug (the illustration's key); a person's own exercise never does.
alter table public.exercises
  add constraint exercises_slug_builtin_only check (slug is null or created_by is null),
  add constraint exercises_movement_pattern_known check (
    movement_pattern is null or movement_pattern in (${PATTERNS.map(q).join(', ')})
  );

create unique index exercises_builtin_slug_unique on public.exercises (slug) where slug is not null;

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

-- 3. Every catalogue exercise's details and guide.
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
    is_active = true
from (values
${values.join(',\n')}
) as v(name, slug, muscle, equipment, measure, movement, logging, secondary, pattern, summary, setup, steps, mistakes, aliases)
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
}

export const BUILTIN_CATALOG: Record<string, BuiltinCatalogEntry> = {
${all
  .map(
    (ex) =>
      `  '${ex.slug}': { name: ${JSON.stringify(ex.name)}, muscle: '${ex.muscle}', equipment: '${ex.equipment}', highlight: { primary: ${JSON.stringify(ex.highlight.primary)}, secondary: ${JSON.stringify(ex.highlight.secondary)} }, secondaryGroups: ${JSON.stringify(secondaryGroups(ex))}, pattern: '${ex.pattern}' },`,
  )
  .join('\n')}
};
`;
// Formatted as the rest of the app is, so a regenerated file only differs where the catalogue did.
const prettierConfig = JSON.parse(readFileSync(join(here, '..', '..', '.prettierrc.json'), 'utf8'));
writeFileSync(APP_FILE, await prettier.format(app, { ...prettierConfig, filepath: APP_FILE }));
console.log(
  `catalogue: ${all.length} exercises (${counts.dumbbell} dumbbell, ${counts.barbell} barbell, ${counts.other} other); ${renames.length} renamed`,
);
console.log(`wrote ${MIGRATION}\nwrote ${APP_FILE}`);
