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
const storageShimFile = join(__dirname, 'storage-shim.sql');

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

/**
 * Same as expectThrows, but for a query that must run inside an already-open,
 * still-needed shared transaction (e.g. the PR-recompute/unilateral tests,
 * which build up state across many statements on one `admin` transaction
 * rather than a fresh asUser() connection per check). Postgres aborts the
 * *entire* transaction after any error until it sees a ROLLBACK, so without
 * a savepoint here, one expected constraint-violation would silently poison
 * every later statement in the same transaction (they'd all fail with
 * "current transaction is aborted"). Wrapping in SAVEPOINT/ROLLBACK TO
 * SAVEPOINT contains the expected failure to just this one check.
 */
async function expectThrowsInTransaction(client, queryPromiseFactory, name, matcher) {
  await client.query('savepoint expect_throws_sp');
  try {
    await queryPromiseFactory();
    record(name, false, 'expected an error but none was thrown');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    record(
      name,
      matcher.test(message),
      matcher.test(message) ? undefined : `unexpected error: ${message}`,
    );
  } finally {
    await client.query('rollback to savepoint expect_throws_sp');
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

  console.log('Applying storage shim...');
  await admin.query(readFileSync(storageShimFile, 'utf8'));

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

  console.log('\nRunning theme color tests...\n');

  await asUserCommitted(userA, async (client) => {
    await client.query(
      "update public.users set workout_accent_color = '#2F80FF', nutrition_accent_color = '#10B981' where id = $1",
      [userA],
    );
  });
  await asUser(userA, async (client) => {
    const res = await client.query(
      'select workout_accent_color, nutrition_accent_color from public.users where id = $1',
      [userA],
    );
    record(
      'User A can set their own workout/nutrition accent colors via the existing self-update RLS policy',
      res.rows[0]?.workout_accent_color === '#2F80FF' &&
        res.rows[0]?.nutrition_accent_color === '#10B981',
      `got ${JSON.stringify(res.rows[0])}`,
    );
  });

  await asUser(userB, async (client) => {
    const res = await client.query(
      "update public.users set workout_accent_color = '#000000' where id = $1",
      [userA],
    );
    const passed = res.rowCount === 0;
    record(
      "User B cannot modify User A's theme colors via UPDATE",
      passed,
      passed ? undefined : `rowCount=${res.rowCount}`,
    );
  });

  await expectThrows(
    admin.query("update public.users set workout_accent_color = 'not-a-hex' where id = $1", [
      userA,
    ]),
    'An invalid workout_accent_color is rejected by the format constraint',
    /violates check constraint/i,
  );

  await expectThrows(
    admin.query("update public.users set nutrition_accent_color = 'blue' where id = $1", [userA]),
    'An invalid nutrition_accent_color is rejected by the format constraint',
    /violates check constraint/i,
  );

  await admin.query('update public.users set workout_accent_color = null where id = $1', [userA]);
  const nullCheck = await admin.query(
    'select workout_accent_color from public.users where id = $1',
    [userA],
  );
  record(
    'workout_accent_color can be cleared back to null (no value chosen yet)',
    nullCheck.rows[0]?.workout_accent_color === null,
    `got ${nullCheck.rows[0]?.workout_accent_color}`,
  );

  // Reset both to a clean, uncustomized state so later tests aren't affected.
  await admin.query(
    'update public.users set workout_accent_color = null, nutrition_accent_color = null where id = $1',
    [userA],
  );

  console.log('\nRunning onboarding profile field tests...\n');

  await asUserCommitted(userA, async (client) => {
    await client.query(
      `update public.users set
         gender = 'other',
         birthday = '2001-09-14',
         weight_value = 79.2,
         height_value = 174,
         height_unit = 'cm',
         fitness_goal = 'build_muscle',
         training_experience = 'intermediate',
         workout_frequency_days = 4,
         training_style_preference = 'build_your_own',
         email_opt_in = true,
         push_notifications_opt_in = false,
         apple_health_preference = 'not_now',
         onboarding_completed_at = now()
       where id = $1`,
      [userA],
    );
  });
  await asUser(userA, async (client) => {
    const res = await client.query(
      `select gender, birthday, weight_value, height_value, height_unit, fitness_goal,
              training_experience, workout_frequency_days, training_style_preference,
              email_opt_in, push_notifications_opt_in, apple_health_preference,
              onboarding_completed_at
       from public.users where id = $1`,
      [userA],
    );
    const row = res.rows[0];
    const passed =
      row?.gender === 'other' &&
      row?.fitness_goal === 'build_muscle' &&
      row?.training_experience === 'intermediate' &&
      row?.workout_frequency_days === 4 &&
      row?.training_style_preference === 'build_your_own' &&
      row?.email_opt_in === true &&
      row?.push_notifications_opt_in === false &&
      row?.apple_health_preference === 'not_now' &&
      row?.onboarding_completed_at !== null;
    record(
      'User A can set their own onboarding profile fields via the existing self-update RLS policy',
      passed,
      passed ? undefined : `got ${JSON.stringify(row)}`,
    );
  });

  await asUser(userB, async (client) => {
    const res = await client.query("update public.users set gender = 'male' where id = $1", [
      userA,
    ]);
    const passed = res.rowCount === 0;
    record(
      "User B cannot modify User A's onboarding profile fields via UPDATE",
      passed,
      passed ? undefined : `rowCount=${res.rowCount}`,
    );
  });

  await expectThrows(
    admin.query("update public.users set gender = 'robot' where id = $1", [userA]),
    'An invalid gender is rejected by the format constraint',
    /violates check constraint/i,
  );

  await expectThrows(
    admin.query("update public.users set height_unit = 'inches' where id = $1", [userA]),
    'An invalid height_unit is rejected by the format constraint',
    /violates check constraint/i,
  );

  await expectThrows(
    admin.query("update public.users set fitness_goal = 'get_ripped' where id = $1", [userA]),
    'An invalid fitness_goal is rejected by the format constraint',
    /violates check constraint/i,
  );

  await expectThrows(
    admin.query('update public.users set workout_frequency_days = 9 where id = $1', [userA]),
    'An out-of-range workout_frequency_days is rejected by the format constraint',
    /violates check constraint/i,
  );

  await expectThrows(
    admin.query(
      "update public.users set training_style_preference = 'ai_generated' where id = $1",
      [userA],
    ),
    'An invalid training_style_preference is rejected by the format constraint',
    /violates check constraint/i,
  );

  await expectThrows(
    admin.query("update public.users set apple_health_preference = 'maybe' where id = $1", [userA]),
    'An invalid apple_health_preference is rejected by the format constraint',
    /violates check constraint/i,
  );

  await expectThrows(
    admin.query(
      `update public.users set birthday = (current_date + interval '1 day') where id = $1`,
      [userA],
    ),
    'A future birthday is rejected by the format constraint',
    /violates check constraint/i,
  );

  // Reset to a clean, unanswered state so later tests aren't affected.
  await admin.query(
    `update public.users set
       gender = null, birthday = null, weight_value = null, height_value = null,
       height_unit = 'cm', fitness_goal = null, training_experience = null,
       workout_frequency_days = null, training_style_preference = null,
       email_opt_in = null, push_notifications_opt_in = null,
       apple_health_preference = null, onboarding_completed_at = null
     where id = $1`,
    [userA],
  );

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

  console.log('\nRunning set completion-state tests...\n');

  // Own isolated exercise, not shared with any other test's PR expectations
  // (PRs are global per user+exercise across every workout) -- added as a
  // second exercise onto fixtureA's existing workout rather than creating a
  // new one, since a user can only have one active (incomplete) workout at
  // a time (workouts_one_active_per_user) and fixtureA's is already active.
  const pullUp = (await admin.query("select id from public.exercises where name = 'Pull-Up'"))
    .rows[0].id;

  const setCompletionFixture = await asUserCommitted(userA, async (client) => {
    const we = (
      await client.query(
        'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 99) returning id',
        [fixtureA.workoutId, pullUp],
      )
    ).rows[0];
    return { workoutExerciseId: we.id };
  });

  let blankSetId;
  await asUserCommitted(userA, async (client) => {
    const blank = (
      await client.query(
        'insert into public.sets (workout_exercise_id, set_index) values ($1, 1) returning id, weight_kg, reps, completed_at',
        [setCompletionFixture.workoutExerciseId],
      )
    ).rows[0];
    record(
      'A blank (planned) set can be created with no weight/reps/completed_at',
      blank.weight_kg === null && blank.reps === null && blank.completed_at === null,
      `got weight_kg=${blank.weight_kg} reps=${blank.reps} completed_at=${blank.completed_at}`,
    );
    blankSetId = blank.id;
  });

  const prBeforeCompletion = await admin.query(
    'select 1 from public.rep_prs where user_id = $1 and exercise_id = $2',
    [userA, pullUp],
  );
  record(
    'A blank set does not create a rep PR',
    prBeforeCompletion.rowCount === 0,
    `got ${prBeforeCompletion.rowCount} rows`,
  );

  await asUserCommitted(userA, async (client) => {
    const completed = (
      await client.query(
        `update public.sets set weight_kg = 50, reps = 8, completed_at = now()
         where id = $1 returning weight_kg, reps, completed_at`,
        [blankSetId],
      )
    ).rows[0];
    record(
      'Filling in weight/reps and completing a previously-blank set succeeds',
      completed.weight_kg === '50.00' && completed.reps === 8 && completed.completed_at !== null,
      `got weight_kg=${completed.weight_kg} reps=${completed.reps} completed_at=${completed.completed_at}`,
    );
  });

  const prAfterCompletion = await admin.query(
    'select best_weight_kg from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 8',
    [userA, pullUp],
  );
  record(
    'Completing a set with real values now creates its rep PR',
    prAfterCompletion.rows[0]?.best_weight_kg === '50.00',
    `got ${prAfterCompletion.rows[0]?.best_weight_kg}`,
  );

  console.log('\nRunning workout split tests...\n');

  const splitA = await asUserCommitted(userA, async (client) => {
    const res = await client.query(
      "insert into public.workout_splits (user_id, name) values ($1, 'PPL - Hypertrophy') returning id",
      [userA],
    );
    return res.rows[0];
  });

  const pushDay = await asUserCommitted(userA, async (client) => {
    const res = await client.query(
      'insert into public.workout_split_days (workout_split_id, name, order_index) values ($1, $2, 1) returning id',
      [splitA.id, 'Push'],
    );
    return res.rows[0];
  });

  await asUserCommitted(userA, (client) =>
    client.query(
      "insert into public.workout_split_day_muscle_groups (workout_split_day_id, muscle_group) values ($1, 'chest'), ($1, 'shoulders'), ($1, 'triceps')",
      [pushDay.id],
    ),
  );

  await asUser(userA, async (client) => {
    const res = await client.query(
      'select muscle_group from public.workout_split_day_muscle_groups where workout_split_day_id = $1 order by muscle_group',
      [pushDay.id],
    );
    const passed = res.rows.map((r) => r.muscle_group).join(',') === 'chest,shoulders,triceps';
    record(
      "User A can create a split with a day and that day's muscle groups",
      passed,
      passed ? undefined : `got ${JSON.stringify(res.rows)}`,
    );
  });

  // split_muscle_group is deliberately a small, general vocabulary (Chest/
  // Back/Shoulders/Biceps/Triceps/Forearms/Abs/Quads/Hamstrings/Glutes/
  // Calves -- legs deliberately split into 4 specific categories rather
  // than one general "legs") -- prove both that every remaining value is
  // accepted and that an old, no-longer-valid value (a finer-grained value
  // from before the general-vocabulary migration, and the interim general
  // "legs" value from before it was split back out) is rejected.
  await asUserCommitted(userA, (client) =>
    client.query(
      `insert into public.workout_split_day_muscle_groups (workout_split_day_id, muscle_group)
       values ($1, 'back'), ($1, 'biceps'), ($1, 'forearms'), ($1, 'abs'),
              ($1, 'quads'), ($1, 'hamstrings'), ($1, 'glutes'), ($1, 'calves')`,
      [pushDay.id],
    ),
  );
  await asUser(userA, async (client) => {
    const res = await client.query(
      'select count(*)::int as count from public.workout_split_day_muscle_groups where workout_split_day_id = $1',
      [pushDay.id],
    );
    record(
      'Every general split_muscle_group value is accepted (full 11-value enum coverage)',
      res.rows[0]?.count === 11,
      `got ${res.rows[0]?.count}`,
    );
  });

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        "insert into public.workout_split_day_muscle_groups (workout_split_day_id, muscle_group) values ($1, 'front_delts')",
        [pushDay.id],
      ),
    ),
    "The old, finer-grained 'front_delts' value is no longer valid for split_muscle_group",
    /invalid input value for enum/i,
  );

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        "insert into public.workout_split_day_muscle_groups (workout_split_day_id, muscle_group) values ($1, 'legs')",
        [pushDay.id],
      ),
    ),
    "The interim general 'legs' value is no longer valid now that it's split into specific categories",
    /invalid input value for enum/i,
  );

  await asUser(userA, async (client) => {
    const res = await client.query('select user_id from public.workout_split_days where id = $1', [
      pushDay.id,
    ]);
    record(
      "A split day's user_id is auto-derived from its parent split, not left null",
      res.rows[0]?.user_id === userA,
      `got ${res.rows[0]?.user_id}`,
    );
  });

  await asUser(userB, async (client) => {
    expectRowCount(
      await client.query('select id from public.workout_splits where id = $1', [splitA.id]),
      0,
      "User B cannot see User A's workout split",
    );
    expectRowCount(
      await client.query('select id from public.workout_split_days where id = $1', [pushDay.id]),
      0,
      "User B cannot see User A's split day",
    );
  });

  await asUser(userB, async (client) => {
    const upd = await client.query(
      "update public.workout_splits set name = 'hacked' where id = $1",
      [splitA.id],
    );
    record(
      "User B cannot rename User A's workout split via UPDATE",
      upd.rowCount === 0,
      `rowCount=${upd.rowCount}`,
    );
  });

  await expectThrows(
    asUser(userB, (client) =>
      client.query(
        'insert into public.workout_split_days (workout_split_id, name, order_index) values ($1, $2, 99)',
        [splitA.id, 'Hacked Day'],
      ),
    ),
    "User B cannot attach a day to User A's split",
    RLS_ERROR,
  );

  await asUserCommitted(userA, (client) =>
    client.query('update public.users set active_workout_split_id = $1 where id = $2', [
      splitA.id,
      userA,
    ]),
  );
  await asUser(userA, async (client) => {
    const res = await client.query(
      'select active_workout_split_id from public.users where id = $1',
      [userA],
    );
    record(
      'User A can set their own active workout split',
      res.rows[0]?.active_workout_split_id === splitA.id,
      `got ${res.rows[0]?.active_workout_split_id}`,
    );
  });

  // User B can update their own users row (RLS allows id = auth.uid()), but
  // cannot point active_workout_split_id at User A's split -- the
  // owner-mismatch guard trigger nulls the spoofed reference out.
  await asUserCommitted(userB, (client) =>
    client.query('update public.users set active_workout_split_id = $1 where id = $2', [
      splitA.id,
      userB,
    ]),
  );
  await asUser(userB, async (client) => {
    const res = await client.query(
      'select active_workout_split_id from public.users where id = $1',
      [userB],
    );
    record(
      "User B cannot set their active split to User A's split (owner-mismatch guard nulls it)",
      res.rows[0]?.active_workout_split_id === null,
      `got ${res.rows[0]?.active_workout_split_id}`,
    );
  });

  // Tag fixtureA's own workout with pushDay -- a legitimate same-user tag.
  await asUserCommitted(userA, (client) =>
    client.query('update public.workouts set workout_split_day_id = $1 where id = $2', [
      pushDay.id,
      fixtureA.workoutId,
    ]),
  );
  await asUser(userA, async (client) => {
    const res = await client.query(
      'select workout_split_day_id from public.workouts where id = $1',
      [fixtureA.workoutId],
    );
    record(
      'User A can tag their own workout with their own split day',
      res.rows[0]?.workout_split_day_id === pushDay.id,
      `got ${res.rows[0]?.workout_split_day_id}`,
    );
  });

  // User B cannot tag their own workout with User A's split day -- even
  // though B owns the workout row (so RLS alone would allow the UPDATE),
  // the owner-mismatch guard trigger nulls the spoofed reference out.
  await asUserCommitted(userB, (client) =>
    client.query('update public.workouts set workout_split_day_id = $1 where id = $2', [
      pushDay.id,
      fixtureB.workoutId,
    ]),
  );
  await asUser(userB, async (client) => {
    const res = await client.query(
      'select workout_split_day_id from public.workouts where id = $1',
      [fixtureB.workoutId],
    );
    record(
      "User B cannot tag their workout with User A's split day (owner-mismatch guard nulls it)",
      res.rows[0]?.workout_split_day_id === null,
      `got ${res.rows[0]?.workout_split_day_id}`,
    );
  });

  await expectThrows(
    asUser(userA, (client) =>
      client.query(
        "insert into public.workout_split_day_muscle_groups (workout_split_day_id, muscle_group) values ($1, 'not_a_real_group')",
        [pushDay.id],
      ),
    ),
    'An invalid muscle group is rejected by the enum type',
    /invalid input value for enum/i,
  );

  // Deleting the split cascades to its days/muscle groups and clears
  // dependent references rather than blocking the delete.
  await asUserCommitted(userA, (client) =>
    client.query('delete from public.workout_splits where id = $1', [splitA.id]),
  );
  await asUser(userA, async (client) => {
    expectRowCount(
      await client.query('select id from public.workout_split_days where id = $1', [pushDay.id]),
      0,
      'Deleting a split cascades to its days',
    );
    expectRowCount(
      await client.query(
        'select id from public.workout_split_day_muscle_groups where workout_split_day_id = $1',
        [pushDay.id],
      ),
      0,
      "Deleting a split cascades to its days' muscle groups",
    );
    const userRow = await client.query(
      'select active_workout_split_id from public.users where id = $1',
      [userA],
    );
    record(
      "Deleting the active split clears the user's active_workout_split_id rather than blocking",
      userRow.rows[0]?.active_workout_split_id === null,
      `got ${userRow.rows[0]?.active_workout_split_id}`,
    );
    const workoutRow = await client.query(
      'select workout_split_day_id from public.workouts where id = $1',
      [fixtureA.workoutId],
    );
    record(
      "Deleting the split day clears the workout's workout_split_day_id rather than blocking",
      workoutRow.rows[0]?.workout_split_day_id === null,
      `got ${workoutRow.rows[0]?.workout_split_day_id}`,
    );
  });

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

  console.log('\nRunning unilateral exercise tests...\n');

  await admin.query('begin');
  try {
    await asClaims(admin, userA);

    const bulgarianSplitSquat = (
      await admin.query(
        "select id, movement_type, logging_style from public.exercises where name = 'Bulgarian Split Squat'",
      )
    ).rows[0];
    record(
      'Bulgarian Split Squat is reclassified as unilateral/alternating',
      bulgarianSplitSquat.movement_type === 'unilateral' &&
        bulgarianSplitSquat.logging_style === 'alternating',
      `movement_type=${bulgarianSplitSquat.movement_type}, logging_style=${bulgarianSplitSquat.logging_style}`,
    );

    const singleArmRow = (
      await admin.query(
        "select movement_type, logging_style from public.exercises where name = 'Single-Arm Dumbbell Row'",
      )
    ).rows[0];
    record(
      'Single-Arm Dumbbell Row is reclassified as unilateral/single_side',
      singleArmRow.movement_type === 'unilateral' && singleArmRow.logging_style === 'single_side',
      `movement_type=${singleArmRow.movement_type}, logging_style=${singleArmRow.logging_style}`,
    );

    const benchPressRow = (
      await admin.query(
        "select movement_type, logging_style from public.exercises where name = 'Barbell Bench Press'",
      )
    ).rows[0];
    record(
      'An untouched built-in exercise stays bilateral with no logging_style (backward-compatible default)',
      benchPressRow.movement_type === 'bilateral' && benchPressRow.logging_style === null,
      `movement_type=${benchPressRow.movement_type}, logging_style=${benchPressRow.logging_style}`,
    );

    await expectThrowsInTransaction(
      admin,
      () =>
        admin.query(
          "insert into public.exercises (name, muscle_group, created_by, movement_type) values ('Bad Unilateral', 'chest', $1, 'unilateral')",
          [userA],
        ),
      'A unilateral exercise cannot be created without a logging_style',
      /check constraint|logging_style/i,
    );

    await expectThrowsInTransaction(
      admin,
      () =>
        admin.query(
          "insert into public.exercises (name, muscle_group, created_by, movement_type, logging_style) values ('Bad Bilateral', 'chest', $1, 'bilateral', 'single_side')",
          [userA],
        ),
      'A bilateral exercise cannot be created with a logging_style',
      /check constraint|logging_style/i,
    );

    // --- sets.side / uniqueness ---
    const w = (
      await admin.query(
        "insert into public.workouts (user_id, name, performed_at, completed_at) values ($1, 'Unilateral Test Workout', now(), now()) returning id",
        [userA],
      )
    ).rows[0];
    const we = (
      await admin.query(
        'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 1) returning id',
        [w.id, bulgarianSplitSquat.id],
      )
    ).rows[0];

    const leftSet = (
      await admin.query(
        "insert into public.sets (workout_exercise_id, set_index, side, weight_kg, reps) values ($1, 1, 'left', 42.5, 10) returning id",
        [we.id],
      )
    ).rows[0];
    const rightSet = (
      await admin.query(
        "insert into public.sets (workout_exercise_id, set_index, side, weight_kg, reps) values ($1, 1, 'right', 40, 10) returning id",
        [we.id],
      )
    ).rows[0];
    record(
      'Left and right rows can share the same set_index',
      Boolean(leftSet.id) && Boolean(rightSet.id),
    );

    // The unique constraint is deferrable (needed for reorderExercises'
    // real bulk-upsert use case elsewhere), so it's only checked at COMMIT
    // by default -- and this whole test never commits (always rolled back
    // for isolation). Force it to check immediately so the violation below
    // actually raises within this still-open transaction.
    await admin.query(
      'set constraints public.sets_workout_exercise_id_set_index_side_key immediate',
    );
    await expectThrowsInTransaction(
      admin,
      () =>
        admin.query(
          "insert into public.sets (workout_exercise_id, set_index, side, weight_kg, reps) values ($1, 1, 'left', 50, 8)",
          [we.id],
        ),
      'A second left row at the same set_index still violates uniqueness',
      /duplicate key|unique/i,
    );

    // A plain bilateral exercise's set (side defaults to 'none') at the same
    // workout_exercise_id/set_index combo -- the original one-row-per-
    // set_index guarantee must still hold now that side exists, proving
    // 'none' behaves as a real, equal-to-itself value rather than a null
    // that would silently stop being enforced by the unique constraint.
    const weBilateral = (
      await admin.query(
        'insert into public.workout_exercises (workout_id, exercise_id, order_index) values ($1, $2, 2) returning id',
        [w.id, squat],
      )
    ).rows[0];
    await admin.query(
      'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 1, 100, 5)',
      [weBilateral.id],
    );
    await admin.query(
      'set constraints public.sets_workout_exercise_id_set_index_side_key immediate',
    );
    await expectThrowsInTransaction(
      admin,
      () =>
        admin.query(
          'insert into public.sets (workout_exercise_id, set_index, weight_kg, reps) values ($1, 1, 105, 5)',
          [weBilateral.id],
        ),
      "A second bilateral set at the same set_index still violates uniqueness ('none' is a real value, not null)",
      /duplicate key|unique/i,
    );

    // --- PR recompute treats each side's weight independently, never combined ---
    let bssPr = await admin.query(
      'select best_weight_kg, source_set_id from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 10',
      [userA, bulgarianSplitSquat.id],
    );
    record(
      "Unilateral PR reflects the heavier side's weight (42.5kg), never a combined 82.5kg",
      bssPr.rows[0]?.best_weight_kg === '42.50' && bssPr.rows[0]?.source_set_id === leftSet.id,
      `best_weight_kg=${bssPr.rows[0]?.best_weight_kg}, source=${bssPr.rows[0]?.source_set_id}`,
    );

    // The right side later becomes the heavier one -- the PR must follow it,
    // not stay pinned to whichever side happened to be entered first.
    await admin.query('update public.sets set weight_kg = 45 where id = $1', [rightSet.id]);
    bssPr = await admin.query(
      'select best_weight_kg, source_set_id from public.rep_prs where user_id = $1 and exercise_id = $2 and reps = 10',
      [userA, bulgarianSplitSquat.id],
    );
    record(
      'Increasing the right side above the left recomputes the PR to the new heavier side',
      bssPr.rows[0]?.best_weight_kg === '45.00' && bssPr.rows[0]?.source_set_id === rightSet.id,
      `best_weight_kg=${bssPr.rows[0]?.best_weight_kg}, source=${bssPr.rows[0]?.source_set_id}`,
    );
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

  console.log('\nRunning default food database tests...\n');

  await asUser(userA, async (client) => {
    const seeded = await client.query(
      'select count(*)::int as count from public.foods where created_by is null and is_active = true',
    );
    record(
      'The default food catalog is seeded with more than a handful of foods',
      seeded.rows[0].count > 20,
      `count=${seeded.rows[0].count}`,
    );
  });

  await asUser(userA, async (client) => {
    const res = await client.query(
      "select calories, protein_g, carbs_g, fat_g from public.foods where created_by is null and name = 'Chicken Breast (cooked)'",
    );
    expectRowCount(res, 1, 'A known default food (Chicken Breast) exists exactly once');
    const row = res.rows[0];
    record(
      'Chicken Breast (cooked) has the expected (non-fabricated, real) nutritional values',
      row &&
        Number(row.calories) === 165 &&
        Number(row.protein_g) === 31 &&
        Number(row.carbs_g) === 0 &&
        Number(row.fat_g) === 3.6,
      JSON.stringify(row),
    );
  });

  await asUser(userA, async (client) => {
    const res = await client.query(
      "select serving_size, serving_unit from public.foods where created_by is null and name = 'Banana'",
    );
    const row = res.rows[0];
    record(
      "Banana carries its own explicit serving amount/unit ('1 medium'), not an assumed gram value",
      Boolean(row) && Number(row.serving_size) === 1 && row.serving_unit === 'medium',
      JSON.stringify(row),
    );
  });

  await asUser(userA, async (client) => {
    const res = await client.query(
      'select name from public.foods where created_by is null and is_active = true and name ilike $1 order by name',
      ['%chick%'],
    );
    record(
      'Partial, case-insensitive name search matches default foods (%chick% finds Chicken ...)',
      res.rows.length >= 2 && res.rows.every((r) => r.name.toLowerCase().includes('chick')),
      JSON.stringify(res.rows.map((r) => r.name)),
    );
  });

  // Duplicate-safe seeding: re-inserting an existing built-in food (same
  // name+brand) must not create a second row -- this is exactly what
  // foods_builtin_name_brand_unique plus "on conflict ... do nothing" in
  // the seed migration guarantees, and it's what makes it safe to re-run
  // the seed insert (e.g. against a misapplied/rerun migration).
  const beforeCount = (
    await admin.query(
      "select count(*)::int as count from public.foods where created_by is null and lower(name) = lower('Chicken Breast (cooked)')",
    )
  ).rows[0].count;

  await admin.query(
    `insert into public.foods (name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
     values ('Chicken Breast (cooked)', 100, 'g', 165, 31, 0, 3.6)
     on conflict (lower(name), lower(coalesce(brand, ''))) where created_by is null do nothing`,
  );

  const afterCount = (
    await admin.query(
      "select count(*)::int as count from public.foods where created_by is null and lower(name) = lower('Chicken Breast (cooked)')",
    )
  ).rows[0].count;

  record(
    'Re-running the built-in seed insert does not create a duplicate row',
    beforeCount === 1 && afterCount === 1,
    `before=${beforeCount}, after=${afterCount}`,
  );

  // Brand search: two default foods sharing a name but from different
  // brands must both be findable and kept distinct, not merged/deduped.
  // Name is deliberately distinct from the 'Protein Bar' fixture created
  // earlier in this file (built for the food_logs source-food tests above)
  // so this check's row counts aren't polluted by that unrelated fixture.
  await admin.query(
    `insert into public.foods (name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g)
     values
       ('Trail Mix Bar (Test Fixture)', 'Acme', 1, 'bar', 200, 20, 20, 7),
       ('Trail Mix Bar (Test Fixture)', 'Zenith', 1, 'bar', 210, 18, 22, 8)
     on conflict (lower(name), lower(coalesce(brand, ''))) where created_by is null do nothing`,
  );

  await asUser(userA, async (client) => {
    const res = await client.query(
      'select brand from public.foods where created_by is null and brand ilike $1',
      ['%acme%'],
    );
    record(
      'Partial, case-insensitive brand search finds the right branded default food',
      res.rows.length === 1 && res.rows[0].brand === 'Acme',
      JSON.stringify(res.rows),
    );
  });

  await asUser(userA, async (client) => {
    const res = await client.query(
      "select brand from public.foods where created_by is null and name = 'Trail Mix Bar (Test Fixture)' order by brand",
    );
    record(
      'Two default foods sharing a name are kept distinct by brand',
      res.rows.map((r) => r.brand).join(',') === 'Acme,Zenith',
      JSON.stringify(res.rows),
    );
  });

  console.log('\nRunning profile picture (avatar storage) tests...\n');

  record(
    'The avatars bucket is public (avatars are readable without a signed URL)',
    (await admin.query("select public from storage.buckets where id = 'avatars'")).rows[0]
      ?.public === true,
  );

  const userAAvatarPath = `${userA}/avatar.jpg`;

  await asUser(userA, async (client) => {
    const res = await client.query(
      "insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)",
      [userAAvatarPath, userA],
    );
    record(
      'A user can upload their own avatar (insert under their own user-id folder)',
      res.rowCount === 1,
      `rowCount=${res.rowCount}`,
    );
  });

  await expectThrows(
    asUser(userB, (client) =>
      client.query(
        "insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)",
        [userAAvatarPath, userA],
      ),
    ),
    "User B cannot upload into User A's avatar folder",
    RLS_ERROR,
  );

  await asUserCommitted(userA, (client) =>
    client.query(
      "insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2) on conflict do nothing",
      [userAAvatarPath, userA],
    ),
  );

  await asUser(userB, async (client) => {
    const res = await client.query(
      "select * from storage.objects where bucket_id = 'avatars' and name = $1",
      [userAAvatarPath],
    );
    record(
      "Any authenticated user can read (view) User A's avatar object -- public read by design",
      res.rowCount === 1,
      `rowCount=${res.rowCount}`,
    );
  });

  await asUser(userB, async (client) => {
    const upd = await client.query(
      "update storage.objects set name = 'hacked/avatar.jpg' where bucket_id = 'avatars' and name = $1",
      [userAAvatarPath],
    );
    record(
      "User B cannot overwrite User A's avatar via UPDATE",
      upd.rowCount === 0,
      `rowCount=${upd.rowCount}`,
    );
  });

  await asUser(userB, async (client) => {
    const del = await client.query(
      "delete from storage.objects where bucket_id = 'avatars' and name = $1",
      [userAAvatarPath],
    );
    record(
      "User B cannot delete User A's avatar via DELETE",
      del.rowCount === 0,
      `rowCount=${del.rowCount}`,
    );
  });

  await asUser(userA, async (client) => {
    const upd = await client.query(
      "update storage.objects set name = $1 where bucket_id = 'avatars' and name = $1",
      [userAAvatarPath],
    );
    record(
      'A user can update (replace/change) their own avatar',
      upd.rowCount === 1,
      `rowCount=${upd.rowCount}`,
    );
  });

  await asUser(userA, async (client) => {
    const del = await client.query(
      "delete from storage.objects where bucket_id = 'avatars' and name = $1",
      [userAAvatarPath],
    );
    record(
      'A user can remove (delete) their own avatar',
      del.rowCount === 1,
      `rowCount=${del.rowCount}`,
    );
  });

  await asUser(userA, async (client) => {
    const res = await client.query('select avatar_url from public.users where id = $1', [userA]);
    record(
      'public.users.avatar_url exists and defaults to null (no picture set)',
      res.rows.length === 1 && res.rows[0].avatar_url === null,
      JSON.stringify(res.rows[0]),
    );
  });

  await asUserCommitted(userA, (client) =>
    client.query(
      "update public.users set avatar_url = 'https://example.test/a.jpg' where id = $1",
      [userA],
    ),
  );

  await asUser(userB, async (client) => {
    const res = await client.query('select avatar_url from public.users where id = $1', [userA]);
    expectRowCount(
      res,
      0,
      "User B cannot select User A's avatar_url (same users-table RLS as every other profile field)",
    );
  });

  console.log('\nRunning external food provider (cached branded foods) tests...\n');

  // A dedicated connection, isolated from `admin`'s own transaction state
  // (which toggles between autocommit and explicit begin/commit blocks
  // throughout this file) -- this section commits real rows and expects a
  // real constraint violation, so it shouldn't have to reason about
  // whatever state `admin` happens to be left in by earlier sections.
  const foodsAdmin = connect();
  await foodsAdmin.connect();

  await foodsAdmin.query(
    `insert into public.foods (name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, provider, provider_food_id, barcode)
     values ('Oreo Original', 'Oreo', 34, 'g', 160, 1.6, 25, 7, 'open_food_facts', '0066721016123', '0066721016123')`,
  );
  // A different name/brand (so this can't also collide with the unrelated
  // foods_builtin_name_brand_unique constraint) but the SAME provider +
  // provider_food_id -- isolates testing foods_provider_food_unique
  // specifically.
  await expectThrows(
    foodsAdmin.query(
      `insert into public.foods (name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, provider, provider_food_id, barcode)
       values ('Oreo Original (Relisted)', 'Oreo', 34, 'g', 160, 1.6, 25, 7, 'open_food_facts', '0066721016123', '0066721016123')`,
    ),
    'Caching the same external product twice (same provider + provider_food_id) violates the dedup-safe unique index',
    /duplicate key|unique/i,
  );

  // foodsAdmin has no open transaction (each statement above autocommitted
  // individually), so the expected failure above didn't poison anything --
  // this upsert runs as a normal next statement, no rollback/savepoint needed.
  await foodsAdmin.query(
    `insert into public.foods (name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, provider, provider_food_id, barcode)
     values ('Oreo Original', 'Oreo', 34, 'g', 165, 1.7, 25, 7, 'open_food_facts', '0066721016123', '0066721016123')
     on conflict (provider, provider_food_id) do update set calories = excluded.calories`,
  ); // matches the plain (non-partial) foods_provider_food_unique index
  const refreshed = await foodsAdmin.query(
    "select count(*)::int as count, max(calories) as calories from public.foods where provider = 'open_food_facts' and provider_food_id = '0066721016123'",
  );
  record(
    'Re-searching the same external product upserts (refreshes) the cached row rather than duplicating it',
    refreshed.rows[0].count === 1 && Number(refreshed.rows[0].calories) === 165,
    JSON.stringify(refreshed.rows[0]),
  );

  await asUser(userA, async (client) => {
    const res = await client.query(
      "select barcode, provider from public.foods where barcode = '0066721016123'",
    );
    record(
      'A cached external food is readable by any authenticated user (built-in, created_by is null)',
      res.rows.length === 1 && res.rows[0].provider === 'open_food_facts',
      JSON.stringify(res.rows),
    );
  });

  await foodsAdmin.end();
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
