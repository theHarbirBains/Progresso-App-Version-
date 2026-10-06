-- Built-in exercises are limited to free-weight movements (dumbbell and
-- barbell). Machine and cable movements differ from gym to gym, so each user
-- adds their own version (with their own photo) to keep progressive overload
-- comparable. Bodyweight and other non-free-weight built-ins are removed from
-- the library too.
--
-- Deactivated rather than deleted: workout_exercises and the PR tables reference
-- exercises with ON DELETE RESTRICT, and history must keep rendering. Inactive
-- built-ins are hidden from the library, the picker and counts, as the
-- exercises_select policy and the is_active filters already expect.
update public.exercises
set is_active = false
where created_by is null
  and is_active
  and lower(name) in (
    'push-up',
    'cable fly',
    'chest press machine',
    'pull-up',
    'lat pulldown',
    'seated cable row',
    'machine shoulder press',
    'face pull',
    'cable curl',
    'cable triceps pushdown',
    'leg press',
    'hack squat',
    'leg extension',
    'seated leg curl',
    'lying leg curl',
    'nordic hamstring curl',
    'glute bridge',
    'cable kickback',
    'standing calf raise',
    'seated calf raise',
    'plank',
    'hanging leg raise',
    'cable crunch',
    'ab wheel rollout',
    'sit-up'
  );
