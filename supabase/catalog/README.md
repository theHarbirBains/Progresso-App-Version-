# The built-in exercise catalogue

Every built-in exercise Progresso ships, as data: `dumbbell.mjs`, `barbell.mjs` and
`bodyweight.mjs` (the bodyweight and other built-ins that were already in the library). This is
the source of truth -- `npm run db:catalog` (`generate.mjs`) checks it and writes:

- the migration `../migrations/20261128100000_builtin_exercise_library.sql`, and
- the app's `apps/mobile/src/exercises/illustrations/builtinCatalog.generated.ts` (each exercise's
  name, muscle group and the muscles its illustration highlights).

Never edit either by hand. Once that migration is applied to production, a later change to the
catalogue needs a new migration: point `MIGRATION` in `generate.mjs` at a new file name.

## An exercise

| Field                                   |                                                                                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`                                  | Its permanent key (`db-bench-press`): the illustration in `apps/mobile/src/exercises/illustrations/art` is found by it. Never change one.                                                                         |
| `name`                                  | Its one canonical name. Other names it's known by go in `aliases`.                                                                                                                                                |
| `was`                                   | For a built-in that was already in the library under another name: that name. The row is renamed, so its history stays with it, and the old name becomes a search alias.                                          |
| `equipment`                             | `dumbbell`, `barbell`, `bodyweight`, `other`, ...                                                                                                                                                                 |
| `muscle`                                | The one muscle group it's for (`exercises.muscle_group`).                                                                                                                                                         |
| `highlight`                             | The muscles its illustration highlights, `primary` and `secondary`, as regions (`illustrations/muscles.ts`). The muscle groups it also works are worked out from these, so the drawing and the data always agree. |
| `pattern`                               | Its movement pattern (`exercises_movement_pattern_known`).                                                                                                                                                        |
| `measure`                               | `weight_reps` (default), `bodyweight` (reps only) or `timed`.                                                                                                                                                     |
| `sides`                                 | `single_side` or `alternating` for an exercise done one side at a time (logged left and right); left out for both together.                                                                                       |
| `summary`, `setup`, `steps`, `mistakes` | Its guide: one sentence, the starting position, how to do it, and the common mistakes.                                                                                                                            |

A new exercise also needs its poses in `apps/mobile/src/exercises/illustrations/art/` -- the
app's tests fail until every catalogue exercise has an illustration that draws cleanly.
