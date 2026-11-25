-- Inviting friends to a live workout (explicitly requested), on the group workouts there are:
-- an invite is still a workout_group_members row with status 'invited', made by anyone in the
-- group (added_by) for a friend or a client, accepted or declined by its invitee -- no code to
-- type. What's new is telling what became of one, so its sender can see it, cancel it and be told
-- the answer:
--
-- - 'declined' (the invitee said no -- it was 'left' before, as if they'd joined and gone) and
--   'cancelled' (its sender, or the host, took it back) join 'invited', 'joined' and 'left'.
--   Every rule about who's in a group asks for 'joined', so neither ever counts as being in it.
-- - invited_at: when this invite was sent (an invite sent again after a decline is a new one, so
--   created_at no longer says), and responded_at: when it was accepted, declined or cancelled.
--   An invite whose group has finished is expired: the API says so and refuses an answer to it.
-- - users.notify_group_invites: whether an invite, and the answer to one you sent, is pushed to
--   you (Settings > Notifications > Social), on unless turned off, like the other social pushes.
--
-- Nothing about a group's history changes: no member row is removed or rewritten here.

alter table public.workout_group_members
  drop constraint workout_group_members_status_check;
alter table public.workout_group_members
  add constraint workout_group_members_status_check
    check (status in ('invited', 'joined', 'left', 'declined', 'cancelled'));

alter table public.workout_group_members
  add column invited_at timestamptz,
  add column responded_at timestamptz;

comment on column public.workout_group_members.invited_at is
  'When this invite was sent (again, for one sent after a decline); null for someone added '
  'without one (the host, a guest, a tracked client).';
comment on column public.workout_group_members.responded_at is
  'When the invite was accepted, declined or cancelled.';

-- The invites waiting now were sent as their rows were made.
update public.workout_group_members
   set invited_at = created_at
 where status = 'invited' and invited_at is null;

alter table public.users
  add column notify_group_invites boolean not null default true;

comment on column public.users.notify_group_invites is
  'Push a workout invite, and the answer to one they sent (Settings > Notifications > Social).';
