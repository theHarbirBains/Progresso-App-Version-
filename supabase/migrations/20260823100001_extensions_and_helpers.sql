-- Shared helpers used by every table migration that follows.

create type public.muscle_group as enum (
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full_body',
  'other'
);

-- Generic "bump updated_at on write" trigger, reused by every table below.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
