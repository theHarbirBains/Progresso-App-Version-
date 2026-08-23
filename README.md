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
│   └── backend/        # NestJS + Fastify + TypeScript (not yet created)
├── supabase/           # Database migrations and config (not yet created)
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

From the repository root:

```
npm run dev:mobile
```

Then scan the QR code with the Expo Go app on your phone.

## Tech Stack

- Mobile: React Native + Expo + TypeScript
- Backend: Node.js + TypeScript, NestJS on Fastify
- Database: PostgreSQL via Supabase
- Auth: Supabase Auth
- Storage: Supabase Storage
- Subscriptions: RevenueCat
- Admin dashboard: React (web)
