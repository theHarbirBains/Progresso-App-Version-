-- Social, the rest of it: likes and comments on workouts, a person's profile
-- (their heaviest lifts), push notifications for social activity, and
-- finding friends from your phone's contacts.
--
-- Everything here is read and written by the API (service role), which
-- checks who may see what -- the workout's owner, or someone whose follow
-- they accepted -- and honours blocks both ways. No client policies at all.

-- ---------------------------------------------------------------------------
-- Likes: one per person per workout.
-- ---------------------------------------------------------------------------
create table public.workout_likes (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

create index workout_likes_user_idx on public.workout_likes (user_id);

alter table public.workout_likes enable row level security;
revoke all on public.workout_likes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Comments: short and plain. Deleted outright (by their writer or the
-- workout's owner) -- nothing is kept of a deleted comment.
-- ---------------------------------------------------------------------------
create table public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index workout_comments_workout_idx on public.workout_comments (workout_id, created_at);
create index workout_comments_user_idx on public.workout_comments (user_id);

alter table public.workout_comments enable row level security;
revoke all on public.workout_comments from anon, authenticated;

-- A report can be about a comment (and its writer).
alter table public.user_reports
  add column comment_id uuid references public.workout_comments (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Social push notifications, each on unless turned off; and whether people
-- with this person's email in their contacts can find them (on unless turned
-- off).
-- ---------------------------------------------------------------------------
alter table public.users
  add column notify_follows boolean not null default true,
  add column notify_likes boolean not null default true,
  add column notify_comments boolean not null default true,
  add column findable_by_email boolean not null default true;

-- ---------------------------------------------------------------------------
-- A person's heaviest lifts, for their profile: each weighted exercise's
-- heaviest completed set (more reps breaking a tie, then the latest), from
-- the workouts their followers can see -- finished, not deleted, and not
-- logged by a trainer -- heaviest first.
-- ---------------------------------------------------------------------------
create function public.person_best_lifts(p_owner uuid, p_limit integer)
returns table (exercise_id uuid, weight_kg numeric, reps integer, performed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select best.exercise_id, best.weight_kg, best.reps, best.performed_at
  from (
    select distinct on (we.exercise_id)
      we.exercise_id, s.weight_kg, s.reps, w.performed_at
    from public.workouts w
    join public.workout_exercises we on we.workout_id = w.id and we.deleted_at is null
    join public.sets s on s.workout_exercise_id = we.id and s.deleted_at is null
    where w.user_id = p_owner
      and w.completed_at is not null
      and w.deleted_at is null
      and w.logged_by is null
      and we.measurement_type = 'weight_reps'
      and s.completed_at is not null
      and s.weight_kg is not null
      and s.reps is not null
      and s.reps > 0
    order by we.exercise_id, s.weight_kg desc, s.reps desc, w.performed_at desc
  ) best
  order by best.weight_kg desc, best.reps desc
  limit greatest(p_limit, 0);
$$;

revoke all on function public.person_best_lifts(uuid, integer) from public, anon, authenticated;
grant execute on function public.person_best_lifts(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Finding friends from contacts. The phone sends SHA-256 hashes of the
-- (trimmed, lower-cased) email addresses in its contacts; this returns the
-- people with one of those emails who let themselves be found that way.
-- Emails are hashed here as they're compared -- neither the hashes sent nor
-- any of ours are stored.
-- ---------------------------------------------------------------------------
create function public.find_users_by_email_hashes(p_hashes text[])
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users au
  join public.users u on u.id = au.id
  where u.findable_by_email
    and au.email is not null
    and encode(sha256(convert_to(lower(btrim(au.email)), 'UTF8')), 'hex') = any (p_hashes);
$$;

revoke all on function public.find_users_by_email_hashes(text[]) from public, anon, authenticated;
grant execute on function public.find_users_by_email_hashes(text[]) to service_role;
