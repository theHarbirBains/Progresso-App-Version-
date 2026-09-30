-- An optional photo of the machine/equipment used for an exercise --
-- shown as a small thumbnail next to the exercise in the library, the same
-- "reference, not the blob" pattern every other photo column in this schema
-- already follows (see profile_picture.sql, food_photos.sql). Nullable and
-- editable at any time, on any exercise the user owns (create or edit) --
-- unlike equipment_profiles (one exercise, many gym-specific profiles, no
-- read path today), this is simply "does this exercise have a photo",
-- reusing the exact same equipment-photos bucket/upload path since it's
-- already exercise-equipment-scoped and per-user-folder-isolated.
alter table public.exercises add column photo_url text;
