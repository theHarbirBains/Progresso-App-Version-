import { fireEvent, render, screen } from '@testing-library/react-native';
import { OverviewSection } from './OverviewSection';

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate };

const theme = { accent: '#2F80FF', onAccent: '#FFFFFF' };

const benchHistory = [
  {
    weightKg: 100,
    reps: 5,
    performedAt: '2026-01-01T12:00:00Z',
    workoutExerciseId: 'we1',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest' as const,
  },
  {
    weightKg: 120,
    reps: 5,
    performedAt: '2026-02-15T12:00:00Z',
    workoutExerciseId: 'we2',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest' as const,
  },
];

const baseLifetimeStats = {
  totalWorkouts: 2,
  totalMinutes: 105,
  workoutsThisMonth: 1,
  avgWorkoutsPerWeek: 0.5,
  firstWorkoutAt: '2026-01-01T12:00:00Z',
};

const baseMilestones = [
  {
    key: 'first-workout',
    label: 'First Workout',
    achieved: true,
    achievedAt: '2026-01-01T12:00:00Z',
    progress: null,
  },
  {
    key: 'sets-100',
    label: '100 Sets Completed',
    achieved: false,
    achievedAt: null,
    progress: { current: 2, target: 100 },
  },
];

function renderOverview(overrides: Partial<Parameters<typeof OverviewSection>[0]> = {}) {
  return render(
    <OverviewSection
      groups={[{ exerciseId: 'ex-bench', exerciseName: 'Bench Press', sets: benchHistory }]}
      weightUnit="kg"
      theme={theme}
      oneRepMaxes={[]}
      repPRs={[]}
      lifetimeStats={baseLifetimeStats}
      totalCompletedSets={2}
      totalPRs={0}
      globalMilestones={baseMilestones}
      navigation={navigation}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-03-01T12:00:00Z'));
  mockNavigate.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('OverviewSection', () => {
  it('shows the empty state with no workout history', () => {
    renderOverview({ groups: [] });

    expect(screen.getByTestId('progress-overview-empty')).toHaveTextContent(
      'Your progression starts here.',
    );
  });

  it('shows real lifetime stats, never fabricated placeholders', () => {
    renderOverview({ totalPRs: 3 });

    expect(screen.getByTestId('progress-stat-workouts')).toHaveTextContent(/2/);
    expect(screen.getByTestId('progress-stat-prs')).toHaveTextContent(/3/);
    expect(screen.getByTestId('progress-stat-sets')).toHaveTextContent(/2/);
    expect(screen.getByTestId('progress-stat-time')).toHaveTextContent(/1h 45m/);
  });

  it('shows the shared Strength Journey chart in its compact (non-detailed) form', () => {
    renderOverview();

    expect(screen.getByTestId('progress-overview-exercise-selector')).toHaveTextContent(
      /Bench Press/,
    );
    expect(screen.queryByTestId('progress-overview-metric-topset')).toBeNull();
  });

  it('shows a real "You Got Stronger" insight when an exercise is genuinely improving', () => {
    renderOverview();

    expect(screen.getByTestId('progress-insight-0')).toHaveTextContent(
      /Bench Press is up 20.0% since you started./,
    );
  });

  it('never shows the insight section when there is nothing genuine to report', () => {
    renderOverview({
      groups: [
        {
          exerciseId: 'ex-bench',
          exerciseName: 'Bench Press',
          sets: [benchHistory[0]],
        },
      ],
    });

    expect(screen.queryByText('You Got Stronger')).toBeNull();
  });

  it('numbers Most Improved by rank and navigates to exercise detail on press', () => {
    renderOverview();

    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('progress-improving-ex-bench'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
    });
  });

  it('shows real Training Momentum stats and never a streak', () => {
    renderOverview();

    expect(screen.getByTestId('progress-momentum-month')).toHaveTextContent(/1/);
    expect(screen.getByTestId('progress-momentum-avg')).toBeTruthy();
    expect(screen.queryByText(/streak/i)).toBeNull();
  });

  it('shows real global milestones with real progress', () => {
    renderOverview();

    expect(screen.getByTestId('progress-milestone-global-first-workout')).toHaveTextContent(
      /First Workout/,
    );
    expect(screen.getByTestId('progress-milestone-global-sets-100')).toHaveTextContent(/2 \/ 100/);
  });
});
