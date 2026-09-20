import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import type { LifetimeStats } from './lifetimeStats';
import { OverviewSection } from './OverviewSection';

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate };

const lifetimeStats: LifetimeStats = {
  totalWorkouts: 18,
  totalMinutes: 540,
  workoutsThisMonth: 6,
  avgWorkoutsPerWeek: 3.5,
  firstWorkoutAt: '2026-01-01T00:00:00Z',
};

const groups: ExerciseHistoryGroup[] = [
  { exerciseId: 'ex-1', exerciseName: 'Bench Press', sets: [] },
  { exerciseId: 'ex-2', exerciseName: 'Squat', sets: [] },
];

const repPRs: RepPRWithExercise[] = [
  {
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    bestWeightKg: 100,
    reps: 8,
    achievedAt: '2026-03-01T00:00:00Z',
    sourceSetId: 'set-1',
  },
];

const oneRepMaxes: OneRepMaxWithExercise[] = [
  {
    exerciseId: 'ex-2',
    exerciseName: 'Squat',
    weightKg: 140,
    achievedAt: '2026-02-01T00:00:00Z',
    sourceSetId: 'set-2',
  },
];

const onViewDetails = jest.fn();
const onViewAllMilestones = jest.fn();

function renderOverview(overrides: Partial<Parameters<typeof OverviewSection>[0]> = {}) {
  return render(
    <OverviewSection
      groups={groups}
      lifetimeStats={lifetimeStats}
      totalCompletedSets={120}
      totalPRs={2}
      repPRs={repPRs}
      oneRepMaxes={oneRepMaxes}
      weightUnit="kg"
      accentColor="#2F80FF"
      navigation={navigation}
      onViewDetails={onViewDetails}
      onViewAllMilestones={onViewAllMilestones}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  onViewDetails.mockClear();
  onViewAllMilestones.mockClear();
});

describe('OverviewSection', () => {
  it('shows an empty state when there is no exercise history at all', () => {
    renderOverview({ groups: [] });

    expect(screen.getByTestId('progress-overview-empty')).toBeTruthy();
  });

  it('shows real lifetime stats, never fabricated values', () => {
    renderOverview();

    expect(screen.getByTestId('progress-overview-stat-workouts')).toHaveTextContent(/18/);
    expect(screen.getByTestId('progress-overview-stat-prs')).toHaveTextContent(/2/);
    expect(screen.getByTestId('progress-overview-stat-exercises')).toHaveTextContent(/2/);
    expect(screen.getByTestId('progress-overview-stat-sets')).toHaveTextContent(/120/);
  });

  it('calls onViewDetails when "View Details" is pressed', () => {
    renderOverview();

    fireEvent.press(screen.getByTestId('progress-overview-view-details'));

    expect(onViewDetails).toHaveBeenCalled();
  });

  it('shows the most recent real PRs as Recent Milestones, most recent first', () => {
    renderOverview();

    const milestone1 = screen.getByTestId('progress-overview-milestone-pr-ex-1-8');
    const milestone2 = screen.getByTestId('progress-overview-milestone-orm-ex-2');
    expect(milestone1).toHaveTextContent(/Bench Press/);
    expect(milestone2).toHaveTextContent(/Squat/);
  });

  it('calls onViewAllMilestones when "View All" is pressed', () => {
    renderOverview();

    fireEvent.press(screen.getByTestId('progress-overview-view-all-milestones'));

    expect(onViewAllMilestones).toHaveBeenCalled();
  });

  it('navigates to exercise detail when a milestone row is pressed', () => {
    renderOverview();

    fireEvent.press(screen.getByTestId('progress-overview-milestone-pr-ex-1-8'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-1',
      exerciseName: 'Bench Press',
    });
  });

  it('does not show the Recent Milestones card when there are no PRs at all', () => {
    renderOverview({ repPRs: [], oneRepMaxes: [] });

    expect(screen.queryByText('Recent Milestones')).toBeNull();
  });
});
