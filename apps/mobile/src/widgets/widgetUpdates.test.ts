import { recordQuietFailure } from '../lib/sentry';
import { nextWorkoutWidget, nutritionWidget, stepsWidget, workoutActivity } from './homeWidgets';
import {
  clearWidgets,
  nextWorkoutProps,
  showNextWorkoutWidget,
  showNutritionWidget,
  showStepsWidget,
} from './widgetUpdates';
import { showWorkoutActivity } from './workoutActivity';

jest.mock('../lib/sentry', () => ({ recordQuietFailure: jest.fn() }));

const TARGETS = { calories: 2000, proteinG: 150, carbsG: 220, fatG: 60 };
const PLAN = {
  splitId: 's1',
  splitName: 'PPL',
  day: { id: 'd2', name: 'Pull', muscleGroups: ['back', 'biceps'] } as never,
  previousDayName: 'Push',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('nextWorkoutProps', () => {
  it('puts a workout that is going first, with Resume', () => {
    expect(
      nextWorkoutProps(
        {
          title: 'Push Day',
          kind: 'Your workout',
          startedAt: '2026-10-22T18:42:00.000Z',
          url: 'progresso://workouts/w1/live',
        },
        PLAN,
      ),
    ).toEqual({
      signedIn: true,
      eyebrow: 'Workout in Progress',
      title: 'Push Day',
      detail: expect.stringMatching(/^Your workout · started \d/),
      action: 'Resume',
      url: 'progresso://workouts/w1/live',
    });
  });

  it("shows the split's next day with its muscles, opening the start of a workout", () => {
    expect(nextWorkoutProps(null, PLAN)).toEqual({
      signedIn: true,
      eyebrow: 'Next Workout',
      title: 'Pull',
      detail: 'Back • Biceps',
      action: 'Start',
      url: 'progresso://workouts/new',
    });
  });

  it('says what comes after the last day when the next one has no muscles', () => {
    const plan = { ...PLAN, day: { id: 'd2', name: 'Pull', muscleGroups: [] } as never };
    expect(nextWorkoutProps(null, plan).detail).toBe('Up next after Push');
    expect(nextWorkoutProps(null, { ...plan, previousDayName: null }).detail).toBe(
      "Let's get started",
    );
  });

  it('says there is no split yet without one', () => {
    expect(nextWorkoutProps(null, null)).toMatchObject({
      title: 'No split yet',
      action: 'Open',
      url: 'progresso://feed',
    });
  });
});

describe('updating the widgets', () => {
  it("hands Today's Nutrition its timeline", async () => {
    const now = new Date(2026, 9, 22, 12);
    await showNutritionWidget({ calories: 760, proteinG: 92, carbsG: 80, fatG: 21 }, TARGETS, now);
    const [entries] = (nutritionWidget.updateTimeline as jest.Mock).mock.calls[0];
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ date: now, props: { calories: '1,240' } });
  });

  it('hands Steps and Next Workout what they show', async () => {
    await showStepsWidget(8412, new Date(2026, 9, 22, 12));
    expect((stepsWidget.updateTimeline as jest.Mock).mock.calls[0][0][0].props.steps).toBe('8,412');
    await showNextWorkoutWidget(null, PLAN);
    expect(nextWorkoutWidget.updateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pull' }),
    );
  });

  it("records a widget that can't be updated, without stopping the app", async () => {
    const failure = new Error('No app group');
    (nutritionWidget.updateTimeline as jest.Mock).mockImplementationOnce(() => {
      throw failure;
    });
    await expect(
      showNutritionWidget({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, TARGETS),
    ).resolves.toBeUndefined();
    expect(recordQuietFailure).toHaveBeenCalledWith('widget.nutrition', failure);
  });

  it("clears every widget and the Lock Screen card on sign-out, leaving no one's figures", async () => {
    await showWorkoutActivity(
      'workout:w1',
      { title: 'Push Day', kind: 'Your workout', startedAt: 0 },
      'progresso://workouts/w1/live',
    );
    const card = (workoutActivity.start as jest.Mock).mock.results[0].value;
    (workoutActivity.getInstances as jest.Mock).mockReturnValueOnce([card]);

    await clearWidgets();

    expect(nutritionWidget.updateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ signedIn: false, calories: '', macros: [] }),
    );
    expect(nextWorkoutWidget.updateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ signedIn: false, title: '' }),
    );
    expect(stepsWidget.updateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ signedIn: false, caption: '' }),
    );
    expect(card.end).toHaveBeenCalledWith('immediate');
  });
});
