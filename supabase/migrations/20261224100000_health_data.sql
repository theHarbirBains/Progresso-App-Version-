-- Health data (Phase 2 of Harbir's Health & Wearables brief: the data architecture, approved
-- 2026-11-27 -- docs/proposals/health-data/README.md). The tables Apple Health (Phase 3), Oura
-- (Phase 4) and a manual sleep log will share. Nothing is collected yet: the API's import routes
-- stay shut (HEALTH_DATA_ENABLED) until Phase 3 ships with its permission wording and the
-- rewritten Privacy Policy.
--
-- * One value per person, day, metric and source: re-syncing is an upsert, so a retry or an
--   overlapping sync never duplicates.
-- * A missing value is a missing row, never 0.
-- * Sources are kept apart and never added together: showing a day picks one source a metric
--   (health_daily), the person's choice or a default order.
-- * Different measurements are different metrics (Apple Watch's HRV is SDNN, Oura's RMSSD), each
--   from only the sources that measure it.
-- * Only the server writes health data (import_health_data, service role only); people read their
--   own under RLS. Health data is theirs alone: no trainer, follower or groupmate policy, ever.
-- * Everything cascades from the account, so deleting it deletes their health data.
--
-- Decisions (Harbir, 2026-11-27): stored on Progresso's servers; Health in every membership;
-- trainers never see a client's; 90 days of history on connect; kept until they delete it or
-- their account, sync history 90 days.

-- ---------------------------------------------------------------------------------------------
-- Where health data comes from. Later providers (garmin, fitbit, whoop) are added here.

create domain public.health_provider as text
  check (value in ('apple_health', 'oura', 'manual'));

-- ---------------------------------------------------------------------------------------------
-- The metrics: each with one canonical unit, the range a real value falls in, the sources that
-- measure it, and whether it's an overnight measurement (which decides the default source). The
-- API keeps the same list (health-data/health-metrics.ts, checked against this file by its tests).

create table public.health_metric_definitions (
  metric text primary key,
  unit text not null,
  min_value numeric not null,
  max_value numeric not null,
  sources text[] not null,
  overnight boolean not null,
  check (min_value < max_value),
  check (cardinality(sources) > 0)
);

insert into public.health_metric_definitions (metric, unit, min_value, max_value, sources, overnight) values
  ('steps',              'count',        0,  200000, array['apple_health', 'oura'],           false),
  ('distance_m',         'm',            0,  500000, array['apple_health', 'oura'],           false),
  ('active_energy_kcal', 'kcal',         0,   15000, array['apple_health', 'oura'],           false),
  ('exercise_min',       'min',          0,    1440, array['apple_health'],                   false),
  ('heart_rate_avg_bpm', 'bpm',         20,     250, array['apple_health', 'oura'],           false),
  ('resting_hr_bpm',     'bpm',         20,     200, array['apple_health', 'oura'],           true),
  ('hrv_sdnn_ms',        'ms',           1,     400, array['apple_health'],                   true),
  ('hrv_rmssd_ms',       'ms',           1,     400, array['oura'],                           true),
  ('respiratory_rate',   'breaths/min',  4,      60, array['apple_health', 'oura'],           true),
  ('spo2_pct',           '%',           50,     100, array['apple_health', 'oura'],           true),
  ('wrist_temp_c',       'degC',        30,      42, array['apple_health'],                   true),
  ('temp_deviation_c',   'degC',        -5,       5, array['oura'],                           true),
  ('vo2max',             'ml/kg/min',   10,     100, array['apple_health'],                   false),
  ('hr_recovery_bpm',    'bpm',          0,     150, array['apple_health'],                   false),
  ('sleep_asleep_s',     's',            0,   86400, array['apple_health', 'oura', 'manual'], true),
  ('sleep_in_bed_s',     's',            0,   86400, array['apple_health', 'oura', 'manual'], true),
  ('oura_readiness',     'score',        0,     100, array['oura'],                           true);

alter table public.health_metric_definitions enable row level security;

revoke all on public.health_metric_definitions from anon, authenticated;
grant select on public.health_metric_definitions to authenticated;

create policy "health_metric_definitions_select"
on public.health_metric_definitions for select
to authenticated
using (true);

-- ---------------------------------------------------------------------------------------------
-- What someone said they use (onboarding's step, Set Up Health), so Health is tailored before
-- anything is connected. A table of its own rather than columns on users, which an active trainer
-- can read: a client's health stays theirs alone. The app writes it, like a setting.

create table public.health_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  devices text[] not null default '{}'
    constraint health_profiles_devices_check check (
      devices <@ array['iphone', 'apple_watch', 'oura', 'other_watch', 'none']::text[]
      and cardinality(devices) <= 5
      and (not ('none' = any(devices)) or cardinality(devices) = 1)
    ),
  setup_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.health_profiles
for each row execute function public.set_updated_at();

alter table public.health_profiles enable row level security;

revoke all on public.health_profiles from anon, authenticated;
grant select, insert, update, delete on public.health_profiles to authenticated;

create policy "health_profiles_select_own"
on public.health_profiles for select
to authenticated
using (user_id = auth.uid());

create policy "health_profiles_insert_own"
on public.health_profiles for insert
to authenticated
with check (user_id = auth.uid());

create policy "health_profiles_update_own"
on public.health_profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "health_profiles_delete_own"
on public.health_profiles for delete
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- One connection per person per provider, in the five states Health shows.

create table public.health_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.health_provider not null,
  status text not null default 'connected' check (
    status in ('connected', 'syncing', 'permission_required', 'error', 'disconnected')
  ),
  -- What's behind it, as reported ("Apple Watch", "iPhone", "Oura Ring Gen 3").
  devices text[] not null default '{}' check (cardinality(devices) <= 20),
  -- The data types the person allowed.
  granted text[] not null default '{}' check (cardinality(granted) <= 50),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger set_updated_at
before update on public.health_connections
for each row execute function public.set_updated_at();

alter table public.health_connections enable row level security;

revoke all on public.health_connections from anon, authenticated;
grant select on public.health_connections to authenticated;

create policy "health_connections_select_own"
on public.health_connections for select
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- A provider's OAuth secrets (Oura, Phase 4). No client access at all -- not even the owner's:
-- the API encrypts each value (AES-256-GCM, HEALTH_TOKEN_KEY) before it's stored, so the database
-- alone never holds a usable token.

create table public.health_provider_tokens (
  connection_id uuid primary key references public.health_connections (id) on delete cascade,
  access_token_enc text not null check (char_length(access_token_enc) <= 8000),
  refresh_token_enc text check (refresh_token_enc is null or char_length(refresh_token_enc) <= 8000),
  expires_at timestamptz,
  scope text check (scope is null or char_length(scope) <= 500),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
before update on public.health_provider_tokens
for each row execute function public.set_updated_at();

alter table public.health_provider_tokens enable row level security;

revoke all on public.health_provider_tokens from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The core: one value a day per metric per source, in the metric's canonical unit.

create table public.health_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The person's own local day.
  day date not null,
  metric text not null references public.health_metric_definitions (metric),
  source public.health_provider not null,
  -- Which device measured it, where the source says ("Apple Watch").
  device text check (device is null or char_length(device) between 1 and 80),
  value numeric not null,
  -- How many readings went into it, where known.
  sample_count integer check (sample_count is null or sample_count >= 0),
  -- The latest original timestamp behind it.
  measured_at timestamptz,
  -- The provider's own id or hash, for tracing.
  source_ref text check (source_ref is null or char_length(source_ref) between 1 and 200),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day, metric, source)
);

create index health_daily_metrics_metric_idx
  on public.health_daily_metrics (user_id, metric, day);

-- A value only from a source that measures it, and only within the metric's range: the API
-- checks both first, and this keeps anything else out.
create function public.health_daily_metrics_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d public.health_metric_definitions;
begin
  select * into d from public.health_metric_definitions where metric = new.metric;
  -- An unknown metric is left to the foreign key.
  if d.metric is null then
    return new;
  end if;
  if not (new.source::text = any (d.sources)) then
    raise exception 'health_metric_source: % never comes from %', new.metric, new.source
      using errcode = '23514';
  end if;
  if new.value < d.min_value or new.value > d.max_value then
    raise exception 'health_metric_range: % of % is outside % to %',
      new.metric, new.value, d.min_value, d.max_value
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger health_daily_metrics_check
before insert or update on public.health_daily_metrics
for each row execute function public.health_daily_metrics_check();

alter table public.health_daily_metrics enable row level security;

revoke all on public.health_daily_metrics from anon, authenticated;
grant select on public.health_daily_metrics to authenticated;

create policy "health_daily_metrics_select_own"
on public.health_daily_metrics for select
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Each sleep, with its stages (null where the source has none: a manual log, an iPhone-only
-- bedtime). A day's totals (naps aside) also land in health_daily_metrics, worked out here
-- (refresh_health_sleep_totals), never sent separately.

create table public.health_sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source public.health_provider not null,
  source_ref text not null check (char_length(source_ref) between 1 and 200),
  device text check (device is null or char_length(device) between 1 and 80),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- The morning it ended, in the person's own day.
  day date not null,
  in_bed_s integer check (in_bed_s is null or in_bed_s between 0 and 86400),
  asleep_s integer check (asleep_s is null or asleep_s between 0 and 86400),
  awake_s integer check (awake_s is null or awake_s between 0 and 86400),
  rem_s integer check (rem_s is null or rem_s between 0 and 86400),
  light_s integer check (light_s is null or light_s between 0 and 86400),
  deep_s integer check (deep_s is null or deep_s between 0 and 86400),
  is_nap boolean not null default false,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, source_ref),
  constraint health_sleep_sessions_times check (
    ended_at > started_at and ended_at - started_at <= interval '24 hours'
  ),
  constraint health_sleep_sessions_asleep_in_bed check (
    asleep_s is null or in_bed_s is null or asleep_s <= in_bed_s
  )
);

create index health_sleep_sessions_day_idx
  on public.health_sleep_sessions (user_id, day desc);

alter table public.health_sleep_sessions enable row level security;

revoke all on public.health_sleep_sessions from anon, authenticated;
grant select on public.health_sleep_sessions to authenticated;

create policy "health_sleep_sessions_select_own"
on public.health_sleep_sessions for select
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Which source to show for a metric -- a display choice, like a setting, so the one table people
-- write directly (their own rows). Without one, the default order applies (health_daily).

create table public.health_metric_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null references public.health_metric_definitions (metric),
  source public.health_provider not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, metric)
);

create trigger set_updated_at
before update on public.health_metric_preferences
for each row execute function public.set_updated_at();

alter table public.health_metric_preferences enable row level security;

revoke all on public.health_metric_preferences from anon, authenticated;
grant select, insert, update, delete on public.health_metric_preferences to authenticated;

create policy "health_metric_preferences_select_own"
on public.health_metric_preferences for select
to authenticated
using (user_id = auth.uid());

create policy "health_metric_preferences_insert_own"
on public.health_metric_preferences for insert
to authenticated
with check (user_id = auth.uid());

create policy "health_metric_preferences_update_own"
on public.health_metric_preferences for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "health_metric_preferences_delete_own"
on public.health_metric_preferences for delete
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Sync history -- what Devices' "Synced 5 min ago" and "Connection issue" read. Kept 90 days.

create table public.health_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.health_provider not null,
  trigger text not null check (
    trigger in ('connect', 'app_open', 'webhook', 'manual', 'backfill', 'nightly')
  ),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('succeeded', 'failed')),
  rows_upserted integer not null default 0 check (rows_upserted >= 0),
  error text check (error is null or char_length(error) <= 500)
);

create index health_sync_runs_user_idx
  on public.health_sync_runs (user_id, provider, started_at desc);

create index health_sync_runs_started_idx
  on public.health_sync_runs (started_at);

alter table public.health_sync_runs enable row level security;

revoke all on public.health_sync_runs from anon, authenticated;
grant select on public.health_sync_runs to authenticated;

create policy "health_sync_runs_select_own"
on public.health_sync_runs for select
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- A day's sleep totals for one source, from its sessions (naps aside). A day with no session left
-- loses its totals -- missing, never 0.

create function public.refresh_health_sleep_totals(p_user uuid, p_source text, p_days date[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.health_daily_metrics m
  where m.user_id = p_user
    and m.source = p_source
    and m.day = any (p_days)
    and m.metric in ('sleep_asleep_s', 'sleep_in_bed_s');

  insert into public.health_daily_metrics (user_id, day, metric, source, value, sample_count, measured_at)
  select p_user, s.day, x.metric, p_source, x.value, x.n, s.ended
  from (
    select
      day,
      sum(asleep_s) as asleep,
      count(asleep_s)::integer as n_asleep,
      sum(in_bed_s) as in_bed,
      count(in_bed_s)::integer as n_in_bed,
      max(ended_at) as ended
    from public.health_sleep_sessions
    where user_id = p_user and source = p_source and day = any (p_days) and not is_nap
    group by day
  ) s
  cross join lateral (
    values ('sleep_asleep_s', s.asleep, s.n_asleep), ('sleep_in_bed_s', s.in_bed, s.n_in_bed)
  ) as x (metric, value, n)
  where x.value is not null;
end;
$$;

revoke all on function public.refresh_health_sleep_totals(uuid, text, date[])
  from public, anon, authenticated;
grant execute on function public.refresh_health_sleep_totals(uuid, text, date[]) to service_role;

-- ---------------------------------------------------------------------------------------------
-- One sync, whole or not at all: the server's one way in, after the API has validated and
-- normalised every value. Returns the run it recorded and how many rows it wrote.
--
-- p_metrics: [{day, metric, value, device?, sample_count?, measured_at?, source_ref?}] -- a repeat
--   of the same day and metric keeps the last.
-- p_cleared: [{day, metric}] -- values the source no longer has (deleted in Apple Health).
-- p_sleep: [{source_ref, started_at, ended_at, day, in_bed_s?, asleep_s?, awake_s?, rem_s?,
--   light_s?, deep_s?, is_nap?, device?}]; p_cleared_sleep: source_refs no longer there.
-- p_devices / p_granted: what the connection reports; null keeps what it had.
--
-- At most 30 runs a person in 10 minutes (health_import_rate_limited).

create function public.import_health_data(
  p_user uuid,
  p_provider text,
  p_trigger text,
  p_metrics jsonb default '[]'::jsonb,
  p_cleared jsonb default '[]'::jsonb,
  p_sleep jsonb default '[]'::jsonb,
  p_cleared_sleep text[] default '{}',
  p_devices text[] default null,
  p_granted text[] default null
)
returns table (run_id uuid, rows_upserted integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_started timestamptz := clock_timestamp();
  v_metric_rows integer := 0;
  v_sleep_rows integer := 0;
  v_days date[];
  v_run uuid;
begin
  -- Rows for this person and provider only, one transaction for all of it.
  if (
    select count(*) from public.health_sync_runs r
    where r.user_id = p_user and r.started_at > now() - interval '10 minutes'
  ) >= 30 then
    raise exception 'health_import_rate_limited' using errcode = 'P0001';
  end if;

  insert into public.health_connections as c
    (user_id, provider, status, devices, granted, last_synced_at, last_error)
  values
    (p_user, p_provider, 'connected', coalesce(p_devices, '{}'), coalesce(p_granted, '{}'), now(), null)
  on conflict (user_id, provider) do update
    set status = 'connected',
        devices = coalesce(p_devices, c.devices),
        granted = coalesce(p_granted, c.granted),
        last_synced_at = now(),
        last_error = null;

  -- Daily values (sleep totals come from sessions, below).
  insert into public.health_daily_metrics as m
    (user_id, day, metric, source, device, value, sample_count, measured_at, source_ref)
  select distinct on ((e.v ->> 'day')::date, e.v ->> 'metric')
    p_user,
    (e.v ->> 'day')::date,
    e.v ->> 'metric',
    p_provider,
    e.v ->> 'device',
    (e.v ->> 'value')::numeric,
    (e.v ->> 'sample_count')::integer,
    (e.v ->> 'measured_at')::timestamptz,
    e.v ->> 'source_ref'
  from jsonb_array_elements(coalesce(p_metrics, '[]'::jsonb)) with ordinality as e (v, n)
  where e.v ->> 'metric' not in ('sleep_asleep_s', 'sleep_in_bed_s')
  order by (e.v ->> 'day')::date, e.v ->> 'metric', e.n desc
  on conflict (user_id, day, metric, source) do update
    set value = excluded.value,
        device = excluded.device,
        sample_count = excluded.sample_count,
        measured_at = excluded.measured_at,
        source_ref = excluded.source_ref,
        updated_at = now();
  get diagnostics v_metric_rows = row_count;

  delete from public.health_daily_metrics m
  using jsonb_to_recordset(coalesce(p_cleared, '[]'::jsonb)) as r (day date, metric text)
  where m.user_id = p_user
    and m.source = p_provider
    and m.day = r.day
    and m.metric = r.metric
    and m.metric not in ('sleep_asleep_s', 'sleep_in_bed_s');

  -- Sleep: every day a session lands on, was on, or leaves, has its totals worked out again.
  select coalesce(array_agg(distinct d.day), '{}')
  into v_days
  from (
    select s.day
    from public.health_sleep_sessions s
    where s.user_id = p_user
      and s.source = p_provider
      and s.source_ref = any (
        array(select e ->> 'source_ref' from jsonb_array_elements(coalesce(p_sleep, '[]'::jsonb)) e)
        || coalesce(p_cleared_sleep, '{}')
      )
    union
    select (e ->> 'day')::date from jsonb_array_elements(coalesce(p_sleep, '[]'::jsonb)) e
  ) d;

  insert into public.health_sleep_sessions as s (
    user_id, source, source_ref, device, started_at, ended_at, day,
    in_bed_s, asleep_s, awake_s, rem_s, light_s, deep_s, is_nap
  )
  select distinct on (e.v ->> 'source_ref')
    p_user,
    p_provider,
    e.v ->> 'source_ref',
    e.v ->> 'device',
    (e.v ->> 'started_at')::timestamptz,
    (e.v ->> 'ended_at')::timestamptz,
    (e.v ->> 'day')::date,
    (e.v ->> 'in_bed_s')::integer,
    (e.v ->> 'asleep_s')::integer,
    (e.v ->> 'awake_s')::integer,
    (e.v ->> 'rem_s')::integer,
    (e.v ->> 'light_s')::integer,
    (e.v ->> 'deep_s')::integer,
    coalesce((e.v ->> 'is_nap')::boolean, false)
  from jsonb_array_elements(coalesce(p_sleep, '[]'::jsonb)) with ordinality as e (v, n)
  order by e.v ->> 'source_ref', e.n desc
  on conflict (user_id, source, source_ref) do update
    set device = excluded.device,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        day = excluded.day,
        in_bed_s = excluded.in_bed_s,
        asleep_s = excluded.asleep_s,
        awake_s = excluded.awake_s,
        rem_s = excluded.rem_s,
        light_s = excluded.light_s,
        deep_s = excluded.deep_s,
        is_nap = excluded.is_nap,
        updated_at = now();
  get diagnostics v_sleep_rows = row_count;

  delete from public.health_sleep_sessions s
  where s.user_id = p_user
    and s.source = p_provider
    and s.source_ref = any (coalesce(p_cleared_sleep, '{}'));

  if cardinality(v_days) > 0 then
    perform public.refresh_health_sleep_totals(p_user, p_provider, v_days);
  end if;

  insert into public.health_sync_runs
    (user_id, provider, trigger, started_at, finished_at, status, rows_upserted)
  values
    (p_user, p_provider, p_trigger, v_started, clock_timestamp(), 'succeeded', v_metric_rows + v_sleep_rows)
  returning id into v_run;

  return query select v_run, v_metric_rows + v_sleep_rows;
end;
$$;

revoke all on function public.import_health_data(uuid, text, text, jsonb, jsonb, jsonb, text[], text[], text[])
  from public, anon, authenticated;
grant execute on function public.import_health_data(uuid, text, text, jsonb, jsonb, jsonb, text[], text[], text[])
  to service_role;

-- A sync that failed: recorded, and the connection says so (Devices' "Connection issue").
create function public.record_health_sync_failure(
  p_user uuid,
  p_provider text,
  p_trigger text,
  p_error text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run uuid;
  v_error text := left(coalesce(nullif(p_error, ''), 'Sync failed'), 500);
begin
  insert into public.health_connections as c (user_id, provider, status, last_error)
  values (p_user, p_provider, 'error', v_error)
  on conflict (user_id, provider) do update
    set status = 'error', last_error = v_error;

  insert into public.health_sync_runs
    (user_id, provider, trigger, finished_at, status, error)
  values
    (p_user, p_provider, p_trigger, now(), 'failed', v_error)
  returning id into v_run;
  return v_run;
end;
$$;

revoke all on function public.record_health_sync_failure(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_health_sync_failure(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- "Delete my health data": every health row of theirs from one source, or from all of them (and
-- their source choices with it). The connections stay, marked disconnected, so nothing syncs
-- again until they connect; a provider's tokens are revoked and removed by the API first (Oura,
-- Phase 4). Returns how many rows went.

create function public.delete_health_data(p_user uuid, p_provider text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_rows integer;
begin
  delete from public.health_daily_metrics
  where user_id = p_user and (p_provider is null or source = p_provider);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  delete from public.health_sleep_sessions
  where user_id = p_user and (p_provider is null or source = p_provider);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  delete from public.health_sync_runs
  where user_id = p_user and (p_provider is null or provider = p_provider);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  if p_provider is null then
    delete from public.health_metric_preferences where user_id = p_user;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end if;

  update public.health_connections
  set status = 'disconnected', devices = '{}', granted = '{}', last_synced_at = null, last_error = null
  where user_id = p_user and (p_provider is null or provider = p_provider);

  return v_count;
end;
$$;

revoke all on function public.delete_health_data(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_health_data(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- What Health shows for each day: one value a metric -- from the source the person chose for it,
-- else overnight measurements from Oura and daytime ones from Apple Health, then a manual log --
-- with the other sources that also had one. Their own rows only (security invoker: RLS decides),
-- a year at most.

create function public.health_daily(p_from date, p_to date)
returns table (
  day date,
  metric text,
  value numeric,
  unit text,
  source text,
  device text,
  measured_at timestamptz,
  other_sources text[]
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'health_daily_range: from % to % (a year at most)', p_from, p_to
      using errcode = '22023';
  end if;

  return query
  with ranked as (
    select
      m.day,
      m.metric,
      m.value,
      d.unit,
      m.source::text as source,
      m.device,
      m.measured_at,
      row_number() over (
        partition by m.day, m.metric
        order by
          (p.source is not null and p.source = m.source) desc,
          array_position(
            case when d.overnight
              then array['oura', 'apple_health', 'manual']
              else array['apple_health', 'oura', 'manual']
            end,
            m.source::text
          )
      ) as rank,
      array_agg(m.source::text) over (partition by m.day, m.metric) as all_sources
    from public.health_daily_metrics m
    join public.health_metric_definitions d on d.metric = m.metric
    left join public.health_metric_preferences p
      on p.user_id = m.user_id and p.metric = m.metric
    where m.user_id = auth.uid()
      and m.day between p_from and p_to
  )
  select r.day, r.metric, r.value, r.unit, r.source, r.device, r.measured_at,
         array_remove(r.all_sources, r.source)
  from ranked r
  where r.rank = 1
  order by r.day, r.metric;
end;
$$;

revoke all on function public.health_daily(date, date) from public, anon;
grant execute on function public.health_daily(date, date) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Sync history older than 90 days goes, nightly. Returns how many.

create function public.purge_health_sync_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.health_sync_runs where started_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_health_sync_runs() from public, anon, authenticated;

-- Nightly, where pg_cron is available (Supabase has it; the local test database doesn't, and
-- calls the function directly).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'purge-health-sync-runs',
      '50 4 * * *',
      'select public.purge_health_sync_runs()'
    );
  end if;
end;
$$;
