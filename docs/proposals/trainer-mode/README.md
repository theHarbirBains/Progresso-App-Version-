# Trainer Mode (workouts only) — design proposal

Status: **built for the workouts-only scope; paywall deferred.** Approved by the owner
("ignore paywall for now and go ahead with implementation"). Decisions A–F below were
taken as recommended, unless noted in §11. Section 11 lists what was built and what
is still open.

## 1. What a trainer can do (v1 scope: workouts only)

- Subscribe to a **Trainer** tier (RevenueCat entitlement; see §6).
- **Add a client**: name, email, and body dimensions (height, weight, and any other
  measurements the profile already holds). Clients are not required to have an account
  yet.
- **Manage their own exercise library**: the same library a user has (built-ins, plus
  custom exercises they create, with photos).
- **Log a workout for a client**: the same live-workout experience a user has, targeted
  at a chosen client. Exercises come from the trainer's library, the built-in library,
  or the client's own library.
- **See every client** in one list, and open any client to see their workout history,
  PRs and 1RMs, and progress charts (the existing Progress screens, parameterised by
  client).
- The **client** sees every workout logged for them on their own account, labelled
  "Logged by <trainer name>".

Out of scope for v1: nutrition, programmes or templates for clients, messaging, client
notes, billing UI, trainer analytics, and public trainer profiles.

## 2. Client identity: the central decision

Every workout row is owned by a `user_id` and the PR trigger chain (see CLAUDE.md,
"Architecture Summary") runs on that owner. The simplest way to keep isolation and PR
correctness intact is to make **every client a real auth user from the moment the
trainer adds them**.

**Recommended: "managed clients".**
- Adding a client creates a Supabase auth user with the client's email and no usable
  password. The client profile is marked `claimed = false`.
- The trainer logs workouts for that user as normal. `workouts.user_id` is the client.
- Claiming: the client receives an invite email, sets a password (or signs in with
  Google/Apple using the same email), and `claimed` becomes true. Their history is
  already there.
- If an account with that email already exists, the trainer gets a **link request**
  instead of a new account (see §3).

Alternative (rejected): keep trainer-owned "shadow" clients in a separate table and
migrate them on claim. This would duplicate every workout table and the PR triggers,
and break the rule that user data is isolated by `user_id`.

## 3. Relationship and consent

New table `trainer_clients`:

| column | notes |
|---|---|
| `trainer_id` | auth user with the Trainer entitlement |
| `client_id` | auth user (managed or real) |
| `status` | `pending` / `active` / `ended` |
| `created_at`, `ended_at` | |

- Linking an **existing** account requires the client to accept (`pending` → `active`).
- A **managed** client (created by the trainer, not yet claimed) is `active` immediately,
  because the trainer created the account.
- Either side can end the relationship. Ending it removes the trainer's access to
  everything from that point on; it does not delete any data. The client keeps all
  history, including workouts the trainer logged.

**Open question A:** should a managed client be able to see and edit trainer-logged
data before they claim the account? Recommend: they see nothing until they claim
(no login, no access), which is the natural result of the design above.

## 4. Access rules (enforced in the database)

This is the change that needs the most care. Today every workout table is
`user_id = auth.uid()` only.

Add a helper:

```
is_active_trainer_for(client uuid) returns boolean
  -- true when auth.uid() has an active trainer_clients row for `client`
  -- AND the trainer has an active Trainer entitlement (§6)
```

Then, for `workouts`, `workout_exercises`, `sets`, and the PR projections
(`rep_prs`, `one_rep_maxes`, read-only):

- **select**: `user_id = auth.uid() OR is_active_trainer_for(user_id)`
- **insert / update / soft-delete**: `user_id = auth.uid() OR is_active_trainer_for(user_id)`

Rules that must hold regardless of which client writes:

- The client can always read and edit their own data.
- A trainer can read and write only the clients they have an active link to, with an
  active entitlement.
- PR and 1RM rows stay trigger-maintained and are never written by any client
  (unchanged from today).
- Every row a trainer writes records who wrote it (`logged_by`, §5).

Trainer writes should go through the **NestJS API**, not direct-to-Supabase. CLAUDE.md
puts cross-user, trust-sensitive operations behind the API, and an API endpoint is the
natural place for audit logging and the entitlement check. The RLS policy above stays as
the backstop, so a direct Supabase call still cannot reach another user's data.

**Open question B:** write path. Recommend API endpoints
(`POST /trainer/clients/:clientId/workouts`, etc.), with the RLS policy as backstop.

## 5. Attribution and audit

- Add `logged_by uuid null references auth.users` to `workouts`, `workout_exercises`
  and `sets`. Null means the owner logged it. A trigger sets it to `auth.uid()` on insert
  when the writer is not the owner.
- New append-only table `trainer_actions` (trainer_id, client_id, action, target table,
  target id, created_at). Every trainer write goes here. This is needed to meet the
  auditability rule for non-user writes.
- The client's history shows "Logged by <trainer>" on trainer-logged workouts and sets.
- The client can view the audit list for their own account (who logged what, when).

## 6. Subscription and entitlement

- The **Trainer** tier is a RevenueCat entitlement. RevenueCat remains the source of truth
  (CLAUDE.md, §14 of the master spec); the `subscriptions` table is only the projection.
- `is_active_trainer_for` reads the projection. The projection is updated by the existing
  webhook path, so no new billing code is required for v1.
- **Open question C:** what happens when the trainer's subscription lapses?
  - *Option 1 (recommended):* writes stop immediately; reads stop too, and the trainer sees
    the clients list with a "renew to view" state. Clients' data is untouched.
  - *Option 2:* read-only for a grace period, then stop.
- **Open question D:** client seat limits per tier (e.g. 10 clients on Trainer). Not
  needed for v1 unless you want it at launch.

## 7. Exercise library: the hard part

Problem: a trainer's custom exercise is owned by the trainer (`exercises.created_by`), and
`exercises_select` only shows built-ins and a user's own customs. If the trainer logs
"Cable Fly (Gym B)" for a client, the client can't see that exercise's name or photo.

Options:

- **A. Copy on log (recommended).** When the trainer logs a custom exercise for a client,
  the API ensures the client has their own custom exercise with the same name (the
  existing per-user unique index on `(created_by, lower(name))` makes this a simple
  find-or-create). The workout references the client's copy. The client owns the
  exercise, can rename or re-photo it, and keeps it if the relationship ends. The trainer's
  library stays private.
- **B. Shared visibility.** Extend `exercises_select` to any exercise a linked client has
  been logged against. Less copying, but a client can then see the trainer's private
  library entries, and an exercise rename by the trainer changes the client's history.

Recommendation: A. It matches your point that each gym's machine should be the client's
own, with their own photo, for progressive overload. The client's history then never
depends on the trainer's library.

The trainer's own library is still used for logging: the picker shows the trainer's
customs, the built-ins, and the client's own customs.

## 8. Mobile experience (for later phases)

- A **Clients** entry point for trainers (in the existing tab structure, only shown to
  trainers). List of clients with last-workout date.
- **Add client**: name, email, body dimensions. Creates a managed client or sends a link
  request.
- **Client detail**: history, PRs, 1RMs, progress charts (reusing the Progress screens).
- **Log for client**: the live-workout screen with a `clientId` target. A banner shows
  whose workout it is, so trainers never log to the wrong person. The draft and
  unfinished-workout logic is per client.
- **Client view**: "Logged by <trainer>" labels, and the audit list under Settings.

Feed: trainer-logged workouts should **not** appear in the client's friends feed by
default. **Open question E** asks whether they should.

## 9. Phases

1. **Decisions** (this document): answer A–E.
2. **Data model and access**: migrations for `trainer_clients`, `trainer_actions`,
   `logged_by`, the helper function, and policies. DB tests for every policy, including
   the negative cases (unlinked trainer, ended link, lapsed entitlement, a second trainer,
   a client trying to write to another client).
3. **API**: client management endpoints, trainer write endpoints with audit logging, and
   entitlement checks. Unit and e2e tests.
4. **Mobile**: Clients screen, add client, client detail, log-for-client, client-side
   attribution and audit list.
5. **Launch**: paywall for the Trainer tier (not yet built: CLAUDE.md, Phase 8).

Each phase is a separate reviewable change, per the working process in CLAUDE.md.

## 10. Decisions needed

| # | Question | Recommendation |
|---|---|---|
| A | Can a managed client see anything before they claim? | No (default) |
| B | Trainer writes via API or direct to Supabase? | API, with RLS as backstop |
| C | Lapsed subscription: stop immediately or grace period? | Stop immediately, data untouched |
| D | Client seat limit per tier, at launch? | No (add later) |
| E | Trainer-logged workouts in the client's friends feed? | No |
| F | Trainer custom exercises: copy on log or shared visibility? | Copy on log (§7) |

Once these are decided, phase 2 can start, beginning with the RLS policy tests.

## 11. As built

**Database** (`20261005200000_trainer_mode.sql`, `20261005210000_trainer_client_source.sql`):
`trainer_clients` (pending / active / ended, with `source` managed or linked),
append-only `trainer_actions`, `logged_by` on workouts, workout exercises and sets,
`has_trainer_entitlement` and `is_active_trainer_for` helpers, additive trainer RLS
policies, `find_auth_user_id_by_email` (service role only) and `trainer_log_workout`
(atomic, copy-on-log). 171 database checks pass, including 34 for trainer mode.

**API** (`apps/api/src/trainer`): status, clients, add client, managed-profile edit,
end link (either side), log workout, client requests (accept / decline), my trainers,
activity. 18 unit tests. The friends feed leaves out trainer-logged workouts (decision E).

**Mobile:** Trainer Access (Settings → Trainer Access), Clients, Client detail, and
the add / edit form. Logging for a client reuses the past-workout screen, titled
"Log for <name>", and saves through the API.

**Decisions taken as recommended:**
- A. A managed client is active at once, so the trainer can log for them before they
  claim the account. Until they claim it, they can't see anything.
- B. Trainer writes go through the API, with RLS as the backstop.
- C. A lapsed subscription or ended link stops access at once; the data is kept.
- D. No seat limits.
- E. Trainer-logged workouts are kept out of the friends feed.
- F. A trainer's custom exercise is copied into the client's library when logged for them.

**Still open:**
- **Enumeration (resolved):** adding by username finds an existing account and sends a
  request, which is acceptable because usernames are already public through search. Adding
  by email is always an invite, with the same answer whether or not the address has an
  account. The invite attaches at sign-in, only for a confirmed email, and a new account it
  creates is managed while an existing one stays linked. The email lookup is gone.
- **Visibility:** Trainer Access is in the side menu for everyone (under Social), and
  Clients appears under Training for trainers only, read from trainer status at launch.
- **Paywall:** deferred as requested. Until it exists, a trainer is granted access by a
  `subscriptions` row with `entitlement_id = 'trainer'`, `status = 'active'` and a future
  `current_period_ends_at`.
- **Not built:** a live timer for logging a client's workout (the past-workout form is
  used instead); a per-workout "Logged by" label on the client's own workout detail
  (the activity log shows it); trainers editing or deleting workouts they logged (the RLS
  allows it, but no screen does); birthday and feet-and-inches height in the form.
- **Account deletion:** `trainer_actions` keeps no foreign keys, so audit rows survive
  account deletion but keep the deleted user's id.
- **Copy-on-log photos:** a client's copy of a trainer's exercise keeps the photo URL. The
  equipment-photos bucket is public read, so it displays.
- **Tests not run here:** the API end-to-end specs need a running environment, and the
  mobile app hasn't been run on a device.

## 12. Clients without an account

A trainer can track a client who has no Progresso account yet. Adding one takes only a
name. Their details are optional.

- The API creates a **placeholder** account for the client: an address on a domain that
  cannot receive mail, with no password. Nobody can sign in to it. Every workout the
  trainer logs therefore has an owner from the start, so the isolation and PR rules are
  unchanged.
- The trainer gets a **claim code** (8 characters, no look-alike letters, shown once). Only
  a SHA-256 hash of it is stored. It works once and expires after 30 days. Getting a new
  code replaces the old one at once.
- The client opens Trainer Access, chooses Link Tracked History and enters the code.
  `claim_placeholder_history` then moves, in one transaction: the workouts, the exercises
  (merged by name where the client already has one), the sets, machine photos, PRs
  (rebuilt for the client), the profile details they have not set themselves, and the
  trainer link. The link starts pending, so the client chooses to keep the trainer by
  accepting. The placeholder account is then deleted.
- Claims are refused while both accounts have an open workout, so no session is merged
  under another.
- Attempts are limited to 10 per user per hour. **This limit lives in the API's memory,
  so it resets on restart and is not shared between instances.** It should move to shared
  storage before launch.
- `trainer_placeholder_clients.failed_attempts` is not used yet. It is reserved for a
  per-code lock and should be dropped if that is not added.
