# Health data architecture — Phase 2 proposal

Status: **Phase 2 approved ("Continue phase 2", 2026-11-27) and built** --
`supabase/migrations/20261224100000_health_data.sql` and `apps/api/src/health-data`. It collects
nothing: the import routes stay shut (`HEALTH_DATA_ENABLED`) until Phase 3 ships with its
permission wording and the rewritten Privacy Policy. Phase 1 (the UI prototype,
`apps/mobile/src/health/preview`) was approved on 2026-11-27. Phases 3 (Apple Health), 4 (Oura),
5 (unified data), 6 (recovery and baselines) and 7 (polish) each need their own approval.

### What was built differently from this proposal

- **What someone said they use is `health_profiles`**, a table of its own (own rows only), not
  `users.health_devices` / `health_setup_at`: an active trainer can read a client's `users` row,
  and trainers never see a client's health data (decision 3).
- **The metric list is a table, `health_metric_definitions`**, each with its unit, range, the
  sources that measure it and whether it's overnight -- a trigger refuses a value out of range or
  from a source that never measures it (Apple's HRV as RMSSD). The API's list is checked against
  it by test.
- **A sync is one database call, `import_health_data`**: values, cleared values, sleeps, cleared
  sleeps, the connection and the run, in one transaction. A night's totals are worked out from
  its sessions (naps aside), never sent on their own. A failed sync is recorded with
  `record_health_sync_failure`. At most 30 syncs a person in 10 minutes.
- **A run is written once finished** (`succeeded` / `failed`), so there's no "running" state.
- **Deleting keeps the connections, marked disconnected**, so nothing syncs again until they
  connect; a provider's tokens are revoked and removed by the API first (Phase 4).
- **Values a source no longer has can be cleared** (Apple Health deletions), so nothing stale
  stays.
- There's no account export to extend yet (none exists).

## 1. What exists today (audit)

| Area | Today | What it means for Health |
| --- | --- | --- |
| Apple Health | `@kingstinct/react-native-healthkit` v16 is installed with its Expo config plugin (`app.json`, `background: false`); the app reads **steps only**, on the phone (`apps/mobile/src/health/steps.ts`), never stored. | Phase 3 needs no new native library and no Expo SDK upgrade (the app is on **SDK 58**, not 54). It does need a new EAS build: new read permissions and new permission wording. |
| Promises made | The iPhone permission text and the Privacy Policy say Progresso reads steps only and "your steps stay on your phone". | Storing any health data on our servers changes both. They're rewritten in the phase that first stores data (Phase 3), before anything is sent. |
| Database | Supabase Postgres, own-row RLS everywhere, `pg_cron` in use (nightly achievements, purges), no encryption extension in use. | New tables follow the same pattern. Provider tokens are encrypted by the API (§5), not the database. |
| Server-only data | `notifications`, `device_push_tokens`: RLS select-own, writes only through the API (service role). | Health data follows the same model: people read their own; only the server writes. |
| API | NestJS on Render. A module called `health` already exists: the server's uptime check (`/health`). No scheduler: the daily reminder job has never been triggered. | The new module is **`health-data`**. Oura syncs come from webhooks and app-open requests, with an optional nightly backstop from `pg_cron` (§6). |
| Account deletion | `delete_account` plus deleting the auth user; tables keyed to the user with `on delete cascade` clean up automatically. | Every new table cascades from the user. Nothing references another person's rows. |
| Time zones | `users.time_zone` (the phone's), already used for achievements' days and weeks. | A health "day" is the person's local day. |
| Training data | `workouts`, `sets`, `workout_cardio` and the record tables. | Never copied into health tables. Training & Recovery reads them where they are. |

## 2. Principles

1. **One value per person, day, metric and source.** A unique key makes re-syncing an upsert, so
   a retry or an overlapping sync can never duplicate.
2. **A missing value is a missing row, never 0.**
3. **Sources are kept apart and never added together.** Showing a day picks one source per metric
   (the person's preference, else a default order), with the source shown.
4. **Store what the experience needs, not everything a device records.** Daily summaries and sleep
   sessions; no minute-by-minute heart rate, location, or raw sensor streams.
5. **Different measurements stay different metrics.** Apple Watch's HRV is **SDNN**; Oura's is
   **RMSSD**. They aren't comparable, so they're two metrics, never one line. The same goes for
   Apple's absolute wrist temperature against Oura's deviation from baseline, and for each
   provider's own score (Oura Readiness, later Garmin Body Battery or WHOOP Recovery).
6. **Only the server writes health data.** The app sends what it reads from Apple Health to the
   API, which validates and normalises it. Oura never touches the phone.
7. **Health data is the person's alone.** It isn't shown to followers or trainers, used in social
   features or put on a lock screen, unless a later, separately approved feature says otherwise.

## 3. Proposed tables

All tables: `user_id uuid references auth.users on delete cascade`; RLS enabled with **select own**;
no insert, update or delete for clients unless noted. Timestamps are `timestamptz` (original times
as the source gave them, in UTC).

### `health_connections` — one per person per provider

| Column | Notes |
| --- | --- |
| `id`, `user_id` | unique (`user_id`, `provider`) |
| `provider` | `apple_health`, `oura`, `manual`; later `garmin`, `fitbit`, `whoop` (a check constraint, extended by migration) |
| `status` | `connected`, `syncing`, `permission_required`, `error`, `disconnected` (the five states the prototype shows) |
| `devices` | text[]: what's behind it, as reported ("Apple Watch", "iPhone", "Oura Ring Gen 3") |
| `granted` | text[]: the data types the person allowed |
| `connected_at`, `last_synced_at`, `last_error`, `updated_at` | |

### `health_provider_tokens` — OAuth secrets (Oura and later providers)

`connection_id` (unique), `access_token_enc`, `refresh_token_enc`, `expires_at`, `scope`.
**No client access at all**: RLS on, no policies, privileges revoked from `authenticated`. Token
values are encrypted by the API with AES-256-GCM using `HEALTH_TOKEN_KEY` (Render). A database
leak alone doesn't expose them.

### `health_daily_metrics` — the core: one value a day per metric per source

| Column | Notes |
| --- | --- |
| `id`, `user_id` | |
| `day` | date, the person's local day |
| `metric` | a fixed list (check constraint), each with one canonical unit (§4) |
| `source` | `apple_health`, `oura`, `manual`, … |
| `device` | optional attribution ("Apple Watch") |
| `value` | numeric, in the metric's canonical unit |
| `sample_count` | how many readings went into it, where known |
| `measured_at` | the latest original timestamp behind it |
| `source_ref` | the provider's own id or hash, for tracing |
| `imported_at`, `updated_at` | |

Unique (`user_id`, `day`, `metric`, `source`). Indexes on (`user_id`, `day` desc) and
(`user_id`, `metric`, `day`).

### `health_sleep_sessions` — each sleep, with its stages

`id`, `user_id`, `source`, `source_ref`, `started_at`, `ended_at`, `day` (the morning it ended),
`in_bed_s`, `asleep_s`, `awake_s`, `rem_s`, `light_s`, `deep_s` (each null where the source has no
stages: a manual log or an iPhone-only bedtime), `is_nap`. Unique (`user_id`, `source`,
`source_ref`); the night's totals also land in `health_daily_metrics` (`sleep_asleep_s`,
`sleep_in_bed_s`).

### `health_metric_preferences` — which source to show for a metric

`user_id`, `metric`, `source`; primary key (`user_id`, `metric`). The one table people write
directly (own rows only): it's a display choice, like a setting. Without a row, a default order
applies (§6).

### `health_sync_runs` — sync history

`id`, `user_id`, `provider`, `trigger` (`connect`, `app_open`, `webhook`, `manual`, `backfill`,
`nightly`), `started_at`, `finished_at`, `status`, `rows_upserted`, `error`. Kept 90 days (a nightly
`pg_cron` purge). This is what Devices' "Synced 5 min ago" and "Connection issue" read.

### `users` — what they said they use

`health_devices text[]` (`iphone`, `apple_watch`, `oura`, `other_watch`, `none`) and
`health_setup_at timestamptz`: onboarding's step and Set Up Health save these, so Health is
tailored before anything is connected. Changed in Settings or Devices.

### Later, in their own phases (not created in Phase 2)

- **`health_baselines`** (Phase 6): per person and metric, the window, mean, spread, how many days
  it rests on, and when it was worked out. It would be computed by the server from
  `health_daily_metrics`, with the method approved first.
- **Raw samples:** not planned. If a later feature needs them (heart rate during a workout, say), it
  gets its own table and its own approval.

## 4. Metrics and canonical units

| Metric | Unit | Apple Health | Oura | Manual |
| --- | --- | --- | --- | --- |
| `steps` | count | ✓ (iPhone and Watch, merged by Apple) | ✓ | |
| `distance_m` | metres | ✓ | ✓ | |
| `active_energy_kcal` | kcal (all-day movement) | ✓ | ✓ | |
| `exercise_min` | minutes | ✓ | | |
| `heart_rate_avg_bpm` | bpm | ✓ | ✓ | |
| `resting_hr_bpm` | bpm | ✓ | ✓ (lowest overnight) | |
| `hrv_sdnn_ms` | ms | ✓ | | |
| `hrv_rmssd_ms` | ms | | ✓ | |
| `respiratory_rate` | breaths/min | ✓ | ✓ | |
| `spo2_pct` | % | ✓ | ✓ (Gen 3) | |
| `wrist_temp_c` | °C | ✓ (Series 8 and later) | | |
| `temp_deviation_c` | °C from baseline | | ✓ | |
| `vo2max` | ml/kg/min | ✓ | | |
| `hr_recovery_bpm` | bpm | ✓ | | |
| `sleep_asleep_s`, `sleep_in_bed_s` | seconds | ✓ | ✓ | ✓ |
| `oura_readiness` | 0–100, Oura's own | | ✓ | |

The API owns the conversions (kJ to kcal, km to metres, a fraction to a percent) and range checks
(a resting heart rate of 400 is refused, not stored). The list is a constraint in the database
and a typed list in the API and app, extended by migration.

## 5. Data flow

```
Apple Watch / iPhone ─▶ Apple Health ─▶ Progresso app (HealthKit, on the phone)
                                          │  daily summaries + sleep sessions
                                          ▼
                                  POST /health-data/apple/import ──▶ validate · normalise · upsert
                                                                       └─▶ health_sync_runs
Oura Ring ─▶ Oura cloud ─▶ webhook / app-open sync ─▶ API (tokens decrypted server-side)
                                                         └──────────▶ validate · normalise · upsert
Manual sleep log ─▶ POST /health-data/manual ───────────────────────▶ upsert (source: manual)

Progresso app ◀── health_daily(from, to) (SQL, security invoker: own rows, one source a metric)
              ◀── workouts / sets as they are today (never copied)
```

- **Apple Health (Phase 3):** on connect, a backfill (proposed: 90 days); then on each app open,
  what's changed since the last sync (HealthKit's anchored queries). Daily totals come from
  HealthKit's statistics queries, which merge iPhone and Watch so steps aren't counted twice.
  **Double counting across providers:** Oura can write into Apple Health. When Oura is connected
  directly, Apple Health samples written by the Oura app are skipped, so its data arrives once,
  from Oura.
- **Oura (Phase 4):** OAuth through the API; Oura's webhooks say what changed and the API fetches
  it; the app asks for a sync as Health opens; a nightly `pg_cron` backstop calls an internal
  endpoint (`pg_net`), so nothing depends on the missing API scheduler. Tokens are refreshed by
  the API and revoked on disconnect.
- **Which source is shown:** the person's preference for that metric, else overnight measurements
  from Oura and daytime ones from the watch (Apple Health), then manual, as in the prototype's
  `sourceOf`.
- **Disconnecting:** the provider is revoked (Oura) or the person is told how to remove access in
  the Health app (Apple can't be revoked from our side), and the connection is marked disconnected.
  They choose to keep that source's history or delete it.
- **Deleting:** "Delete my health data" removes every health row of theirs, all sources. Account
  deletion removes it all through the cascades.

## 6. What Phase 2 itself would build (once approved)

1. One migration: the tables above (except baselines), their RLS, `users.health_devices` /
   `health_setup_at`, `health_daily(from, to)`, the sync-run purge job. It's applied to
   production before any code that reads it, as always.
2. The API module `health-data`: the metric list and unit conversions, validation, the import and
   manual-log endpoints, delete-my-health-data, sync-run recording, and token encryption helpers
   (unused until Oura). Unit tests throughout.
3. Account deletion confirmed by test; no change needed thanks to the cascades.
4. **No data is collected yet.** Nothing calls the import endpoints until Phase 3 ships with the
   new permission wording and the rewritten Privacy Policy.

## 7. Decisions for Harbir

**Decided 2026-11-27:** store on our servers (1); Health in every membership (2); trainers never
see a client's health data for now (3); 90 days of history on connect (4). Retention (5) as
recommended unless he says otherwise.


1. **Store health data on our servers (recommended)**, or keep Apple Health data on the phone only?
   Server storage is what makes Oura, more than one device, insights, baselines and a new phone
   work. It means changing the permission text and the Privacy Policy (and App Store privacy
   labels), and it's what this proposal assumes.
2. **Which membership gets Health?** Workouts, Workouts + Nutrition, Everything, or all of them.
3. **Trainers:** recommended that trainers never see a client's health data for now.
4. **History on connect:** 90 days (recommended) or longer. Oura's API offers more; Apple Health has
   whatever the phone kept.
5. **Retention:** kept until the person deletes it or their account (recommended); sync history 90
   days.
