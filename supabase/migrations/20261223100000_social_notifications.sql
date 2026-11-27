-- Social notifications (Harbir's push notification brief, 2026-11-27): one record per social
-- event -- a follow request, a request accepted, a new follower of a public profile, a live
-- workout invitation and the answer to one, a like, a comment -- that both the push and the
-- in-app Notifications screen come from, so the two always agree.
--
-- * Only the server writes them (record_social_notification, executable by the service role
--   alone). A person reads their own under RLS; marking read goes through the API.
-- * Idempotent: each record has a dedupe key, unique per recipient, so an event retried (a
--   request repeated, a trigger fired twice) never makes a second record or a second push.
-- * Grouped: every like on one workout is one record ("Sam and 3 others"), its push spaced by a
--   cooldown; a comment is its own record, but one person's comments on one workout push at
--   most once in a couple of minutes (a throttle key). Follow requests and invitations are never
--   grouped away.
-- * Never about someone's own action.
-- * Each kind has its own switch (users.notify_*): a new one, notify_follow_accepted, splits
--   accepted requests from new requests. The switches decide the push; the record is kept either
--   way, as the Activity list always showed everything.

-- ---------------------------------------------------------------------------------------------
-- The switch for accepted follow requests, starting as each person's follows switch was.

alter table public.users
  add column notify_follow_accepted boolean not null default true;

update public.users set notify_follow_accepted = notify_follows;

-- ---------------------------------------------------------------------------------------------
-- The records.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  -- The latest person behind it (a grouped like: the newest liker); null once their account is
  -- deleted.
  actor_id uuid references auth.users (id) on delete set null,
  type text not null check (
    type in (
      'follow_request',
      'follow_accepted',
      'new_follower',
      'workout_invite',
      'invite_answer',
      'workout_like',
      'workout_comment'
    )
  ),
  -- What makes it one record ("workout_like:<workout>"): unique per recipient.
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  -- Pushes sharing a throttle key are spaced by the event's cooldown.
  throttle_key text not null check (char_length(throttle_key) between 1 and 200),
  -- What it's about. A request withdrawn or declined, or an unfollow, empties follow_id (the
  -- record stays, keeping its cooldown, but isn't listed); a comment deleted takes its record
  -- with it; a workout or group gone takes its records.
  follow_id uuid references public.follows (id) on delete set null,
  workout_id uuid references public.workouts (id) on delete cascade,
  comment_id uuid references public.workout_comments (id) on delete cascade,
  group_id uuid references public.workout_groups (id) on delete cascade,
  invite_id uuid references public.workout_group_members (id) on delete cascade,
  -- A comment's opening words, or an invite's answer ('accepted' / 'declined').
  preview text check (preview is null or char_length(preview) <= 200),
  -- Everyone behind a grouped record, and how many.
  actor_ids uuid[] not null default '{}',
  actor_count integer not null default 1 check (actor_count >= 1),
  -- When it last happened (a new like on a grouped record moves it up).
  event_at timestamptz not null default now(),
  read_at timestamptz,
  -- When it was last due a push (whether or not the person has pushes switched on): what the
  -- cooldown counts from.
  pushed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, event_at desc);

create index notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

create index notifications_throttle_idx
  on public.notifications (recipient_id, throttle_key, pushed_at desc);

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create policy "notifications_select_own"
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Whether a record is shown: a follow request whose follow is gone (withdrawn, declined) isn't.

create or replace function public.notification_listed(n public.notifications)
returns boolean
language sql
immutable
as $$
  select not (n.type in ('follow_request', 'follow_accepted', 'new_follower') and n.follow_id is null);
$$;

-- ---------------------------------------------------------------------------------------------
-- Recording an event: the server's one way in.
--
-- Returns the record's id, whether to push it now, how many people are behind it and the
-- recipient's unread count (for the app icon's badge). Nothing at all for someone's own action.
--
-- * New record: push.
-- * Same record again: someone new (a second liker), or a repeat that is news of its own
--   (p_repeat: a new follow request after one was withdrawn, a new invitation) -- marked unread,
--   moved up, and pushed if no push with its throttle key went out within p_cooldown. The same
--   person again on a grouped record (a like, unliked and liked again) changes nothing.
-- * A new record whose throttle key pushed within p_cooldown (a second comment from the same
--   person on the same workout a minute later) is kept but not pushed.

create or replace function public.record_social_notification(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_dedupe_key text,
  p_throttle_key text,
  p_cooldown interval,
  p_repeat boolean,
  p_follow_id uuid default null,
  p_workout_id uuid default null,
  p_comment_id uuid default null,
  p_group_id uuid default null,
  p_invite_id uuid default null,
  p_preview text default null
)
returns table (notification_id uuid, should_push boolean, actor_count integer, unread integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_row public.notifications;
  v_inserted boolean := false;
  v_news boolean;
  v_recently_pushed boolean;
begin
  if p_recipient is null or p_actor is null or p_recipient = p_actor then
    return;
  end if;

  insert into public.notifications as n (
    recipient_id, actor_id, type, dedupe_key, throttle_key, follow_id, workout_id, comment_id,
    group_id, invite_id, preview, actor_ids, actor_count
  )
  values (
    p_recipient, p_actor, p_type, p_dedupe_key, p_throttle_key, p_follow_id, p_workout_id,
    p_comment_id, p_group_id, p_invite_id, left(p_preview, 200), array[p_actor], 1
  )
  on conflict (recipient_id, dedupe_key) do nothing
  returning * into v_row;
  v_inserted := found;

  if not v_inserted then
    select * into v_row
    from public.notifications
    where recipient_id = p_recipient and dedupe_key = p_dedupe_key
    for update;
  end if;

  -- Any push with this throttle key within the cooldown -- this record's own, or another's.
  select exists (
    select 1 from public.notifications o
    where o.recipient_id = p_recipient
      and o.throttle_key = p_throttle_key
      and o.pushed_at is not null
      and o.pushed_at > now() - p_cooldown
      and o.id <> v_row.id
  ) or (v_row.pushed_at is not null and v_row.pushed_at > now() - p_cooldown)
  into v_recently_pushed;

  if v_inserted then
    v_news := true;
  else
    v_news := p_repeat or not (p_actor = any (v_row.actor_ids));
    if v_news then
      update public.notifications n set
        actor_id = p_actor,
        actor_ids = case when p_actor = any (n.actor_ids) then n.actor_ids
                         else array_append(n.actor_ids, p_actor) end,
        actor_count = case when p_actor = any (n.actor_ids) then n.actor_count
                           else n.actor_count + 1 end,
        follow_id = coalesce(p_follow_id, n.follow_id),
        comment_id = coalesce(p_comment_id, n.comment_id),
        invite_id = coalesce(p_invite_id, n.invite_id),
        preview = coalesce(left(p_preview, 200), n.preview),
        event_at = now(),
        read_at = null
      where n.id = v_row.id
      returning * into v_row;
    end if;
  end if;

  should_push := v_news and not v_recently_pushed;
  if should_push then
    update public.notifications set pushed_at = now() where id = v_row.id;
  end if;

  notification_id := v_row.id;
  actor_count := v_row.actor_count;
  select count(*)::integer into unread
  from public.notifications n
  where n.recipient_id = p_recipient and n.read_at is null and public.notification_listed(n);
  return next;
end;
$$;

revoke all on function public.record_social_notification(
  uuid, uuid, text, text, text, interval, boolean, uuid, uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.record_social_notification(
  uuid, uuid, text, text, text, interval, boolean, uuid, uuid, uuid, uuid, uuid, text
) to service_role;

-- ---------------------------------------------------------------------------------------------
-- What the Activity list showed before, kept: pending follow requests (unread -- they wait on an
-- answer, and the bell counted them), and the last two weeks' accepted requests, likes (one
-- record a workout) and comments (read -- they were on screen already). Nothing is pushed.

insert into public.notifications (
  recipient_id, actor_id, type, dedupe_key, throttle_key, follow_id, actor_ids, actor_count,
  event_at, read_at, created_at
)
select f.followee_id, f.follower_id, 'follow_request',
       'follow_request:' || f.follower_id, 'follow_request:' || f.follower_id, f.id,
       array[f.follower_id], 1, f.created_at, null, f.created_at
from public.follows f
where f.status = 'pending'
on conflict (recipient_id, dedupe_key) do nothing;

insert into public.notifications (
  recipient_id, actor_id, type, dedupe_key, throttle_key, follow_id, actor_ids, actor_count,
  event_at, read_at, created_at
)
select f.follower_id, f.followee_id, 'follow_accepted',
       'follow_accepted:' || f.followee_id, 'follow_accepted:' || f.followee_id, f.id,
       array[f.followee_id], 1, f.responded_at, now(), f.responded_at
from public.follows f
where f.status = 'accepted'
  and f.responded_at is not null
  and f.responded_at > now() - interval '14 days'
on conflict (recipient_id, dedupe_key) do nothing;

insert into public.notifications (
  recipient_id, actor_id, type, dedupe_key, throttle_key, workout_id, actor_ids, actor_count,
  event_at, read_at, created_at
)
select w.user_id,
       (array_agg(l.user_id order by l.created_at desc))[1],
       'workout_like',
       'workout_like:' || w.id, 'workout_like:' || w.id, w.id,
       array_agg(l.user_id order by l.created_at),
       count(*)::integer,
       max(l.created_at), now(), min(l.created_at)
from public.workout_likes l
join public.workouts w on w.id = l.workout_id
where l.user_id <> w.user_id
  and l.created_at > now() - interval '14 days'
  and w.deleted_at is null
group by w.id, w.user_id
on conflict (recipient_id, dedupe_key) do nothing;

insert into public.notifications (
  recipient_id, actor_id, type, dedupe_key, throttle_key, workout_id, comment_id, preview,
  actor_ids, actor_count, event_at, read_at, created_at
)
select w.user_id, c.user_id, 'workout_comment',
       'workout_comment:' || c.id, 'workout_comment:' || w.id || ':' || c.user_id,
       w.id, c.id, left(c.body, 200), array[c.user_id], 1, c.created_at, now(), c.created_at
from public.workout_comments c
join public.workouts w on w.id = c.workout_id
where c.user_id <> w.user_id
  and c.created_at > now() - interval '14 days'
  and w.deleted_at is null
on conflict (recipient_id, dedupe_key) do nothing;
