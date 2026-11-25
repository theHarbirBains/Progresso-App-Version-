# Workout Programs: how a program is written

Progresso's workout programs are written by hand. Nothing in a program is generated: every
day, exercise, set count, rep range, rest, alternative and tip comes from its author.

A program has two parts, kept apart so the list of programs can be complete before any of them
is written:

- **The catalogue**, [`programCatalog.ts`](../apps/mobile/src/programs/programCatalog.ts): every
  program and variation Progresso offers and what each one _is_ -- days a week, what it puts
  first, what it leaves out, equipment, style, goals and level. No days, exercises or sets.
- **The content**, [`programContent.ts`](../apps/mobile/src/programs/programContent.ts): the
  programming itself, keyed by the catalogue's ids -- each variation's days, exercises, sets,
  reps, rest, notes, tips and alternatives, and the program's words (description, benefits,
  guidance).

**A variation only shows once its content is in**, with every day's exercises
([`programAssembly.ts`](../apps/mobile/src/programs/programAssembly.ts)). A program with no
written variation isn't shown at all. Until the first program is written the browser says
programs are on their way. Nothing empty or made up is ever shown.

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

A variation has an `id` (unique within its program, never changed once released), and
optionally `daysPerWeek` (where the list names it), a `focus` ("Glute-Focused") and `default`
(the one shown first, at most one per program).

Where the list named the same program twice, it's one program here. The Arnold Split's days,
the Bro Split's long name, Upper Body & Glutes and the Time-Efficient list's repeats are all
variations of their parent. The full list of merges is at the top of `programCatalog.ts`.

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

A variation's days must match its `daysPerWeek` where the catalogue names one; where it doesn't,
the days decide.

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
