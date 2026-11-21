-- Each cardio activity asks for what fits it (Harbir's cardio brief): a treadmill's or an
-- elliptical's speed is the number on the machine, a StairMaster counts its steps, a rower its
-- stroke rate, a swim its laps and pool length, and "Other" can carry a note. Calories are no
-- longer asked for or shown anywhere -- cardio carries no calorie figure -- but what was typed on
-- older activities is kept as it was, never deleted.
--
-- Additive and nullable, so every activity saved before reads exactly as it did, and an older app
-- version (which never sends these) keeps working. Canonical units as before: metres, km/h,
-- percent. The app shows distance in kilometres for everyone.

alter table public.workout_cardio
  -- The speed the machine was set to, as it shows it (a treadmill's "6.5"): a number, no unit.
  add column speed_setting numeric(5, 1)
    check (speed_setting is null or (speed_setting > 0 and speed_setting <= 500)),
  add column steps integer check (steps is null or steps between 1 and 100000),
  -- A rower's strokes a minute.
  add column stroke_rate smallint check (stroke_rate is null or stroke_rate between 1 and 100),
  add column pool_length_m numeric(5, 2)
    check (pool_length_m is null or pool_length_m between 5 and 100),
  -- Lengths of the pool.
  add column laps integer check (laps is null or laps between 1 and 10000),
  add column notes text check (notes is null or char_length(btrim(notes)) between 1 and 500);

comment on column public.workout_cardio.calories is
  'No longer asked for or shown: kept as typed on activities saved before cardio dropped calories.';
comment on column public.workout_cardio.speed_kmh is
  'An average speed in km/h, typed as one (cycling) or as a pace (a run, a walk) or a split (a row). A treadmill''s or elliptical''s machine speed is speed_setting; older ones typed one here.';
comment on column public.workout_cardio.speed_setting is
  'The speed a treadmill or elliptical was set to, as the machine shows it: no unit.';
comment on column public.workout_cardio.after_strength is
  'Done after the strength part ended (added after the last set was finished): not taken out of the strength time.';
comment on column public.workouts.strength_ended_at is
  'When the strength part of a workout with cardio ended -- its last finished set, worked out at Finish: strength time is the start to here, less the cardio before it.';
