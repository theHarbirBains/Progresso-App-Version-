-- A one-off data fix (Harbir's request, 2026-11-18): every custom exercise that has an identical or
-- near-identical built-in now that the library is complete moves onto it -- its whole history, for
-- everyone who logged it (a tracked client's included: Jashan's and Purnima's), its split-day plans,
-- machine setups and rep range exception -- and is then deleted, so a custom exercise is only ever
-- the odd one out. A custom exercise whose name marks a particular stack or setup (Single Stack,
-- Double Stack, Inner/Outer Stack, a MAG grip width), whose name is too general to know which
-- machine it is ("Shoulder press", "Leg Curls", "Tricep pushdown"), that's logged one side at a time
-- where the built-in is both together (or the other way round), or that the library has no match
-- for (Stair Master) stays exactly as it is.
--
-- Records follow the history: the custom exercise's are removed and the built-in's worked out again
-- for each person from all their logged sets (recompute_prs_for_exercise and
-- recompute_records_for_exercise -- the triggers don't fire on workout_exercises.exercise_id
-- changing). Achievements awarded stay (they never change); progress is worked out again on the
-- next run. A custom exercise's photo becomes its owner's own photo of their machine for the built-in
-- (exercise_user_photos), shown where the drawing was.
--
-- Each custom exercise by its id, from production as read on 2026-11-18 (run anywhere else, it
-- changes nothing), onto a built-in by its slug. Each pair is
-- checked again here: a custom exercise still there, onto a built-in, recorded the same way.

create temporary table exercise_merge_by_slug (
  custom_id uuid primary key,
  builtin_slug text not null
);

insert into exercise_merge_by_slug (custom_id, builtin_slug) values
  ('e53eded9-13e0-4887-ba3d-4f7248966c06'::uuid, 'mc-standing-calf-raise'), -- Harbir: Standing Calf Raises (BCC) -> Standing Calf Raise
  ('9e9b9705-fe15-446a-beef-1196bce49e3c'::uuid, 'mc-single-leg-extension'), -- Harbir: Leg Extension -> Single-Leg Extension
  ('42249a15-8138-4927-8734-a28905e6c690'::uuid, 'mc-hip-thrust'), -- Harbir: Hip Thrust Machine -> Hip Thrust Machine
  ('d65cc2b5-6808-4bad-9663-d4d9d55856a6'::uuid, 'mc-ab-crunch'), -- Harbir: Machine Ab Crunch -> Ab Crunch Machine
  ('af035fff-424c-4f63-942d-1dfd4e5f3d8e'::uuid, 'pl-incline-press'), -- Harbir: Plate Loaded Incline Press -> Plate-Loaded Incline Press
  ('95a68a87-2ad3-44d0-8ab5-7868e914d0f0'::uuid, 'mc-hip-adduction'), -- Harbir: Hip Adduction -> Hip Adduction
  ('70e595b7-a83b-4634-a3f5-389b5bb079e6'::uuid, 'cb-fly-high-to-low'), -- Harbir: Cable Chest fly (High to Low) -> High-to-Low Cable Fly
  ('6ee47974-164a-47d0-822c-3996e800feeb'::uuid, 'pl-incline-press'), -- Harbir: Incline Chest Press (Plate Loaded) -> Plate-Loaded Incline Press
  ('6c4b88e7-5d35-4eaf-a2a0-2af42cd80ca8'::uuid, 'mc-pec-deck'), -- Harbir: Pec Deck -> Pec Deck
  ('4e7eb5ca-dc3b-47e5-9132-ed6f8bedc130'::uuid, 'mc-seated-leg-curl'), -- Harbir: Seated Hamstring Curl -> Seated Leg Curl
  ('12743e8b-8c8e-403f-9f6f-63e8ebe4d2bd'::uuid, 'mc-lying-leg-curl'), -- Harbir: Lying Hamstring Curl -> Lying Leg Curl
  ('fc9be0bc-f33a-4067-b262-9d06cac3434b'::uuid, 'mc-lying-leg-curl'), -- Harbir: Lying leg curl -> Lying Leg Curl
  ('3cc70854-42f8-4227-bac6-387a502f642a'::uuid, 'mc-lying-leg-curl'), -- Harbir: Leg curl (lying) -> Lying Leg Curl
  ('032b8751-dd36-434f-9364-37e39d88a3b7'::uuid, 'pl-hack-squat'), -- Harbir: Hack Squat -> Hack Squat
  ('9de8e12b-21b5-449f-8b9c-757fd2fd30a5'::uuid, 'pl-leg-press'), -- Harbir: Leg Press -> Leg Press
  ('3fa0c061-d0c7-49bb-8a98-97f1ec918ca7'::uuid, 'mc-leg-extension'), -- Harbir: Leg Extension (Bilateral) -> Leg Extension
  ('e75989cb-bf09-41dc-83a7-e64f89831f19'::uuid, 'bb-t-bar-row'), -- Harbir: T-Bar Row -> T-Bar Row
  ('5ca5c4e9-b434-4172-85d2-d4630892ca40'::uuid, 'db-cross-body-hammer-curl'), -- Harbir: Cross-Body Hammer Curl -> Cross-Body Hammer Curl
  ('9a393eb7-5c1b-4d3b-be80-e57837fc1af6'::uuid, 'sm-shoulder-press'), -- Harbir: Smith Machine Shoulder Press -> Smith Machine Shoulder Press
  ('b7d945d3-2941-4cf7-a30d-624e360334b5'::uuid, 'db-standing-shoulder-press'), -- Harbir: Dumbbell Shoulder Press -> Dumbbell Shoulder Press
  ('949a6434-e776-482b-b344-e17c8e6807be'::uuid, 'cb-fly-high-to-low'), -- Harbir: Cable chest flies (high to low) -> High-to-Low Cable Fly
  ('fffa0ab3-50ec-4e52-9b29-e1a73f6ba1ca'::uuid, 'bb-t-bar-row'), -- Harbir: T-Bar Row -> T-Bar Row
  ('f38a803b-e2e3-4bb7-9e56-dd20bfe485cf'::uuid, 'db-single-arm-row'), -- Harbir: Dumbbell Row -> Single-Arm Dumbbell Row
  ('9f297b80-68e6-46c3-a6e5-4a67af3d21f5'::uuid, 'cb-lat-pulldown-wide'), -- Maaz: Lat Pulldown -> Lat Pulldown â€” Wide-Grip Straight Bar
  ('f305fe35-9c34-4151-b365-3d7e6cd65c9a'::uuid, 'mc-ab-crunch'), -- Maaz: Seated Crunches -> Ab Crunch Machine
  ('2f19152d-9c26-4358-ad19-331ad0c4bf65'::uuid, 'mc-leg-extension'), -- Maaz: Leg Extensions -> Leg Extension
  ('20997d01-509f-4303-924c-8419f4f6900e'::uuid, 'mc-hip-adduction'), -- Maaz: Adductors -> Hip Adduction
  ('24158d92-7ead-4344-9054-7f552ea76de9'::uuid, 'mc-hip-abduction'), -- Maaz: Abductors -> Hip Abduction
  ('ca08c1f2-0d8f-47f9-a55a-7769ad0815bc'::uuid, 'mc-seated-dip'), -- Maaz: Seated Dips -> Seated Dip
  ('c56dfa20-3cbb-42b5-b686-ddea8419f975'::uuid, 'mc-lying-leg-curl'), -- Jashan Malhi: Lying Hamstring Curl -> Lying Leg Curl
  ('9bab22e4-208c-4cde-b9f6-b29c02d4c6a9'::uuid, 'cb-fly-high-to-low'), -- Harry: Cable chest flies (high to low) -> High-to-Low Cable Fly
  ('ef1acd57-ff90-400c-999d-f2b992c124be'::uuid, 'mc-hip-adduction'), -- Purnima Handa: Hip Adduction -> Hip Adduction
  ('b093743c-0121-4133-a349-c5fc9a1d1faf'::uuid, 'mc-standing-calf-raise'), -- Purnima Handa: Standing Calf Raises (BCC) -> Standing Calf Raise
  ('cf7aaaf2-aff1-4340-adfd-aacd95422926'::uuid, 'pl-hack-squat'), -- Purnima Handa: Hack Squat -> Hack Squat
  ('bcb41179-620b-4604-b5f2-cb2151020317'::uuid, 'mc-single-leg-extension'), -- Purnima Handa: Leg Extension -> Single-Leg Extension
  ('97fd6e7c-c761-47bd-99d8-6586ab1ebdc4'::uuid, 'mc-hip-adduction'), -- Aiden: Hip Adductor -> Hip Adduction
  ('020b8781-7d5f-4464-b931-b7b5339cd071'::uuid, 'mc-hip-abduction'), -- Aiden: Hip Abductor -> Hip Abduction
  ('f737a1aa-7335-41c4-af90-4e7b454cddbb'::uuid, 'mc-leg-extension') -- Aiden: Leg extension -> Leg Extension
;

-- The built-ins by their permanent slug (their ids differ from one database to the next).
create temporary table exercise_merge as
select x.custom_id, b.id as builtin_id
from exercise_merge_by_slug x
join public.exercises b on b.slug = x.builtin_slug and b.created_by is null;

delete from exercise_merge m
where not exists (
  select 1
  from public.exercises c
  join public.exercises b on b.id = m.builtin_id
  where c.id = m.custom_id
    and c.created_by is not null
    and b.created_by is null
    and c.measurement_type is not distinct from b.measurement_type
    and c.movement_type = b.movement_type
);

-- Everyone whose records a move touches: whoever logged the custom exercise.
create temporary table exercise_merge_people as
select distinct we.user_id, m.builtin_id
from public.workout_exercises we
join exercise_merge m on m.custom_id = we.exercise_id;

-- The history, the plans and the machine setups.
update public.workout_exercises we
set exercise_id = m.builtin_id
from exercise_merge m
where we.exercise_id = m.custom_id;

update public.workout_split_day_exercises x
set exercise_id = m.builtin_id
from exercise_merge m
where x.exercise_id = m.custom_id;

update public.equipment_profiles x
set exercise_id = m.builtin_id
from exercise_merge m
where x.exercise_id = m.custom_id;

-- A rep range exception moves unless the person already has one for the built-in (or another of
-- their custom exercises moving onto it brings a newer one).
with ranked as (
  select
    s.user_id,
    s.exercise_id as custom_id,
    m.builtin_id,
    row_number() over (partition by s.user_id, m.builtin_id order by s.updated_at desc) as n
  from public.exercise_progression_settings s
  join exercise_merge m on m.custom_id = s.exercise_id
  where not exists (
    select 1
    from public.exercise_progression_settings o
    where o.user_id = s.user_id and o.exercise_id = m.builtin_id
  )
)
update public.exercise_progression_settings s
set exercise_id = r.builtin_id
from ranked r
where r.n = 1 and s.user_id = r.user_id and s.exercise_id = r.custom_id;

-- The custom exercise's photo becomes its owner's photo of their machine for the built-in.
insert into public.exercise_user_photos (user_id, exercise_id, photo_url)
select distinct on (c.created_by, m.builtin_id) c.created_by, m.builtin_id, c.photo_url
from exercise_merge m
join public.exercises c on c.id = m.custom_id
where c.photo_url is not null
  and exists (select 1 from auth.users u where u.id = c.created_by)
order by c.created_by, m.builtin_id, c.updated_at desc
on conflict (user_id, exercise_id) do nothing;

-- Records: the custom exercise's go; the built-in's are worked out again from every logged set.
delete from public.rep_prs r using exercise_merge m where r.exercise_id = m.custom_id;
delete from public.one_rep_maxes r using exercise_merge m where r.exercise_id = m.custom_id;
delete from public.rep_records r using exercise_merge m where r.exercise_id = m.custom_id;
delete from public.duration_records r using exercise_merge m where r.exercise_id = m.custom_id;

select
  public.recompute_prs_for_exercise(p.user_id, p.builtin_id),
  public.recompute_records_for_exercise(p.user_id, p.builtin_id)
from exercise_merge_people p;

-- Then the custom exercise itself (what's left keyed to it -- an exception that didn't move -- goes
-- with it).
delete from public.exercises e
using exercise_merge m
where e.id = m.custom_id;

drop table exercise_merge_people, exercise_merge, exercise_merge_by_slug;
