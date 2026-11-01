import {
  dailyTimeline,
  dayLabel,
  nextMidnight,
  nutritionTimeline,
  nutritionWidgetProps,
  plistSafe,
  plistSafeTimeline,
  SIGNED_OUT_NEXT_WORKOUT,
  SIGNED_OUT_NUTRITION,
  SIGNED_OUT_STEPS,
  stepsTimeline,
  wearsLook,
  WIDGET_DAYS_AHEAD,
  withLook,
} from './widgetProps';
import { nextWorkoutProps } from './widgetUpdates';

const TARGETS = { calories: 2000, proteinG: 150, carbsG: 220, fatG: 60 };
const NO_TARGETS = { calories: null, proteinG: null, carbsG: null, fatG: null };

/** Where a value iOS's UserDefaults can't hold sits, if anywhere: a null, undefined or non-finite number. */
function unsafeAt(value: unknown, path = 'props'): string | null {
  if (value === null || value === undefined) return path;
  if (typeof value === 'number') return Number.isFinite(value) ? null : path;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = unsafeAt(item, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const found = unsafeAt(item, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

describe('nutritionWidgetProps', () => {
  it('gives the calories left, and each macro against its target', () => {
    expect(
      nutritionWidgetProps({ calories: 760.4, proteinG: 92.3, carbsG: 80, fatG: 21.6 }, TARGETS),
    ).toEqual({
      signedIn: true,
      // 1,239.6 left, rounded down.
      calories: '1,239',
      caption: 'calories left',
      progress: 0.3802,
      macros: [
        { label: 'Protein', amount: '92 / 150 g', progress: 92.3 / 150 },
        { label: 'Carbs', amount: '80 / 220 g', progress: 80 / 220 },
        { label: 'Fat', amount: '21 / 60 g', progress: 21.6 / 60 },
      ],
    });
  });

  it('says how far over, with the bars full', () => {
    const props = nutritionWidgetProps(
      { calories: 2150, proteinG: 160, carbsG: 0, fatG: 0 },
      TARGETS,
    );
    expect(props).toMatchObject({ calories: '150', caption: 'calories over', progress: 1 });
    expect(props.macros[0].progress).toBe(1);
  });

  it('shows what was eaten, with no bars -- and no empty values -- when no targets are set', () => {
    const props = nutritionWidgetProps(
      { calories: 500, proteinG: 30, carbsG: 50, fatG: 10 },
      NO_TARGETS,
    );
    expect(props).toEqual({
      signedIn: true,
      calories: '500',
      caption: 'calories eaten',
      macros: [
        { label: 'Protein', amount: '30 g' },
        { label: 'Carbs', amount: '50 g' },
        { label: 'Fat', amount: '10 g' },
      ],
    });
  });
});

describe('the timelines', () => {
  const now = new Date(2026, 9, 22, 15, 42);

  it('turn over to a fresh day at midnight', () => {
    expect(nextMidnight(now)).toEqual(new Date(2026, 9, 23));
    expect(nextMidnight(new Date(2026, 11, 31, 23, 59))).toEqual(new Date(2027, 0, 1));
  });

  it('date each entry with its own day, for a week ahead', () => {
    const entries = dailyTimeline<{ signedIn: boolean; day?: string }>(
      now,
      { signedIn: true },
      { signedIn: false },
    );
    expect(entries).toHaveLength(1 + WIDGET_DAYS_AHEAD);
    expect(entries[0]).toEqual({ date: now, props: { signedIn: true, day: dayLabel(now) } });
    expect(entries.slice(1).map((entry) => entry.date)).toEqual(
      [23, 24, 25, 26, 27, 28, 29].map((day) => new Date(2026, 9, day)),
    );
    expect(entries[7].props).toEqual({ signedIn: false, day: dayLabel(new Date(2026, 9, 29)) });
  });

  it('name the day the way the widgets show it', () => {
    expect(dayLabel(now)).toBe(
      now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    );
  });

  it("start Today's Nutrition again each midnight with nothing eaten and the targets kept", () => {
    const [today, tomorrow, ...after] = nutritionTimeline(
      { calories: 760, proteinG: 92, carbsG: 80, fatG: 21 },
      TARGETS,
      now,
    );
    expect(today).toMatchObject({ date: now, props: { calories: '1,240' } });
    expect(tomorrow).toMatchObject({
      date: new Date(2026, 9, 23),
      props: { calories: '2,000', caption: 'calories left', progress: 0 },
    });
    expect(after.every((entry) => entry.props.calories === '2,000')).toBe(true);
  });

  it("show today's steps until midnight, then ask for the app to update them", () => {
    const [today, tomorrow] = stepsTimeline(8412, now);
    expect(today.props).toEqual({
      signedIn: true,
      steps: '8,412',
      caption: expect.stringMatching(/^As of 3:42/),
      day: dayLabel(now),
    });
    expect(tomorrow).toEqual({
      date: new Date(2026, 9, 23),
      props: {
        signedIn: true,
        caption: 'Open Progresso to update',
        day: dayLabel(new Date(2026, 9, 23)),
      },
    });
  });

  it('ask to connect Apple Health when steps are not read yet', () => {
    expect(stepsTimeline(null, now)[0].props).toMatchObject({
      signedIn: true,
      caption: 'Connect Apple Health in Progresso',
    });
    expect(stepsTimeline(null, now)[0].props.steps).toBeUndefined();
  });
});

describe('the look', () => {
  const FOREST = { accent: '#9DBF7A', glow: '#2E3226', photoSmall: 'file:///s.jpg' };

  it('dresses props in a theme, leaving nothing of the one before -- and keeps the day', () => {
    const before = {
      signedIn: true,
      day: 'Sun, Nov 1',
      accent: '#D99A50',
      photoSmall: 'file:///old-s.jpg',
      photoMedium: 'file:///old-m.jpg',
    };
    expect(withLook(before, FOREST)).toEqual({ signedIn: true, day: 'Sun, Nov 1', ...FOREST });
  });

  it('knows when props already wear a theme', () => {
    expect(wearsLook({ ...FOREST, day: 'Sun, Nov 1' }, FOREST)).toBe(true);
    expect(wearsLook({ ...FOREST, photoMedium: 'file:///m.jpg' }, FOREST)).toBe(false);
    expect(wearsLook({ accent: '#D99A50' }, FOREST)).toBe(false);
  });
});

// expo-widgets keeps every widget's props in iOS's UserDefaults; a null there is NSNull, which
// UserDefaults refuses by crashing the whole app -- what builds 28 and 29 did at launch.
describe('never a value iOS can’t store', () => {
  const now = new Date(2026, 9, 22, 15, 42);
  const plan = {
    splitId: 's1',
    splitName: 'PPL',
    day: { id: 'd1', name: 'Push', orderIndex: 0, muscleGroups: [] },
    previousDayName: null,
  };

  it.each([
    [
      'nutrition, with targets',
      nutritionTimeline({ calories: 1, proteinG: 1, carbsG: 1, fatG: 1 }, TARGETS, now),
    ],
    [
      'nutrition, without targets',
      nutritionTimeline({ calories: 1, proteinG: 1, carbsG: 1, fatG: 1 }, NO_TARGETS, now),
    ],
    [
      'nutrition, with a zero target',
      nutritionTimeline(
        { calories: 1, proteinG: 1, carbsG: 1, fatG: 1 },
        { ...TARGETS, calories: 0 },
        now,
      ),
    ],
    ['steps, read', stepsTimeline(8412, now)],
    ['steps, not connected', stepsTimeline(null, now)],
    ['next workout, the next day', nextWorkoutProps(null, plan as never)],
    [
      'next workout, one going',
      nextWorkoutProps({ title: 'Push', kind: 'Your workout', startedAt: null, url: 'u' }, null),
    ],
    ['next workout, no split', nextWorkoutProps(null, null)],
    ['signed out', [SIGNED_OUT_NUTRITION, SIGNED_OUT_NEXT_WORKOUT, SIGNED_OUT_STEPS]],
  ])('%s', (_name, props) => {
    expect(unsafeAt(props)).toBeNull();
  });

  it('a timeline keeps its dates as dates, with only the props cleaned', () => {
    const [entry] = plistSafeTimeline([{ date: now, props: { a: null, b: 1 } }]);
    expect(entry.date).toBe(now);
    expect(entry.props).toEqual({ b: 1 });
  });

  it('plistSafe leaves out nulls, undefined and non-finite numbers, at any depth', () => {
    expect(
      plistSafe({
        a: null,
        b: undefined,
        c: Number.NaN,
        d: 1,
        e: '',
        f: false,
        g: [null, { h: null, i: 2 }, Number.POSITIVE_INFINITY, 'x'],
      }),
    ).toEqual({ d: 1, e: '', f: false, g: [{ i: 2 }, 'x'] });
  });
});
