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
  // Used only by the additional PR edge-case tests below, kept separate from
  // squat/benchPress for the same reason: no cross-contamination between
  // assertions that all read global per-user-per-exercise PR state.
  const deadlift = (await admin.query("select id from public.exercises where name = 'Deadlift'"))
    .rows[0].id;
  const overheadPress = (
    await admin.query("select id from public.exercises where name = 'Overhead Press'")
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

  console.log('\nRunning exercise library tests...\n');

  const customExerciseId = await asUserCommitted(userA, async (client) => {
    const res = await client.query(
      "insert into public.exercises (name, muscle_group, created_by) values ('My Curl Variation', 'biceps', $1) returning id",
      [userA],
    );
    return res.rows[0].id;
  });

  await asUser(userA, async (client) => {
    const res = await client.query(
      "update public.exercises set name = 'My Curl Variation v2' where id = $1",
      [customExerciseId],
    );
    const passed = res.rowCount === 1;
    record(
      'User A can update their own custom exercise via the existing RLS policy',
      passed,
      passed ? undefined : `rowCount=${res.rowCount}`,
    );
  });

  await asUser(userA, async (client) => {
    const res = await client.query(
      "update public.exercises set name = 'Hacked Bench Press' where id = $1",
      [benchPress],
    );
    const passed = res.rowCount === 0;
    record(
      'User A cannot modify a built-in exercise via UPDATE',
      passed,
      passed ? undefined : `rowCount=${res.rowCount}`,
    );
  });

  await asUser(userB, async (client) => {
    const res = await client.query(
      "update public.exercises set name = 'Stolen Curl' where id = $1",
      [customExerciseId],
    );
    const passed = res.rowCount === 0;
    record(
      "User B cannot modify User A's custom exercise via UPDATE",
      passed,
      passed ? undefined : `rowCount=${res.rowCount}`,
    );
  });

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        "insert into public.exercises (name, muscle_group, created_by) values ('Spoofed Builtin', 'chest', null)",
      ),
    ),
    'User A cannot create a built-in exercise by spoofing created_by to null',
    RLS_ERROR,
  );

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        "insert into public.exercises (name, muscle_group, created_by) values ('Spoofed Owner', 'chest', $1)",
        [userB],
      ),
    ),
    'User A cannot create a custom exercise spoofing User B as the owner',
    RLS_ERROR,
  );

  await asUser(userB, async (client) => {
    expectRowCount(
      await client.query('select id from public.exercises where id = $1', [customExerciseId]),
      0,
      "User B cannot see User A's custom exercise",
    );
  });

  await asUser(userA, async (client) => {
    expectRowCount(
      await client.query('select id from public.exercises where id = $1', [benchPress]),
      1,
      'User A can see built-in exercises',
    );
  });

  await admin.query('begin');
  try {
    await admin.query('update public.exercises set is_active = false where id = $1', [
      customExerciseId,
    ]);
    await asClaims(admin, userA);
    expectRowCount(
      await admin.query('select id from public.exercises where id = $1', [customExerciseId]),
      1,
      'A deactivated custom exercise remains visible by id (historical integrity)',
    );
  } finally {
    await admin.query('reset role').catch(() => {});
    await admin.query('rollback').catch(() => {});
  }

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

  console.log('\nRunning workout logging tests (Phase 3)...\n');

  await asUser(userB, async (client) => {
    expectRowCount(
      await client.query('select id from public.workout_exercises where id = $1', [
        fixtureA.workoutExerciseId,
      ]),
      0,
      "User B cannot access User A's workout_exercises",
    );
  });

  // One-active-workout-per-user: fixtureA/fixtureB's fixture workouts are
  // already active (completed_at is null), so a second active workout for
  // the same user should be rejected by the partial unique index.
  await expectThrows(
    asUserCommitted(userA, (client) =>
      client.query("insert into public.workouts (user_id, name) values ($1, 'Second Active')", [
        userA,
      ]),
    ),
    'User A cannot have two simultaneous active (incomplete) workouts',
    /duplicate key|unique constraint/i,
  );

  await asUserCommitted(userA, async (client) => {
    await client.query('update public.workouts set completed_at = now() where id = $1', [
      fixtureA.workoutId,
    ]);
    const res = await client.query(
      "insert into public.workouts (user_id, name) values ($1, 'New Active Workout') returning id",
      [userA],
    );
    record(
      'Completing the active workout frees the slot for a new one',
      res.rowCount === 1,
      `rowCount=${res.rowCount}`,
    );
    // Regular users have no DELETE policy on workouts (soft-delete only via
    // UPDATE, matching the schema's design) -- so cleanup here completes the
    // extra workout too, freeing the slot back for fixtureA, rather than
    // trying to hard-delete it.
    await client.query('update public.workouts set completed_at = now() where id = $1', [
      res.rows[0].id,
    ]);
    await client.query('update public.workouts set completed_at = null where id = $1', [
      fixtureA.workoutId,
    ]);
  });

  // Reordering exercises: the mobile app sends a single bulk upsert (one
  // PostgREST request = one transaction) covering every reordered row. Since
  // the (workout_id, order_index) uniqueness constraint is
  // "deferrable initially deferred", it's only checked at commit -- not
  // after each row within the statement -- so a same-statement swap of two
  // rows' order_index values should succeed even though an intermediate
  // state would otherwise collide. This test exists specifically to verify
  // that assumption against a real database before the mobile app relies on
  // it.
  await asUserCommitted(userA, async (client) => {
    const squatWe = (
      await client.query(
        'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 2) returning id',
        [fixtureA.workoutId, squat],
      )
    ).rows[0];

    // Single statement, single request: swap order_index 1<->2 for the two
    // rows via one multi-row INSERT ... ON CONFLICT (id) DO UPDATE, exactly
    // mirroring what a bulk supabase-js .upsert() call sends.
    await client.query(
      `insert into public.workout_exercises (id, workout_id, exercise_id, order_index)
       values ($1, $2, $3, 2), ($4, $2, $5, 1)
       on conflict (id) do update set order_index = excluded.order_index`,
      [fixtureA.workoutExerciseId, fixtureA.workoutId, benchPress, squatWe.id, squat],
    );

    const rows = (
      await client.query(
        'select id, order_index from public.workout_exercises where workout_id = $1 order by order_index',
        [fixtureA.workoutId],
      )
    ).rows;
    const passed =
      rows.length === 2 && rows[0].id === squatWe.id && rows[1].id === fixtureA.workoutExerciseId;
    record(
      'Bulk single-statement upsert can swap order_index values without tripping the deferred unique constraint',
      passed,
      passed ? undefined : `got ${JSON.stringify(rows)}`,
    );

    // Restore original ordering for later tests/fixtures.
    await client.query(
      `insert into public.workout_exercises (id, workout_id, exercise_id, order_index)
       values ($1, $2, $3, 1), ($4, $2, $5, 2)
       on conflict (id) do update set order_index = excluded.order_index`,
      [fixtureA.workoutExerciseId, fixtureA.workoutId, benchPress, squatWe.id, squat],
    );
    await client.query('delete from public.workout_exercises where id = $1', [squatWe.id]);
  });

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 99, -10, 5)',
        [fixtureA.workoutExerciseId],
      ),
    ),
    'A non-positive weight is rejected by the check constraint',
    /violates check constraint/i,
  );

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 99, 100, 0)',
        [fixtureA.workoutExerciseId],
      ),
    ),
    'A non-positive rep count is rejected by the check constraint',
    /violates check constraint/i,
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

    // completed_at is set at creation (rather than left active) purely so
    // this doesn't collide with fixtureA's own already-active workout under
    // the one-active-workout-per-user constraint -- PR recomputation itself
    // doesn't care about completed_at at all, only deleted_at/performed_at.
    const w = (
      await admin.query(
        "insert into public.workouts (user_id, name, performed_at, completed_at) values ($1, 'PR Test Workout', now(), now()) returning id",
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

    // completed_at set at creation, same reasoning as the "PR Test Workout"
    // above -- avoids colliding with the one-active-workout-per-user index.
    const wD = (
      await admin.query(
        "insert into public.workouts (user_id, name, performed_at, completed_at) values ($1, 'PR Edge Case Workout', now(), now()) returning id",
        [userA],
      )
    ).rows[0];
    const weD = (
      await admin.query(
        'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 1) returning id',
        [wD.id, deadlift],
      )
    ).rows[0];

    const set8a = (
      await admin.query(
        'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 1, 150, 8) returning id',
        [weD.id],
      )
    ).rows[0];

    let pr8 = await admin.query(
      'select best_weight_kg, source_set_id from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 8',
      [userA, deadlift],
    );
    record(
      '8-rep PR is created from the first qualifying 8-rep set (150kg)',
      pr8.rows[0]?.best_weight_kg === '150.00',
      `got ${pr8.rows[0]?.best_weight_kg}`,
    );

    await admin.query(
      'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 2, 140, 8)',
      [weD.id],
    );
    pr8 = await admin.query(
      'select best_weight_kg, source_set_id from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 8',
      [userA, deadlift],
    );
    record(
      'A lighter set at the same rep count does not replace the PR',
      pr8.rows[0]?.best_weight_kg === '150.00' && pr8.rows[0]?.source_set_id === set8a.id,
      `weight=${pr8.rows[0]?.best_weight_kg}, source=${pr8.rows[0]?.source_set_id}`,
    );

    await admin.query(
      'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 3, 160, 6)',
      [weD.id],
    );
    const pr6 = await admin.query(
      'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 6',
      [userA, deadlift],
    );
    const pr8Still = await admin.query(
      'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 8',
      [userA, deadlift],
    );
    record(
      'A different rep count maintains an independent PR (6-rep and 8-rep coexist)',
      pr6.rows[0]?.best_weight_kg === '160.00' && pr8Still.rows[0]?.best_weight_kg === '150.00',
      `6-rep=${pr6.rows[0]?.best_weight_kg}, 8-rep=${pr8Still.rows[0]?.best_weight_kg}`,
    );

    expectRowCount(
      await admin.query(
        'select 1 from public.one_rep_maxes where user_id = $1 and exercise_id = $2',
        [userA, deadlift],
      ),
      0,
      'A set above 1 rep never creates a true 1RM',
    );

    await admin.query('update public.sets set weight_kg = 170 where id = $1', [set8a.id]);
    pr8 = await admin.query(
      'select best_weight_kg, source_set_id from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 8',
      [userA, deadlift],
    );
    record(
      "Editing a set's weight recomputes its rep-count PR",
      pr8.rows[0]?.best_weight_kg === '170.00' && pr8.rows[0]?.source_set_id === set8a.id,
      `got ${pr8.rows[0]?.best_weight_kg}`,
    );

    // set8a (currently the 8-rep PR at 170kg) moves to 6 reps. The other
    // 8-rep set inserted earlier (140kg) is still qualifying, so the 8-rep
    // PR must fall back to it rather than disappear -- and the 6-rep PR
    // must pick up set8a's new 170kg, since that beats the existing 160kg
    // 6-rep set.
    await admin.query('update public.sets set reps = 6 where id = $1', [set8a.id]);
    const pr8AfterMove = await admin.query(
      'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 8',
      [userA, deadlift],
    );
    const pr6Moved = await admin.query(
      'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 6',
      [userA, deadlift],
    );
    record(
      "Editing a set's reps moves it out of its old rep-count PR slot and into the new one",
      pr8AfterMove.rows[0]?.best_weight_kg === '140.00' &&
        pr6Moved.rows[0]?.best_weight_kg === '170.00',
      `8-rep=${pr8AfterMove.rows[0]?.best_weight_kg}, 6-rep=${pr6Moved.rows[0]?.best_weight_kg}`,
    );

    // Workout date (performed_at) changes and tie-break ordering.
    const dateEarly = (
      await admin.query(
        "insert into public.workouts (user_id, name, performed_at, completed_at) values ($1, 'Date Early', '2024-01-01T00:00:00Z', now()) returning id",
        [userA],
      )
    ).rows[0];
    const weEarly = (
      await admin.query(
        'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 1) returning id',
        [dateEarly.id, overheadPress],
      )
    ).rows[0];
    const setEarly = (
      await admin.query(
        'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 1, 100, 5) returning id',
        [weEarly.id],
      )
    ).rows[0];

    const dateLate = (
      await admin.query(
        "insert into public.workouts (user_id, name, performed_at, completed_at) values ($1, 'Date Late', '2024-06-01T00:00:00Z', now()) returning id",
        [userA],
      )
    ).rows[0];
    const weLate = (
      await admin.query(
        'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 1) returning id',
        [dateLate.id, overheadPress],
      )
    ).rows[0];
    const setLate = (
      await admin.query(
        'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 1, 100, 5) returning id',
        [weLate.id],
      )
    ).rows[0];

    let ohp = await admin.query(
      'select source_set_id from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 5',
      [userA, overheadPress],
    );
    record(
      'A tie in weight keeps the earliest-performed set as the PR source',
      ohp.rows[0]?.source_set_id === setEarly.id,
      `source=${ohp.rows[0]?.source_set_id}, expected=${setEarly.id}`,
    );

    await admin.query('update public.workouts set performed_at = $2 where id = $1', [
      dateEarly.id,
      '2024-12-01T00:00:00Z',
    ]);
    ohp = await admin.query(
      'select source_set_id from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 5',
      [userA, overheadPress],
    );
    record(
      "Changing a workout's date re-derives which tied set is the PR source",
      ohp.rows[0]?.source_set_id === setLate.id,
      `source=${ohp.rows[0]?.source_set_id}, expected=${setLate.id}`,
    );

    // Isolation and manufacture-prevention on rep_prs/one_rep_maxes.
    await asUser(userA, async (client) => {
      expectRowCount(
        await client.query('select * from public.rep_prs where user_id = $1', [userB]),
        0,
        "User A cannot select User B's rep_prs rows",
      );
    });

    await asUser(userA, async (client) => {
      expectRowCount(
        await client.query('select * from public.one_rep_maxes where user_id = $1', [userB]),
        0,
        "User A cannot select User B's one_rep_maxes rows",
      );
    });

    await expectThrows(
      asUser(userA, (client) =>
        client.query(
          'insert into public.rep_prs (user_id, exercise_id, reps, best_weight_kg, source_set_id, achieved_at) values ($1, $2, 5, 999, $3, now())',
          [userA, deadlift, set8a.id],
        ),
      ),
      'User cannot manufacture a rep_prs record via INSERT',
      RLS_ERROR,
    );

    await expectThrows(
      asUser(userA, (client) =>
        client.query(
          'insert into public.one_rep_maxes (user_id, exercise_id, weight_kg, source_set_id, achieved_at) values ($1, $2, 999, $3, now())',
          [userA, deadlift, set8a.id],
        ),
      ),
      'User cannot manufacture a one_rep_maxes record via INSERT',
      RLS_ERROR,
    );

    await asUser(userA, async (client) => {
      const upd = await client.query(
        'update public.rep_prs set best_weight_kg = 999 where user_id = $1',
        [userA],
      );
      record(
        'User cannot modify their own rep_prs record via UPDATE',
        upd.rowCount === 0,
        `rowCount=${upd.rowCount}`,
      );
    });

    await asUser(userA, async (client) => {
      const upd = await client.query(
        'update public.one_rep_maxes set weight_kg = 999 where user_id = $1',
        [userA],
      );
      record(
        'User cannot modify their own one_rep_maxes record via UPDATE',
        upd.rowCount === 0,
        `rowCount=${upd.rowCount}`,
      );
    });

    await asUser(userA, async (client) => {
      const del = await client.query('delete from public.rep_prs where user_id = $1', [userA]);
      record(
        'User cannot delete their own rep_prs record via DELETE',
        del.rowCount === 0,
        `rowCount=${del.rowCount}`,
      );
    });

    await asUser(userA, async (client) => {
      const del = await client.query('delete from public.one_rep_maxes where user_id = $1', [
        userA,
      ]);
      record(
        'User cannot delete their own one_rep_maxes record via DELETE',
        del.rowCount === 0,
        `rowCount=${del.rowCount}`,
      );
    });
  } finally {
    await admin.query('reset role').catch(() => {});
    await admin.query('rollback').catch(() => {});
  }

  console.log('\nRunning nutrition tests (Phase 6)...\n');

  // Built via asUserCommitted (a real committed transaction on its own
  // connection), same as fixtureA/fixtureB above -- this is what makes the
  // isolation checks below meaningful. If these rows only existed inside an
  // uncommitted transaction, a different session's queries wouldn't see
  // them regardless of RLS (plain MVCC snapshot isolation), which would
  // make "User B cannot select User A's X" trivially true for the wrong
  // reason instead of actually exercising the policy.
  const userAFood = (
    await asUserCommitted(userA, (client) =>
      client.query(
        `insert into public.foods (created_by, name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
         values ($1, 'Nutrition Test Food', 100, 'g', 100, 10, 10, 2) returning id`,
        [userA],
      ),
    )
  ).rows[0];

  const userAFoodLog = (
    await asUserCommitted(userA, (client) =>
      client.query(
        `insert into public.food_logs (user_id, food_id, food_name_snapshot, serving_size, serving_unit, quantity, calories, protein_g, carbs_g, fat_g)
         values ($1, $2, 'Nutrition Test Food', 100, 'g', 1, 100, 10, 10, 2) returning id`,
        [userA, userAFood.id],
      ),
    )
  ).rows[0];

  await asUserCommitted(userA, (client) =>
    client.query(
      `insert into public.nutrition_goals (user_id, calories, protein_g, carbs_g, fat_g)
       values ($1, 2000, 180, 200, 60)`,
      [userA],
    ),
  );

  await asUser(userB, async (client) => {
    expectRowCount(
      await client.query('select * from public.foods where id = $1', [userAFood.id]),
      0,
      "User B cannot select User A's custom food",
    );
  });

  await asUser(userB, async (client) => {
    const upd = await client.query("update public.foods set name = 'hacked' where id = $1", [
      userAFood.id,
    ]);
    record(
      "User B cannot modify User A's custom food via UPDATE",
      upd.rowCount === 0,
      `rowCount=${upd.rowCount}`,
    );
  });

  await expectThrows(
    asUser(userB, (client) =>
      client.query(
        `insert into public.foods (created_by, name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
         values ($1, 'spoofed', 100, 'g', 0, 0, 0, 0)`,
        [userA],
      ),
    ),
    'User B cannot create a food claiming created_by = User A',
    RLS_ERROR,
  );

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        `insert into public.foods (created_by, name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
         values ($1, 'Bad Food', -5, 'g', 100, 10, 10, 2)`,
        [userA],
      ),
    ),
    'A non-positive serving size is rejected by the check constraint',
    /check constraint/i,
  );

  await asUser(userB, async (client) => {
    expectRowCount(
      await client.query('select * from public.food_logs where id = $1', [userAFoodLog.id]),
      0,
      "User B cannot select User A's food log",
    );
  });

  await asUser(userB, async (client) => {
    const upd = await client.query('update public.food_logs set quantity = 99 where id = $1', [
      userAFoodLog.id,
    ]);
    record(
      "User B cannot modify User A's food log via UPDATE",
      upd.rowCount === 0,
      `rowCount=${upd.rowCount}`,
    );
  });

  await asUser(userB, async (client) => {
    const del = await client.query('delete from public.food_logs where id = $1', [userAFoodLog.id]);
    record(
      "User B cannot delete User A's food log via DELETE",
      del.rowCount === 0,
      `rowCount=${del.rowCount}`,
    );
  });

  await expectThrows(
    asUser(userB, (client) =>
      client.query(
        `insert into public.food_logs (user_id, food_name_snapshot, serving_size, serving_unit, quantity, calories, protein_g, carbs_g, fat_g)
         values ($1, 'spoofed', 1, 'serving', 1, 0, 0, 0, 0)`,
        [userA],
      ),
    ),
    'User B cannot create a food log claiming user_id = User A',
    RLS_ERROR,
  );

  await asUser(userB, async (client) => {
    expectRowCount(
      await client.query('select * from public.nutrition_goals where user_id = $1', [userA]),
      0,
      "User B cannot select User A's nutrition goals",
    );
  });

  await asUser(userB, async (client) => {
    const upd = await client.query(
      'update public.nutrition_goals set calories = 1 where user_id = $1',
      [userA],
    );
    record(
      "User B cannot modify User A's nutrition goals via UPDATE",
      upd.rowCount === 0,
      `rowCount=${upd.rowCount}`,
    );
  });

  await asUser(userB, async (client) => {
    const del = await client.query('delete from public.nutrition_goals where user_id = $1', [
      userA,
    ]);
    record(
      "User B cannot delete User A's nutrition goals via DELETE",
      del.rowCount === 0,
      `rowCount=${del.rowCount}`,
    );
  });

  await expectThrows(
    asUser(userB, (client) =>
      client.query('insert into public.nutrition_goals (user_id, calories) values ($1, 999)', [
        userA,
      ]),
    ),
    'User B cannot create nutrition goals claiming user_id = User A',
    RLS_ERROR,
  );

  // userA's goals row is already committed (via asUserCommitted above), so
  // this correctly surfaces an immediate unique-constraint error rather
  // than blocking on another session's uncommitted work.
  await expectThrows(
    asUser(userA, (client) =>
      client.query('insert into public.nutrition_goals (user_id, calories) values ($1, 1500)', [
        userA,
      ]),
    ),
    'A user cannot have two nutrition_goals rows (unique per user)',
    /duplicate key|unique/i,
  );

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
  // Windows can briefly hold file locks after the server process exits --
  // occasionally longer than rmSync's own retries cover. This is best-effort
  // temp-directory cleanup, not a test result, so a leftover temp dir here
  // must never mask the actual pass/fail tally below.
  try {
    rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch (err) {
    console.error(`\nWarning: failed to remove temp data dir ${dataDir}:`, err);
  }
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
