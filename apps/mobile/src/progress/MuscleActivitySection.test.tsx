import { fireEvent, render, screen } from '@testing-library/react-native';
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

describe("MuscleActivitySection -- Progress's Muscles tab", () => {
  it('reads the last 90 days once as it opens, and shows the last 30 first', async () => {
    await renderScreen();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const since = mockFetch.mock.calls[0][1] as Date;
    expect(Math.round((Date.now() - since.getTime()) / 86400000)).toBeGreaterThanOrEqual(89);
    expect(screen.getByTestId('muscle-activity-row-chest')).toHaveTextContent(/2 sets · 1 session/);
    expect(screen.getByTestId('muscle-activity-row-quadriceps')).toHaveTextContent(/1 set/);
    // Triceps only as a muscle bench press also works.
    expect(screen.getByTestId('muscle-activity-row-triceps')).toHaveTextContent(
      /Only as a muscle it also works/,
    );
    expect(screen.getByTestId('muscle-activity-row-hamstrings')).toHaveTextContent(
      /Nothing logged/,
    );
  });

  it('changes period in memory, with no new read', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('muscle-activity-period-7'));
    expect(screen.getByTestId('muscle-activity-row-quadriceps')).toHaveTextContent(
      /Nothing logged/,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows a group chosen from its row: its sets, volume, when, and the exercises behind it', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('muscle-activity-row-chest'));
    expect(screen.getByTestId('muscle-activity-group-level')).toHaveTextContent(/Recently trained/);
    expect(screen.getByTestId('muscle-activity-group-sets')).toHaveTextContent(/2/);
    expect(screen.getByTestId('muscle-activity-group-volume')).toHaveTextContent(/1,000 kg/);
    expect(screen.getByTestId('muscle-activity-group-last')).toHaveTextContent(/Today|Yesterday/);
    fireEvent.press(screen.getByTestId('muscle-activity-exercise-bench'));
    expect(mockOpenExercise).toHaveBeenCalledWith('bench', 'Bench Press');
    fireEvent.press(screen.getByTestId('muscle-activity-group-close'));
    expect(screen.queryByTestId('muscle-activity-group')).toBeNull();
  });

  it('turns the figure to the side that shows a group chosen from a list', async () => {
    await renderScreen();
    expect(screen.getByTestId('muscle-activity-figure-front')).toBeTruthy();
    fireEvent.press(screen.getByTestId('muscle-activity-row-hamstrings'));
    expect(await screen.findByTestId('muscle-activity-figure-back')).toBeTruthy();
  });

  it('points out the main groups trained least, and says what the colours mean', async () => {
    await renderScreen();
    expect(screen.getByTestId('muscle-activity-less')).toBeTruthy();
    expect(screen.queryByTestId('muscle-activity-less-chest')).toBeNull();
    expect(screen.getByTestId('muscle-activity-legend')).toHaveTextContent(/Recently trained/);
    expect(screen.getByTestId('muscle-activity-legend')).toHaveTextContent(/No recent training/);
    expect(screen.getByText(/not how recovered a muscle is/)).toBeTruthy();
  });

  it('offers Try Again when it cannot be read', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));
    renderSection();
    expect(await screen.findByTestId('muscle-activity-error')).toBeTruthy();
  });
});
