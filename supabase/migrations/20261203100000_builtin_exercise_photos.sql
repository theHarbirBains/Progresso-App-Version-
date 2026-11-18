-- A person's own photo of the machine they use for a built-in exercise (explicitly requested): added
-- from the exercise's page or the live workout, it's shown in place of the built-in's drawing
-- wherever that person sees the exercise -- the library, the picker, its page and the live workout.
-- Only their own: no one else sees it. One per person per built-in; replacing it replaces the row.
--
-- The photo itself is in the person's own folder of the equipment-photos bucket, like a custom
-- exercise's (its storage policies already allow only that folder), so deleting the account removes
-- it with the rest of their photos; the row goes with the account.

create table public.exercise_user_photos (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  photo_url text not null check (length(photo_url) between 1 and 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create trigger set_updated_at
before update on public.exercise_user_photos
for each row execute function public.set_updated_at();

-- Built-ins only: a person's own exercise has its own photo (exercises.photo_url).
create function public.trg_exercise_user_photos_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.exercises e where e.id = new.exercise_id and e.created_by is null
  ) then
    raise exception 'only a built-in exercise takes a photo of your own' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.trg_exercise_user_photos_check() from public, anon, authenticated;

create trigger exercise_user_photos_check
before insert or update on public.exercise_user_photos
for each row execute function public.trg_exercise_user_photos_check();

alter table public.exercise_user_photos enable row level security;

create policy "exercise_user_photos_own" on public.exercise_user_photos
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.exercise_user_photos to authenticated;
