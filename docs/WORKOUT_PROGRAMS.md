# Workout Programs: how a program is written

Progresso's workout programs are written by hand. Nothing in a program is generated: every
day, exercise, set count, rep range, rest, alternative and tip comes from its author.

A program has three parts, kept apart so the library can be complete before any program is
written:

- **The library**, [`programLibrary.ts`](../apps/mobile/src/programs/programLibrary.ts): Harbir's
  Workout Split Library as the Split Library tab lists it -- his nine sections in his order, each
  title as he wrote it ("Upper / Lower (Chest Emphasis)"), each pointing at its program and its
  variations in the catalogue, one variation per day count the title names ("3 or 6 Days").
- **The catalogue**, [`programCatalog.ts`](../apps/mobile/src/programs/programCatalog.ts): every
  program and variation and what each one _is_ -- days a week, what it puts first, what it leaves
  out, equipment, style, goals and level. No days' workouts, exercises or sets.
- **The content**, [`programContent.ts`](../apps/mobile/src/programs/programContent.ts): the
  programming itself, keyed by the catalogue's ids -- each variation's days, exercises, sets,
  reps, rest, notes, tips and alternatives, and the program's words (description, benefits,
  guidance).

**Every title shows in the library from the start**, with its days a week, and **opens once one
of its variations has its content in**, with every day's exercises
([`programAssembly.ts`](../apps/mobile/src/programs/programAssembly.ts)). Until then its row has
no chevron and does nothing, and the library says each one opens once its workouts are in. A
program's own pages only ever show its written variations: nothing empty or made up.

Adding or changing a program is an app update (like the ready-made split presets). Everything is
bundled with the app, so it works before sign-up and offline.

## The catalogue

Each parent program has an `id`, a `name`, a `profile` and its `variations`. A variation repeats
nothing from its parent: it says only what's different about it.

| Field | Values | Used for |
| --- | --- | --- |
| `categories` | `traditional`, `upper_lower`, `specialization`, `strength`, `hypertrophy`, `time_efficient`, `athletic` | Grouping. A variation can be in several. |
| `style` | `general` (Traditional), `bodybuilding`, `strength`, `powerbuilding`, `athletic`, `hybrid`, `calisthenics` | The Style filter, and the card's "3 days a week · Bodybuilding". |
| `goals` | Onboarding's six fitness goals | The Goal filter and recommendations. |
| `levels` | `beginner`, `intermediate`, `advanced`; empty for any level | The Experience filter and recommendations. |
| `equipment` | `full_gym` (default), `dumbbells`, `bodyweight`: the least it needs | The Equipment filter and recommendations. |
| `emphasis` | `chest`, `back`, `shoulders`, `arms`, `legs`, `glutes`, `core`; empty for balanced development | The Muscle Focus filter and recommendations. |
| `excludes` | `chest`, `glutes`: no direct work for it | The Training Preferences filter and recommendations. |

A variation has an `id` (unique within its program, never changed once released), its
`daysPerWeek` (the library's day count for it), and optionally a `focus` ("Glute-Focused") and
`default` (the one shown first, at most one per program). A title with several day counts
("3-5 Days") is one variation per count.

Where the list names one split twice -- in two sections, or by two names -- it's one program
here, and the library lists each title where the list does. Chest & Back / Shoulders & Arms /
Legs is the Arnold Split, Upper Body & Glutes is Glutes & Upper Body, the Time-Efficient list's
"Three-Day ..." titles are their splits' own schedules; the full list is at the top of
`programCatalog.ts`.

## Home programs

A program for home has `setting: 'home'` in the catalogue, and its titles go in `HOME_LIBRARY`
(`programLibrary.ts`) as the gym ones go in `PROGRAM_LIBRARY`; the Split Library's Home switch
shows them. Each exercise's equipment is worked out from the built-in exercise -- dumbbells,
barbell, cable machine (or a home gym), home gym for a machine, bands, and a bench, pull-up bar or
dip bars where its name says so -- and an exercise can say it outright instead:

```ts
{ slug: 'db-bench-press', sets: 3, reps: 10, equipment: [['dumbbells', 'adjustable_dumbbells'], ['bench']] },
```

Each inner list is one need, met by any one of its pieces: `bodyweight`, `dumbbells`,
`adjustable_dumbbells`, `barbell`, `bench`, `resistance_bands`, `pull_up_bar`, `cable_machine`,
`home_gym`, `other`. A program's page lists everything its variation needs; someone's home
equipment (asked in onboarding, changed in Settings > Workout Preferences) decides what's
recommended and which exercises are marked as needing something they don't have.

## The library

Each section has an `id`, a `title`, a one-line `blurb`, a glyph and its `entries`; each entry
is the `title` as written, the `program` it is and the `variations` it covers:

```ts
e('Glute-Focused PPL', 'push-pull-legs', 'glute-focused-3-day', 'glute-focused-6-day'),
```

A title's days a week are its variations' (shown as small rings beside it); words in brackets
at the end of a title show as a line of their own in the accent. `libraryProblems`
(`programLibrary.test.ts`) checks every title points at a program and variations the catalogue
has, names one variation per day count, isn't listed twice in a section, and that every
catalogue variation is in some title -- so nothing can be written that no one could find.

## The content

```ts
export const PROGRAM_CONTENT = {
  'push-pull-legs': {
    description: 'A paragraph for the Overview.',
    tags: ['Hypertrophy'],
    benefits: ['A line each'],
    guidance: { progression: ['Paragraphs'], recovery: [], exerciseSelection: [] },
    variations: {
      '3-day': {
        sessionMinutes: { min: 45, max: 60 }, // optional, used in recommendations
        note: 'A line under the schedule', // optional
        days: [
          {
            name: 'Push',
            muscleGroups: ['chest', 'shoulders', 'triceps'],
            exercises: [
              { slug: 'bb-bench-press', sets: 3, reps: { min: 6, max: 8 }, restSeconds: 120 },
            ],
          },
          // ...a day for each training day
        ],
      },
    },
  },
};
```

A variation's days must match its `daysPerWeek`.

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

Any clear form works (a document or a spreadsheet): which program and variation it is, then each
day with each exercise's name (or slug), sets, reps or seconds, rest, note, tips and
alternatives. Exercise names are matched to built-in slugs when it's added.
`programCatalog.test.ts` checks the catalogue and its content before they ship
(`catalogProblems`):

- every id is well made and listed once, and every name is used once;
- content exists only for programs and variations the catalogue has;
- each variation's days match its days a week, and no variation is half written;
- every exercise and alternative is a built-in in use;
- sets are 1 to 20, ranges run low to high, and there's one default.

## Recommendations

Onboarding asks what someone wants to prioritize (up to three areas, or Balanced Development on
its own), where they train, and what they'd rather not train directly. Those answers are saved
to the profile (`users.training_priorities`, `equipment_access`, `training_exclusions`) and can
be changed in Settings > Workout Preferences. Recommendations
([`recommendations.ts`](../apps/mobile/src/programs/recommendations.ts)) also use their goals,
days a week, experience and session length.

Only the catalogue profile and a variation's days are read, never anything about a program that
isn't written down. Frequency, the main goal and the areas put first count most. Some variations
are never recommended:

- one with more days than the person trains, or two fewer;
- one needing equipment they don't have, or written for another level;
- one that puts first an area they'd leave out, or leaves out an area they put first.

Everything can still be browsed.

## Using a program

Use Program makes the chosen variation an ordinary split of the person's own -- named for the
program (with its schedule and focus where it has several), each day's name, muscle groups and
planned exercises with their sets -- and their active split. Their other splits, workouts and
records are untouched, and the split can be changed like any other. In onboarding the choice is
remembered and the split is made with the account.

A split day's plan holds each exercise and its sets; a program's reps, seconds, rest, notes and
tips show on the program's own pages. Carrying a program's rep targets into the split itself
(and the live workout) needs a database change that hasn't been made.
