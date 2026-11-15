// Achievement balancing, step 1 (node supabase/tests/achievement-trajectories.mjs <out.json>):
// seven kinds of Progresso user, each with five years of made-up but realistic training, food
// and social history, loaded into a throwaway embedded Postgres with every migration applied.
// At each checkpoint (3, 6, 12, 24, 36, 60 months) it records the real figures an achievement would
// be measured on -- workouts, volume (in all and for each muscle group), records held, exercises,
// weeks trained, food days and foods, friends and likes -- using the database's own functions
// where they exist. Step 2 weighs a proposed catalogue against them. Touches no real database.

import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');
const out = process.argv[2] ?? null;
const PORT = 54332;
const dataDir = mkdtempSync(join(tmpdir(), 'progresso-aptraj-'));
const pgInstance = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
});

// The ranks, as apps/mobile/src/achievements/ranks.ts works them out.
const TIERS = [
  ['Bronze', 0],
  ['Silver', 750],
  ['Gold', 2_000],
  ['Platinum', 4_000],
  ['Diamond', 7_000],
  ['Vanguard', 11_000],
  ['Titan', 16_000],
  ['Sovereign', 22_000],
  ['Legacy', 30_000],
];
const NUMERALS = ['V', 'IV', 'III', 'II', 'I'];
function rankOf(points) {
  let tier = 0;
  TIERS.forEach(([, floor], index) => {
    if (points >= floor) tier = index;
  });
  const [name, floor] = TIERS[tier];
  const step = tier === TIERS.length - 1 ? 2_000 : (TIERS[tier + 1][1] - floor) / 5;
  const level = Math.floor((points - floor) / step);
  return `${name} ${NUMERALS[Math.min(4, level)]}${tier === TIERS.length - 1 && level > 4 ? ` · ${level - 3}` : ''}`;
}

function random(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Every trainable muscle group, with how heavy its lifts typically are against a chest press.
const MUSCLES = {
  quadriceps: 1.6,
  glutes: 1.5,
  back: 1.15,
  hamstrings: 1.05,
  chest: 1.0,
  calves: 1.0,
  adductors: 0.9,
  shoulders: 0.65,
  triceps: 0.5,
  biceps: 0.42,
  core: 0.4,
  forearms: 0.32,
};
const MUSCLE_NAMES = Object.keys(MUSCLES);

/**
 * perWeek: [fewest, most] workouts; exercises a session from a pool growing to maxExercises
 * (round the muscle groups -- `muscles` limits which); sets; reps; base weight (a chest press,
 * kg); gain: [first year, each year after]; bodyweight/timed: a share of core work done that
 * way; food days a week and how many different foods; friends; how many likes they give a week.
 */
const PERSONAS = [
  { key: 'beginner', label: 'Beginner, 2-3 a week', perWeek: [2, 3], skipWeek: 0.12, exercises: 5, maxExercises: 18, sets: 3, reps: [8, 10, 12], base: 35, gain: [0.35, 0.12], foodDays: 1, foods: 40, friends: 3, likesGiven: 0.3 },
  { key: 'intermediate', label: 'Intermediate, 4 a week', perWeek: [3, 4], skipWeek: 0.06, exercises: 6, maxExercises: 32, sets: 4, reps: [6, 8, 10], base: 60, gain: [0.15, 0.06], foodDays: 3, foods: 90, friends: 7, likesGiven: 1 },
  { key: 'advanced', label: 'Advanced, 5-6 a week', perWeek: [5, 6], skipWeek: 0.04, exercises: 7, maxExercises: 55, sets: 4, reps: [5, 6, 8, 10, 12], base: 90, gain: [0.08, 0.04], foodDays: 6, foods: 160, friends: 14, likesGiven: 2 },
  { key: 'strength', label: 'Strength-focused, 3-4 a week', perWeek: [3, 4], skipWeek: 0.05, exercises: 4, maxExercises: 14, sets: 5, reps: [1, 2, 3, 4, 5, 6, 8], base: 110, gain: [0.2, 0.08], foodDays: 2, foods: 60, friends: 5, likesGiven: 0.6, muscles: ['quadriceps', 'back', 'chest', 'hamstrings', 'shoulders', 'glutes'] },
  { key: 'consistent', label: 'Consistency-focused, 4 a week', perWeek: [4, 4], skipWeek: 0, exercises: 6, maxExercises: 12, sets: 3, reps: [10], base: 50, gain: [0.02, 0], foodDays: 2, foods: 30, friends: 2, likesGiven: 0.2 },
  { key: 'nutrition', label: 'Nutrition-focused, trains 0-2 a week', perWeek: [0, 2], skipWeek: 0.3, exercises: 4, maxExercises: 10, sets: 3, reps: [10, 12], base: 25, gain: [0.1, 0.03], foodDays: 7, foods: 320, friends: 4, likesGiven: 0.4 },
  { key: 'general', label: 'General fitness, 3 a week, a bit of everything', perWeek: [2, 4], skipWeek: 0.08, exercises: 6, maxExercises: 40, sets: 3, reps: [8, 10, 12, 15], base: 45, gain: [0.18, 0.06], foodDays: 4, foods: 150, friends: 9, likesGiven: 1.5, bodyweight: 0.5 },
];

const CHECKPOINTS = [3, 6, 12, 24, 36, 60];
const WEEK = 7 * 86400000;
const START = (() => {
  const d = new Date(Date.now() - 60 * 30.44 * 86400000);
  d.setUTCHours(17, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
})();

function connect() {
  return new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: 'postgres', database: 'postgres' });
}

async function insertMany(db, table, columns, rows) {
  for (let i = 0; i < rows.length; i += 2000) {
    const chunk = rows.slice(i, i + 2000);
    const values = [];
    const params = [];
    chunk.forEach((row, r) => {
      values.push(`(${row.map((_, c) => `$${r * row.length + c + 1}`).join(', ')})`);
      params.push(...row);
    });
    await db.query(`insert into public.${table} (${columns.join(', ')}) values ${values.join(', ')}`, params);
  }
}

async function figures(db, user) {
  const metrics = (await db.query("select public.achievement_metrics($1, 'America/Toronto') as m", [user])).rows[0].m;
  const muscles = Object.fromEntries(
    (
      await db.query(
        `select e.muscle_group::text as muscle,
           coalesce(sum(s.weight_kg * s.reps) filter (where we.measurement_type = 'weight_reps'), 0)::float as volume_kg,
           count(s.id)::int as sets
         from public.achievement_valid_workouts($1, 'America/Toronto') v
         join public.workout_exercises we on we.workout_id = v.workout_id and we.deleted_at is null
         join public.exercises e on e.id = we.exercise_id
         join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null and s.completed_at is not null
         group by 1`,
        [user],
      )
    ).rows.map((row) => [row.muscle, { volumeKg: row.volume_kg, sets: row.sets }]),
  );
  const weeks = (
    await db.query("select count(distinct week_start)::int as n from public.achievement_valid_workouts($1, 'America/Toronto')", [user])
  ).rows[0].n;
  const months = (
    await db.query("select count(distinct month_key)::int as n from public.achievement_valid_workouts($1, 'America/Toronto')", [user])
  ).rows[0].n;
  return { ...metrics, active_weeks: weeks, active_months: months, muscles };
}

async function simulate(db, persona, seed) {
  const rand = random(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const user = randomUUID();
  await db.query('insert into auth.users (id, email) values ($1, $2)', [user, `${persona.key}@traj.local`]);
  await db.query("update public.users set workout_frequency_days = 3, time_zone = 'America/Toronto' where id = $1", [user]);

  const muscleNames = persona.muscles ?? MUSCLE_NAMES;
  const exercises = [];
  for (let i = 0; i < persona.maxExercises; i += 1) {
    const id = randomUUID();
    const muscle = muscleNames[i % muscleNames.length];
    const type = muscle === 'core' && rand() < (persona.bodyweight ?? 0.3) ? (rand() < 0.5 ? 'bodyweight' : 'timed') : 'weight_reps';
    exercises.push({ id, muscle, type, base: persona.base * MUSCLES[muscle] * (0.8 + rand() * 0.4) });
    await db.query(
      'insert into public.exercises (id, name, muscle_group, created_by, measurement_type) values ($1, $2, $3, $4, $5)',
      [id, `${persona.key} ${muscle} ${i + 1}`, muscle, user, type],
    );
  }
  const split = randomUUID();
  await db.query("insert into public.workout_splits (id, user_id, name) values ($1, $2, 'Plan')", [split, user]);
  await db.query("insert into public.workout_split_days (workout_split_id, name, order_index) values ($1, 'Day 1', 1)", [split]);
  const friends = [];
  for (let i = 0; i < persona.friends; i += 1) {
    const friend = randomUUID();
    friends.push(friend);
    await db.query('insert into auth.users (id, email) values ($1, $2)', [friend, `${persona.key}-f${i}@traj.local`]);
    await db.query("insert into public.follows (follower_id, followee_id, status) values ($1, $2, 'accepted'), ($2, $1, 'accepted')", [user, friend]);
    await db.query("insert into public.workouts (user_id, name, performed_at, completed_at) values ($1, 'Friend day', $2, $2)", [friend, START.toISOString()]);
  }
  const foodPool = Array.from({ length: Math.max(1, persona.foods) }, (_, i) => `${persona.key} food ${i + 1}`);

  const results = [];
  let week = 0;
  let likesGiven = 0;
  for (const months of CHECKPOINTS) {
    const untilWeek = Math.round((months * 30.44) / 7);
    const workouts = [];
    const workoutExercises = [];
    const sets = [];
    const foodLogs = [];
    const likes = [];
    for (; week < untilWeek; week += 1) {
      const weekStart = START.getTime() + week * WEEK;
      const years = week / 52;
      const growth = 1 + Math.min(years, 1) * persona.gain[0] + Math.max(0, years - 1) * persona.gain[1];
      const pool = exercises.slice(0, Math.min(persona.maxExercises, persona.exercises + Math.floor(week / 6)));
      const [few, most] = persona.perWeek;
      const count = rand() < persona.skipWeek ? Math.max(0, few - 1) : few + Math.floor(rand() * (most - few + 1));
      const days = [...Array(7).keys()].sort(() => rand() - 0.5).slice(0, count).sort();
      for (const day of days) {
        const at = new Date(weekStart + day * 86400000);
        const done = new Date(at.getTime() + (45 + Math.floor(rand() * 40)) * 60000);
        const workout = randomUUID();
        workouts.push([workout, user, 'Session', at.toISOString(), done.toISOString()]);
        const today = [...pool].sort(() => rand() - 0.5).slice(0, persona.exercises);
        today.forEach((exercise, order) => {
          const we = randomUUID();
          workoutExercises.push([we, workout, exercise.id, order + 1]);
          for (let s = 1; s <= persona.sets; s += 1) {
            const reps = pick(persona.reps);
            const effort = persona.gain[0] <= 0.02 ? 1 : 0.97 + rand() * 0.06;
            if (exercise.type === 'timed') {
              sets.push([randomUUID(), we, user, s, null, null, 30 + Math.floor(rand() * 60), done.toISOString()]);
            } else if (exercise.type === 'bodyweight') {
              sets.push([randomUUID(), we, user, s, null, 10 + Math.floor(rand() * 15), null, done.toISOString()]);
            } else {
              const weight = Math.max(2.5, Math.round((exercise.base * growth * effort * (1.15 - reps * 0.025)) / 2.5) * 2.5);
              sets.push([randomUUID(), we, user, s, weight, reps, null, done.toISOString()]);
            }
          }
        });
        for (const friend of friends) if (rand() < 0.35) likes.push([workout, friend]);
      }
      const foodDays = [...Array(7).keys()].sort(() => rand() - 0.5).slice(0, persona.foodDays);
      for (const day of foodDays) {
        for (let n = 0; n < 3; n += 1) {
          const at = new Date(weekStart + day * 86400000 + n * 4 * 3600000);
          const known = foodPool.slice(0, Math.max(5, Math.min(foodPool.length, 5 + week * 2)));
          foodLogs.push([user, pick(known), 100, 'g', 1, 450, 30, 45, 15, at.toISOString()]);
        }
      }
    }
    await insertMany(db, 'workouts', ['id', 'user_id', 'name', 'performed_at', 'completed_at'], workouts);
    await insertMany(db, 'workout_exercises', ['id', 'workout_id', 'exercise_id', 'order_index'], workoutExercises);
    await db.query("set session_replication_role = 'replica'");
    await insertMany(db, 'sets', ['id', 'workout_exercise_id', 'user_id', 'set_index', 'weight_kg', 'reps', 'duration_seconds', 'completed_at'], sets);
    await db.query("set session_replication_role = 'origin'");
    for (const exercise of exercises) {
      await db.query('select public.recompute_prs_for_exercise($1, $2)', [user, exercise.id]);
    }
    await insertMany(db, 'food_logs', ['user_id', 'food_name_snapshot', 'serving_size', 'serving_unit', 'quantity', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'logged_at'], foodLogs);
    await insertMany(db, 'workout_likes', ['workout_id', 'user_id'], likes);
    const toGive = Math.round(untilWeek * persona.likesGiven) - likesGiven;
    for (let i = 0; i < toGive && friends.length > 0; i += 1) {
      const friendWorkout = randomUUID();
      await db.query("insert into public.workouts (id, user_id, name, performed_at, completed_at) values ($1, $2, 'Friend day', $3, $3)", [friendWorkout, friends[(likesGiven + i) % friends.length], new Date(START.getTime() + (likesGiven + i) * 3600000).toISOString()]);
      await db.query('insert into public.workout_likes (workout_id, user_id) values ($1, $2)', [friendWorkout, user]);
    }
    likesGiven += Math.max(0, toGive);
    if (months >= 3 && persona.foods > 0 && results.length === 0) {
      await db.query("insert into public.saved_meals (user_id, name) values ($1, 'Usual breakfast')", [user]);
    }
    await db.query("select * from public.award_achievements($1, 'America/Toronto')", [user]);
    const summary = (await db.query('select * from public.achievement_summary($1)', [user])).rows[0];
    const byCategory = (
      await db.query(
        `select d.category, sum(a.ap)::int as ap
         from public.achievement_awards a join public.achievement_definitions d on d.id = a.achievement_id
         where a.user_id = $1 group by 1 order by 2 desc`,
        [user],
      )
    ).rows;
    results.push({ months, points: summary.points, awards: summary.awards, rank: rankOf(summary.points), byCategory, ...(await figures(db, user)) });
  }
  return results;
}

async function main() {
  await pgInstance.initialise();
  await pgInstance.start();
  const db = connect();
  await db.connect();
  await db.query(readFileSync(join(__dirname, 'auth-shim.sql'), 'utf8'));
  await db.query(readFileSync(join(__dirname, 'storage-shim.sql'), 'utf8'));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.query(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  await db.query(readFileSync(join(__dirname, '..', 'seed.sql'), 'utf8'));
  const all = [];
  for (const [index, persona] of PERSONAS.entries()) {
    const started = Date.now();
    const checkpoints = await simulate(db, persona, 2000 + index);
    all.push({ key: persona.key, label: persona.label, checkpoints });
    console.log(`
${persona.label}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    for (const c of checkpoints) {
      console.log(`  ${String(c.months).padStart(2)} months: ${String(c.points).padStart(6)} AP  ${c.rank.padEnd(14)} ${c.awards} levels`);
    }
    console.log('  after 5 years, by kind: ' + checkpoints.at(-1).byCategory.map((c) => `${c.category} ${c.ap}`).join(', '));
  }
  if (out) {
    writeFileSync(out, JSON.stringify(all, null, 2));
    console.log(`
Wrote ${out}`);
  }
  await db.end();
}

try {
  await main();
} finally {
  await pgInstance.stop().catch(() => {});
  try {
    rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    // Best-effort cleanup of the throwaway database.
  }
}
