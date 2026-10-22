# CLAUDE.md — Progresso Development Rules

This file contains the **permanent** working rules for any coding agent (Claude Code or otherwise) operating in this repository. Product/domain detail lives in [docs/PROGRESSO_MASTER_SPEC.md](docs/PROGRESSO_MASTER_SPEC.md) — read both before doing substantial work.

## Current Phase

**Actively developed, past Foundation.** The core loop is implemented and working end to end: accounts/onboarding, workout splits (create/edit/view/duplicate/delete + presets), live workout tracking, workout history, and Progress/PR/1RM analytics, plus a working (if simpler) nutrition-logging feature and an app-wide Settings hub. See [README.md](README.md) for the current feature list and [docs/PROGRESSO_MASTER_SPEC.md](docs/PROGRESSO_MASTER_SPEC.md) for the roadmap.

Some areas remain intentionally incomplete rather than hidden — do not treat these as done: push notifications (devices register their tokens and the API has a daily reminder job that sends through Expo, but nothing triggers it — there is no scheduler and its `INTERNAL_NOTIFICATIONS_SECRET` is unset — and iOS delivery also needs an APNs key in EAS; there is no email delivery), Change Email (visible but "Coming Soon"), Apple Health (not offered anywhere; no HealthKit integration), and the admin surface (authorization is real and tested; the admin dashboard itself is still a placeholder route). Do not implement these, AI features, or anything else beyond the current feature set until explicitly approved.

Social v1 (explicitly requested and implemented — a one-directional, accept-gated follow graph plus a read-only Friends feed, with blocking and reporting; see `apps/api/src/follows`, `apps/api/src/feed`, `apps/api/src/safety`, and `apps/mobile/src/screens/FindPeopleScreen.tsx`) is real, backed functionality, not a placeholder. A block must be honoured by every way one person can reach another (search, suggestions, follows, group invites, trainer link requests): a new path that connects two people checks `loadBlocks` too. Account deletion (`DELETE /users/me`, `delete_account`) must keep other people's history whole; a new table that references another user's rows needs handling there. Likes, comments, leaderboards, and anything else beyond that scope still require explicit approval before being built.

## Design System

[DESIGN.md](DESIGN.md) is the visual/design source of truth for Progresso. Read it before making any UI/UX change. Follow its documented colors, typography, spacing, radii, components, navigation, states, and accessibility rules exactly — do not invent colors, typography, spacing, radii, or component styling that conflicts with it. Do not introduce a new visual pattern that conflicts with DESIGN.md without first explaining the conflict and getting explicit approval.

## Working Process (required for every non-trivial change)

1. Inspect the existing project state before proposing changes.
2. Explain the plan: what will change and why.
3. Identify the files that will be created/modified.
4. Implement the change.
5. Run tests, type checking, and linting.
6. Review the implementation critically.
7. Fix issues found.
8. Commit meaningful milestones to Git with clear messages.

## Hard Rules

- **Work incrementally.** Do not build ahead of the current phase.
- **No unrelated changes.** Don't refactor or "clean up" code outside the scope of the task.
- **No unnecessary dependencies.** Justify any new package before adding it.
- **Don't rewrite working code** unless the task requires it.
- **Never hide errors or suppress warnings** just to make builds/tests pass.
- **Never commit secrets.** All credentials/keys live in environment variables, excluded via `.gitignore`.
- **Never modify the database schema outside of version-controlled migrations.**
- **Never make major architectural decisions silently.** If the architecture needs to change, explain the reasoning and tradeoffs first and get approval.
- **Ask when a requirement is ambiguous** rather than inventing a product decision.
- User data isolation (workouts, sets, nutrition, goals, custom exercises/foods, performance data) must be enforced at the database/security level (RLS + backend authorization), never only hidden in the UI.

## Architecture Summary (see master spec for full detail)

- **Mobile:** React Native + Expo + TypeScript
- **Backend:** Node.js + TypeScript, NestJS on the Fastify adapter
- **Database:** PostgreSQL via Supabase, version-controlled migrations, RLS, triggers where appropriate
- **Auth:** Supabase Auth (email/password, Google, Apple, MFA)
- **Storage:** Supabase Storage
- **Subscriptions:** RevenueCat is the authoritative source of entitlement; our subscription table is a projection/cache only
- **Admin dashboard:** React web app
- **Mobile builds:** Expo EAS
- **Backend pattern:** Hybrid — simple RLS-protected reads/writes may go direct to Supabase; anything needing server-side business logic, cross-user-trusted computation, or a third-party integration (exercise/equipment-profile writes, food search, barcode lookup and AI food search with their shared-catalog caching, follows and the Friends feed, trainer and group sessions, push tokens, admin ops, RevenueCat webhooks, account export/deletion) goes through the NestJS API. Workout/set CRUD, nutrition logging and the user's own custom foods, saved meals and recipes are direct-to-Supabase from the client, own-row RLS-protected — this is intentional, not a gap: PR/1RM recomputation is enforced entirely by a security-definer Postgres trigger chain (`recompute_prs_for_exercise`, see `supabase/migrations/20260823100008_pr_infrastructure.sql`) with client write access to `rep_prs`/`one_rep_maxes` revoked, so correctness holds regardless of which client path wrote the set. Nutrition log totals are computed client-side at log time and are not server-verified against the live food row — a deliberate simplicity tradeoff, not an oversight.

## Caching & Data Freshness (mobile)

No caching library is used or needed — every rule below is built on plain React state/Context plus two small shared primitives (`useSignedInResource`, the exercise cache). Do not add a caching library without explaining why these can't meet the requirement first.

- **Fetch-once-per-sign-in resources** (profile, nutrition goals, today's food log, and the signed-in user's whole workout/set/PR history) go through `useSignedInResource` (`src/lib/useSignedInResource.ts`): fetched once when the user signs in, reset on sign-out, never re-fetched on focus/navigation. A write path (`updateProfile`, `saveGoals`, `logFoodEntry`, `completeWorkout`, ...) updates the shared cache directly from its own save's response (or calls `refetch()`), so every other screen already mounted sees the change immediately with no second round trip.
- **Exercise library/picker data** uses its own per-user in-memory cache (`src/exercises/exerciseQueries.ts`), not time-based — built-ins never change, and a custom exercise only changes through `ExerciseFormScreen`, which calls `invalidateExerciseCache(userId)` after every create/update/delete.
- **Feed's own items** (the signed-in user's own workouts) and **the live-workout/group/session check** are never staleness-gated — they're refetched on every focus, because they're exactly what a one-hop edit-and-return (finish a workout, edit a past workout) changes, and a live session must always be current.
- **Feed's friends section, its notification/goal badges, and its next-workout preview** — things that only change from elsewhere (someone else's activity, a notification acted on minutes ago, a split edited) — use a 45s staleness window (`src/lib/focusFreshness.ts`) before refocusing refetches them, so switching tabs quickly doesn't re-fire these needlessly.
- **Workout History's and Profile's own recent-workout lists** always refetch on focus, for the same one-hop-mutation reason as Feed's own items.
- **The week's figures** -- Today's weekly calorie budget (its earlier days; today's own come from the shared food-log cache, so the bar moves on every log) and Progress's Weekly Summary -- are read each time their page opens, with no staleness gate: a section page opens fresh, and what they show changes one hop away.
- **Nutrition shortcuts** -- Today's Copy Yesterday list and the Food Library's Saved Meals, Usual and Recent -- are read each time their page opens (a section page opens fresh) and again after a save on that page; no staleness gate, since a meal or recipe edited one hop away must show at once.
- **The Trainer Workspace's Activity and Sessions tabs** always refetch on focus too: the trainer's own logging and live sessions (one hop away, under Sessions) change both, and a live session must always be current.
- **What a section page last showed** (`src/lib/lastShown.ts`) -- Feed's first page, friends section, next-workout preview and open workouts (the live workout itself notes it as it opens and clears it when finished or cancelled -- `feed/liveWorkoutMemory.ts` -- so Feed never shows "start your next workout" while one is going), Workout History's month and recent list, Profile's recent workouts, the Trainer Workspace's Activity feed and Sessions page, Progress's Weekly Summary (only for the same week) -- is remembered in memory for the session, per user, and forgotten on sign-out. A section page is opened fresh on every section switch (`navigation/sectionNavigation.ts`), so it starts from that instead of a blank page and a spinner, then refetches exactly as the rules above say. It never replaces a fetch and is never the source of truth; don't read it anywhere but a page's own initial state.
- Do not add a staleness gate to a screen's own just-mutated data, and do not remove one from data that only ever changes elsewhere, without re-checking which case it is first.

## Key Domain Concepts (do not conflate these)

- **Top set:** heaviest weight completed for an exercise within one specific workout.
- **Rep-count PR:** heaviest weight ever logged for an exercise at a specific rep count.
- **True 1RM:** only ever comes from a logged set of exactly 1 rep. Never estimated from higher-rep sets. Lives in a dedicated "Maxes" section.
- **Progression cue:** a suggestion, never a record. Each person has one rep range (`users.rep_range_min`/`rep_range_max`). When a set reaches the top of it, the next time that exercise is done its slide in Last Time's Sets says to go up ("Hit 10! Go up to 77.5 lb today."); short of the top nothing is said -- never "bad" or "go lighter". Worked out in the app from logged sets (`workouts/progression.ts`); it never changes a weight, a PR or a Top Set.
- **Which rep range applies:** an exercise's own range -- an "exception" (`exercise_progression_settings`, set from its menu in the live workout or Settings > Workout Preferences > Rep Range Exceptions) -- wins over the person's (`users.rep_range_min/max`); a range may be one number. A trainer sets an active client's range and exceptions through the API (`/trainer/clients/:id/rep-range(s)`, link-checked and audited) -- the same rows, so the client sees and can change them; there is no separate trainer layer. The suggested next weight is the exercise's own step, else 5 lb / 2.5 kg.
- **Daily targets:** the daily targets (`nutrition_goals`) are only ever changed by the person saving them. Recommended: protein 0.8 g and fat 0.3 g per lb of body weight (`macroGuidance`), carbs (calories - 4 x protein - 9 x fat) / 4 (`carbsFor`). Every target is still the person's to type; on Nutrition Goals a blank macro field is its recommendation (shown faded, saved as shown). A calorie estimate is applied only on a tap, nothing is saved until the person saves, and a weight change never rewrites a saved target.
- **Split day plan:** a day's planned exercises (`workout_split_day_exercises`) are copied into a workout when the day is started; the workout is its own record from then on. The next day is the one after the last completed day -- a missed workout never advances it.
- **Measurement type:** what an exercise's sets record -- `weight_reps`, `bodyweight` (reps only) or `timed` (a duration). A weighted variant (Weighted Pull-Up) is its own `weight_reps` exercise, never a flag on a bodyweight one. Each logged exercise snapshots its type (`workout_exercises.measurement_type`, set by trigger), so changing an exercise's type never rewrites history. Top sets, rep PRs, 1RMs, volume and strength charts are `weight_reps` only; a bodyweight exercise's record is its most reps (`rep_records`) and a timed one's its longest (`duration_records`), both trigger-maintained like PRs.

Weights are stored canonically in kilograms; lb/kg is a display/input preference only.

PR correctness must be maintained across set create/edit/soft-delete/restore and workout delete/restore/date-change. No stale PR records. This is enforced by DB triggers, not application code — see the Architecture Summary's backend pattern note. If a future change reassigns a `workout_exercises.exercise_id` after sets were already logged against it (no current code path does this), extend the trigger chain to cover it; the existing triggers do not fire on that column changing.

Nutrition logs must snapshot the nutrition data at the time of logging — later edits to a food database entry must not retroactively change historical logs.

- **Saved meal vs recipe (do not conflate):** a saved meal (`saved_meals`) is several foods eaten together; logging it logs **each food as its own entry**. A recipe is **one food** (a `foods` row with `recipe_servings` set, serving 1 "serving"), its figures per serving worked out client-side from `recipe_ingredients` when it's saved and stored on the food row; it logs as a single entry like any food. Editing either never changes past logs (snapshots).

## Permission Levels

- **Regular user:** own data only.
- **Support admin:** restricted administrative/support capabilities.
- **Full admin:** exercise library management, user management, support ops, analytics, subscription/billing visibility.

All administrative actions must be auditable.
