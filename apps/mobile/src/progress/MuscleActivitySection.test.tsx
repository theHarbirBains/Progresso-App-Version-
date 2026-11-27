import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
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

/** A tap on the figure from the front, at a point 0-1 across and down. */
function tapFigure(x: number, y: number) {
  const figure = screen.getByTestId('muscle-activity-figure-front');
  const { width, height } = figure.props.style as { width: number; height: number };
  fireEvent.press(figure, { nativeEvent: { locationX: x * width, locationY: y * height } });
}

/** Muscle Breakdown's rows, top to bottom, by muscle group. */
function breakdownOrder(): string[] {
  return within(screen.getByTestId('muscle-activity-breakdown'))
    .getAllByTestId(/^muscle-activity-row-/)
    .map((row) => String(row.props.testID).replace('muscle-activity-row-', ''));
}

describe("MuscleActivitySection -- Progress's Muscles tab", () => {
  it('reads the last 90 days once as it opens, and sums up the last 30', async () => {
    await renderScreen();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const since = mockFetch.mock.calls[0][1] as Date;
    expect(Math.round((Date.now() - since.getTime()) / 86400000)).toBeGreaterThanOrEqual(89);
    // Chest and quadriceps trained (triceps only as a muscle bench press also works); 3 working
    // sets in 2 workouts.
    expect(screen.getByTestId('muscle-activity-count')).toHaveTextContent(/2\/12.*Muscles/);
    expect(screen.getByTestId('muscle-activity-sets')).toHaveTextContent(/3.*Sets/);
    expect(screen.getByTestId('muscle-activity-workouts')).toHaveTextContent(/2.*Workouts/);
    expect(screen.getByTestId('muscle-activity-map')).toHaveTextContent(/Muscle Heat Map/);
  });

  it('says what each colour means, in days', async () => {
    await renderScreen();
    expect(screen.getByTestId('muscle-activity-legend')).toHaveTextContent(
      /Recently trained.*1–2 days.*Frequently trained.*3–7 days.*Less trained.*8–14 days.*No recent training.*15\+ days/,
    );
    expect(screen.getByText(/not how recovered a muscle is/)).toBeTruthy();
  });

  it('weighs the upper body against the lower, by volume', async () => {
    await renderScreen();
    // Bench press 1,000 kg against back squat 700 kg.
    expect(screen.getByTestId('muscle-activity-balance-upper')).toHaveTextContent(
      /Upper Body.*59%.*1,000 kg · 2 sets/,
    );
    expect(screen.getByTestId('muscle-activity-balance-lower')).toHaveTextContent(
      /Lower Body.*41%.*700 kg · 1 set/,
    );
  });

  it('says so when there are no weighted sets to weigh', async () => {
    mockFetch.mockResolvedValue([
      {
        workoutId: 'w1',
        performedAt: new Date().toISOString(),
        exerciseId: 'pushup',
        exerciseName: 'Push-Up',
        muscleGroup: 'chest',
        measurementType: 'bodyweight',
        sets: [{ weightKg: null, reps: 20, isDrop: false }],
      },
    ]);
    await renderScreen();
    expect(screen.getByTestId('muscle-activity-balance-empty')).toHaveTextContent(
      'No weighted sets in the last 30 days.',
    );
  });

  it('lists six muscles, last trained first, each with its sessions, sets, volume and when', async () => {
    await renderScreen();
    expect(breakdownOrder()).toEqual([
      'chest',
      'quadriceps',
      'back',
      'shoulders',
      'biceps',
      'triceps',
    ]);
    expect(screen.getByTestId('muscle-activity-row-chest')).toHaveTextContent(
      /Chest.*Today.*1 session · 2 sets · 1,000 kg/,
    );
    expect(screen.getByTestId('muscle-activity-row-triceps')).toHaveTextContent(
      /Also worked · 2 sets/,
    );
    expect(screen.queryByTestId('muscle-activity-row-hamstrings')).toBeNull();

    fireEvent.press(screen.getByTestId('muscle-activity-view-all'));
    expect(breakdownOrder()).toHaveLength(12);
    expect(screen.getByTestId('muscle-activity-row-hamstrings')).toHaveTextContent(
      /Nothing logged/,
    );
    expect(screen.getByTestId('muscle-activity-view-all')).toHaveTextContent(/Show Fewer/);
  });

  it('sorts by Recent, Sets, Volume or Frequency from its sheet', async () => {
    await renderScreen();
    expect(screen.getByTestId('muscle-activity-sort')).toHaveTextContent(/Sort: Recent/);
    fireEvent.press(screen.getByTestId('muscle-activity-sort'));
    for (const sort of ['recent', 'sets', 'volume', 'frequency']) {
      expect(screen.getByTestId(`muscle-activity-sort-${sort}`)).toBeTruthy();
    }

    fireEvent.press(screen.getByTestId('muscle-activity-sort-volume'));
    expect(screen.getByTestId('muscle-activity-sort')).toHaveTextContent(/Sort: Volume/);
    expect(breakdownOrder().slice(0, 2)).toEqual(['chest', 'quadriceps']);
  });

  it('changes period in memory, with no new read', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('muscle-activity-period-7'));
    expect(screen.getByTestId('muscle-activity-count')).toHaveTextContent(/1\/12/);
    expect(screen.getByTestId('muscle-activity-sets')).toHaveTextContent(/2/);
    expect(screen.getByTestId('muscle-activity-workouts')).toHaveTextContent(/1/);
    expect(screen.getByTestId('muscle-activity-balance-lower')).toHaveTextContent(/0%/);
    fireEvent.press(screen.getByTestId('muscle-activity-view-all'));
    expect(screen.getByTestId('muscle-activity-row-quadriceps')).toHaveTextContent(
      /Nothing logged/,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('opens a row in place: its level, its volume over the period, and its exercises', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('muscle-activity-row-chest'));

    // Still every muscle listed: the row opens where it is.
    expect(breakdownOrder()).toHaveLength(6);
    expect(screen.getByTestId('muscle-activity-row-chest').props.accessibilityState).toEqual({
      expanded: true,
    });
    expect(screen.getByTestId('muscle-activity-group-level')).toHaveTextContent(
      /Recently trained · 1–2 days · 0.2 sessions a week/,
    );
    expect(screen.getByTestId('muscle-activity-group')).toHaveTextContent(/VOLUME EACH WEEK/);
    expect(screen.getByTestId('muscle-activity-trend').props.accessibilityLabel).toMatch(
      /1,000 kg/,
    );
    expect(screen.getByTestId('muscle-activity-exercise-bench')).toHaveTextContent(
      /Bench Press.*2 sets · 1,000 kg · Today/,
    );
    fireEvent.press(screen.getByTestId('muscle-activity-exercise-bench'));
    expect(mockOpenExercise).toHaveBeenCalledWith('bench', 'Bench Press');

    fireEvent.press(screen.getByTestId('muscle-activity-row-chest'));
    expect(screen.queryByTestId('muscle-activity-group')).toBeNull();
  });

  it('shows just the muscle tapped on the figure, opened and standing out -- tapped again, every muscle', async () => {
    await renderScreen();
    // A thigh.
    tapFigure(0.35, 0.55);

    expect(breakdownOrder()).toEqual(['quadriceps']);
    expect(screen.getByTestId('muscle-activity-filter')).toHaveTextContent('Showing Quadriceps');
    expect(screen.getByTestId('muscle-activity-group-level')).toHaveTextContent(
      /No recent training · 15\+ days/,
    );
    expect(screen.getByTestId('muscle-activity-figure-layer-quadriceps')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByTestId('muscle-activity-figure-layer-chest').props.style)
        .opacity,
    ).toBe(0.3);

    tapFigure(0.35, 0.55);
    expect(screen.queryByTestId('muscle-activity-group')).toBeNull();
    expect(breakdownOrder()).toHaveLength(6);
  });

  it('turns the figure to the side that shows a muscle opened from its row', async () => {
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
