-- Local/dev seed data only. Never applied to the production database by
-- `supabase db push`. A handful of built-in exercises across muscle groups,
-- enough to exercise the schema; the real exercise library is Phase 2 work.
insert into public.exercises (name, muscle_group) values
  ('Barbell Bench Press', 'chest'),
  ('Barbell Back Squat', 'quadriceps'),
  ('Deadlift', 'back'),
  ('Overhead Press', 'shoulders'),
  ('Barbell Row', 'back');
