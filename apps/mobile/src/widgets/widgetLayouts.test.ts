import { colors } from '../design/theme';
import { APP_THEMES } from '../theme/appThemes';
import { homeWidgets } from './homeWidgets';
import { nutritionWidgetProps, SIGNED_OUT_NUTRITION, SIGNED_OUT_STEPS } from './widgetProps';
import { nextWorkoutProps } from './widgetUpdates';

const { nextWorkoutWidget, nutritionWidget, stepsWidget, workoutActivity } = homeWidgets();

// Each layout runs here the way the widget itself runs it (expo-widgets evaluates the layout's
// string with only its own runtime's names in scope): @expo/ui's SwiftUI views and modifiers and
// the JSX functions. A view is its name and a modifier a record of its arguments, so the tree can
// be read -- and anything else a layout reached for would throw here, as it would on the phone.

interface Node {
  type: string;
  props: { children?: unknown; modifiers?: { modifier: string; args: unknown[] }[] } & Record<
    string,
    unknown
  >;
}

const VIEWS = ['HStack', 'VStack', 'ZStack', 'Text', 'Image', 'ProgressView', 'Spacer', 'Circle'];
const MODIFIERS = [
  'activityBackgroundTint',
  'aspectRatio',
  'background',
  'clipped',
  'containerBackground',
  'font',
  'foregroundStyle',
  'frame',
  'lineLimit',
  'minimumScaleFactor',
  'monospacedDigit',
  'multilineTextAlignment',
  'padding',
  'resizable',
  'rotationEffect',
  'shadow',
  'strokeBorder',
  'tint',
  'widgetURL',
];

function run(layout: unknown, ...args: unknown[]) {
  expect(typeof layout).toBe('string');
  const jsx = (type: string, props: Node['props']): Node => ({ type, props });
  const scope: Record<string, unknown> = {
    _jsx: jsx,
    _jsxs: jsx,
    _jsxDEV: jsx,
    _Fragment: 'Fragment',
    _jsxFileName: 'widget',
    shapes: {
      capsule: () => ({ shape: 'capsule' }),
      roundedRectangle: (params: object) => ({ shape: 'roundedRectangle', ...params }),
    },
  };
  for (const view of VIEWS) scope[view] = view;
  for (const name of MODIFIERS)
    scope[name] = (...rest: unknown[]) => ({ modifier: name, args: rest });
  const evaluate = new Function(...Object.keys(scope), `return (${layout as string});`);
  return evaluate(...Object.values(scope))(...args);
}

function nodesIn(node: unknown): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodesIn);
  if (!node || typeof node !== 'object' || !('type' in node)) return [];
  const self = node as Node;
  return [self, ...nodesIn(self.props.children)];
}

function textsIn(node: unknown): string[] {
  return nodesIn(node)
    .filter((n) => n.type === 'Text' && n.props.children !== undefined)
    .map((n) => [n.props.children].flat().join(''));
}

function modifierOf(node: Node, name: string): unknown[] | undefined {
  return node.props.modifiers?.find((m) => m.modifier === name)?.args;
}

const urlOf = (node: Node) => modifierOf(node, 'widgetURL')?.[0];

/** The photo the widget draws, if any. */
const photoOf = (tree: unknown) =>
  nodesIn(tree).find((n) => n.type === 'Image' && n.props.uiImage)?.props.uiImage;

/** Every colour the tree is painted in, anywhere. */
const coloursIn = (tree: unknown) => JSON.stringify(tree).match(/#[0-9A-Fa-f]{6}/g) ?? [];

const layoutOf = (target: unknown) => (target as { layout: unknown }).layout;

const SMALL = { widgetFamily: 'systemSmall', date: new Date() };
const MEDIUM = { widgetFamily: 'systemMedium', date: new Date() };
const TINTED = { widgetFamily: 'systemSmall', widgetRenderingMode: 'accented', date: new Date() };

const LOOK = {
  accent: '#9DBF7A',
  glow: '#2E3226',
  photoSmall: 'file:///group/forest-small.jpg',
  photoMedium: 'file:///group/forest-medium.jpg',
  day: 'Sun, Nov 1',
};

describe("Today's Nutrition", () => {
  const props = {
    ...nutritionWidgetProps(
      { calories: 760, proteinG: 92, carbsG: 80, fatG: 21 },
      { calories: 2000, proteinG: 150, carbsG: 220, fatG: 60 },
    ),
    ...LOOK,
  };

  it('shows the date, the calories left in a ring, and opens Nutrition', () => {
    const tree = run(layoutOf(nutritionWidget), props, SMALL);
    expect(textsIn(tree)).toEqual(['Sun, Nov 1', '1,240', 'calories left']);
    // The ring: its track, then the share eaten (760 of 2,000) as a dash of the way round.
    const rings = nodesIn(tree).filter((n) => n.type === 'Circle');
    expect(rings).toHaveLength(2);
    const [{ style }] = modifierOf(rings[1], 'strokeBorder') as [{ style: { dash: number[] } }];
    const around = style.dash[1];
    expect(style.dash[0] / around).toBeCloseTo(0.38);
    expect(urlOf(tree)).toBe('progresso://nutrition');
  });

  it('adds protein, carbs and fat, each with its bar, when it is wide', () => {
    const tree = run(layoutOf(nutritionWidget), props, MEDIUM);
    expect(textsIn(tree)).toEqual([
      'Sun, Nov 1',
      'Nutrition',
      '1,240',
      'calories left',
      'Protein',
      '92 / 150 g',
      'Carbs',
      '80 / 220 g',
      'Fat',
      '21 / 60 g',
    ]);
    expect(nodesIn(tree).filter((n) => n.type === 'ProgressView')).toHaveLength(3);
  });

  it("draws the theme's photo for its size, and its accent", () => {
    expect(photoOf(run(layoutOf(nutritionWidget), props, SMALL))).toBe(LOOK.photoSmall);
    expect(photoOf(run(layoutOf(nutritionWidget), props, MEDIUM))).toBe(LOOK.photoMedium);
    const colours = coloursIn(run(layoutOf(nutritionWidget), props, MEDIUM));
    expect(colours).toContain(LOOK.accent);
    expect(colours).not.toContain(colors.accent);
  });

  it('leaves the photo out where iOS tints the widget, and the ring empty with nothing eaten', () => {
    expect(photoOf(run(layoutOf(nutritionWidget), props, TINTED))).toBeUndefined();
    const fresh = { ...props, progress: 0 };
    expect(
      nodesIn(run(layoutOf(nutritionWidget), fresh, SMALL)).filter((n) => n.type === 'Circle'),
    ).toHaveLength(1);
  });

  it('asks to sign in once signed out, and to open the app before it has any figures', () => {
    expect(textsIn(run(layoutOf(nutritionWidget), SIGNED_OUT_NUTRITION, SMALL))).toContain(
      'Sign in to Progresso to see today.',
    );
    const before = run(layoutOf(nutritionWidget), {}, SMALL);
    expect(textsIn(before)).toEqual(['Open Progresso to see today.']);
    // The original amber, and no photo, before it has been handed any.
    expect(coloursIn(before)).toContain(colors.accent);
    expect(photoOf(before)).toBeUndefined();
  });
});

describe('Next Workout', () => {
  const plan = {
    splitId: 's1',
    splitName: 'PPL',
    day: { id: 'd2', name: 'Pull', muscleGroups: ['back'] } as never,
    previousDayName: 'Push',
  };

  it('shows the date and the next day with Start, opening the start of a workout', () => {
    const tree = run(
      layoutOf(nextWorkoutWidget),
      { ...nextWorkoutProps(null, plan), ...LOOK },
      SMALL,
    );
    expect(textsIn(tree)).toEqual(['Sun, Nov 1', 'Next Workout', 'Pull', 'Back', 'Start']);
    expect(urlOf(tree)).toBe('progresso://workouts/new');
    expect(photoOf(tree)).toBe(LOOK.photoSmall);
  });

  it('heads the wide one with what it is, the day in a card beside Start', () => {
    const tree = run(
      layoutOf(nextWorkoutWidget),
      { ...nextWorkoutProps(null, plan), ...LOOK },
      MEDIUM,
    );
    expect(textsIn(tree)).toEqual(['Sun, Nov 1', 'Next Workout', 'Pull', 'Back', 'Start']);
    expect(photoOf(tree)).toBe(LOOK.photoMedium);
  });

  it('shows the workout going with Resume, opening it', () => {
    const tree = run(
      layoutOf(nextWorkoutWidget),
      nextWorkoutProps(
        {
          title: 'Push Day',
          kind: 'Your workout',
          startedAt: null,
          url: 'progresso://workouts/w1/live',
        },
        null,
      ),
      SMALL,
    );
    expect(textsIn(tree)).toEqual(['Workout in Progress', 'Push Day', 'Your workout', 'Resume']);
    expect(urlOf(tree)).toBe('progresso://workouts/w1/live');
  });

  it('asks to open the app before it knows anything', () => {
    expect(textsIn(run(layoutOf(nextWorkoutWidget), {}, SMALL))).toContain(
      'Open Progresso to see your next workout.',
    );
  });
});

describe("Today's Steps", () => {
  it('shows the date, the count and when it was read', () => {
    const tree = run(
      layoutOf(stepsWidget),
      { signedIn: true, steps: '8,412', caption: 'As of 3:42 PM', ...LOOK },
      SMALL,
    );
    expect(textsIn(tree)).toEqual(['Sun, Nov 1', '8,412', 'Steps', 'As of 3:42 PM']);
    expect(photoOf(tree)).toBe(LOOK.photoSmall);
  });

  it('shows a dash with no count, or once signed out', () => {
    expect(
      textsIn(
        run(
          layoutOf(stepsWidget),
          { signedIn: true, steps: null, caption: 'Open Progresso to update' },
          SMALL,
        ),
      ),
    ).toEqual(['—', 'Steps', 'Open Progresso to update']);
    expect(textsIn(run(layoutOf(stepsWidget), SIGNED_OUT_STEPS, SMALL))).toEqual([
      '—',
      'Steps',
      'Sign in to Progresso',
    ]);
    expect(textsIn(run(layoutOf(stepsWidget), {}, SMALL))).toEqual([
      '—',
      'Steps',
      'Open Progresso to see your steps',
    ]);
  });
});

describe('the Lock Screen workout card', () => {
  const startedAt = Date.parse('2026-10-22T18:00:00.000Z');

  it('names the workout and runs a timer from when it started', () => {
    const regions = run(layoutOf(workoutActivity), {
      title: 'Push Day',
      kind: 'Your workout',
      startedAt,
    });
    expect(textsIn(regions.banner)).toEqual(['Push Day', 'Your workout']);
    const timers = nodesIn(regions.banner).filter((n) => n.props.dateStyle === 'timer');
    expect(timers).toHaveLength(1);
    expect((timers[0].props.date as Date).getTime()).toBe(startedAt);
    expect(regions.compactTrailing.props.dateStyle).toBe('timer');
    expect(regions.minimal.type).toBe('Image');
  });

  it("wears the theme's accent it was started with", () => {
    const regions = run(layoutOf(workoutActivity), {
      title: 'Push Day',
      kind: 'Your workout',
      startedAt,
      accent: '#E8A0B4',
    });
    expect(regions.minimal.props.color).toBe('#E8A0B4');
  });
});

it("uses the app's own colours (design/theme.ts), and the original accent when it has no theme", () => {
  for (const target of [nutritionWidget, nextWorkoutWidget, stepsWidget, workoutActivity]) {
    const layout = layoutOf(target) as string;
    for (const colour of [
      colors.background,
      colors.textPrimary,
      colors.textSecondary,
      colors.accent,
    ]) {
      expect(layout).toContain(colour);
    }
  }
  expect(layoutOf(nextWorkoutWidget)).toContain(colors.heroAction);
  expect(layoutOf(nextWorkoutWidget)).toContain(colors.onAccent);
});

it('never draws a colour iOS would refuse, whatever accent it is handed', () => {
  // An accent that isn't "#RRGGBB" falls back to the original, rather than reaching iOS.
  const tree = run(layoutOf(stepsWidget), { signedIn: true, accent: 'not a colour' }, SMALL);
  expect(JSON.stringify(tree)).not.toContain('not a colour');
  for (const theme of APP_THEMES) expect(theme.accent).toMatch(/^#[0-9A-F]{6}$/);
});
