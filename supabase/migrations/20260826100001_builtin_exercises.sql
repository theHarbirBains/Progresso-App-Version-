-- Phase 2: the real built-in exercise catalog (supersedes the 5-exercise
-- placeholder that lived in the dev-only seed.sql during Phase 0/1).
-- Conventional bodybuilding/strength-training movements only, chosen to fit
-- the v1 weight x reps set-logging model -- no cardio/conditioning/strongman
-- movements. 50 exercises across all 13 muscle groups (full_body and other
-- intentionally have none yet: everything that would go there is exactly
-- the kind of movement excluded from this catalog).
insert into public.exercises (name, muscle_group) values
  -- chest
  ('Barbell Bench Press', 'chest'),
  ('Incline Barbell Bench Press', 'chest'),
  ('Dumbbell Bench Press', 'chest'),
  ('Push-Up', 'chest'),
  ('Cable Fly', 'chest'),
  ('Chest Press Machine', 'chest'),
  -- back
  ('Deadlift', 'back'),
  ('Barbell Row', 'back'),
  ('Pull-Up', 'back'),
  ('Lat Pulldown', 'back'),
  ('Seated Cable Row', 'back'),
  ('Single-Arm Dumbbell Row', 'back'),
  -- shoulders
  ('Overhead Press', 'shoulders'),
  ('Machine Shoulder Press', 'shoulders'),
  ('Dumbbell Lateral Raise', 'shoulders'),
  ('Dumbbell Front Raise', 'shoulders'),
  ('Dumbbell Rear Delt Fly', 'shoulders'),
  ('Face Pull', 'shoulders'),
  -- biceps
  ('Barbell Curl', 'biceps'),
  ('Dumbbell Curl', 'biceps'),
  ('Hammer Curl', 'biceps'),
  ('Preacher Curl', 'biceps'),
  ('Cable Curl', 'biceps'),
  -- triceps
  ('Cable Triceps Pushdown', 'triceps'),
  ('EZ-Bar Skull Crusher', 'triceps'),
  ('Dumbbell Overhead Triceps Extension', 'triceps'),
  ('Close-Grip Bench Press', 'triceps'),
  -- forearms
  ('Wrist Curl', 'forearms'),
  ('Reverse Wrist Curl', 'forearms'),
  -- quadriceps
  ('Barbell Back Squat', 'quadriceps'),
  ('Leg Press', 'quadriceps'),
  ('Hack Squat', 'quadriceps'),
  ('Bulgarian Split Squat', 'quadriceps'),
  ('Leg Extension', 'quadriceps'),
  -- hamstrings
  ('Romanian Deadlift', 'hamstrings'),
  ('Seated Leg Curl', 'hamstrings'),
  ('Lying Leg Curl', 'hamstrings'),
  ('Good Morning', 'hamstrings'),
  ('Nordic Hamstring Curl', 'hamstrings'),
  -- glutes
  ('Hip Thrust', 'glutes'),
  ('Glute Bridge', 'glutes'),
  ('Cable Kickback', 'glutes'),
  ('Sumo Deadlift', 'glutes'),
  -- calves
  ('Standing Calf Raise', 'calves'),
  ('Seated Calf Raise', 'calves'),
  -- core
  ('Plank', 'core'),
  ('Hanging Leg Raise', 'core'),
  ('Cable Crunch', 'core'),
  ('Ab Wheel Rollout', 'core'),
  ('Sit-Up', 'core');

-- Supports the exercise discovery query pattern (filter active exercises by
-- muscle group). Partial on is_active since discovery never lists inactive
-- ones; deactivated exercises are still found by id (historical display),
-- which doesn't need this index.
create index exercises_muscle_group_active_idx
on public.exercises (muscle_group)
where is_active;
