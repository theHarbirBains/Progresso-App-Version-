# Progresso — Master Product & Technical Spec

This document is the canonical product/technical reference for Progresso. Working rules for how the agent should operate day-to-day live in [../CLAUDE.md](../CLAUDE.md).

## 1. What Progresso Is

A fitness and nutrition mobile app (iOS and Android) combining workout tracking, progressive overload tracking, strength/performance analytics, nutrition tracking, user accounts, subscriptions, and an admin system.

Goal: make fitness tracking feel like using a modern social/athletic platform rather than a spreadsheet. Users should feel like athletes whose performance is recorded, analyzed, and presented engagingly.

Visual inspiration: EA FC/FIFA Ultimate Team player cards — presenting a user's stats like an athlete profile/card. **Do not copy EA FC branding or copyrighted assets** — only the concept.

App feel: premium, modern, athletic, motivating, social, data-driven, dark-mode-first, mobile-first, highly visual.

## 2. Core Product Philosophy

Progresso is **not** primarily a workout-program app. Users freely create and log their own workouts — no mandatory built-in programs in v1.

Focus areas, in priority order:

1. Record what the user actually does.
2. Remember historical performance.
3. Surface useful previous performance while training.
4. Identify meaningful progression.
5. Present achievements/statistics engagingly.
6. Combine training data with nutrition data.

Progresso surfaces useful information rather than dictating what the user must do.

## 3. Workout Tracking

Users can create/name workouts, add/reorder exercises, log/edit/delete sets, complete workouts, view history, and review previous exercise performance.

**v1 set data:** weight and reps only. No RPE, RIR, or rest timers in v1.

Units: user chooses lb or kg. **All weights are stored internally in kilograms** — the selected unit only affects input/display.

## 4. Progressive Overload

Not simply "add more weight." Progression includes: increasing weight at the same reps, increasing reps at the same weight, improved performance over time, increased training volume, or other measurable improvement.

Progresso maintains historical performance per exercise. When a user selects an exercise during a workout, surface: recent sets, previous workout performance, top sets, personal records.

## 5. Top Set vs. Rep-Count PR vs. True 1RM

These are three distinct concepts — do not conflate them.

- **Top set:** the heaviest weight completed for an exercise _within one specific workout_. E.g., if a workout has 135×10, 155×8, 165×6, the top set is 165×6. Specific to that workout only.
- **Rep-count PR:** the heaviest weight ever logged for an exercise _at a specific rep count_, across all history. E.g., logging 135×10, 145×10, 155×8, 160×10 makes 160×10 the 10-rep PR. Identified in real time while logging.
- **True 1RM:** comes **only** from an actual logged set of exactly 1 rep. Never estimated from higher-rep sets (e.g., 155×8 does NOT create a 1RM; 165×1 does). Lives in a dedicated "Maxes" section, separate from PRs.

## 6. Dashboard

Data-focused: no greeting or welcome header -- the widgets themselves lead. Visually clean, not overloaded.

- **Nutrition section (one only):** calories, protein, carbs, fat — concise.
- **Workout section:** current workout/split — name, muscles trained, athletic/premium visual muscle representation.
- **Top Sets section:** top sets from the most recently completed workout (e.g., Bench Press 165 lb × 6). Top sets are **not** automatically labeled PRs — if a top set is also a PR, that distinction is shown separately.

## 7. Social/Athlete Experience

UI should have social-media-app engagement and visual language: athlete profile, athlete card, workout cards, performance stats, achievement cards, progress posts, workout summaries, leaderboards, shareable workout cards — these are **concepts for later**, not v1 requirements.

**Social features are not required for v1 and must not be implemented unless explicitly requested.** The social feeling in v1 should come from visual design/presentation of the user's own data only.

## 8. Nutrition

Tracks calories, protein, carbs, fat. No micronutrients in v1.

Logging methods (eventual): manual entry, food database search, barcode scanning, custom foods.

Users may optionally set daily targets for calories/protein/carbs/fat.

**Historical food logs must snapshot nutrition data at time of logging.** If a food database entry changes later, old logs must not silently change.

## 9. Accounts

Auth: email/password, Google, Apple, MFA. No forced guided onboarding in v1 — after auth, users enter the app directly.

## 10. Admin System

Three permission levels:

- **Regular user:** own data only. Must never access another user's workouts, sets, nutrition, nutrition goals, custom exercises, custom foods, or performance data.
- **Support admin:** restricted administrative/support capabilities.
- **Full admin:** exercise library management, user management, support operations, usage analytics, subscription/billing visibility, and other explicitly authorized operations.

Administrative actions must be auditable. **User-data isolation must be enforced at the database/security level (RLS + backend authorization), not merely hidden in the UI.**

## 11. Technology Direction

- **Mobile:** React Native + Expo + TypeScript
- **Backend:** Node.js + TypeScript, NestJS (Fastify adapter)
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Subscriptions:** RevenueCat
- **Admin dashboard:** React web application
- **Mobile builds/releases:** Expo EAS

## 12. Backend Architecture

**Hybrid architecture.**

- Simple authenticated reads, properly protected by Supabase RLS, may go direct to Supabase.
- Operations involving important business logic or side effects go through the backend API: set writes, PR operations, workout delete/restore, nutrition logging requiring snapshots, administrative operations, RevenueCat webhooks, account export/deletion.

Never bypass security or business logic just because direct Supabase access is technically possible.

## 13. Database Principles

Production-quality PostgreSQL: foreign keys, constraints, indexes, version-controlled migrations, RLS, triggers where appropriate, correct deletion behavior, audit logging, canonical kg weight storage, correct PR recomputation, nutrition snapshots, subscription event idempotency.

**PR records must remain correct** when a user: creates a set, edits weight, edits reps, soft-deletes a set, restores a set, deletes a workout, restores a workout, or changes a workout date. No stale PR records.

Historical exercises should generally not be physically destroyed if doing so would break historical workout data.

## 14. Subscription Architecture

RevenueCat is the **authoritative source** of subscription entitlement. Our subscription table is a server-side projection/cache — never a competing source of truth.

Webhooks must support: signature verification, idempotent processing, duplicate event protection, out-of-order event protection, audit/event history.

Handle: initial purchase, renewal, cancellation, expiration, refund, restore purchase.

## 15. Privacy & Security

First-class requirement. Users only access their own data via Supabase RLS, proper backend authorization, role-based admin permissions, secure environment variables, no committed secrets, database constraints, audit logging.

Users should eventually be able to export their data and delete their account/data.

**No body metrics (body weight, body-fat %) required in v1.**

## 16. Development Roadmap

| Phase | Scope                              | Status                                                                                                                                               |
| ----- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation                         | Done                                                                                                                                                 |
| 1     | Accounts                           | Done — email/password auth, onboarding, account settings                                                                                             |
| 2     | Exercise Library                   | Done — default + custom exercises, muscle-group tagging, backend endpoints                                                                           |
| 3     | Workout Logging                    | Done — splits (incl. presets), live workout tracking, history, calendar                                                                              |
| 4     | Progressive Overload Engine        | Done — top sets, rep-count PRs, true 1RM, PR correctness across edit/delete/restore                                                                  |
| 5     | Strength Analytics                 | Done — tabbed Progress section (Overview/Strength/PRs/Exercises/Top Sets/1RM), charts, muscle visualization                                          |
| 6     | Nutrition Logging                  | Done, simpler than final vision — manual food entry/log/goals only; no barcode scanning or food database search                                      |
| 7     | Nutrition Analytics                | Not started — daily totals only, no trend/history analytics                                                                                          |
| 8     | Subscriptions                      | In progress — RevenueCat webhook handling (signature verification, event projection) is implemented; no client-side purchase/paywall flow yet        |
| 9     | Admin Dashboard                    | Not started — role-based authorization is implemented and tested end to end; the admin surface itself is a single placeholder route, not a dashboard |
| 10    | Privacy Tooling                    | Not started — no account export or account deletion yet (Delete Account is a visible "Coming Soon" placeholder)                                      |
| 11    | Design Polish + Push Notifications | Partial — theme/accent design system is implemented; push/email notifications are opt-in preferences only, with no delivery mechanism                |
| 12    | Beta Launch Preparation            | Not started                                                                                                                                          |

**Post-v1:** social features, home screen widgets, Apple Watch/Wear OS, exercise form media, AI features, other advanced functionality. A front-end-only Social screen shell (no backend) exists ahead of schedule as an approved, explicitly-scoped exception — see Section 17.

## 17. Current Implementation State

Progresso is **past the Phase 0 foundation** and has an implemented core loop, not just a skeleton. This section distinguishes what's actually built from what's in progress or still planned; see the roadmap in Section 16 for per-phase detail.

**Implemented:**

- Authentication: Supabase email/password sign up and sign in, password reset. (Google/Apple/MFA from Section 9 are not yet implemented.)
- Onboarding: a guided flow collecting profile basics (first name, last name, username, display name — each independent, none derived from another) and unit preference.
- Workout splits: create, edit, view, duplicate, delete, plus built-in presets that copy into an editable user-owned split.
- Workout tracking: live workout logging (exercises, sets, reps, weight) against a split, workout history with a month calendar, workout sharing.
- Progressive overload / PRs: top sets, rep-count PRs, and true 1RM (only from a logged 1-rep set), correct across set/workout edit, soft-delete, and restore.
- Progress/strength analytics: a tabbed Progress section (Overview, Strength, PRs, Exercises, Top Sets, 1-Rep Max), strength trend charts, and muscle-group visualization.
- Nutrition: a basic food library and food log against user-set daily goals (calories/protein/carbs/fat). Manual entry only — no barcode scanning or external food database.
- Settings: an app-wide Settings hub (Account, Appearance, App, Notifications, Privacy, Help) with theme/accent customization applied consistently across the app.
- Backend: JWT-authenticated NestJS API with role-based authorization (`user`/`support_admin`/`full_admin`), user profile endpoints, exercise library endpoints, and RevenueCat webhook processing (signature verification, idempotent event handling, subscription projection).

**In progress / partial (do not treat as complete):**

- Subscriptions: webhook/backend projection exists; there is no in-app purchase or paywall flow yet.
- Notifications: push/email opt-in preferences are real and persisted; there is no actual push or email delivery mechanism.
- Admin: authorization is real and tested end to end; the admin dashboard itself does not exist yet beyond a single placeholder route proving the auth chain.

**Explicitly placeholder (visible in the UI, not backed by real functionality):**

- Change Password and Delete Account (Settings → Account).
- Apple Health connection (onboarding) — no HealthKit integration.
- Social screen — front-end-only shell (profile entry point, honest empty "Recent Activity" state), no posts/follows/activity-feed backend.

**Not yet started:** nutrition analytics/trends, privacy tooling (data export, account deletion), full admin dashboard, design-polish pass beyond the current theme system, beta launch preparation, and everything listed under Post-v1 in Section 16.
