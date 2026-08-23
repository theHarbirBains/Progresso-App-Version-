# Progresso

A fitness and nutrition tracking mobile app — workout logging, progressive overload tracking, strength analytics, and nutrition tracking, presented with a premium, athlete-card-inspired experience.

See [CLAUDE.md](CLAUDE.md) for development rules and [docs/PROGRESSO_MASTER_SPEC.md](docs/PROGRESSO_MASTER_SPEC.md) for the full product/technical spec.

## Status

Currently in **Phase 0 — Foundation**. No application features are implemented yet.

## Repository Structure

```
.
├── apps/               # Application packages (npm workspaces) — added incrementally
│   ├── mobile/         # React Native + Expo + TypeScript (Expo SDK 54)
│   └── api/            # NestJS + Fastify + TypeScript backend
├── supabase/           # Database migrations, seed data, and local DB tests
├── docs/               # Project documentation
├── CLAUDE.md           # Permanent working rules for coding agents
└── tsconfig.base.json  # Shared TypeScript base config for all apps
```

## Tooling

- **Package manager:** npm (workspaces)
- **Node version:** see `.nvmrc`
- **Linting:** ESLint (flat config) — `npm run lint`
- **Formatting:** Prettier — `npm run format`
- **Typecheck:** `npm run typecheck`

## Mobile App

`apps/mobile` is pinned to **Expo SDK 54** — the version currently shipped by the Expo Go app on the App Store / Play Store. Do not upgrade the Expo SDK without first checking which SDK version Expo Go on the stores supports, or the app will fail to load in Expo Go.

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill in your Supabase project URL and **anon** key (never the service-role key — that stays backend-only). The app supports email/password sign in, sign up, and sign out; there's no dashboard yet, just a placeholder shell once signed in.

From the repository root:

```
npm run dev:mobile
```

Then scan the QR code with the Expo Go app on your phone.

## Backend API

`apps/api` is a NestJS + Fastify service. Copy `apps/api/.env.example` to `apps/api/.env` and fill in your Supabase project URL and service role key before starting it.

From the repository root:

```
npm run dev:api      # start in watch mode
npm run build:api    # production build
npm run test:api     # unit tests
```

`GET /health` is public and unversioned. All other routes require a valid Supabase-issued JWT (`Authorization: Bearer <token>`) by default; routes marked `@Roles(...)` additionally require a matching row in `admin_users`. `GET /api/v1/users/me` and `GET /api/v1/admin/ping` are foundation endpoints proving this chain end to end — not product features.

## Tech Stack

- Mobile: React Native + Expo + TypeScript
- Backend: Node.js + TypeScript, NestJS on Fastify
- Database: PostgreSQL via Supabase
- Auth: Supabase Auth
- Storage: Supabase Storage
- Subscriptions: RevenueCat
- Admin dashboard: React (web)
