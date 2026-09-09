# Progresso

A full-stack fitness tracking application focused on progressive overload: logging workouts, tracking strength over time, and surfacing personal records with a premium, data-forward user experience.

See [CLAUDE.md](CLAUDE.md) for development rules and [docs/PROGRESSO_MASTER_SPEC.md](docs/PROGRESSO_MASTER_SPEC.md) for the full product/technical spec.

## Overview

Most workout-logging apps either bury progress data in raw tables or estimate it in ways that don't hold up (e.g. estimating a 1-rep max from a 10-rep set). Progresso is built around a stricter, more honest model of strength progress:

- **Top sets** — the heaviest weight completed for an exercise within a single workout.
- **Rep-count PRs** — the heaviest weight ever logged for an exercise at a specific rep count.
- **True 1-Rep Max** — recorded only from an actual logged set of exactly 1 rep, never estimated from higher-rep sets.

A user creates a workout split (or starts from a preset), logs sets during a live workout, and the app derives history, personal records, and strength trends from that logged data — per exercise and per muscle group. Every user's data is isolated at the database level via Postgres Row-Level Security, not just hidden in the UI.

## Current Features

**Accounts & onboarding**
- Email/password sign up and sign in (Supabase Auth), password reset flow
- Signup collects first name, last name, username, and a user-chosen display name (independently — none is derived from another)
- Guided onboarding flow (profile basics, unit preference, permission steps)
- Account settings: edit display name, username, and weight unit (kg/lb)

**Workouts**
- Create, edit, view, duplicate, and delete workout splits, including a set of built-in split presets (e.g. Push/Pull/Legs) that can be copied into an editable, user-owned split
- Live workout tracking: log exercises, sets, reps, and weight against a split in progress, with a running workout timer
- Custom exercises alongside a shared default exercise library, each tagged with a muscle group
- Workout history with a month calendar view and per-day/per-workout detail
- Workout sharing (generates a shareable summary card)

**Progress & analytics**
- A tabbed Progress section (Overview, Strength, PRs, Exercises, Top Sets, 1-Rep Max), mirroring the same category-tab pattern used in Settings
- Per-exercise and lifetime top sets, rep-count PRs, and true 1RM tracking (1RM is only ever recorded from an actual 1-rep set)
- Strength trend charts and progress metrics per exercise
- Muscle-group visualization based on which exercises the user has actually logged

**Nutrition**
- A food library (create/search/edit custom foods) and a food log for tracking daily intake
- Daily nutrition totals against user-set nutrition goals
- No integration with an external food database — all food entries are user-entered

**Settings**
- App-level Settings hub organized into horizontal category tabs: Account, Appearance, App, Notifications, Privacy, Help
- Theme/accent color customization, applied consistently across primary buttons and controls app-wide
- Notification preferences: push and email opt-in toggles are real and persisted; more granular categories (workout reminders, PR alerts, weekly summaries) are shown as explicit "Coming Soon" rows rather than toggles that wouldn't do anything
- Change Password and Delete Account are visible in the UI but not yet implemented ("Coming Soon")
- Apple Health connection is a preference-only placeholder in onboarding — there is no HealthKit integration

**Social**
- A front-end-only Social screen (profile entry point + an honest empty "Recent Activity" state) — no posts, follows, or activity feed backend exists yet

**Backend (NestJS API)**
- JWT authorization middleware validating Supabase-issued tokens on every route except `GET /health`
- Role-based authorization (`user` / `support_admin` / `full_admin`) backed by an `admin_users` table, proven end-to-end by a minimal `GET /api/v1/admin/ping` route
- User profile read/update endpoints (`GET/PATCH /api/v1/users/me`) and username-availability check
- Exercise library endpoints for managing default and custom exercises
- RevenueCat webhook handling: signature verification and event processing that projects subscription entitlement into the app's own subscription table (RevenueCat itself remains the source of truth)
- Structured observability/logging via Sentry (mobile and backend)

## Tech Stack

- **Mobile:** React Native 0.86 + Expo SDK 57, TypeScript, React Navigation (native stack)
- **Backend:** NestJS 11 on the Fastify adapter, TypeScript
- **Database:** PostgreSQL via Supabase, version-controlled SQL migrations, Row-Level Security
- **Auth:** Supabase Auth (email/password)
- **Subscriptions:** RevenueCat (authoritative entitlement source; the backend table is a projection/cache)
- **Testing:** Jest (`jest-expo` for mobile, `ts-jest` for the API), React Native Testing Library, Supertest for API e2e tests
- **Tooling:** ESLint (flat config), Prettier, npm workspaces

## Architecture

Progresso is an npm-workspaces monorepo:

- **`apps/mobile`** — the Expo/React Native client. For simple, RLS-protected reads it talks to Supabase directly; anything with business logic or side effects (writes with derived state, PR recomputation, account actions, RevenueCat events) goes through the backend API instead.
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
│   │       ├── auth/        # Session/auth context
│   │       ├── dashboard/   # Dashboard screen logic
│   │       ├── design/      # Shared design-system components
│   │       ├── exercises/   # Exercise library + muscle-group data
│   │       ├── navigation/  # Navigation stack, side menu, quick actions
│   │       ├── nutrition/   # Food library, food log, nutrition goals
│   │       ├── onboarding/  # Guided onboarding flow
│   │       ├── progress/    # Progress tab sections, charts, PR/1RM logic
│   │       ├── screens/     # Screen components
│   │       ├── settings/    # Settings hub categories
│   │       ├── sharing/     # Workout share-card generation
│   │       └── workouts/    # Splits, live workout, history, calendar, PRs
│   └── api/                 # NestJS + Fastify backend
│       └── src/
│           ├── admin/       # Role-gated admin routes
│           ├── auth/        # JWT verification, roles/guards
│           ├── exercises/   # Exercise library endpoints
│           ├── health/      # Public health check
│           ├── observability/ # Sentry wiring
│           ├── revenuecat/  # Subscription webhook handling
│           ├── supabase/    # Supabase service client
│           └── users/       # Profile read/update endpoints
├── supabase/
│   ├── migrations/          # Version-controlled schema changes
│   ├── seed/                # Seed data
│   └── tests/                # Local database test runner
├── docs/                     # Product/technical spec
└── CLAUDE.md                 # Permanent working rules for coding agents
```

## Testing

- **Mobile:** 127 test files under `apps/mobile/src` (Jest + `jest-expo` + React Native Testing Library), covering screens, components, and business logic (query builders, PR/1RM calculations, progressive-overload logic, calendar/date logic).
- **Backend:** 9 unit-test (`.spec.ts`) files alongside their modules, plus 6 end-to-end suites under `apps/api/test` (auth/authorization, exercises, observability, RevenueCat webhook, user profile, and a general app smoke test) using Supertest against a mocked Supabase layer.
- **Database:** `npm run db:test` applies every migration to a real, ephemeral, local Postgres instance (via the `embedded-postgres` package — no Docker or live Supabase project required) and runs correctness/security tests against it, including RLS isolation checks.
- Run everything: `npm run test:api` (backend unit tests), `npm run test --workspace apps/mobile` (mobile tests), `npm run db:test` (database tests).

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

## Project Status

Progresso is **actively under development**. The core loop — accounts, onboarding, workout splits, live workout logging, workout history, and progress/PR analytics — is implemented and working end to end, along with a functional (if simpler) nutrition-logging feature and an app-wide Settings hub.

Some areas are intentionally incomplete rather than hidden:
- **Notifications**: opt-in preferences are real and saved; actual notification delivery (push or email) is not implemented.
- **Account actions**: Change Password and Delete Account are visible in Settings but marked "Coming Soon."
- **Apple Health**: onboarding shows a connect step, but it's a preference placeholder with no real HealthKit integration.
- **Social**: the Social screen is a front-end-only shell with an honest empty state — no backend, posts, or activity feed exist yet.
- **Admin**: role-based authorization is implemented and tested end to end, but the admin surface itself is a minimal placeholder route, not a full admin dashboard.

## Roadmap

Planned, not yet built:
- Real notification delivery (push/email) behind the existing opt-in preferences
- Account actions: password change and account deletion
- A fuller admin dashboard (user management, support tooling, analytics) on top of the existing role/authorization system
- Milestones (a scoped-but-not-yet-designed addition to the Progress section)

## Author

Built and maintained by Harbir Bains.
