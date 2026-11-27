import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import { OverviewSection } from './OverviewSection';

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate };

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

const onViewAllMilestones = jest.fn();

function renderOverview(overrides: Partial<Parameters<typeof OverviewSection>[0]> = {}) {
  return render(
    <OverviewSection
      groups={groups}
      repPRs={repPRs}
      oneRepMaxes={oneRepMaxes}
      weightUnit="kg"
      accentColor="#2F80FF"
      navigation={navigation}
      onViewAllMilestones={onViewAllMilestones}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  onViewAllMilestones.mockClear();
});

describe('OverviewSection', () => {
  it('shows an empty state when there is no exercise history at all', () => {
    renderOverview({ groups: [] });

    expect(screen.getByTestId('progress-overview-empty')).toBeTruthy();
  });

  it('leaves the lifetime counts to All Time -- never the same figures twice', () => {
    renderOverview();

    for (const stat of ['workouts', 'prs', 'exercises', 'sets']) {
      expect(screen.queryByTestId(`progress-overview-stat-${stat}`)).toBeNull();
    }
  });

  it('has no "View Details" link', () => {
    renderOverview();

    expect(screen.queryByTestId('progress-overview-view-details')).toBeNull();
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
