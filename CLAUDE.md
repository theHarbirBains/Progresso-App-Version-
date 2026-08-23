# CLAUDE.md — Progresso Development Rules

This file contains the **permanent** working rules for any coding agent (Claude Code or otherwise) operating in this repository. Product/domain detail lives in [docs/PROGRESSO_MASTER_SPEC.md](docs/PROGRESSO_MASTER_SPEC.md) — read both before doing substantial work.

## Current Phase

**Phase 0 — Foundation.** Do not implement full workout logging, nutrition logging, the final dashboard, social features, or AI features until their respective phases are reached and explicitly approved. See the roadmap in the master spec.

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
- **Backend pattern:** Hybrid — simple RLS-protected reads may go direct to Supabase; anything with business logic or side effects (set writes, PR recomputation, workout delete/restore, nutrition snapshots, admin ops, RevenueCat webhooks, account export/deletion) goes through the NestJS API.

## Key Domain Concepts (do not conflate these)

- **Top set:** heaviest weight completed for an exercise within one specific workout.
- **Rep-count PR:** heaviest weight ever logged for an exercise at a specific rep count.
- **True 1RM:** only ever comes from a logged set of exactly 1 rep. Never estimated from higher-rep sets. Lives in a dedicated "Maxes" section.

Weights are stored canonically in kilograms; lb/kg is a display/input preference only.

PR correctness must be maintained across set create/edit/soft-delete/restore and workout delete/restore/date-change. No stale PR records.

Nutrition logs must snapshot the nutrition data at the time of logging — later edits to a food database entry must not retroactively change historical logs.

## Permission Levels

- **Regular user:** own data only.
- **Support admin:** restricted administrative/support capabilities.
- **Full admin:** exercise library management, user management, support ops, analytics, subscription/billing visibility.

All administrative actions must be auditable.
