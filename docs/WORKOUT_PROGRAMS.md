# Workout Programs: how a program is written

Progresso's workout programs are written by hand and live in the app's catalogue,
[`apps/mobile/src/programs/programCatalog.ts`](../apps/mobile/src/programs/programCatalog.ts).
Nothing in a program is generated: every day, exercise, set count, rep range, rest,
alternative and tip comes from its author. The catalogue ships empty until the first programs
are written; the library says they're on their way until then.

Adding or changing a program is an app update (like the ready-made split presets): the catalogue
is bundled with the app, so it works before sign-up and offline.

## What a program has

| Field | Example | Shown where |
| --- | --- | --- |
| `id` | `push-pull-legs` | Never shown. Lowercase words joined by `-`, unique, never changed once released. |
| `name` | `Push, Pull, Legs` | Everywhere. |
| `style` | `Balanced` | After the days in lists: "3 or 6 days · Balanced". |
| `description` | A paragraph | Overview. |
| `levels` | `beginner`, `intermediate`, `advanced` | Experience filter; "Beginner to Advanced". |
| `goals` | `build_muscle`, `get_stronger`, `lose_fat`, `improve_athletic_performance`, `improve_fitness`, `maintain_fitness` | Goal filter (onboarding's six goals). |
| `focuses` | `full_body`, `upper_body`, `lower_body`, `glutes`, `arms`, `core` | Focus filter. |
| `tags` (optional) | `Hypertrophy`, `Strength` | Pills under the name. |
| `badge` (optional) | `Popular` | A pill over the name. |
| `benefits` (optional) | A line each | "Why Choose This Split?" |
| `guidance` (optional) | Paragraphs for `progression`, `recovery`, `exerciseSelection` | The Guidance tab's topics (Progression, Volume & Recovery, Exercise Selection), above "In Progresso". |
| `variations` | At least one | Schedule, Workouts, Variations. |

### Variations

Each variation is one way of running the program, written out in full:

| Field | Example | Notes |
| --- | --- | --- |
| `id` | `3-day-balanced` | Unique within the program. |
| `schedule` | `3-Day` | The Schedule tab switches between schedules. |
| `scheduleNote` (optional) | `Standard`, `High Volume` | Shown after the schedule. |
| `focus` (optional) | `Balanced`, `Hypertrophy Focus` | Only where one schedule has several variations. |
| `focusNote` (optional) | `Higher volume, moderate reps (8–15)` | Program Variations. |
| `default` (optional) | `true` | The one shown first on its schedule (at most one per schedule). |
| `note` (optional) | A line | Under the schedule's days. |
| `days` | In order | Each day below. |

### Days and exercises

A day has a `name` ("Push"), its `muscleGroups` (from `chest`, `back`, `shoulders`, `biceps`,
`triceps`, `forearms`, `abs`, `quads`, `hamstrings`, `adductors`, `glutes`, `calves`) and its
`exercises`, in order. Each exercise:

| Field | Example | Notes |
| --- | --- | --- |
| `slug` | `bb-bench-press` | A built-in exercise in use (its slug in the built-in library). |
| `sets` | `3` | 1 to 20. |
| `reps` (optional) | `8` or `{ min: 6, max: 8 }` | For exercises done in reps. |
| `seconds` (optional) | `30` or `{ min: 30, max: 45 }` | For timed exercises (holds, carries). Not with `reps`. |
| `restSeconds` (optional) | `120` | "Rest 2 min". |
| `note` (optional) | `Last set to failure` | Under the exercise. |
| `tips` (optional) | A line each | The exercise's Tips tab, before its Key Tips. |
| `alternatives` (optional) | Slugs | The exercise's Alternatives tab, in order. |

Everything else an exercise page shows -- its name, phases, setup and movement steps, Key Tips
and the muscles it works -- comes from the built-in library.

## Sending a program

Any clear form works (a document or a spreadsheet): the program's details, then each variation's
days with each exercise's name (or slug), sets, reps or seconds, rest, note, tips and
alternatives. Exercise names are matched to built-in slugs when it's added, and
`programCatalog.test.ts` checks every program before it ships -- every exercise and alternative
a built-in in use, sets 1 to 20, ranges written low to high, one default per schedule.

## Using a program

Use Program makes the chosen variation an ordinary split of the person's own -- named for the
program (with its schedule and focus where it has several), each day's name, muscle groups and
planned exercises with their sets -- and their active split. Their other splits, workouts and
records are untouched, and the split can be changed like any other. In onboarding the choice is
remembered and the split is made with the account.

A split day's plan holds each exercise and its sets; a program's reps, seconds, rest, notes and
tips show on the program's own pages. Carrying a program's rep targets into the split itself
(and the live workout) needs a database change that hasn't been made.
