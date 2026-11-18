-- A profile montage (explicitly requested): up to four photos or videos a person shows on their
-- profile, under its Edit/Share buttons, playing as a moving strip. Seen by the person and by the
-- people whose follow they accepted -- exactly who sees their workouts -- through the API, which
-- reads the rows and hands out short-lived signed links (the files are in a private bucket). Only
-- the owner adds, reorders or removes their own, straight from the app under these policies.
--
-- Four at most, by position 0-3: each new one goes at the end, removing one closes the gap, and
-- reorder_profile_montage puts them in a new order in one go (the positions are unique once the
-- transaction ends, so a swap never trips over itself). A file must be in the owner's own folder:
-- the API signs whatever a row points at, so a row can never point at anyone else's file. The rows
-- go with the account; the API's account deletion removes the files with the rest of their photos.

create table public.profile_montage_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  kind text not null check (kind in ('photo', 'video')),
  -- "<user id>/<file>": in the owner's own folder, one level down.
  storage_path text not null unique
    check (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$' and split_part(storage_path, '/', 1) = user_id::text),
  width integer check (width between 1 and 20000),
  height integer check (height between 1 and 20000),
  -- The app takes videos up to a minute long.
  duration_seconds numeric(6, 2) check (duration_seconds > 0 and duration_seconds <= 61),
  created_at timestamptz not null default now(),
  constraint profile_montage_items_position_unique unique (user_id, position) deferrable initially deferred,
  -- Only a video has a length.
  check (kind = 'video' or duration_seconds is null)
);

-- Each new one at the end -- and never a fifth. Taken one person at a time, so two added at once
-- can't both take the last place.
create function public.trg_profile_montage_place()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  taken integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('profile_montage:' || new.user_id::text, 0));
  select count(*) into taken from public.profile_montage_items where user_id = new.user_id;
  if taken >= 4 then
    raise exception 'A montage holds four photos or videos at most' using errcode = '23514';
  end if;
  new.position := taken;
  return new;
end;
$$;

create trigger profile_montage_place
before insert on public.profile_montage_items
for each row execute function public.trg_profile_montage_place();

-- Removing one closes the gap: the rest keep their order from 0.
create function public.trg_profile_montage_close_gaps()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.profile_montage_items m
  set position = ordered.place
  from (
    select id, (row_number() over (partition by user_id order by position) - 1)::smallint as place
    from public.profile_montage_items
    where user_id in (select distinct user_id from gone)
  ) ordered
  where m.id = ordered.id and m.position <> ordered.place;
  return null;
end;
$$;

create trigger profile_montage_close_gaps
after delete on public.profile_montage_items
referencing old table as gone
for each statement execute function public.trg_profile_montage_close_gaps();

alter table public.profile_montage_items enable row level security;

create policy "profile_montage_items_own" on public.profile_montage_items
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Added and removed whole; only the order changes afterwards (Supabase grants every table to
-- everyone by default, so that's taken back first).
revoke all on public.profile_montage_items from anon, authenticated;
grant select, insert, delete on public.profile_montage_items to authenticated;
grant update (position) on public.profile_montage_items to authenticated;

-- The person's own, in the order given: every one of theirs, each once.
create function public.reorder_profile_montage(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('profile_montage:' || me::text, 0));
  if coalesce(cardinality(p_ids), 0) <> (select count(*) from public.profile_montage_items where user_id = me)
    or coalesce(cardinality(p_ids), 0) <> (select count(distinct id) from unnest(p_ids) as given(id))
    or exists (
      select 1 from unnest(p_ids) as given(id)
      where not exists (
        select 1 from public.profile_montage_items m where m.id = given.id and m.user_id = me
      )
    )
  then
    raise exception 'The new order must list each of your montage''s photos and videos once'
      using errcode = '22023';
  end if;
  update public.profile_montage_items m
  set position = (given.place - 1)::smallint
  from unnest(p_ids) with ordinality as given(id, place)
  where m.id = given.id and m.user_id = me and m.position <> given.place - 1;
end;
$$;

revoke all on function public.reorder_profile_montage(uuid[]) from public, anon;
grant execute on function public.reorder_profile_montage(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The files: private, in each person's own folder
-- ---------------------------------------------------------------------------------------------

-- Private (unlike the photo buckets): others see a montage only through the API's signed links,
-- and only when they may. 50 MB a file: a JPEG photo, or an MP4 or QuickTime video.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-montage',
  'profile-montage',
  false,
  52428800,
  array['image/jpeg', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "profile_montage_insert_own"
on storage.objects for insert
to authenticated
with check (bucket_id = 'profile-montage' and (storage.foldername(name))[1] = auth.uid()::text);

-- The owner's own, for the montage page's signed links.
create policy "profile_montage_select_own"
on storage.objects for select
to authenticated
using (bucket_id = 'profile-montage' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_montage_delete_own"
on storage.objects for delete
to authenticated
using (bucket_id = 'profile-montage' and (storage.foldername(name))[1] = auth.uid()::text);
