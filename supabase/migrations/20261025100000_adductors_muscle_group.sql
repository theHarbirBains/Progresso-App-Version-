-- ---------------------------------------------------------------------------
-- Adductors (the inner thighs) join the leg muscle groups
-- ---------------------------------------------------------------------------
-- Beside Quadriceps/Quads, Hamstrings, Glutes and Calves, in both vocabularies:
-- an exercise's muscle group (public.muscle_group) and a split day's
-- (public.split_muscle_group). No built-in exercise is added for it: the
-- adduction movements are machine and cable ones, which stay each person's own
-- (see 20261005100000), so people tag their own with it.
--
-- Backward compatible: a value is only added, never renamed or removed, so
-- every existing exercise, logged workout and split day keeps its group, and
-- an app build from before this simply never offers the new one.
alter type public.muscle_group add value if not exists 'adductors' after 'hamstrings';
alter type public.split_muscle_group add value if not exists 'adductors' after 'hamstrings';
