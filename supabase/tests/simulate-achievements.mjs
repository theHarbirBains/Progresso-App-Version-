// Achievement Points balancing (npm run db:simulate): six kinds of Progresso user, each with
// five years of made-up but realistic training, food and social history, loaded into a
// throwaway embedded Postgres with every migration applied -- then awarded by the real
// award_achievements at checkpoints (1, 3, 6, 12, 24, 36 and 60 months), so what's printed is
// exactly what the app would award. Nothing here touches a real database.

import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');
const PORT = 54331;
const dataDir = mkdtempSync(join(tmpdir(), 'progresso-apsim-'));
const pgInstance = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
});

// The ranks, as apps/mobile/src/achievements/ranks.ts works them out.
const TIERS = [
  ['Bronze', 0, 100],
  ['Silver', 500, 200],
  ['Gold', 1500, 300],
  ['Platinum', 3000, 400],
  ['Diamond', 5000, 600],
  ['Vanguard', 8000, 800],
  ['Titan', 12000, 1000],
  ['Sovereign', 17000, 1200],
  ['Legacy', 23000, 2000],
];
const NUMERALS = ['V', 'IV', 'III', 'II', 'I'];
function rankOf(points) {
  let tier = 0;
  TIERS.forEach(([, floor], index) => {
    if (points >= floor) tier = index;
  });
  const [name, floor, step] = TIERS[tier];
  const division = Math.min(4, Math.floor((points - floor) / step));
  return `${name} ${NUMERALS[division]}`;
}

// A seeded random, so every run prints the same.
function random(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Who each one is. perWeek: [fewest, most] workouts; goal: their weekly goal; exercises: how
 * many they rotate through, growing to `maxExercises`; sets per exercise; reps they work in;
 * a base weight; `gain` -- how much stronger a year (0 = the same weights forever); food days
 * a week; friends.
 */
const PERSONAS = [
  {
    key: 'beginner',
    label: 'Beginner, 2-3 a week',
    perWeek: [2, 3], goal: 3, skipWeek: 0.12, exercises: 5, maxExercises: 18, sets: 3,
    reps: [8, 10, 12], base: 35, gain: [0.35, 0.12], foodDays: 1, foods: 40, friends: 3, likesGiven: 0.2,
  },
  {
    key: 'intermediate',
    label: 'Intermediate, 4 a week',
    perWeek: [3, 4], goal: 4, skipWeek: 0.06, exercises: 6, maxExercises: 32, sets: 4,
    reps: [6, 8, 10], base: 60, gain: [0.15, 0.06], foodDays: 3, foods: 90, friends: 7, likesGiven: 0.5,
  },
  {
    key: 'advanced',
    label: 'Advanced, 5-6 a week',
    perWeek: [5, 6], goal: 5, skipWeek: 0.04, exercises: 7, maxExercises: 55, sets: 4,
    reps: [5, 6, 8, 10, 12], base: 90, gain: [0.08, 0.04], foodDays: 6, foods: 160, friends: 14, likesGiven: 0.8,
  },
  {
    key: 'nutrition',
    label: 'Mostly nutrition tracking',
    perWeek: [0, 2], goal: 3, skipWeek: 0.3, exercises: 4, maxExercises: 10, sets: 3,
    reps: [10, 12], base: 25, gain: [0.1, 0.03], foodDays: 7, foods: 320, friends: 4, likesGiven: 0.3,
  },
  {
    key: 'strength',
    label: 'Strength-focused, 3-4 a week',
    perWeek: [3, 4], goal: 3, skipWeek: 0.05, exercises: 4, maxExercises: 14, sets: 5,
    reps: [1, 2, 3, 4, 5, 6, 8], base: 110, gain: [0.2, 0.08], foodDays: 2, foods: 60, friends: 5, likesGiven: 0.4,
  },
  {
    key: 'steady',
    label: 'Consistent, rarely a PR',
    perWeek: [4, 4], goal: 4, skipWeek: 0, exercises: 6, maxExercises: 8, sets: 3,
    reps: [10], base: 50, gain: [0, 0], foodDays: 0, foods: 0, friends: 2, likesGiven: 0.1,
  },
];

const CHECKPOINTS = [1, 3, 6, 12, 24, 36, 60];
const WEEK = 7 * 86400000;
// Five years ago, on a Monday, so the last checkpoint lands about now.
const START = (() => {
  const d = new Date(Date.now() - 60 * 30.44 * 86400000);
  d.setUTCHours(17, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
})();
const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'core'];

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

async function simulate(db, persona, seed) {
  const rand = random(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const user = randomUUID();
  await db.query('insert into auth.users (id, email) values ($1, $2)', [user, `${persona.key}@sim.local`]);
  await db.query('update public.users set workout_frequency_days = $2, time_zone = $3 where id = $1', [
    user,
    persona.goal,
    'America/Toronto',
  ]);

  // Their exercises, each its own machine, across the major muscle groups.
  const exercises = [];
  for (let i = 0; i < persona.maxExercises; i += 1) {
    const id = randomUUID();
    exercises.push({ id, base: persona.base * (0.5 + rand()), muscle: MUSCLES[i % MUSCLES.length] });
    await db.query(
      "insert into public.exercises (id, name, muscle_group, created_by, measurement_type) values ($1, $2, $3, $4, 'weight_reps')",
      [id, `${persona.key} lift ${i + 1}`, exercises[i].muscle, user],
    );
  }
  // A split, and friends who train (and follow each other back).
  const split = randomUUID();
  await db.query("insert into public.workout_splits (id, user_id, name) values ($1, $2, 'Plan')", [split, user]);
  await db.query("insert into public.workout_split_days (workout_split_id, name, order_index) values ($1, 'Day 1', 1)", [split]);
  const friends = [];
  for (let i = 0; i < persona.friends; i += 1) {
    const friend = randomUUID();
    friends.push(friend);
    await db.query('insert into auth.users (id, email) values ($1, $2)', [friend, `${persona.key}-friend-${i}@sim.local`]);
    await db.query(
      "insert into public.follows (follower_id, followee_id, status) values ($1, $2, 'accepted'), ($2, $1, 'accepted')",
      [user, friend],
    );
    await db.query(
      "insert into public.workouts (user_id, name, performed_at, completed_at) values ($1, 'Friend day', $2, $2)",
      [friend, START.toISOString()],
    );
  }

  const results = [];
  let week = 0;
  const foodPool = Array.from({ length: Math.max(1, persona.foods) }, (_, i) => `${persona.key} food ${i + 1}`);
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
      const growth =
        1 + Math.min(years, 1) * persona.gain[0] + Math.max(0, years - 1) * persona.gain[1];
      const pool = exercises.slice(
        0,
        Math.min(persona.maxExercises, persona.exercises + Math.floor(week / 6)),
      );
      const [few, most] = persona.perWeek;
      const count =
        rand() < persona.skipWeek ? Math.max(0, few - 1) : few + Math.floor(rand() * (most - few + 1));
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
            const effort = persona.gain[0] === 0 ? 1 : 0.97 + rand() * 0.06;
            const weight = Math.max(2.5, Math.round((exercise.base * growth * effort * (1.15 - reps * 0.025)) / 2.5) * 2.5);
            sets.push([randomUUID(), we, user, s, weight, reps, done.toISOString()]);
          }
        });
        // Friends like some of their workouts; they like some of their friends'.
        for (const friend of friends) if (rand() < 0.35) likes.push([workout, friend]);
      }
      // Food on some days of the week, a few foods a day.
      const foodDays = [...Array(7).keys()].sort(() => rand() - 0.5).slice(0, persona.foodDays);
      for (const day of foodDays) {
        for (let n = 0; n < 3; n += 1) {
          const at = new Date(weekStart + day * 86400000 + n * 4 * 3600000);
          foodLogs.push([user, pick(foodPool.slice(0, Math.max(5, Math.min(foodPool.length, 5 + week * 2)))), 100, 'g', 1, 450, 30, 45, 15, at.toISOString()]);
        }
      }
    }
    await insertMany(db, 'workouts', ['id', 'user_id', 'name', 'performed_at', 'completed_at'], workouts);
    await insertMany(db, 'workout_exercises', ['id', 'workout_id', 'exercise_id', 'order_index'], workoutExercises);
    // Sets in bulk with their per-row triggers paused, then every exercise's records worked out
    // once -- the same recompute the triggers run.
    await db.query("set session_replication_role = 'replica'");
    await insertMany(db, 'sets', ['id', 'workout_exercise_id', 'user_id', 'set_index', 'weight_kg', 'reps', 'completed_at'], sets);
    await db.query("set session_replication_role = 'origin'");
    for (const exercise of exercises) {
      await db.query('select public.recompute_prs_for_exercise($1, $2)', [user, exercise.id]);
    }
    await insertMany(db, 'food_logs', ['user_id', 'food_name_snapshot', 'serving_size', 'serving_unit', 'quantity', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'logged_at'], foodLogs);
    await insertMany(db, 'workout_likes', ['workout_id', 'user_id'], likes);
    // Likes they give: one friend's workout each, as many as they'd plausibly give.
    const toGive = Math.round(untilWeek * persona.likesGiven) - (await db.query('select count(*)::int as n from public.workout_likes where user_id = $1', [user])).rows[0].n;
    for (let i = 0; i < toGive && friends.length > 0; i += 1) {
      const friendWorkout = randomUUID();
      await db.query(
        "insert into public.workouts (id, user_id, name, performed_at, completed_at) values ($1, $2, 'Friend day', $3, $3)",
        [friendWorkout, friends[i % friends.length], new Date(START.getTime() + i * 86400000).toISOString()],
      );
      await db.query('insert into public.workout_likes (workout_id, user_id) values ($1, $2)', [friendWorkout, user]);
    }
    if (months >= 3 && persona.foods > 0) {
      await db.query("insert into public.saved_meals (user_id, name) values ($1, 'Usual breakfast') on conflict do nothing", [user]);
    }

    await db.query("select * from public.award_achievements($1, 'America/Toronto')", [user]);
    const summary = (await db.query('select * from public.achievement_summary($1)', [user])).rows[0];
    const byCategory = (
      await db.query(
        `select d.category, d.repeats <> 'once' as repeats, sum(a.ap)::int as ap
         from public.achievement_awards a join public.achievement_definitions d on d.id = a.achievement_id
         where a.user_id = $1 group by 1, 2 order by 1, 2`,
        [user],
      )
    ).rows;
    results.push({ months, points: summary.points, awards: summary.awards, rank: rankOf(summary.points), byCategory });
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
    const results = await simulate(db, persona, 1000 + index);
    all.push({ persona, results });
    console.log(`\n${persona.label}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    for (const r of results) {
      console.log(
        `  ${String(r.months).padStart(2)} months: ${String(r.points).padStart(6)} AP  ${r.rank.padEnd(14)} ${r.awards} awards`,
      );
    }
    const last = results.at(-1);
    console.log(
      '  after 5 years, by kind: ' +
        last.byCategory
          .map((c) => `${c.category}${c.repeats ? ' (repeat)' : ''} ${c.ap}`)
          .join(', '),
    );
  }
  await db.end();
  return all;
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
