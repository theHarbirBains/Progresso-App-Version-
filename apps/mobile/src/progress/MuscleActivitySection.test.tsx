import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ActivityEntry } from './muscleActivityQueries';
import { MuscleActivitySection } from './MuscleActivitySection';

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
const mockFetch = jest.fn();
jest.mock('./muscleActivityQueries', () => ({
  fetchMuscleActivity: (...args: unknown[]) => mockFetch(...args),
}));
jest.mock('../exercises/builtinExtras', () => ({
  loadBuiltinExtras: async () =>
    new Map([
      [
        'bench',
        {
          slug: 'bb-bench-press',
          secondaryMuscleGroups: ['shoulders', 'triceps'],
          searchAliases: [],
          movementPattern: 'horizontal_push',
          illustrationUrl: null,
        },
      ],
    ]),
  setBuiltinSources: jest.fn(),
}));

const mockOpenExercise = jest.fn();

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const entries: ActivityEntry[] = [
  {
    workoutId: 'w1',
    performedAt: hoursAgo(3),
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    measurementType: 'weight_reps',
    sets: [
      { weightKg: 100, reps: 5, isDrop: false },
      { weightKg: 100, reps: 5, isDrop: false },
    ],
  },
  {
    workoutId: 'w2',
    performedAt: hoursAgo(24 * 20),
    exerciseId: 'squat',
    exerciseName: 'Back Squat',
    muscleGroup: 'quadriceps',
    measurementType: 'weight_reps',
    sets: [{ weightKg: 140, reps: 5, isDrop: false }],
  },
];

function renderSection() {
  return render(
    <MuscleActivitySection
      accentColor="#D99A50"
      onAccentColor="#12110F"
      weightUnit="kg"
      onOpenExercise={mockOpenExercise}
    />,
  );
}

async function renderScreen() {
  renderSection();
  await screen.findByTestId('muscle-activity-map');
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(entries);
  mockOpenExercise.mockClear();
});

/** The drawn muscles on the figure that answer a tap. */
type Node = { props: Record<string, unknown> };
function tappableMuscles(): (() => void)[] {
  return screen.UNSAFE_root.findAll(
    (candidate: Node) =>
      typeof candidate.props.onPress === 'function' && typeof candidate.props.d === 'string',
  ).map((node: Node) => node.props.onPress as () => void);
}

/** Muscle Breakdown's rows, top to bottom, by muscle group. */
function breakdownOrder(): string[] {
  return within(screen.getByTestId('muscle-activity-breakdown'))
    .getAllByTestId(/^muscle-activity-row-/)
    .map((row) => String(row.props.testID).replace('muscle-activity-row-', ''));
}

describe("MuscleActivitySection -- Progress's Muscles tab", () => {
  it('reads the last 90 days once as it opens, and shows the last 30 first', async () => {
    await renderScreen();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const since = mockFetch.mock.calls[0][1] as Date;
    expect(Math.round((Date.now() - since.getTime()) / 86400000)).toBeGreaterThanOrEqual(89);
    expect(screen.getByTestId('muscle-activity-map')).toHaveTextContent(/Muscle Heat Map/);
    expect(screen.getByTestId('muscle-activity-map')).toHaveTextContent(/last 30 days/);
    // Chest and quadriceps; triceps only as a muscle bench press also works.
    expect(screen.getByTestId('muscle-activity-count')).toHaveTextContent(/2.*Muscles Trained/);
    expect(screen.getByTestId('muscle-activity-row-chest')).toHaveTextContent(
      /Chest.*1 session · 2 sets.*Today/,
    );
    expect(screen.getByTestId('muscle-activity-row-quadriceps')).toHaveTextContent(
      /1 session · 1 set/,
    );
    expect(screen.getByTestId('muscle-activity-row-triceps')).toHaveTextContent(
      /Also worked · 2 sets/,
    );
  });

  it('says what each colour means, in days', async () => {
    await renderScreen();
    const legend = screen.getByTestId('muscle-activity-legend');
    expect(legend).toHaveTextContent(
      /Recently trained.*\(1–2 days\).*Frequently trained.*\(3–7 days\).*Less trained.*\(8–14 days\).*No recent training.*\(15\+ days\)/,
    );
    expect(screen.getByText(/not how recovered a muscle is/)).toBeTruthy();
  });

  it('lists six muscles, last trained first, and the rest with View All Muscles', async () => {
    await renderScreen();
    expect(breakdownOrder()).toEqual([
      'chest',
      'quadriceps',
      'back',
      'shoulders',
      'biceps',
      'triceps',
    ]);
    expect(screen.queryByTestId('muscle-activity-row-hamstrings')).toBeNull();

    fireEvent.press(screen.getByTestId('muscle-activity-view-all'));
    expect(breakdownOrder()).toHaveLength(12);
    expect(screen.getByTestId('muscle-activity-row-hamstrings')).toHaveTextContent(
      /Nothing logged/,
    );
    expect(screen.getByTestId('muscle-activity-view-all')).toHaveTextContent(/Show Fewer/);
  });

  it('sorts by Most or Least Trained from its sheet', async () => {
    await renderScreen();
    expect(screen.getByTestId('muscle-activity-sort')).toHaveTextContent(/Sort: Recent/);

    fireEvent.press(screen.getByTestId('muscle-activity-sort'));
    fireEvent.press(screen.getByTestId('muscle-activity-sort-least'));
    expect(screen.getByTestId('muscle-activity-sort')).toHaveTextContent(/Sort: Least Trained/);
    // Untrained first (triceps only also worked), in the app's order; then the least sessions.
    expect(breakdownOrder()[0]).toBe('back');
    fireEvent.press(screen.getByTestId('muscle-activity-view-all'));
    expect(breakdownOrder().slice(-2)).toEqual(['quadriceps', 'chest']);
  });

  it('changes period in memory, with no new read', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('muscle-activity-period-7'));
    expect(screen.getByTestId('muscle-activity-count')).toHaveTextContent(/1.*Muscle Trained/);
    expect(screen.getByTestId('muscle-activity-map')).toHaveTextContent(/last 7 days/);
    fireEvent.press(screen.getByTestId('muscle-activity-view-all'));
    expect(screen.getByTestId('muscle-activity-row-quadriceps')).toHaveTextContent(
      /Nothing logged/,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows just a muscle chosen from its row, with its details -- and every muscle again', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('muscle-activity-row-chest'));

    expect(breakdownOrder()).toEqual(['chest']);
    expect(screen.getByTestId('muscle-activity-filter')).toHaveTextContent('Showing Chest');
    expect(screen.getByTestId('muscle-activity-group-level')).toHaveTextContent(
      /Recently trained · 1–2 days/,
    );
    expect(screen.getByTestId('muscle-activity-group-sets')).toHaveTextContent(/2/);
    expect(screen.getByTestId('muscle-activity-group-volume')).toHaveTextContent(/1,000 kg/);
    expect(screen.getByTestId('muscle-activity-group-last')).toHaveTextContent(/Today|Yesterday/);
    fireEvent.press(screen.getByTestId('muscle-activity-exercise-bench'));
    expect(mockOpenExercise).toHaveBeenCalledWith('bench', 'Bench Press');

    fireEvent.press(screen.getByTestId('muscle-activity-show-all'));
    expect(screen.queryByTestId('muscle-activity-group')).toBeNull();
    expect(breakdownOrder()).toHaveLength(6);
  });

  it('shows just the muscle tapped on the figure, outlined there -- tapped again, every muscle', async () => {
    await renderScreen();
    const press = tappableMuscles()[0]!;
    act(() => press());

    const shown = breakdownOrder();
    expect(shown).toHaveLength(1);
    const row = screen.getByTestId(`muscle-activity-row-${shown[0]}`);
    expect(row.props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('muscle-activity-filter')).toHaveTextContent(/^Showing /);
    expect(screen.getByTestId('muscle-activity-group-level')).toBeTruthy();
    // Outlined on the figure: its muscles drawn with the outline's width.
    expect(
      screen.UNSAFE_root.findAll(
        (candidate: Node) =>
          typeof candidate.props.d === 'string' && candidate.props.strokeWidth === 1.4,
      ).length,
    ).toBeGreaterThan(0);

    act(() => tappableMuscles()[0]!());
    expect(screen.queryByTestId('muscle-activity-group')).toBeNull();
    expect(breakdownOrder()).toHaveLength(6);
  });

  it('turns the figure to the side that shows a muscle chosen from its row', async () => {
    await renderScreen();
    expect(screen.getByTestId('muscle-activity-figure-front')).toBeTruthy();
    fireEvent.press(screen.getByTestId('muscle-activity-view-all'));
    fireEvent.press(screen.getByTestId('muscle-activity-row-hamstrings'));
    expect(await screen.findByTestId('muscle-activity-figure-back')).toBeTruthy();
  });

  it('offers Try Again when it cannot be read', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));
    renderSection();
    expect(await screen.findByTestId('muscle-activity-error')).toBeTruthy();
  });
});
