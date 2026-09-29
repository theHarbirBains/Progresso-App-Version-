-- Social v1: a one-directional, accept-gated follow graph (Instagram-style
-- follow requests, not a symmetric "friendship" -- following someone back is
-- a second, independent row). follower_id is the one who requested to see
-- followee_id's activity.
--
-- All reads/writes for this table go through the backend (apps/api/src/follows),
-- never direct-to-Supabase: deciding who may accept/reject a request, and
-- joining another user's workouts/food logs into a feed, is exactly the
-- "cross-user-trusted computation" CLAUDE.md's hybrid backend pattern
-- reserves for the NestJS API, the same reasoning PR computation already
-- uses server-side triggers for. RLS below is read-only defense-in-depth
-- (same "select for the owner, no client write policy" shape as
-- rep_prs/one_rep_maxes) in case a future screen ever reads it directly --
-- it grants no write access, so today's backend-only write path stays the
-- only way this table changes.
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (follower_id <> followee_id),
  unique (follower_id, followee_id)
);

create index follows_follower_idx on public.follows (follower_id, status);
create index follows_followee_idx on public.follows (followee_id, status);

alter table public.follows enable row level security;

create policy "follows_select_own"
on public.follows for select
to authenticated
using (follower_id = auth.uid() or followee_id = auth.uid());
