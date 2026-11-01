import { recordQuietFailure } from '../lib/sentry';
import { widgetShown } from '../testUtils/widgetShown';
import { themeById } from '../theme/appThemes';
import { homeWidgets } from './homeWidgets';
import { themeLook } from './widgetLook';
import { keepWidgetPhotos } from './widgetPhotos';
import { WIDGET_DAYS_AHEAD } from './widgetProps';
import {
  applyWidgetTheme,
  clearWidgets,
  nextWorkoutProps,
  showNextWorkoutWidget,
  showNutritionWidget,
  showStepsWidget,
} from './widgetUpdates';
import { showWorkoutActivity } from './workoutActivity';

const { nextWorkoutWidget, nutritionWidget, stepsWidget, workoutActivity } = homeWidgets();

jest.mock('../lib/sentry', () => ({ recordQuietFailure: jest.fn() }));
jest.mock('./widgetPhotos', () => ({ keepWidgetPhotos: jest.fn().mockResolvedValue({}) }));

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
    expect(entries).toHaveLength(1 + WIDGET_DAYS_AHEAD);
    // In the original look until the theme is applied, and dated.
    expect(entries[0]).toMatchObject({
      date: now,
      props: { calories: '1,240', accent: '#D99A50', day: expect.any(String) },
    });
  });

  it('hands Steps and Next Workout what they show, Next Workout the same each day', async () => {
    await showStepsWidget(8412, new Date(2026, 9, 22, 12));
    expect(widgetShown(stepsWidget)).toMatchObject({ steps: '8,412' });
    await showNextWorkoutWidget(null, PLAN, new Date(2026, 9, 22, 12));
    const [entries] = (nextWorkoutWidget.updateTimeline as jest.Mock).mock.calls[0];
    expect(entries).toHaveLength(1 + WIDGET_DAYS_AHEAD);
    expect(
      entries.every((entry: { props: { title: string } }) => entry.props.title === 'Pull'),
    ).toBe(true);
  });

  it('hands everything over in the order it was asked for', async () => {
    const first = showStepsWidget(1, new Date(2026, 9, 22, 12));
    const second = showStepsWidget(2, new Date(2026, 9, 22, 13));
    await Promise.all([first, second]);
    expect(widgetShown(stepsWidget)).toMatchObject({ steps: '2' });
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

    expect(widgetShown(nutritionWidget)).toMatchObject({
      signedIn: false,
      calories: '',
      macros: [],
    });
    expect(widgetShown(nextWorkoutWidget)).toMatchObject({ signedIn: false, title: '' });
    expect(widgetShown(stepsWidget)).toMatchObject({ signedIn: false, caption: '' });
    expect(card.end).toHaveBeenCalledWith('immediate');
  });
});

describe('the theme', () => {
  const MONDAY = new Date(2026, 10, 2, 9);
  const shown = { signedIn: true, steps: '8,412', caption: 'As of 9:00 AM', day: 'Mon, Nov 2' };

  it("dresses what each widget shows in the theme's accent and photo, keeping each entry", async () => {
    (keepWidgetPhotos as jest.Mock).mockResolvedValueOnce({
      photoSmall: 'file:///group/forest-small.jpg',
      photoMedium: 'file:///group/forest-medium.jpg',
    });
    (stepsWidget.getTimeline as jest.Mock).mockResolvedValueOnce([
      { date: MONDAY, props: { ...shown, accent: '#D99A50' } },
    ]);

    await applyWidgetTheme(themeById('forest'));

    expect(keepWidgetPhotos).toHaveBeenCalledWith('forest');
    expect(stepsWidget.updateTimeline).toHaveBeenCalledWith([
      {
        date: MONDAY,
        props: {
          ...shown,
          accent: '#9DBF7A',
          glow: expect.stringMatching(/^#[0-9A-F]{6}$/),
          photoSmall: 'file:///group/forest-small.jpg',
          photoMedium: 'file:///group/forest-medium.jpg',
        },
      },
    ]);
    // Nothing to redo for a widget with nothing on it.
    expect(nutritionWidget.updateTimeline).not.toHaveBeenCalled();

    // And what's handed over next wears it too.
    await showStepsWidget(9000, MONDAY);
    expect(widgetShown(stepsWidget)).toMatchObject({ accent: '#9DBF7A' });
  });

  it('leaves a widget alone that already wears it', async () => {
    const alpine = themeById('alpine');
    (keepWidgetPhotos as jest.Mock).mockResolvedValueOnce({});
    (stepsWidget.getTimeline as jest.Mock).mockResolvedValueOnce([
      { date: MONDAY, props: { ...shown, ...themeLook(alpine) } },
    ]);

    await applyWidgetTheme(alpine);

    expect(stepsWidget.updateTimeline).not.toHaveBeenCalled();
  });

  it("still wears the theme's accent when its photo can't be kept, and says why", async () => {
    const failure = new Error('No App Group');
    (keepWidgetPhotos as jest.Mock).mockRejectedValueOnce(failure);
    (stepsWidget.getTimeline as jest.Mock).mockResolvedValueOnce([
      { date: MONDAY, props: { ...shown, accent: '#D99A50', photoSmall: 'file:///old.jpg' } },
    ]);

    await applyWidgetTheme(themeById('winter'));

    expect(recordQuietFailure).toHaveBeenCalledWith('widget.photo', failure);
    const dressed = widgetShown(stepsWidget);
    expect(dressed).toMatchObject({ accent: '#A9C4E0' });
    // Not another theme's photo.
    expect(dressed?.photoSmall).toBeUndefined();
  });
});
