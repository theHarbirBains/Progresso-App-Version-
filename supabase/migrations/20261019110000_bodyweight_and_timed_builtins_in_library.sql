-- ---------------------------------------------------------------------------
-- Bodyweight and timed built-ins are back in the exercise library
-- ---------------------------------------------------------------------------
-- 20261005100000 limited built-ins to free weights, and that hid the bodyweight
-- ones too: until then a push-up or a plank could only be logged with a made-up
-- weight. Since 20261019100000 each records what it measures (reps only, or a
-- time), so they are default built-ins again, next to that migration's new
-- Weighted Pull-Up and Dead Hang. Machine and cable movements stay hidden, for
-- the reason 20261005100000 gives: they differ from gym to gym.
--
-- Nothing logged changes: these rows were only ever hidden, never deleted, and
-- every logged exercise keeps the measurement type it was logged with.
update public.exercises
set is_active = true
where created_by is null
  and not is_active
  and lower(name) in (
    'push-up',
    'pull-up',
    'sit-up',
    'hanging leg raise',
    'nordic hamstring curl',
    'ab wheel rollout',
    'plank'
  );
