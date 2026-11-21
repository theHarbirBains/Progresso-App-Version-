import type { MeasurementType } from '../exercises/movementTypes';
import type { MuscleGroup } from '../exercises/muscleGroups';
import {
  muscleGroupList,
  planPreviousExercises,
  previousByMuscleGroup,
  type PreviousExerciseRow,
} from './previousExercises';
import type { SetRecord } from './workoutQueries';

const ME = 'me';
const TRAINER = 'coach';

/** November 2026, local time: a day and an hour. */
const at = (day: number, hour = 9) => new Date(2026, 10, day, hour).toISOString();

let nextId = 0;
const set = (
  setIndex: number,
  weightKg: number | null,
  reps: number | null,
  extra: Partial<SetRecord> = {},
): SetRecord => ({
  id: `s${++nextId}`,
  setIndex,
  weightKg,
  reps,
  completedAt: at(1),
  side: null,
  ...extra,
});

function done(
  exerciseId: string,
  muscleGroup: MuscleGroup,
  performedAt: string,
  extra: Partial<PreviousExerciseRow> = {},
): PreviousExerciseRow {
  return {
    muscleGroup,
    workoutId: `w-${performedAt}`,
    performedAt,
    loggedBy: null,
    workoutExerciseId: `we-${++nextId}`,
    exerciseId,
    orderIndex: 1,
    measurementType: 'weight_reps' as MeasurementType,
    sets: [set(1, 60, 10), set(2, 80, 8), set(3, 70, 8)],
    ...extra,
  };
}

const ids = (rows: { exercises: { exerciseId: string }[] }) =>
  rows.exercises.map((e) => e.exerciseId);

describe('previousByMuscleGroup -- the last time each muscle group was trained', () => {
  it("is the latest day's exercises for it, in the order they were done, newest group first", () => {
    const groups = previousByMuscleGroup(
      [
        done('incline', 'chest', at(18), { orderIndex: 2 }),
        done('bench', 'chest', at(18), { orderIndex: 1 }),
        done('old-fly', 'chest', at(11)),
        done('pulldown', 'back', at(16)),
      ],
      ME,
    );
    expect(groups.map((g) => g.muscleGroup)).toEqual(['chest', 'back']);
    expect(ids(groups[0])).toEqual(['bench', 'incline']);
    expect(groups[0].lastTrainedAt).toBe(at(18));
  });

  it('takes in every workout of that day -- a morning and an evening session are one', () => {
    const [chest] = previousByMuscleGroup(
      [
        done('fly', 'chest', at(18, 18)),
        done('bench', 'chest', at(18, 7)),
        done('dips', 'chest', at(17, 18)),
      ],
      ME,
    );
    expect(ids(chest)).toEqual(['bench', 'fly']);
    expect(chest.lastTrainedAt).toBe(at(18, 18));
  });

  it('keeps every variation apart by its own id, and lists one done twice that day once', () => {
    const [back] = previousByMuscleGroup(
      [
        done('pulldown-wide', 'back', at(16, 7), { orderIndex: 1 }),
        done('pulldown-neutral', 'back', at(16, 7), { orderIndex: 2 }),
        done('my-row-fit4less', 'back', at(16, 7), { orderIndex: 3 }),
        done('pulldown-wide', 'back', at(16, 18), { sets: [set(1, 50, 12)] }),
      ],
      ME,
    );
    expect(ids(back)).toEqual(['pulldown-wide', 'pulldown-neutral', 'my-row-fit4less']);
    // Where it was first done, as it was done last.
    expect(back.exercises[0].best?.weightKg).toBe(50);
  });

  it('shows the Top Set and the working sets, a two-sided set counting once', () => {
    const [legs] = previousByMuscleGroup(
      [
        done('split-squat', 'quadriceps', at(12), {
          sets: [
            set(1, 20, 10, { side: 'left' }),
            set(1, 20, 10, { side: 'right' }),
            set(2, 24, 8, { side: 'left' }),
            set(2, 24, 8, { side: 'right' }),
          ],
        }),
      ],
      ME,
    );
    expect(legs.exercises[0]).toMatchObject({ setCount: 2, best: { weightKg: 24, reps: 8 } });

    const [bench] = previousByMuscleGroup([done('bench', 'chest', at(12))], ME)[0].exercises;
    expect(bench).toMatchObject({ setCount: 3, best: { weightKg: 80, reps: 8 } });
  });

  it('gives a bodyweight exercise its most reps and a timed one its longest', () => {
    const [core] = previousByMuscleGroup(
      [
        done('plank', 'core', at(12), {
          measurementType: 'timed',
          sets: [
            set(1, null, null, { durationSeconds: 60 }),
            set(2, null, null, { durationSeconds: 90 }),
          ],
        }),
        done('hanging-raise', 'core', at(12), {
          orderIndex: 2,
          measurementType: 'bodyweight',
          sets: [set(1, null, 12), set(2, null, 15)],
        }),
      ],
      ME,
    );
    expect(core.exercises.map((e) => e.best?.durationSeconds ?? e.best?.reps)).toEqual([90, 15]);
  });

  it("marks what the person's trainer logged for them -- it's their own history all the same", () => {
    const [chest] = previousByMuscleGroup(
      [
        done('bench', 'chest', at(10), { loggedBy: TRAINER }),
        done('fly', 'chest', at(10), { orderIndex: 2, loggedBy: ME }),
      ],
      ME,
    );
    expect(chest.exercises.map((e) => [e.exerciseId, e.byTrainer])).toEqual([
      ['bench', true],
      ['fly', false],
    ]);
  });

  it('is nothing at all before the first workout', () => {
    expect(previousByMuscleGroup([], ME)).toEqual([]);
  });
});

describe('planPreviousExercises -- what Add Exercise shows', () => {
  const history = previousByMuscleGroup(
    [
      done('bench', 'chest', at(18)),
      done('pushdown', 'triceps', at(18), { orderIndex: 2 }),
      done('pulldown', 'back', at(16)),
      done('curl', 'biceps', at(14)),
      done('squat', 'quadriceps', at(12)),
      done('raise', 'shoulders', at(10)),
    ],
    ME,
  );

  it("on a Chest & Triceps day, the day's own muscle groups and nothing unrelated", () => {
    const plan = planPreviousExercises(history, {
      dayGroups: ['chest', 'triceps'],
      addedGroups: [],
    });
    expect(plan.title).toBe('Last Time You Trained — Chest & Triceps');
    expect(plan.sections.map((s) => s.muscleGroup)).toEqual(['chest', 'triceps']);
    expect(plan.initialCount).toBe(2);
  });

  it("on a Back & Biceps day, each muscle group's own last time, wherever it was", () => {
    const plan = planPreviousExercises(history, { dayGroups: ['back', 'biceps'], addedGroups: [] });
    expect(plan.sections.map((s) => [s.muscleGroup, s.lastTrainedAt, ids(s)])).toEqual([
      ['back', at(16), ['pulldown']],
      ['biceps', at(14), ['curl']],
    ]);
  });

  it('gives a day muscle group with no history yet its own empty section', () => {
    const plan = planPreviousExercises(history, {
      dayGroups: ['chest', 'calves'],
      addedGroups: [],
    });
    expect(plan.sections[1]).toEqual({ muscleGroup: 'calves', lastTrainedAt: null, exercises: [] });
  });

  it('on a split day, also takes in another muscle group already being trained', () => {
    const plan = planPreviousExercises(history, {
      dayGroups: ['chest', 'triceps'],
      addedGroups: ['chest', 'shoulders'],
    });
    expect(plan.sections.map((s) => s.muscleGroup)).toEqual(['chest', 'triceps', 'shoulders']);
  });

  it('without a split, every muscle group by when it was last trained, the first few shown', () => {
    const plan = planPreviousExercises(history, { dayGroups: [], addedGroups: [] });
    expect(plan.mode).toBe('open');
    expect(plan.title).toBe('Your Previous Exercises');
    expect(plan.sections.map((s) => s.muscleGroup)).toEqual([
      'chest',
      'triceps',
      'back',
      'biceps',
      'quadriceps',
      'shoulders',
    ]);
    expect(plan.initialCount).toBe(3);
  });

  it('without a split, puts the muscle groups already added first -- every one of them', () => {
    const plan = planPreviousExercises(history, {
      dayGroups: [],
      addedGroups: ['shoulders', 'quadriceps', 'biceps', 'back', 'shoulders'],
    });
    expect(plan.sections.map((s) => s.muscleGroup).slice(0, 4)).toEqual([
      'shoulders',
      'quadriceps',
      'biceps',
      'back',
    ]);
    expect(plan.initialCount).toBe(4);
  });

  it('without a split, a muscle group added with no history yet adds no empty section', () => {
    const plan = planPreviousExercises(history, { dayGroups: [], addedGroups: ['calves'] });
    expect(plan.sections.some((s) => s.muscleGroup === 'calves')).toBe(false);
  });

  it('is empty before the first workout', () => {
    expect(planPreviousExercises([], { dayGroups: [], addedGroups: [] }).sections).toEqual([]);
  });

  it('names the muscle groups the way a person would say them', () => {
    expect(muscleGroupList(['chest'])).toBe('Chest');
    expect(muscleGroupList(['chest', 'shoulders', 'triceps'])).toBe('Chest, Shoulders & Triceps');
  });
});
