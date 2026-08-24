// Applies every migration to a real, ephemeral local Postgres instance
// (no Docker required) and runs security/correctness tests against it.
// Dev/CI tooling only - not part of the shipped app.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');
const seedFile = join(__dirname, '..', 'seed.sql');
const shimFile = join(__dirname, 'auth-shim.sql');

const PORT = 54329;
const dataDir = mkdtempSync(join(tmpdir(), 'progresso-pgtest-'));

const pgInstance = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
});

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}${detail ? ' - ' + detail : ''}`);
}

function expectRowCount(res, expected, name) {
  const passed = res.rowCount === expected;
  record(name, passed, passed ? undefined : `expected ${expected} rows, got ${res.rowCount}`);
}

async function expectThrows(promise, name, matcher) {
  try {
    await promise;
    record(name, false, 'expected an error but none was thrown');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    record(
      name,
      matcher.test(message),
      matcher.test(message) ? undefined : `unexpected error: ${message}`,
    );
  }
}

function connect() {
  return new pg.Client({
    host: '127.0.0.1',
    port: PORT,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
}

async function asClaims(client, userId) {
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
}

/** Runs fn as userId on a fresh connection/transaction, always rolled back. */
async function asUser(userId, fn) {
  const client = connect();
  await client.connect();
  try {
    await client.query('begin');
    await asClaims(client, userId);
    return await fn(client);
  } finally {
    await client.query('rollback').catch(() => {});
    await client.end();
  }
}

/** Runs fn as userId on a fresh connection/transaction, committed on success. */
async function asUserCommitted(userId, fn) {
  const client = connect();
  await client.connect();
  try {
    await client.query('begin');
    await asClaims(client, userId);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

const RLS_ERROR = /row-level security|policy/i;

async function main() {
  console.log('Starting embedded Postgres (no Docker required)...');
  await pgInstance.initialise();
  await pgInstance.start();

  const admin = connect();
  await admin.connect();

  console.log('Applying auth shim...');
  await admin.query(readFileSync(shimFile, 'utf8'));

  console.log('Applying migrations...');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    console.log(`  -> ${file}`);
    await admin.query(readFileSync(join(migrationsDir, file), 'utf8'));
  }

  console.log('Applying seed data...');
  await admin.query(readFileSync(seedFile, 'utf8'));

  // ---- fixtures ----
  const userA = randomUUID();
  const userB = randomUUID();
  await admin.query('insert into auth.users (id, email) values ($1, $2), ($3, $4)', [
    userA,
    'a@test.local',
    userB,
    'b@test.local',
  ]);

  const benchPress = (
    await admin.query("select id from public.exercises where name = 'Barbell Bench Press'")
  ).rows[0].id;
  // Used only by the PR recompute tests below, kept separate from benchPress
  // so fixtureA/fixtureB's own bench press sets can't contaminate those
  // assertions (PRs are computed globally per user+exercise, across every
  // workout, not scoped to one workout).
  const squat = (
    await admin.query("select id from public.exercises where name = 'Barbell Back Squat'")
  ).rows[0].id;
  const testFood = (
    await admin.query(
      `insert into public.foods (name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
       values ('Protein Bar', 1, 'bar', 200, 20, 15, 8) returning id`,
    )
  ).rows[0].id;

  async function buildFixture(userId, label) {
    return asUserCommitted(userId, async (client) => {
      const workout = (
        await client.query(
          'insert into public.workouts (user_id, name, performed_at) values ($1, $2, now()) returning id',
          [userId, `${label} Workout`],
        )
      ).rows[0];
      const workoutExercise = (
        await client.query(
          'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 1) returning id',
          [workout.id, benchPress],
        )
      ).rows[0];
      const set = (
        await client.query(
          'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 1, 100, 5) returning id',
          [workoutExercise.id],
        )
      ).rows[0];
      const foodLog = (
        await client.query(
          `insert into public.food_logs (user_id, food_name_snapshot, serving_size, serving_unit, quantity, calories, protein_g, carbs_g, fat_g)
           values ($1, 'Chicken Breast', 100, 'g', 1, 165, 31, 0, 3.6) returning id`,
          [userId],
        )
      ).rows[0];
      const foodLogWithSource = (
        await client.query(
          `insert into public.food_logs (user_id, food_id, food_name_snapshot, serving_size, serving_unit, quantity, calories, protein_g, carbs_g, fat_g)
           values ($1, $2, 'Protein Bar', 1, 'bar', 1, 200, 20, 15, 8) returning id`,
          [userId, testFood],
        )
      ).rows[0];
      return {
        workoutId: workout.id,
        workoutExerciseId: workoutExercise.id,
        setId: set.id,
        foodLogId: foodLog.id,
        foodLogWithSourceId: foodLogWithSource.id,
      };
    });
  }

  const fixtureA = await buildFixture(userA, 'A');
  const fixtureB = await buildFixture(userB, 'B');

  console.log('\nRunning profile/username tests...\n');

  await asUserCommitted(userA, async (client) => {
    await client.query("update public.users set username = 'harbir_b' where id = $1", [userA]);
  });
  await asUser(userA, async (client) => {
    const res = await client.query('select username from public.users where id = $1', [userA]);
    record(
      'User A can set their own username via the existing self-update RLS policy',
      res.rows[0]?.username === 'harbir_b',
      `got ${res.rows[0]?.username}`,
    );
  });

  await asUser(userB, async (client) => {
    const res = await client.query("update public.users set username = 'stolen' where id = $1", [
      userA,
    ]);
    const passed = res.rowCount === 0;
    record(
      "User B cannot modify User A's username via UPDATE",
      passed,
      passed ? undefined : `rowCount=${res.rowCount}`,
    );
  });

  await expectThrows(
    admin.query("update public.users set username = 'Has-Dash' where id = $1", [userA]),
    'Uppercase/invalid-character usernames are rejected by the format constraint',
    /violates check constraint/i,
  );

  await admin.query('begin');
  try {
    await admin.query("update public.users set username = 'dup_name' where id = $1", [userA]);
    await expectThrows(
      admin.query("update public.users set username = 'dup_name' where id = $1", [userB]),
      'Duplicate usernames are rejected by the unique constraint',
      /duplicate key|unique constraint/i,
    );
  } finally {
    await admin.query('rollback').catch(() => {});
  }

  // Only userA's username change was actually committed above (userB's was
  // rolled back with the duplicate-username transaction); reset it so
  // later tests start from a clean, username-less state.
  await admin.query('update public.users set username = null where id = $1', [userA]);

  console.log('\nRunning ownership/isolation tests...\n');

  await asUser(userA, async (client) => {
    expectRowCount(
      await client.query('select id from public.workouts where id = $1', [fixtureA.workoutId]),
      1,
      'User A can access their own workout',
    );
  });

  await asUser(userA, async (client) => {
    expectRowCount(
      await client.query('select id from public.workouts where id = $1', [fixtureB.workoutId]),
      0,
      "User A cannot access User B's workout",
    );
  });

  await asUser(userA, async (client) => {
    expectRowCount(
      await client.query('select id from public.sets where id = $1', [fixtureB.setId]),
      0,
      "User A cannot access User B's sets",
    );
  });

  await asUser(userA, async (client) => {
    expectRowCount(
      await client.query('select id from public.food_logs where id = $1', [fixtureB.foodLogId]),
      0,
      "User A cannot access User B's nutrition logs",
    );
  });

  await asUser(userA, async (client) => {
    const res = await client.query("update public.workouts set name = 'hacked' where id = $1", [
      fixtureB.workoutId,
    ]);
    const passed = res.rowCount === 0;
    record(
      "User A cannot modify User B's workout via UPDATE",
      passed,
      passed ? undefined : `rowCount=${res.rowCount}`,
    );
  });

  await expectThrows(
    asUser(userA, (client) =>
      client.query('insert into public.workouts (user_id, name) values ($1, $2)', [
        userB,
        'spoofed',
      ]),
    ),
    'User A cannot create a workout with a spoofed user_id',
    RLS_ERROR,
  );

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        'insert into public.sets (workout_exercise_id, user_id, set_index, weight_kg, reps) values ($1, $2, 99, 999, 1)',
        [fixtureB.workoutExerciseId, userA],
      ),
    ),
    "User A cannot attach a set to User B's workout_exercise by spoofing user_id",
    RLS_ERROR,
  );

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        'insert into public.workout_exercises (workout_id, exercise_id, user_id, order_index) values ($1, $2, $3, 99)',
        [fixtureB.workoutId, benchPress, userA],
      ),
    ),
    "User A cannot attach a workout_exercise to User B's workout",
    RLS_ERROR,
  );

  await asUser(userA, async (client) => {
    expectRowCount(
      await client.query('select * from public.admin_users'),
      0,
      'Normal users cannot read admin_users',
    );
  });

  await expectThrows(
    asUser(userA, (client) =>
      client.query("insert into public.admin_users (user_id, role) values ($1, 'full_admin')", [
        userA,
      ]),
    ),
    'User A cannot grant themself admin via INSERT',
    RLS_ERROR,
  );

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        "insert into public.subscriptions (user_id, revenuecat_customer_id, status) values ($1, 'fake', 'active')",
        [userA],
      ),
    ),
    'User A cannot create their own subscription row',
    RLS_ERROR,
  );

  await asUser(userA, async (client) => {
    expectRowCount(
      await client.query('select * from public.subscription_events'),
      0,
      'Normal users cannot read subscription_events',
    );
  });

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        "insert into public.subscription_events (id, event_type, app_user_id, occurred_at, payload) values ('evt_fake', 'INITIAL_PURCHASE', $1, now(), '{}'::jsonb)",
        [userA],
      ),
    ),
    'User A cannot fabricate a subscription_events row (audit log integrity)',
    RLS_ERROR,
  );

  console.log('\nRunning historical-integrity tests...\n');

  await admin.query('begin');
  try {
    await admin.query('update public.exercises set is_active = false where id = $1', [benchPress]);
    await asClaims(admin, userA);
    expectRowCount(
      await admin.query(
        `select e.name from public.workout_exercises we
         join public.exercises e on e.id = we.exercise_id
         where we.id = $1`,
        [fixtureA.workoutExerciseId],
      ),
      1,
      'Deactivated exercise is still visible through a historical workout',
    );
    await admin.query('reset role');
    await expectThrows(
      admin.query('delete from public.exercises where id = $1', [benchPress]),
      'Deactivated exercise referenced by history cannot be hard-deleted',
      /foreign key|violat/i,
    );
  } finally {
    await admin.query('reset role').catch(() => {});
    await admin.query('rollback').catch(() => {});
  }

  await admin.query('begin');
  try {
    await admin.query('update public.foods set calories = calories + 500 where id = $1', [
      testFood,
    ]);
    await asClaims(admin, userA);
    const snap = await admin.query('select calories from public.food_logs where id = $1', [
      fixtureA.foodLogWithSourceId,
    ]);
    const passed = snap.rows[0] && Number(snap.rows[0].calories) === 200;
    record(
      'Food log snapshot unchanged after source food is edited',
      Boolean(passed),
      passed ? undefined : `calories=${snap.rows[0]?.calories}`,
    );
  } finally {
    await admin.query('reset role').catch(() => {});
    await admin.query('rollback').catch(() => {});
  }

  console.log('\nRunning PR/1RM recompute engine tests...\n');

  await admin.query('begin');
  try {
    await asClaims(admin, userA);

    const w = (
      await admin.query(
        "insert into public.workouts (user_id, name, performed_at) values ($1, 'PR Test Workout', now()) returning id",
        [userA],
      )
    ).rows[0];
    const we = (
      await admin.query(
        'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 1) returning id',
        [w.id, squat],
      )
    ).rows[0];

    await admin.query(
      'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 1, 100, 5)',
      [we.id],
    );
    const set110 = (
      await admin.query(
        'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 2, 110, 5) returning id',
        [we.id],
      )
    ).rows[0];

    let pr = await admin.query(
      'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 5',
      [userA, squat],
    );
    record(
      'Rep-count PR reflects the heaviest 5-rep set (110kg)',
      pr.rows[0]?.best_weight_kg === '110.00',
      `got ${pr.rows[0]?.best_weight_kg}`,
    );

    await admin.query(
      'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 3, 140, 1)',
      [we.id],
    );

    let orm = await admin.query(
      'select weight_kg from public.one_rep_maxes where user_id = $1 and exercise_id = $2',
      [userA, squat],
    );
    record(
      'True 1RM recorded from the single 1-rep set (140kg)',
      orm.rows[0]?.weight_kg === '140.00',
      `got ${orm.rows[0]?.weight_kg}`,
    );

    expectRowCount(
      await admin.query(
        'select 1 from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 1',
        [userA, squat],
      ),
      0,
      'The 1-rep set is not duplicated into rep_prs',
    );

    await admin.query('update public.sets set deleted_at = now() where id = $1', [set110.id]);
    pr = await admin.query(
      'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 5',
      [userA, squat],
    );
    record(
      'Soft-deleting the PR set recomputes down to the remaining set (100kg)',
      pr.rows[0]?.best_weight_kg === '100.00',
      `got ${pr.rows[0]?.best_weight_kg}`,
    );

    await admin.query('update public.sets set deleted_at = null where id = $1', [set110.id]);
    pr = await admin.query(
      'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 5',
      [userA, squat],
    );
    record(
      'Restoring the set recomputes the PR back up (110kg)',
      pr.rows[0]?.best_weight_kg === '110.00',
      `got ${pr.rows[0]?.best_weight_kg}`,
    );

    await admin.query('update public.workouts set deleted_at = now() where id = $1', [w.id]);
    expectRowCount(
      await admin.query(
        'select 1 from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 5',
        [userA, squat],
      ),
      0,
      'Deleting the workout removes the now-unqualified PR entirely',
    );

    await admin.query('update public.workouts set deleted_at = null where id = $1', [w.id]);
    pr = await admin.query(
      'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 5',
      [userA, squat],
    );
    record(
      'Restoring the workout recomputes the PR again (110kg)',
      pr.rows[0]?.best_weight_kg === '110.00',
      `got ${pr.rows[0]?.best_weight_kg}`,
    );
  } finally {
    await admin.query('reset role').catch(() => {});
    await admin.query('rollback').catch(() => {});
  }

  await admin.end();
}

let exitCode = 0;
try {
  await main();
} catch (err) {
  console.error('\nTest harness crashed:', err);
  exitCode = 1;
} finally {
  await pgInstance.stop().catch(() => {});
  // Windows can briefly hold file locks after the server process exits.
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

console.log('\n---');
const failed = results.filter((r) => !r.passed);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.log('\nFailed:');
  for (const f of failed) {
    console.log(`  - ${f.name}${f.detail ? ': ' + f.detail : ''}`);
  }
  exitCode = 1;
}

process.exit(exitCode);
