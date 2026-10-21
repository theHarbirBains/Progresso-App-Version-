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

## 6. Home (Feed)

The landing screen is a personal activity feed, which replaced the original Dashboard. Data-focused: no greeting or welcome header -- the cards themselves lead. Visually clean, not overloaded.

- **Your activity:** your own completed workouts and logged foods as activity cards, newest first, with a Friends tab for the people you follow (Section 7).
- **Next workout:** the next day in your active split; a workout in progress gets its own card.
- **Workout cards:** duration, exercises and sets, then a Top Sets strip — the top set of each exercise in that workout (e.g., Bench Press 165 lb × 6). Top sets are **not** automatically labeled PRs — a PR is a separate distinction.
- Today's calories and macros are on Nutrition Today and the You tab, with the week's calorie budget (7 times the daily target, Monday to Sunday) under them on Today.
- **Targets:** calories, protein, fat and carbs (Nutrition Goals), set in three steps: calories (one of the Mifflin-St Jeor estimates -- x activity, -500/-300/+300 -- on a tap, or any number entered), then macros, then Save. Recommended: protein 0.8 g and fat 0.3 g per lb of body weight, every time, and carbs = (calories - protein x 4 - fat x 9) / 4. Each recommendation shows faded in its field; a blank field saves it, and any field can be typed over (a different number is offered the recommendation back with "Use N g"). Protein and fat past the calories are explained, never clamped or blocked.
- **Phases:** a cut, bulk, maintenance or custom phase from a start date (today or earlier) to an end (none while going); one at a time, never overlapping. A phase's own targets replace the daily ones field by field while it's going; the daily targets are never changed. Progress shows the phase's days, workouts a week and days on the calorie target out of days logged -- never a promised rate.
- **Weekly Summary:** at the top of Progress → Overview, this week or last in plain numbers -- workout days against the weekly goal, average calories and protein and the days on target (only days with food logged count), sets per muscle group against the 4 weeks before, and the main lifts' top sets against their best in the 4 weeks before. Deterministic and descriptive: it says what happened, never why.

## 7. Social/Athlete Experience

UI should have social-media-app engagement and visual language: athlete profile, athlete card, workout cards, performance stats, achievement cards, progress posts, leaderboards, shareable workout cards — these remain **concepts for later**, not yet built.

**Social v1 (explicitly requested and implemented; see `apps/api/src/follows`/`apps/api/src/feed` and `apps/mobile/src/screens/FindPeopleScreen.tsx`):** a one-directional, accept-gated follow graph (Instagram-style follow requests, not a symmetric "friendship") plus a read-only Friends tab on Feed showing accepted followees' own completed workouts and logged foods, reusing the same card visual language as the self feed. No likes, no comments, no leaderboards yet — those, plus anything beyond this scope, still require explicit approval before being built.

## 8. Nutrition

Tracks calories, protein, carbs, fat. No micronutrients in v1.

Logging methods: custom foods entered by hand (with an optional photo), food search (Progresso's catalog and Open Food Facts), barcode scanning, and AI Food Search, which takes its figures from food data (Progresso's catalog, USDA, Open Food Facts) and uses an AI estimate only as a labelled last resort. A food can be logged in servings, in the pieces its serving names, in grams or ounces (a weight-based serving) or millilitres (a drink), and the log keeps the amount as typed. Shortcuts: usual and recently logged foods can be logged again in two taps; a **saved meal** (foods eaten together) is logged in one go, each food as its own entry; a **recipe** (a drink or meal always made the same way: its ingredients and how many servings it makes) is one food, whose figures per serving are worked out from its ingredients when it's saved; and Copy Yesterday logs any of yesterday's foods again. Editing a food or a recipe never changes what was already logged.

Users may optionally set daily targets for calories/protein/carbs/fat.

**Historical food logs must snapshot nutrition data at time of logging.** If a food database entry changes later, old logs must not silently change.

## 9. Accounts

Auth: email/password, Google, Apple, MFA (MFA is not built yet). Signing up goes through a guided onboarding that ends with creating the account; signing in goes straight into the app.

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

- Simple authenticated reads and own-row writes, properly protected by Supabase RLS, may go direct to Supabase. This includes workout and set writes — PR correctness is enforced by database triggers whichever path wrote a set, not by the API — and nutrition logging, whose snapshot values are computed at log time, with the user's own foods, saved meals and recipes.
- Operations needing server-side logic, cross-user trust or a third-party integration go through the backend API: exercise and equipment-profile writes, food search, barcode lookup and AI food search, social, trainer and group features, push tokens, administrative operations, RevenueCat webhooks, account export/deletion.

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

| Phase | Scope                              | Status                                                                                                                                                                                            |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation                         | Done                                                                                                                                                                                              |
| 1     | Accounts                           | Done — email/password, Google and (web) Apple sign-in, onboarding, account settings, Change Password                                                                                              |
| 2     | Exercise Library                   | Done — default + custom exercises, muscle-group tagging, backend endpoints                                                                                                                        |
| 3     | Workout Logging                    | Done — splits (incl. presets), live workout tracking, history, calendar                                                                                                                           |
| 4     | Progressive Overload Engine        | Done — top sets, rep-count PRs, true 1RM, PR correctness across edit/delete/restore                                                                                                               |
| 5     | Strength Analytics                 | Done — tabbed Progress section (Overview/Top Sets/Strength/All Time), charts, muscle visualization, PRs and true 1RMs                                                                             |
| 6     | Nutrition Logging                  | Done — custom foods, food search, barcode scanning, AI food search, usual and recent foods, saved meals, recipes, Copy Yesterday, logging by servings, pieces, weight or volume, daily goals      |
| 7     | Nutrition Analytics                | Started — daily totals, a history calendar, the weekly calorie budget and the Weekly Summary; no body-weight tracking or longer trends yet                                                        |
| 8     | Subscriptions                      | Paused by decision — RevenueCat webhook handling (signature verification, event projection) is implemented; no in-app purchase or paywall until approved                                          |
| 9     | Admin Dashboard                    | Not started — role-based authorization is implemented and tested end to end; the admin surface itself is a single placeholder route, not a dashboard                                              |
| 10    | Privacy Tooling                    | Not started — no account export or account deletion yet (Delete Account is a visible "Coming Soon" placeholder)                                                                                   |
| 11    | Design Polish + Push Notifications | Partial — theme/accent design system is implemented; devices register for push and a daily reminder job exists, but nothing triggers it yet and iOS delivery needs an APNs key; no email delivery |
| 12    | Beta Launch Preparation            | In progress — internal TestFlight builds through EAS, Sentry, CI checks including an iOS bundle export                                                                                            |

**Post-v1:** likes/comments/leaderboards and other deeper social features, home screen widgets, Apple Watch/Wear OS, exercise form media, AI features beyond the existing AI Food Search, other advanced functionality. Social v1 (follow graph + Friends feed) is implemented ahead of schedule as an approved, explicitly-scoped exception — see Section 17.

## 17. Current Implementation State

Progresso is **past the Phase 0 foundation** and has an implemented core loop, not just a skeleton. This section distinguishes what's actually built from what's in progress or still planned; see the roadmap in Section 16 for per-phase detail.

**Implemented:**

- Authentication: Supabase email/password sign up and sign in, password reset, plus Google sign-in/sign-up via web-redirect OAuth (`apps/mobile/src/auth/oauth.ts`) -- Google sign-up lives on onboarding's account-creation step, Google sign-in on the Sign In screen. An Apple button exists on the same code path but isn't yet production-polished (real native Sign-In-with-Apple is a later, EAS-build-dependent milestone). Change Password in Settings. MFA from Section 9 is not yet implemented.
- Onboarding: a guided flow that ends in creating the account — referral source, country, gender, birthday, weight, height, fitness goal, how comfortable they are planning and progressing their workouts (it sets the starting rep range), weekly frequency, workout length, a starting split, and email and push preferences, then a first name (the display name), a username, email and password (or Google). Allowing notifications asks iOS for permission and registers the device for push.
- Feed (Section 6): the landing screen, with your own activity and a Friends tab.
- Workout splits: create, edit, view, duplicate, delete, plus built-in presets that copy into an editable user-owned split.
- Workout tracking: live workout logging (exercises, sets, reps, weight) against a split, with each new set pre-filled from the set before it or the same set last session (never completed without the user's tap), workout history with a month calendar, workout sharing.
- Progressive overload / PRs: top sets, rep-count PRs, and true 1RM (only from a logged 1-rep set), correct across set/workout edit, soft-delete, and restore.
- Progress/strength analytics: a tabbed Progress section (Overview, Top Sets, Nutrition, All Time; the Strength tab and every Progress line graph were later removed at the product owner's request), muscle-group visualization, and PRs and true 1RMs (also listed on the You tab).
- Nutrition: today's calories and macros against user-set daily goals (with goal estimates from body data), a history calendar, and every logging method in Section 8 — custom foods, food search, barcode scanning, AI Food Search (with a per-user hourly and daily limit), usual and recent foods, saved meals, recipes, Copy Yesterday and logging by pieces, weight or volume.
- Trainer mode and group workouts: a trainer manages clients, logs workouts for them and runs live sessions, behind a "trainer" entitlement with no purchase flow yet (switched on by hand during internal testing); anyone can start a group from a workout, with each person's sets in their own tab.
- Deep links: `progresso://feed`, `progresso://nutrition`, `progresso://workouts/<id>` and `progresso://workouts/<id>/live`, opened once the user is signed in.
- Settings: an app-wide Settings hub — a root list of Profile & Personal Information, Workout Preferences, Nutrition & Goals, Notifications, Account & Security and Support & About, each its own page. The look is fixed (Warm Minimal: the warm gym photo behind the top of every screen and one amber accent), with no background themes or colour customization.
- Backend: JWT-authenticated NestJS API with role-based authorization (`user`/`support_admin`/`full_admin`), user profile endpoints, exercise and equipment-profile endpoints, food search, barcode lookup and AI food search, follows and the Friends feed, trainer and group endpoints, push token registration with a daily reminder job, and RevenueCat webhook processing (signature verification, idempotent event handling, subscription projection).
- Social v1: a one-directional, accept-gated follow graph (send/accept/reject/unfollow, user search) and a read-only Friends tab on Feed showing accepted followees' own completed workouts and logged foods. No likes, comments, or leaderboards yet.

**In progress / partial (do not treat as complete):**

- Subscriptions: webhook/backend projection exists; there is no in-app purchase or paywall flow yet, and none is built until approved.
- Notifications: push/email opt-in preferences are real and persisted, and devices register their push tokens. The API's daily reminder job sends through Expo's push service, but nothing triggers it (no scheduler; its trigger secret is unset), and iOS delivery also needs an APNs key in EAS. There is no email delivery.
- Admin: authorization is real and tested end to end; the admin dashboard itself does not exist yet beyond a single placeholder route proving the auth chain.

**Explicitly placeholder (visible in the UI, not backed by real functionality):**

- Change Email and Delete Account (Settings → Account & Security).
- Help & FAQ, Contact Support and Report a Problem (Settings → Support & About), and the finer notification categories (Settings → Notifications).
- Apple Health — not offered; onboarding's former placeholder step was removed until HealthKit is approved.

**Not yet started:** nutrition analytics/trends, privacy tooling (data export, account deletion), full admin dashboard, design-polish pass beyond the current theme system, and everything listed under Post-v1 in Section 16.
