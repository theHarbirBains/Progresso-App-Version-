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
- A guided onboarding in five named parts (About You, Your Training, Your Plan, Staying in Touch, Your Account -- each question says where it is, "About You · 2 of 6"), opening on "Let's get you started!", every question built from widgets, that ends in creating the account: where you heard about Progresso, your location if you allow it (once, so your country is first in the list -- never sent or kept), country, sex, birthday, weight and height, up to three fitness goals, how confident you are planning and progressing your workouts (which sets your starting rep range: 8–12, or 5–10 for experienced lifters), weekly frequency, workout length, a membership (all three at once, each in a few lines), with Nutrition how active you are (with steps a day and examples) and your daily calorie and macro targets (on one screen), a starting split, how ranks work, email, push and Apple Health steps preferences, and your plan at a glance (tap any answer to change it) — then a first and last name (both required; a profile shows both), a username, email, phone number and password, or Google
- Sign-up is for 13 and up and agrees to the Terms of Service and Privacy Policy (each a tap away); a new account is then welcomed with a profile photo and the friends in its contacts already on Progresso, each skippable. A trainer's code can wait -- Settings > Trainer Code takes it any time
- Allowing notifications during onboarding asks iOS for permission and registers the device for push
- Change Password in Settings, for accounts that sign in with email

**Feed**

- The landing screen: your own completed workouts and logged foods as activity cards, and a Friends tab with the people you follow
- Your next workout in the active split, a card for a workout that's in progress, and a "+" shortcut to Start Workout or Log Food
- The Workouts tab leads with the same Next Workout, started in one tap with that day's plan, or a way to choose a split when there isn't one
- On iPhone, today's steps from Apple Health in a small Daily Steps widget beside the greeting -- with a bar of today against your 7-day average -- opening Progress's Steps tab, where you connect it. Progresso only reads the step count; it stays on your phone and is never sent to Progresso's servers

**Home Screen widgets (iPhone)**

- Today's Nutrition (calories left, and protein, carbs and fat against your targets on the wide size), Next Workout (the next day of your split with Start, or the workout going with Resume) and Today's Steps; add them from the Home Screen's Edit > Add Widget. Each shows the date at the top and wears your app theme -- its photo and colour -- changing when you change it. They show what the app last knew and turn over to a new day at midnight
- While a workout or group workout is going, it's on the Lock Screen and in the Dynamic Island with its name and a running timer, until it's finished or cancelled
- Signing out clears every widget

**Workouts**

- Create, edit, view, duplicate, and delete workout splits -- each day's name and muscle groups (days added in one tap from the presets' days, or blank) and, optionally, its exercises and sets -- including a set of built-in split presets (e.g. Push/Pull/Legs, Arnold Split) that can be copied into an editable, user-owned split
- The Split Library (Workout Splits' Split Library tab, and in onboarding): every split on Harbir's list in its nine sections (Traditional, Upper / Lower Variations, Glute-Focused & Lower-Body, Upper-Body & Preference-Based, Muscle Specialization, Strength, Hypertrophy & Bodybuilding, Time-Efficient, Athletic & Hybrid), each with its days a week, browsed by days a week (2 to 7, or all) and filtered by experience, goal, muscle focus, style, equipment and what's left out, with Recommended for You from what you'd like to prioritize, where you train and what you'd rather not train directly (asked in onboarding, changed in Settings > Workout Preferences); each program's overview, weekly schedule and its variations, every day's workout and every exercise's instructions, alternatives and tips, and guidance -- and Use Program, which makes it a split of your own and your active one. Every title is listed from the start; the programming is written by hand and a title opens once it's in (docs/WORKOUT_PROGRAMS.md)
- Micronutrients: the day's (or the week's average) vitamins, minerals, fibre and fats from the foods logged, each against Health Canada's Dietary Reference Intakes for your age, sex and life stage, with a weekly tracker (each day, how many nutrients reached their target) and a page per nutrient -- the week day by day, what it does, too little and too much, its target and upper limit, its sources -- each topic under a header of its own; a found or scanned food shows its vitamins and minerals for the amount being logged. Amounts from USDA FoodData Central and product labels, a nutrient the data doesn't give shown as unknown, never zero
- Previous exercises in Add Exercise, on a Last Time tab of their own beside All Exercises: what you did the last time you trained each muscle group -- your split day's muscle groups, or every one without a split, the ones in the workout first -- with each exercise's sets and top set, trainer-logged workouts included, one tap to add the very same exercise
- Live workout tracking: log exercises, sets, reps, and weight (or reps alone for a bodyweight exercise, or a time like 45 or 1:30 for a timed one -- or timed with Start, Pause and Resume, right through the app being in the background) against a split in progress, with a running workout timer; each exercise is its own widget -- its photo (tap for full size), its all-time best with the date, last time's top set, and last time's sets in a carousel that moves on by itself and can be swiped -- above today's sets
- Warm-up and drop sets, in the live workout and in Log/Edit Past Workout: tap a set's number to mark it a warm-up (counted toward nothing), or Drop Set to carry on under the set just done at a lighter weight, as many drops as you like -- the first set counts like any other, records included, and its drops add to volume but are never a set of their own, a record or a top set
- Cardio in the same workout, on its own page a swipe (or a tab) from the lifting -- each activity with its figures and what it was last time, and Do It Again for what you did lately -- before, between or after your lifts, or on its own -- picking treadmill, outdoor running, walking, cycling, StairMaster, elliptical, rowing, swimming or anything else from a grid (what you did last first), each asking only what fits it (a time, then its own figures: distance in km, a treadmill's speed as the machine shows it, incline, pace, split, level, floors, steps, stroke rate, laps -- no calories), all typed in. Finish never asks about cardio -- the strength part ends at your last set; a finished workout shows Strength Training, each activity and Total Active Training apart from the session's start-to-finish time, and history, the feed, profiles and the share card show the cardio with it -- one workout, never a separate post. Never a set, a record or volume
- Progressive overload: one rep range for all your workouts (Settings › Workout Preferences). When a set reaches the top of the range, the next time you do that exercise its slide in Last Time's Sets says to go up ("Hit 10! Go up in weight today."); a bodyweight exercise is told to add a rep or try the weighted version. Short of the top, nothing is said. Your rep range shows once at the top of the live workout, where it can be changed; exercises trained outside it -- exceptions, with their own range -- are set from an exercise's menu or Settings › Workout Preferences › Rep Range Exceptions. Suggestions only, never automatic, and they can be turned off
- New sets start empty, with last session shown above them; a set saves as it's typed
- Unilateral exercises are logged per side, left and right
- Group workouts: start a group before the workout begins (Start Workout › Working Out as a Group); each person has their own tab of sets, and anyone in the group can enter them
- Custom exercises alongside a shared default exercise library, each tagged with a muscle group (the legs as Quadriceps, Hamstrings, Adductors, Glutes and Calves), with optional equipment profiles and machine photos
- Create Exercise asks only what fits the equipment (dumbbell, barbell, kettlebell, cable, machine, bodyweight or other): a dumbbell curl is a name, a muscle and an optional photo; a cable exercise documents its gym, grip, attachment / handle, weight type, pulley position (high, mid, low, adjustable) and setup notes; a machine its gym, grip, weight type and setup notes (seat height, backrest, pads -- started with a tap). Grip (how it's held) and attachment (what's held) are separate. Each setup is its own exercise with its own records; changing the setup of an exercise with history asks first and offers to save it as a new exercise, and a second exercise with the very same setup is flagged before it's made
- The Exercise Library searches by name, other names, muscle, equipment, grip, attachment and movement ("v handle row", "hinge barbell"), filters by muscle, equipment and movement (Push, Pull, Squat, Lunge, Hinge, Isolation, Core, Carry & Hold, Conditioning -- each with how many it finds), and opens on Browse by Muscle, a tile for each muscle group
- The Exercise Library's Friends tab picks one friend's exercises from a searchable list of the people you follow
- A built-in library of 396 exercises -- dumbbell, barbell, cable (each attachment its own exercise), selectorized and plate-loaded machines, the Smith machine, kettlebells, bodyweight, bands and more -- every built-in with an illustrated instructor (where it starts and what the movement does, the worked muscles named and highlighted on an anatomy figure) and a guide -- starting position, how to do it, common mistakes, the muscles it also works -- opened from its picture in the library, the live workout's picker and card, and its own page; search by any word or other name, filter by equipment, and filter by primary muscle group
- Workout history with a month calendar view and per-day/per-workout detail; past workouts can be logged and completed ones edited
- Workout sharing: a story-sized (9:16) workout card in deep green and gold -- the workout's name and date, duration, sets, volume and records, each exercise's top set and the cardio -- festive through the holidays, fitting any workout, shared to Instagram, TikTok and other apps through the share sheet or saved to Photos

**Progress & analytics**

- A Progress tab with Overview (the Weekly Summary and 12 weeks of consistency), Top Sets, Cardio and All Time sections -- figures and rows, no line graphs. Cardio is the cardio in your workouts over a week, month, three months or all time, all of it or one activity: sessions, time and distance in km, each activity's share, an activity's averages (pace, speed or split, incline, level, floors, steps, laps -- only what it recorded), its all-time bests and latest sessions, and the last 8 weeks or 6 months as bars by time, distance, sessions or pace. All Time has two tabs: Workouts, and Nutrition -- the average logged day (calories, protein, carbs and fat against the targets) and the days logged, for all time or the last week, month or three months, each day of a range opening its foods
- A Weekly Summary at the top of Overview, for this week or last: workout days against your weekly goal, average calories and protein and the days on target, sets per muscle group against the 4 weeks before, and your main lifts' top sets against their best in the 4 weeks before
- Per-exercise and lifetime top sets, rep-count PRs, and true 1RM tracking (1RM is only ever recorded from an actual 1-rep set), plus most reps and longest time for bodyweight and timed exercises
- Progress metrics per exercise: the latest top set and how far it has come, best performances and its progression journey -- each exercise's own page has Summary, History and How To tabs: its picture across the top, its name, primary and secondary muscles and what it's done with (equipment, grip, attachment, cable, loading, movement), its latest top set and personal records (heaviest weight, true 1 rep max, best set volume, rep PRs); each workout's top set; and for a built-in its guide, also behind an (i)
- Muscle Activity (from Progress's Overview): your muscles on a front and back anatomy figure, each coloured by how you've trained it in the last 7, 30 or 90 days -- recently, frequently, less, or not at all -- worked out from the sets you've logged (an exercise's own muscle group, and separately the muscles a built-in also works), never a recovery estimate. Tap a muscle for its sets, sessions, volume, when it was last trained, how it went week by week and the exercises behind it; the main groups trained least are pointed out
- Muscle-group visualization based on which exercises the user has actually logged

**Nutrition**

- Today's calories and macros against your own targets, set on Nutrition Goals in three steps: calories (tap one of four estimates from your body data, or type your own), macros (recommended protein 0.8 g and fat 0.3 g per lb of body weight, and carbs from the calories left, each shown faded in its field and yours to type over), then Save -- any conflict explained
- A weekly calorie budget (7 times your daily target, Sunday to Saturday, starting over Sunday at 12:00 AM on the phone's clock, its dates shown) on every day of the Nutrition screen, counted through the day shown, so eating less one day leaves more for another; a day with nothing logged is named as missing, never counted as 0 eaten (nor as a cut), with an estimate for the missing days on a tap, labelled and kept apart from what was logged
- Setting a food's amount on Today's Foods to 0 takes it off the day (the food stays in your library)
- Log Food opens your Food Library: your saved meals, your usual foods (the ones you log on the most days) and your most recently logged foods first, ready to re-log at last time's amount, then your own foods (with photos) and recipes
- Saved meals: foods you eat together, logged in one go, each as its own entry; build one in the Food Library or save today's foods as one
- Recipes: a drink or a meal always made the same way -- its ingredients and how many servings it makes -- logged as a single food, with its figures per serving worked out from the ingredients
- Copy Yesterday logs any of yesterday's foods again, exactly as they were logged
- Any day on the Nutrition screen: swipe back through past days or on to tomorrow and beyond to plan ahead, see that day's full breakdown in the same layout, and log, edit or delete foods there; Nutrition History opens any day in full
- Quick Macro Entry logs a name and its calories, protein, carbs and fat as typed, kept in your Food Library only if you tick Save to Food Library
- A food you log from search, a barcode or the catalog is kept in your own Food Library (once -- never a duplicate), so it's there to re-log, edit or remove
- The Food Library is A to Z ignoring case; swipe a food, recipe or saved meal left to delete it (it asks first, and what you've logged keeps its figures)
- Tap a food's photo to see it full screen, and pinch to zoom in
- Search Food covers Progresso's food catalog, USDA FoodData Central's whole foods ("Onions, raw") and Open Food Facts' branded products, ranked together so the plain food comes first; plurals, spelling variants and misspellings find the same food, quick results show at once while branded products are still coming -- a search done before this session comes back instantly, and typing on narrows what's shown -- and nothing found offers AI Food Search or entering the figures yourself. Scan Barcode looks products up in USDA's Branded Foods (manufacturers' label data, once its key is set) and Open Food Facts, using USDA's where it has the product, with Enter Manually when neither has it
- A food's page says where its figures come from (USDA, Open Food Facts, Progresso's built-ins, you), a built-in's serving says what it weighs, and Other Matches, Edit Food and Report a Problem are there for figures that look wrong
- AI Food Search (from the Nutrition dashboard or the Food Library) takes how much (an amount and a unit), what food and, optionally, how it was prepared, turns them into the food's parts and takes their figures from Progresso's catalog, USDA data and Open Food Facts; Claude's own estimate is used only as a labelled last resort. Review & Log lets you check and change the name and figures before setting the amount and logging it, without adding a duplicate to your library. Each user has an hourly and a daily limit
- A food can be logged in servings, in the pieces its serving names (cookies, slices), always in grams or ounces (by its serving's weight, the weight its label states, or -- for a serving with no weight -- one the person gives), or in millilitres when it's a drink; a log keeps the amount as typed and is edited that way, and logging the same food twice within seconds asks first
- Every log keeps the figures it was logged with, even if the food (or recipe) changes later

**Trainer mode**

- Trainers set an active client's rep range and their exceptions (exercises trained outside it) from the client's page -- the same settings the client sees
- Trainers switch between My Workspace and a Trainer Workspace (a switcher at the top of Feed) with its own bottom tabs -- Clients, Activity (every client's latest workouts in one feed) and Sessions (live sessions to resume, and Start / Log for each client) -- where they manage clients, log workouts for them and run live sessions, behind a "trainer" entitlement; there's no in-app purchase for it yet, so it's switched on by hand during internal testing (`supabase/dev/trainer-access.sql`)

**Settings**

- A root list of seven categories, each its own page: Profile & Personal Information, Workout Preferences, Nutrition & Goals, Appearance, Notifications, Account & Security, Support & About
- Appearance: nine curated themes -- Golden Hour Gym (the plain classic), Forest, Alpine, Coast, Spring, Summer, Autumn, Winter and Holiday Gym (deep evergreen with gold sparkles, the default) -- each a plain background colour with a faint design over its top (dots, a grid, waves, contour lines, pinstripes, a flannel check, an ice-crystal lattice or sparkles), its own heading font (Plus Jakarta Sans, Fraunces, Oswald or Nunito) and one accent; never a photo behind a screen (a theme's photo is on the launch screen and the widgets; the share card is its own Holiday Gym green and gold, festive through the holidays). An optional Change with the seasons follows the season where you live. Through the holidays (November 1 to January 6), light snow over the app and a few decorations -- a Santa hat on each page's title, twinkling lights across the top of every screen and along the tab bar, snow on Feed's hero card, candy-cane progress bars and a festive Feed greeting -- with their own switches. Everything else stays the same warm dark, so every theme reads as well as the default; there are no free colour pickers
- Notification preferences: push and email opt-in toggles are real and saved; more granular categories (workout reminders, PR alerts, weekly summaries) are shown as explicit "Coming Soon" rows rather than toggles that wouldn't do anything
- Account & Security: Blocked People (each with Unblock), Terms of Service and Privacy Policy (the pages the API serves at `/legal/terms` and `/legal/privacy`), and Delete Account, which asks twice and then deletes the account and everything it owns
- Feedback & Suggestions (Support & About): send a bug report, feature request, usability issue or general feedback, with an optional screenshot and the app version and platform it came from, then see each one's status as it's looked at. Support and full admins get a Feedback Inbox (Settings › Admin) to filter, search, move each on and keep internal notes, every change recorded
- Change Email and the help and contact rows are visible but not yet implemented ("Coming Soon")
- Apple Health is connected from onboarding or from Progress's Steps tab -- Feed's Daily Steps widget opens it (iPhone only), not from Settings; it's turned off in the Health app

**Social**

- A one-directional, accept-gated follow graph (Instagram-style follow requests) — send/accept/reject a request, unfollow, search for people by name/username
- A Friends tab on Feed showing accepted followees' own completed workouts (never their nutrition), reverse-chronological, reusing the same activity-card visual language as your own feed
- Achievement Points and lifetime ranks (side menu > Training > Achievements, and on every profile): 38 achievements -- 11 single unlocks (First Steps, First PR, Split Creator, Heart Starter, Hybrid Athlete, ...) and 27 with levels, each level harder than the last and worth more AP: workouts, PRs held, total weight, exercises, weeks trained, getting stronger on an exercise, food days and foods (only you see these), friends and likes, cardio (workouts with it, its minutes and the distance covered, in miles or km), and a muscle-group collection -- Pecs Appeal, Back Attack, Boulder Shoulders, Guns Blazin', Tri Hard, Grip of Steel, Quad Squad, Hamstring Hustle, Inner Strength, Glute Force, Calf Crusher and Iron Core -- counting the weight you've lifted on each. No weekly or monthly challenges and nothing in a row: a missed week never costs anything. Awarded automatically by the server from what you've really logged, never twice. Your lifetime AP climbs nine ranks -- Bronze, Silver, Gold, Platinum, Diamond, Vanguard, Titan, Sovereign and Legacy (30,000 AP, about four years for someone training five or six times a week), each in five divisions from V to I. Nothing wears off, but achievements follow what you've logged: delete a workout or fix one logged wrong and any level it no longer reaches is taken back, with its AP (friends and likes stay once earned). A new level shows with an unlock card (old level to new, the AP, the way to the next), a new rank with its own, bigger moment, never during a live workout. The Achievements page shows every achievement at its level with exactly what its next level takes and its AP; Ranks shows every rank and division. Your profile shows your rank (to anyone, unless you hide it in Settings > Account & Security) and what you've earned (to followers)
- Profiles: tap a person anywhere (Find People, a friend's card, a follower list, a comment) for their profile -- photo (tap it to see it full screen), name, @username and how many workouts, bio, lifetime rank, follower and following counts (on your own, your follow requests between them when there are any), the mutual friends you share, Follow / Requested / Following (or Accept and Decline when they asked to follow you) and Share Profile. Once they accept your follow: their workouts, last 30 days, PRs held and total volume, and Stats / Workouts / PRs / Achievements tabs -- their figures, every workout in full (read-only), every exercise they've done with its best set (with its photo, gym and grip, searchable), each opening its top set from every workout and the records they hold on it, and the achievements they've earned. The You tab is your own profile on the same page, exactly as the people who follow you see it -- with what's yours alone added inside its tabs: every record you hold under PRs, and under Stats today's calories and macros, this week and your most-trained muscle groups. Tap your photo there to change it; your bio is set in Settings > Profile & Personal Information
- A profile montage: up to four photos or videos of your own, moving slowly across your profile under its buttons -- videos muted, on a loop. One is enough to show it. Tap it to play it full screen, like a short video. Add, reorder, frame (drag and pinch a photo within its panel) and remove them from Edit Profile > Profile Montage; you and the people whose follow you accepted see it
- Likes and comments on finished workouts: a heart and a comment count on every feed card; the workout page lists who liked it and the comments, with a box to add one. Delete your own comments (or any on your workout); report someone else's
- Find People > Following lists everyone you follow; tap one for their profile
- Find People's Friends tab: Your Friends (everyone who follows you or whom you follow, with Follow on anyone you don't follow back) and Suggested -- everyone in your contacts on Progresso, by email or phone number, those you don't follow yet first (with a way to let Progresso see them all when iPhone shows it only some); addresses and numbers are scrambled on the phone before anything is sent, and nothing is kept. Settings > Account & Security turns off being found by email, or by phone number
- A phone number is part of every account: asked for at sign-up (and once of accounts from before), checked as a real number for your country, never shown to anyone
- Push notifications for follow requests and accepts, likes and comments, each with its own switch in Settings > Notifications > Social (iOS delivery needs an APNs key in EAS)
- A Notifications screen with follow requests and recent follows, likes and comments on your workouts, plus suggestions from your own data
- Report or block someone: from their profile's "…", the "…" on a friend's workout in Feed, or a comment's "…". A block ends following each other, and keeps them from finding, following or inviting you; reports are kept for review in the Supabase dashboard (`user_reports`)
- No likes, comments, or leaderboards yet

**Backend (NestJS API)**

- JWT authorization validating Supabase-issued tokens on every route except the health check and two endpoints called by machines (the RevenueCat webhook and the reminder job's trigger), which check their own secrets
- Role-based authorization (`user` / `support_admin` / `full_admin`) backed by an `admin_users` table, proven end-to-end by a minimal `GET /api/v1/admin/ping` route
- Feedback: `POST /api/v1/feedback` (rate-limited; a screenshot only from the sender's own folder) and the support and full admins' inbox under `/api/v1/admin/feedback` (list with filters, search and pages; one with its history, notes and a short-lived screenshot link; status changes and internal notes, each recorded in `admin_actions`)
- User profile read/update endpoints (`GET/PATCH /api/v1/users/me`) and username-availability check
- Exercise library and equipment profile endpoints
- Food search, barcode lookup and AI food search, with per-user usage limits; AI food search answers within 30 seconds
- Follows and the Friends feed, trainer clients and live sessions, and group workouts
- Push token registration and a daily reminder job that sends through Expo's push service (see Project Status: nothing triggers it yet)
- RevenueCat webhook handling: signature verification and event processing that projects subscription entitlement into the app's own subscription table (RevenueCat itself remains the source of truth)
- Structured observability/logging via Sentry (mobile and backend)

## Tech Stack

- **Mobile:** React Native 0.88 + Expo SDK 58, TypeScript, React Navigation (native stack)
- **Backend:** NestJS 11 on the Fastify adapter, TypeScript
- **Database:** PostgreSQL via Supabase, version-controlled SQL migrations, Row-Level Security
- **Auth:** Supabase Auth (email/password, plus Google and Apple through a web sign-in flow)
- **Subscriptions:** RevenueCat (authoritative entitlement source; the backend table is a projection/cache)
- **Testing:** Jest (`jest-expo` for mobile, `ts-jest` for the API), React Native Testing Library, Supertest for API e2e tests
- **Tooling:** ESLint (flat config), Prettier, npm workspaces

## Architecture

Progresso is an npm-workspaces monorepo:

- **`apps/mobile`** — the Expo/React Native client. Reads protected by RLS, workout and set writes, nutrition logs and the user's own foods, saved meals and recipes go straight to Supabase (PRs are recomputed by database triggers, whichever path wrote the set); food search, social, trainer and group features, push tokens and admin operations go through the backend API.
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

`apps/mobile` is on Expo SDK 58, the version the current Expo Go runs; check compatibility before upgrading. Expo Go previews everything but the Home Screen widgets and Apple Health, which need a real build.

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
- **Apple Health**: iPhone only, and it reads today's step count only -- nothing else is read and nothing is written.
- **Widgets**: iPhone only; they need a new EAS build (they're a separate widget extension) and haven't been checked on a device yet.
- **Admin**: role-based authorization is implemented and tested end to end, but the admin surface itself is a minimal placeholder route, not a full admin dashboard.
- **Subscriptions**: RevenueCat webhook handling exists, but there is no in-app purchase or paywall yet.

Social (a follow graph, the Friends feed, profiles, likes, comments, finding friends from contacts and social push) is implemented and real, not a placeholder — see the Social section above. Leaderboards are not built.

## Roadmap

Planned, not yet built:

- Real notification delivery (push/email) behind the existing opt-in preferences
- Account actions: Change Email and account deletion
- A fuller admin dashboard (user management, support tooling, analytics) on top of the existing role/authorization system
- Milestones (a scoped-but-not-yet-designed addition to the Progress section)

## Author

Built and maintained by Harbir Bains.
