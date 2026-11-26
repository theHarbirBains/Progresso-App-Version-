# Exercise Demonstration Videos

Status (2026-11-26): **built, mapped, switched off.** The video player, the exercise page's slot
for it and the mapping to the Free Exercise DB with Videos repository are in the app; no video
provider is on (`EXERCISE_VIDEO_PROVIDER` is null in
`apps/mobile/src/exercises/videos/exerciseVideoSource.ts`), so every exercise page looks exactly as
it did. Nothing in the database changed.

## Licensing (blocks going live)

Source audited: github.com/harshvishu/free-exercise-db-with-videos (created 2026-07-02).

- `LICENSE` is MIT, copyright "Arham Wani". The README says the MIT licence covers **"code and
  exercise metadata"** only.
- Of the videos the README says only: "Demo videos are from an animated exercise video set,
  redistributed here with the maintainer's rights." No licence, source or terms are given for
  them. The MIT licence does not cover them.
- The README's own links point to `amiinwani/free-exercise-db-with-videos`; the repository audited
  is under another account, so it looks like a re-upload.
- The videos are not in the repository; they're served from a third party's Cloudflare R2 bucket.
  The README calls its hosted copy "for testing and evaluation" and tells production users to
  download and re-host the videos.

So the videos' commercial use is **unverified**. They are flagged, not approved: no provider is
switched on, nothing is downloaded or hosted, and the app never loads them. To go live, one of:

1. Written permission from the videos' rights holder (via the maintainer) for commercial use and
   re-hosting; then copy them to Progresso's own storage and switch on
   `repositoryLayoutProvider('…', '<Progresso storage URL>')`.
2. A licensed provider (paid; needs Harbir's approval), mapped through the same provider slot.
3. Leave them off.

## Mapping (Harbir's rules)

Only an **exact name** match counts (case and spacing aside). A video attaches to the existing
built-in by its slug, so its id, its history, its records and every workout that used it are
untouched: nothing is merged, renamed, removed or moved. Where the repository has a male and a
female demonstration, the male one is used; where it has only one, that one. The take is never
shown in the app.

`tools/exercise-videos/map.mjs <repo data/exercises.json>` writes
`apps/mobile/src/exercises/videos/exerciseVideos.generated.ts` and
`tools/exercise-videos/audit.generated.json`.

| | Count |
|---|---|
| Repository exercises | 317 (276 with both takes, 14 male only, 27 female only) |
| Exact name matches | 29 repository entries → **28 Progresso built-ins** (Sit-Up is listed twice) |
| Takes used | 27 male, 1 female (Glute Bridge: female only) |
| Retired built-in among them | Burpee (keeps its page for history) |
| Match only one of Progresso's other names | 12 — not linked (your call) |
| Differ only by punctuation | 3 — not linked (your call) |
| No match | 273 — not imported |

All 28 agree on equipment (the repository sometimes credits a different target muscle; Progresso's
own grouping stays). The videos themselves haven't been watched: each needs a look once they can be
played, to confirm grip and movement.

**Not linked — another of Progresso's names** (same movement, different name; linking them needs
your say-so): Band Triceps Pushdown → Resistance Band Triceps Pushdown; Barbell Front Squat → Front
Squat; Bench Dips → Bench Dip; Cable Lateral Raise → Single-Arm Cable Lateral Raise; Decline
Dumbbell Fly → Decline Dumbbell Chest Fly; Donkey Calf Raise → Dumbbell Donkey Calf Raise; Dumbbell
Fly → Dumbbell Chest Fly; Dumbbell Lunge → Dumbbell Forward Lunge; Front Plank → Plank; Landmine 180
→ Barbell Landmine Rotation; Military Press → Barbell Overhead Press; Squat (ambiguous: Barbell
Back Squat or Bodyweight Squat).

**Not linked — punctuation only**: Band Assisted Pull-up / Band-Assisted Pull-Up; Dumbbell Single
Leg Squat / Dumbbell Single-Leg Squat; Dumbbell Stiff Leg Deadlift / Dumbbell Stiff-Leg Deadlift.

**Not imported — no match (273)**: body weight 99, dumbbell 48, leverage machine 36, cable 27,
band 23, barbell 14, stability ball 9, weighted 6, Smith machine 4, EZ bar 3, rope 2, sled 2.
Adding them would make them built-ins without Progresso's guides, renders or setup details, and
some are Progresso exercises under other names; each would need checking against the library
first. Not done.

**Grip, handle and attachment variations**: none of Progresso's cable-attachment or machine-grip
variations (the seated cable rows, lat pulldowns, pushdowns, cable curls) has an exact match, so
all keep no video, and no video is shared between two variations.

**Workout history**: no migration is needed for the 28 — the video hangs off the built-in's own id.
Custom exercises with a built-in's exact name were already moved onto the built-in by
`20261204100000_custom_exercises_to_builtins.sql`.

## In the app

- `exercises/videos/ExerciseVideo.tsx`: the one player every demonstration uses — muted, plays once
  by itself (never under Reduce Motion), a small round Play / Pause / Replay control in a corner
  and a tap on the video doing the same, poster and spinner while loading, "This video couldn't
  load." with Try Again, paused in the background, one player per video, cached by expo-video.
- `exercises/videos/exerciseVideoSource.ts`: the provider slot (`EXERCISE_VIDEO_PROVIDER`), and
  `repositoryLayoutProvider` for copies hosted in the repository's layout.
- The exercise page's Summary shows the video in the picture's place where one exists; the name,
  muscles and setup stay under it.
