import { colors } from '../design/theme';
import { nextWorkoutWidget, nutritionWidget, stepsWidget, workoutActivity } from './homeWidgets';
import { nutritionWidgetProps, SIGNED_OUT_NUTRITION, SIGNED_OUT_STEPS } from './widgetProps';
import { nextWorkoutProps } from './widgetUpdates';

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

const VIEWS = ['HStack', 'VStack', 'Text', 'Image', 'ProgressView', 'Spacer'];
const MODIFIERS = [
  'background',
  'containerBackground',
  'font',
  'foregroundStyle',
  'frame',
  'minimumScaleFactor',
  'monospacedDigit',
  'multilineTextAlignment',
  'padding',
  'tint',
  'widgetURL',
  'activityBackgroundTint',
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
    shapes: { capsule: () => ({ shape: 'capsule' }) },
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

function urlOf(node: Node): unknown {
  return node.props.modifiers?.find((m) => m.modifier === 'widgetURL')?.args[0];
}

const layoutOf = (target: unknown) => (target as { layout: unknown }).layout;

const SMALL = { widgetFamily: 'systemSmall', date: new Date() };
const MEDIUM = { widgetFamily: 'systemMedium', date: new Date() };

describe("Today's Nutrition", () => {
  const props = nutritionWidgetProps(
    { calories: 760, proteinG: 92, carbsG: 80, fatG: 21 },
    { calories: 2000, proteinG: 150, carbsG: 220, fatG: 60 },
  );

  it('shows the calories left, and opens Nutrition', () => {
    const tree = run(layoutOf(nutritionWidget), props, SMALL);
    expect(textsIn(tree)).toEqual(expect.arrayContaining(['Today', '1,240', 'cal left']));
    expect(textsIn(tree)).not.toContain('Protein');
    expect(nodesIn(tree).some((n) => n.type === 'ProgressView')).toBe(true);
    expect(urlOf(tree)).toBe('progresso://nutrition');
  });

  it('adds protein, carbs and fat when it is wide', () => {
    const texts = textsIn(run(layoutOf(nutritionWidget), props, MEDIUM));
    expect(texts).toEqual(
      expect.arrayContaining(['Protein', '92 / 150 g', 'Carbs', '80 / 220 g', 'Fat', '21 / 60 g']),
    );
  });

  it('asks to sign in once signed out, and to open the app before it has any figures', () => {
    expect(textsIn(run(layoutOf(nutritionWidget), SIGNED_OUT_NUTRITION, SMALL))).toContain(
      'Sign in to Progresso to see today.',
    );
    expect(textsIn(run(layoutOf(nutritionWidget), {}, SMALL))).toContain(
      'Open Progresso to see today.',
    );
  });
});

describe('Next Workout', () => {
  it('shows the next day with Start, opening the start of a workout', () => {
    const tree = run(
      layoutOf(nextWorkoutWidget),
      nextWorkoutProps(null, {
        splitId: 's1',
        splitName: 'PPL',
        day: { id: 'd2', name: 'Pull', muscleGroups: ['back'] } as never,
        previousDayName: 'Push',
      }),
    );
    expect(textsIn(tree)).toEqual(['Next Workout', 'Pull', 'Back', 'Start']);
    expect(urlOf(tree)).toBe('progresso://workouts/new');
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
    );
    expect(textsIn(tree)).toEqual(['Workout in Progress', 'Push Day', 'Your workout', 'Resume']);
    expect(urlOf(tree)).toBe('progresso://workouts/w1/live');
  });

  it('asks to open the app before it knows anything', () => {
    expect(textsIn(run(layoutOf(nextWorkoutWidget), {}))).toContain(
      'Open Progresso to see your next workout.',
    );
  });
});

describe("Today's Steps", () => {
  it('shows the count and when it was read', () => {
    const texts = textsIn(
      run(layoutOf(stepsWidget), { signedIn: true, steps: '8,412', caption: 'As of 3:42 PM' }),
    );
    expect(texts).toEqual(['Steps', '8,412', 'As of 3:42 PM']);
  });

  it('shows a dash with no count, or once signed out', () => {
    expect(
      textsIn(
        run(layoutOf(stepsWidget), {
          signedIn: true,
          steps: null,
          caption: 'Open Progresso to update',
        }),
      ),
    ).toEqual(['Steps', '—', 'Open Progresso to update']);
    expect(textsIn(run(layoutOf(stepsWidget), SIGNED_OUT_STEPS))).toEqual([
      'Steps',
      '—',
      'Sign in to Progresso',
    ]);
    expect(textsIn(run(layoutOf(stepsWidget), {}))).toEqual([
      'Steps',
      '—',
      'Open Progresso to see your steps',
    ]);
  });
});

describe('the Lock Screen workout card', () => {
  it('names the workout and runs a timer from when it started', () => {
    const startedAt = Date.parse('2026-10-22T18:00:00.000Z');
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
});

it("uses the app's own colours (design/theme.ts)", () => {
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
