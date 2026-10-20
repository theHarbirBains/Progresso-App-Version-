# Progresso

A full-stack fitness tracking application focused on progressive overload: logging workouts, tracking strength over time, and surfacing personal records with a premium, data-forward user experience.

See [CLAUDE.md](CLAUDE.md) for development rules and [docs/PROGRESSO_MASTER_SPEC.md](docs/PROGRESSO_MASTER_SPEC.md) for the full product/technical spec.

## Overview

Most workout-logging apps either bury progress data in raw tables or estimate it in ways that don't hold up (e.g. estimating a 1-rep max from a 10-rep set). Progresso is built around a stricter, more honest model of strength progress:

- **Top sets** — the heaviest weight completed for an exercise within a single workout.
- **Rep-count PRs** — the heaviest weight ever logged for an exercise at a specific rep count.
- **True 1-Rep Max** — recorded only from an actual logged set of exactly 1 rep, never estimated from higher-rep sets.
- **Bodyweight and timed exercises** — a bodyweight exercise (Push-Up, Pull-Up) records reps only and keeps its most reps; a timed one (Plank, Dead Hang) records a time and keeps its longest. A weighted variant (Weighted Pull-Up) is its own weighted exercise. Weight-based numbers — volume, top sets, rep PRs, 1RMs — only ever come from weighted sets.

A user creates a workout split (or starts from a preset), logs sets during a live workout, and the app derives history, personal records, and strength trends from that logged data — per exercise and per muscle group. Every user's data is isolated at the database level via Postgres Row-Level Security, not just hidden in the UI.

## Current Features

**Accounts & onboarding**

- Email/password sign-up and sign-in (Supabase Auth), password reset, and Google sign-in; an Apple button uses the same web sign-in flow
- A guided onboarding that ends in creating the account: where you heard about Progresso, country, gender, birthday, weight and height, fitness goal, how comfortable you are planning and progressing your workouts (which sets your starting rep range: 8–12, or 5–10 for experienced lifters), weekly frequency, workout length, a starting split, and email and push preferences — then a first name (shown as the display name), a username, email and password, or Google
- Allowing notifications during onboarding asks iOS for permission and registers the device for push
- Change Password in Settings, for accounts that sign in with email

**Feed**

- The landing screen: your own completed workouts and logged foods as activity cards, and a Friends tab with the people you follow
- Your next workout in the active split, a card for a workout that's in progress, and a "+" shortcut to Start Workout or Log Food

**Workouts**

- Create, edit, view, duplicate, and delete workout splits, including a set of built-in split presets (e.g. Push/Pull/Legs) that can be copied into an editable, user-owned split
- Live workout tracking: log exercises, sets, reps, and weight (or reps alone for a bodyweight exercise, or a time like 45 or 1:30 for a timed one) against a split in progress, with a running workout timer and each exercise's last session shown above its sets
- Progressive overload: one rep range for all your workouts (Settings › Workout Preferences). When an exercise's top set reaches the top of the range, the live workout says to increase the weight next time (a weight you can lift for about the bottom of the range, then build back up); until then, to keep the weight and work toward the top. Bodyweight exercises at the top get more reps or the weighted version, and timed ones a new time to aim for. Each card also shows your best within the range. Suggestions only, never automatic, and they can be turned off
- New sets start filled in from the set before them, or the same set from last session, ready to edit; a set only completes when you tap it
- Unilateral exercises are logged per side, left and right
- Group workouts: start a group from a workout; each person has their own tab of sets, and anyone in the group can enter them
- Custom exercises alongside a shared default exercise library, each tagged with a muscle group, with optional equipment profiles and machine photos
- Workout history with a month calendar view and per-day/per-workout detail; past workouts can be logged and completed ones edited
- Workout sharing: a story-sized (9:16) workout card, shared to Instagram, TikTok and other apps through the share sheet

**Progress & analytics**

- A Progress tab with Overview, Top Sets, Strength and All Time sections
- Per-exercise and lifetime top sets, rep-count PRs, and true 1RM tracking (1RM is only ever recorded from an actual 1-rep set), plus most reps and longest time for bodyweight and timed exercises
- Strength trend charts and progress metrics per exercise
- Muscle-group visualization based on which exercises the user has actually logged

**Nutrition**

- Today's calories and macros against your goals, with goal estimates calculated from your body data, and a history calendar
- Log Food opens your Food Library: your own foods (with photos), with your most recently logged foods first, ready to re-log at last time's quantity
- Search Food covers Progresso's food catalog and Open Food Facts; Scan Barcode looks products up on Open Food Facts, with Enter Manually when one isn't found
- AI Food Search turns a description into its parts and takes their figures from Progresso's catalog, USDA data and Open Food Facts; Claude's own estimate is used only as a labelled last resort. Each user has an hourly and a daily limit
- A food whose serving is a weight can be logged in grams or ounces; every log keeps the figures it was logged with, even if the food changes later

**Trainer mode**

- Trainers switch between My Workspace and a Trainer Workspace (a switcher at the top of Feed) with its own bottom tabs -- Clients, Activity (every client's latest workouts in one feed) and Sessions (live sessions to resume, and Start / Log for each client) -- where they manage clients, log workouts for them and run live sessions, behind a "trainer" entitlement; there's no in-app purchase for it yet, so it's switched on by hand during internal testing (`supabase/dev/trainer-access.sql`)

**Settings**

- A root list of six categories, each its own page: Profile & Personal Information, Workout Preferences, Nutrition & Goals, Notifications, Account & Security, Support & About
- One fixed Warm Minimal look: the warm gym photo behind the top of every screen and one amber accent. There are no background themes or colour pickers, so the app always looks as designed
- Notification preferences: push and email opt-in toggles are real and saved; more granular categories (workout reminders, PR alerts, weekly summaries) are shown as explicit "Coming Soon" rows rather than toggles that wouldn't do anything
- Account & Security: Blocked People (each with Unblock), Terms of Service and Privacy Policy (the pages the API serves at `/legal/terms` and `/legal/privacy`), and Delete Account, which asks twice and then deletes the account and everything it owns
- Change Email and the help and contact rows are visible but not yet implemented ("Coming Soon")
- There is no Apple Health (HealthKit) integration, and onboarding doesn't offer one

**Social**

- A one-directional, accept-gated follow graph (Instagram-style follow requests) — send/accept/reject a request, unfollow, search for people by name/username
- A Friends tab on Feed showing accepted followees' own completed workouts and logged foods, reverse-chronological, reusing the same activity-card visual language as your own feed
- A Notifications screen with follow requests and recent follows, plus suggestions from your own data
- Report or block someone: tap a person in Find People, or the "…" on a friend's workout in Feed. A block ends following each other, and keeps them from finding, following or inviting you; reports are kept for review in the Supabase dashboard (`user_reports`)
- No likes, comments, or leaderboards yet

**Backend (NestJS API)**

- JWT authorization validating Supabase-issued tokens on every route except the health check and two endpoints called by machines (the RevenueCat webhook and the reminder job's trigger), which check their own secrets
- Role-based authorization (`user` / `support_admin` / `full_admin`) backed by an `admin_users` table, proven end-to-end by a minimal `GET /api/v1/admin/ping` route
- User profile read/update endpoints (`GET/PATCH /api/v1/users/me`) and username-availability check
- Exercise library and equipment profile endpoints
- Food search, barcode lookup and AI food search, with per-user usage limits; AI food search answers within 30 seconds
- Follows and the Friends feed, trainer clients and live sessions, and group workouts
- Push token registration and a daily reminder job that sends through Expo's push service (see Project Status: nothing triggers it yet)
- RevenueCat webhook handling: signature verification and event processing that projects subscription entitlement into the app's own subscription table (RevenueCat itself remains the source of truth)
- Structured observability/logging via Sentry (mobile and backend)

## Tech Stack

- **Mobile:** React Native 0.86 + Expo SDK 57, TypeScript, React Navigation (native stack)
- **Backend:** NestJS 11 on the Fastify adapter, TypeScript
- **Database:** PostgreSQL via Supabase, version-controlled SQL migrations, Row-Level Security
- **Auth:** Supabase Auth (email/password, plus Google and Apple through a web sign-in flow)
- **Subscriptions:** RevenueCat (authoritative entitlement source; the backend table is a projection/cache)
- **Testing:** Jest (`jest-expo` for mobile, `ts-jest` for the API), React Native Testing Library, Supertest for API e2e tests
- **Tooling:** ESLint (flat config), Prettier, npm workspaces

## Architecture

Progresso is an npm-workspaces monorepo:

- **`apps/mobile`** — the Expo/React Native client. Reads protected by RLS, workout and set writes, nutrition logs and the user's own foods go straight to Supabase (PRs are recomputed by database triggers, whichever path wrote the set); food search, social, trainer and group features, push tokens and admin operations go through the backend API.
- **`apps/api`** — the NestJS backend. Validates the caller's Supabase-issued JWT on every request, resolves their role from `admin_users`, and owns any operation that needs server-side logic or elevated privileges.
- **`supabase`** — version-controlled SQL migrations (the only way the schema changes), seed data, and a local database test suite.
- **`docs`** — product and technical specification.

Authentication is issued by Supabase Auth; the mobile app holds the session, and the API independently verifies each request's JWT rather than trusting the client.

## Project Structure

```
.
├── apps/
│   ├── mobile/              # React Native + Expo + TypeScript
│   │   └── src/
│   │       ├── auth/        # Session/auth context, OAuth
│   │       ├── charts/      # Chart components
│   │       ├── dashboard/   # Weekly progress and recent-workout helpers (from the old Dashboard)
│   │       ├── design/      # Shared design-system components
│   │       ├── exercises/   # Exercise library + muscle-group data
│   │       ├── feed/        # Feed cards and queries
│   │       ├── lib/         # API client, Supabase client, units, Sentry, push
│   │       ├── navigation/  # Navigation types, side menu, bottom nav, deep links
│   │       ├── notifications/ # Insights for the Notifications screen
│   │       ├── nutrition/   # Food library, food log, nutrition goals
│   │       ├── onboarding/  # Guided onboarding flow
│   │       ├── profile/     # Profile loading and cache
│   │       ├── progress/    # Progress tab sections, charts, PR/1RM logic
│   │       ├── screens/     # Screen components
│   │       ├── settings/    # Settings styles and helpers
│   │       ├── sharing/     # Workout share-card generation
│   │       ├── theme/       # Accent colours
│   │       ├── trainer/     # Trainer mode helpers
│   │       └── workouts/    # Splits, live and group workouts, history, calendar, PRs
│   └── api/                 # NestJS + Fastify backend
│       └── src/
│           ├── admin/       # Role-gated admin routes
│           ├── auth/        # JWT verification, roles/guards
│           ├── equipment-profiles/ # Machine/equipment profiles
│           ├── exercises/   # Exercise library endpoints
│           ├── feed/        # Friends feed
│           ├── follows/     # Follow requests and people search
│           ├── foods/       # Food search, barcode lookup, AI food search
│           ├── groups/      # Group workouts
│           ├── health/      # Public health check
│           ├── notifications/ # Push tokens and the daily reminder job
│           ├── nutrition-resolution/ # Matching AI-parsed foods to food data
│           ├── observability/ # Sentry wiring
│           ├── revenuecat/  # Subscription webhook handling
│           ├── supabase/    # Supabase service client
│           ├── trainer/     # Trainer clients and live sessions
│           └── users/       # Profile read/update endpoints
├── supabase/
│   ├── migrations/          # Version-controlled schema changes
│   ├── seed.sql             # Seed data
│   ├── dev/                 # Development-only scripts (e.g. trainer access)
│   └── tests/               # Local database test runner
├── docs/                    # Product/technical spec
└── CLAUDE.md                # Permanent working rules for coding agents
```

## Testing

- **Mobile:** 230 test files in `apps/mobile` (Jest + `jest-expo` + React Native Testing Library), covering screens, components, and business logic (query builders, PR/1RM calculations, progressive-overload logic, calendar/date logic).
- **Backend:** 29 unit-test (`.spec.ts`) files alongside their modules, plus 8 end-to-end suites under `apps/api/test` (auth/authorization, exercises, observability, RevenueCat webhook, user profile and account deletion, blocking and reporting, the legal pages, and a general app smoke test) using Supertest against a mocked Supabase layer.
- **Database:** `npm run db:test` applies every migration to a real, ephemeral, local Postgres instance (via the `embedded-postgres` package — no Docker or live Supabase project required) and runs correctness/security tests against it, including RLS isolation checks.
- Run everything: `npm run test:api` (backend unit tests), `npm run test:e2e --workspace apps/api` (backend end-to-end tests), `npm run test --workspace apps/mobile` (mobile tests), `npm run db:test` (database tests).
- CI (GitHub Actions) runs lint, typecheck, the format check, all of the above and an iOS bundle export on every push and pull request to `main`.

## Getting Started

**Prerequisites:** Node.js ≥ 22 (see `.nvmrc`), npm, a Supabase project (for the mobile app and API to connect to), and the Expo Go app (for running the mobile client on a physical device) or a simulator.

```bash
git clone <this-repository>
cd progresso
npm install
```

Copy the environment templates and fill in your own values (never commit real credentials):

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

- `apps/mobile/.env` needs your Supabase project URL and **anon** key only.
- `apps/api/.env` needs your Supabase project URL and **service role** key (backend-only — never expose this to the client).

## Development

From the repository root:

```bash
npm run dev:mobile     # start the Expo dev server; scan the QR code with Expo Go
npm run dev:api        # start the NestJS API in watch mode
npm run build:api      # production build of the API
npm run typecheck      # typecheck all workspaces
npm run lint           # lint all workspaces
npm run format         # check formatting
```

`apps/mobile` is currently pinned to Expo SDK 57 to match the version shipped by Expo Go; check compatibility before upgrading.

iOS builds run from `apps/mobile`, which holds the project's only `app.json` and `eas.json`:

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
```

Links can open a screen once the user is signed in; a link that arrives before sign-in waits until then. Each opens on top of Feed:

| Link                             | Opens                                                      |
| -------------------------------- | ---------------------------------------------------------- |
| `progresso://feed`               | Feed                                                       |
| `progresso://nutrition`          | Nutrition Today                                            |
| `progresso://workouts/<id>`      | That workout's detail                                      |
| `progresso://workouts/<id>/live` | That workout, live (its detail instead once it's finished) |

On a simulator: `xcrun simctl openurl booted progresso://nutrition`. The sign-in, email-confirmation and password-reset links are handled by the auth flow, not these.

## Deployment

- **API:** the `progresso-api` web service on Render, in Oregon, described by `render.yaml`. Secrets are set in the Render dashboard, never in the file.
- **Database:** a Supabase project in Canada Central. Migrations reach it only by hand, with `npx supabase db push` from the repository root; nothing in CI or Render applies them. `npx supabase migration list` compares what's applied with the files, changing nothing.
- **There is no separate development database yet:** local `.env` files point at the same project as production, so local work and `db push` both touch real data.
- **iOS app:** built with EAS from `apps/mobile` (see Development) and distributed to internal testers through TestFlight.

## Project Status

Progresso is **actively under development**. The core loop — accounts, onboarding, workout splits, live workout logging, workout history, and progress/PR analytics — is implemented and working end to end, along with nutrition logging (food search, barcode scanning and AI food search included), social features, trainer mode, group workouts and an app-wide Settings hub.

Some areas are intentionally incomplete rather than hidden:

- **Notifications**: opt-in preferences are real and saved, and devices register for push. The API's daily reminder job sends through Expo's push service, but nothing triggers it yet (there's no scheduler, and its trigger secret is unset), and iOS delivery also needs an APNs key in EAS. There is no email delivery.
- **Account actions**: Change Email is visible in Settings but marked "Coming Soon." Delete Account works.
- **Backups**: a nightly, encrypted database backup runs in GitHub Actions once its two secrets are set ([docs/BACKUPS.md](docs/BACKUPS.md)).
- **Legal pages**: the Privacy Policy and Terms of Service (`/legal/privacy`, `/legal/terms`; operator and contact in `apps/api/src/legal/legal-details.ts`) are first drafts that need review before external testers.
- **Apple Health**: not offered; there is no HealthKit integration.
- **Admin**: role-based authorization is implemented and tested end to end, but the admin surface itself is a minimal placeholder route, not a full admin dashboard.
- **Subscriptions**: RevenueCat webhook handling exists, but there is no in-app purchase or paywall yet.

Social v1 (a follow graph and a read-only Friends feed) is implemented and real, not a placeholder — see the Social section above. Likes, comments, and leaderboards are not built yet.

## Roadmap

Planned, not yet built:

- Real notification delivery (push/email) behind the existing opt-in preferences
- Account actions: Change Email and account deletion
- A fuller admin dashboard (user management, support tooling, analytics) on top of the existing role/authorization system
- Milestones (a scoped-but-not-yet-designed addition to the Progress section)

## Author

Built and maintained by Harbir Bains.
