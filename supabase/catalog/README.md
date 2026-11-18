# The built-in exercise catalogue

Every built-in exercise Progresso ships, as data: `dumbbell.mjs`, `barbell.mjs`, `bodyweight.mjs`
(the bodyweight and other built-ins that were already in the library), `cable.mjs`, `machine.mjs`
(selectorized and plate-loaded), `smith.mjs`, `kettlebell.mjs` and `accessories.mjs` (more
bodyweight work, bands, the suspension trainer, medicine balls, battle ropes, the sled, the trap bar,
specialty bars, plates and the landmine). This is the source of truth -- `npm run db:catalog`
(`generate.mjs`) checks it and writes:

- the migration `../migrations/20261129100000_complete_exercise_library.sql`, and
- the app's `apps/mobile/src/exercises/illustrations/builtinCatalog.generated.ts` (each exercise's
  name, muscle group, the muscles its illustration highlights and what its positions are called).

Never edit either by hand. `20261128100000_builtin_exercise_library.sql` (the dumbbell and barbell
library) is applied to production and never written again. Once the current migration is applied
too, a later change to the catalogue needs a new one: point `MIGRATION` in `generate.mjs` at a new
file name. The migration updates every catalogue row, so applying it twice changes nothing.

**One exercise per setup that changes the movement.** A cable attachment or a machine grip that
changes the grip, the range or the path is its own exercise (a V-handle row and a rope row); a
brand, a seat notch or a slightly different hand spacing is not.

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
| `attachment`, `grip`                    | What's held (the handle or attachment clipped on: V-handle, rope, ...) and how (close neutral, wide overhand, ...), as Create Exercise records a custom one's.                                                    |
| `pulley`                                | Where the cable starts: `high`, `mid`, `low` or `adjustable`.                                                                                                                                                     |
| `load`                                  | How a machine is loaded: `single_stack` (selectorized), `double_stack` or `plate_loaded` (plate-loaded machines and the Smith machine).                                                                           |
| `action`                                | What its illustration's last position is called where its pattern's name doesn't fit ("Push Down" for a pushdown), or every position's.                                                                           |

A new exercise also needs its poses in `apps/mobile/src/exercises/illustrations/art/` -- the
app's tests fail until every catalogue exercise has an illustration that draws cleanly.
