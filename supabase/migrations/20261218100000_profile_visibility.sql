-- Public and private profiles (explicitly requested).
--
-- Until now every profile was what this calls private: anyone signed in could find someone and
-- open their profile (name, username, photo), but their workouts, stats, lifts, achievements,
-- montage, followers and bio were for the people whose follow they'd accepted. A person can now
-- make theirs public: every signed-in Progresso user can see it as a follower would, and
-- following it needs no approval. Everyone starts private -- existing accounts keep exactly what
-- they had -- and the person changes it any time in Settings > Account & Security > Privacy.
--
-- Who can see what is still decided in one place, the API's canSeeActivity (its own, an
-- accepted follower, or a public profile), reading this column; nothing else reads another
-- person's training (it's API-only, no client policies). Group workouts keep their own rule:
-- the people in one see its workouts.

alter table public.users
  add column profile_visibility text not null default 'private'
    constraint users_profile_visibility_check check (profile_visibility in ('private', 'public'));

comment on column public.users.profile_visibility is
  'private (the default): their training is for accepted followers; public: for every signed-in '
  'user, and following them needs no approval.';

-- Following a public profile is accepted at once, whatever wrote the row.
create or replace function public.follows_accept_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' and exists (
    select 1 from public.users where id = new.followee_id and profile_visibility = 'public'
  ) then
    new.status := 'accepted';
    new.responded_at := now();
  end if;
  return new;
end;
$$;

create trigger follows_accept_public
  before insert on public.follows
  for each row execute function public.follows_accept_public();

-- Going public accepts the requests waiting (there's nothing left to approve). Going private
-- again keeps everyone already following: only new followers wait for an answer.
create or replace function public.users_accept_waiting_on_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_visibility = 'public' and old.profile_visibility is distinct from 'public' then
    update public.follows
       set status = 'accepted', responded_at = now()
     where followee_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger users_accept_waiting_on_public
  after update of profile_visibility on public.users
  for each row execute function public.users_accept_waiting_on_public();

revoke all on function public.follows_accept_public() from public, anon, authenticated;
revoke all on function public.users_accept_waiting_on_public() from public, anon, authenticated;
