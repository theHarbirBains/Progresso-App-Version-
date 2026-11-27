-- Apple Health in the background (Phase 3 of the Health & Wearables brief, approved 2026-11-27,
-- "background too"): HealthKit wakes Progresso when it has something new, and the sync it makes
-- is recorded as such, so the sync history says when one happened without the app being opened.

alter table public.health_sync_runs
  drop constraint health_sync_runs_trigger_check;

alter table public.health_sync_runs
  add constraint health_sync_runs_trigger_check check (
    trigger in ('connect', 'app_open', 'background', 'webhook', 'manual', 'backfill', 'nightly')
  );
