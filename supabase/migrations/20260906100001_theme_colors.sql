-- Per-user accent color for each of the two Dashboard modes (Workout /
-- Nutrition). Nullable: a row with no value here just means "this user has
-- never customized that mode yet" -- the backend/app fall back to the
-- default accent (Electric Blue / Emerald) rather than this column ever
-- needing a stored default. Once a user picks a color (including hitting
-- "Reset to Default"), a concrete hex is always written back, never null.
alter table public.users
  add column workout_accent_color text,
  add column nutrition_accent_color text;

alter table public.users add constraint users_workout_accent_color_format
  check (workout_accent_color is null or workout_accent_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.users add constraint users_nutrition_accent_color_format
  check (nutrition_accent_color is null or nutrition_accent_color ~ '^#[0-9A-Fa-f]{6}$');
