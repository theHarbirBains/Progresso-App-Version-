import { fireEvent, render, screen } from '@testing-library/react-native';
import type {
  ExerciseHistoryGroup,
  HistoricalSetWithExercise,
} from '../workouts/allExerciseHistoryQueries';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import type { WorkoutSummary } from '../workouts/workoutQueries';
import { AllTimeSection } from './AllTimeSection';
import type { LifetimeStats } from './lifetimeStats';

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

function set(overrides: Partial<HistoricalSetWithExercise> = {}): HistoricalSetWithExercise {
  return {
    weightKg: 100,
    reps: 5,
    performedAt: '2026-01-01T00:00:00Z',
    workoutExerciseId: 'we1',
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
    ...overrides,
  };
}

const history: HistoricalSetWithExercise[] = [
  set({
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    weightKg: 100,
    reps: 5,
  }),
  set({
    exerciseId: 'ex-2',
    exerciseName: 'Barbell Squat',
    muscleGroup: 'quadriceps',
    weightKg: 140,
    reps: 5,
    workoutExerciseId: 'we2',
  }),
];

const groups: ExerciseHistoryGroup[] = [
  { exerciseId: 'ex-1', exerciseName: 'Bench Press', sets: [{ ...history[0] }] },
  { exerciseId: 'ex-2', exerciseName: 'Barbell Squat', sets: [{ ...history[1] }] },
];

const completedWorkouts: WorkoutSummary[] = [
  {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-01T01:00:00Z',
    workoutSplitDayId: null,
  },
];

const repPRs: RepPRWithExercise[] = [
  {
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    bestWeightKg: 100,
    reps: 5,
    achievedAt: '2026-01-01T00:00:00Z',
    sourceSetId: 'set-1',
  },
];

const oneRepMaxes: OneRepMaxWithExercise[] = [];

function renderAllTime(overrides: Partial<Parameters<typeof AllTimeSection>[0]> = {}) {
  return render(
    <AllTimeSection
      groups={groups}
      history={history}
      completedWorkouts={completedWorkouts}
      lifetimeStats={lifetimeStats}
      totalCompletedSets={history.length}
      totalPRs={repPRs.length + oneRepMaxes.length}
      repPRs={repPRs}
      oneRepMaxes={oneRepMaxes}
      weightUnit="kg"
      accentColor="#2F80FF"
      navigation={navigation}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('AllTimeSection', () => {
  it('shows an empty state when there is no exercise history at all', () => {
    renderAllTime({ groups: [], history: [] });

    expect(screen.getByTestId('progress-all-time-empty')).toBeTruthy();
  });

  it('shows the "All Time" hero with no fabricated content', () => {
    renderAllTime();

    expect(screen.getByTestId('progress-all-time-hero')).toHaveTextContent(/All Time/);
  });

  it('shows real lifetime stats -- never Total Calories', () => {
    renderAllTime();

    expect(screen.getByTestId('progress-all-time-stat-workouts')).toHaveTextContent(/18/);
    expect(screen.getByTestId('progress-all-time-stat-sets')).toHaveTextContent(/2/);
    expect(screen.getByTestId('progress-all-time-stat-volume')).toHaveTextContent(/1,200 kg/);
    expect(screen.getByTestId('progress-all-time-stat-prs')).toHaveTextContent(/1/);
    expect(screen.queryByText(/Total Calories/)).toBeNull();
    expect(screen.queryByText(/calor/i)).toBeNull();
  });

  it('shows All Time Personal Records using the real Top Set data, heaviest first', () => {
    renderAllTime();

    const card = screen.getByTestId('progress-all-time-prs');
    expect(card).toHaveTextContent(/All Time Personal Records/);
    expect(card).toHaveTextContent(/See your strongest lifts/);
    expect(screen.getByTestId('progress-all-time-pr-ex-2')).toHaveTextContent(/Barbell Squat/);
    expect(screen.getByTestId('progress-all-time-pr-ex-2')).toHaveTextContent(/140/);
  });

  it('navigates to exercise detail when a personal record is pressed', () => {
    renderAllTime();

    fireEvent.press(screen.getByTestId('progress-all-time-pr-ex-1'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-1',
      exerciseName: 'Bench Press',
    });
  });

  it('shows Muscle Group Volume using real per-muscle-group volume totals', () => {
    renderAllTime();

    const card = screen.getByTestId('progress-all-time-muscle-volume');
    expect(card).toHaveTextContent(/Muscle Group Volume/);
    expect(card).toHaveTextContent(/All time total volume by muscle group/);
    expect(screen.getByTestId('progress-all-time-muscle-quadriceps')).toHaveTextContent(/700 kg/);
    expect(screen.getByTestId('progress-all-time-muscle-chest')).toHaveTextContent(/500 kg/);
  });

  it('shows Total Exercises and Avg Workouts/Week instead of a fabricated streak', () => {
    renderAllTime();

    expect(screen.getByTestId('progress-all-time-stat-exercises')).toHaveTextContent(/2/);
    expect(screen.getByTestId('progress-all-time-stat-frequency')).toHaveTextContent(/3\.5/);
    expect(screen.queryByText(/Workout Streak/)).toBeNull();
  });

  it('shows Top Exercises ranked by real lifetime volume', () => {
    renderAllTime();

    const card = screen.getByTestId('progress-all-time-top-exercises');
    expect(card).toHaveTextContent(/Top Exercises/);
    expect(card).toHaveTextContent(/By total volume/);
    expect(screen.getByTestId('progress-all-time-top-exercise-ex-2')).toHaveTextContent(
      /Barbell Squat/,
    );
  });

  it('shows Progress Highlights built from real milestones', () => {
    renderAllTime();

    const card = screen.getByTestId('progress-all-time-milestones');
    expect(card).toHaveTextContent(/Progress Highlights/);
    expect(card).toHaveTextContent(/All time milestones/);
    expect(screen.getByTestId('progress-all-time-milestone-workouts-1')).toHaveTextContent(
      /First Workout/,
    );
  });

  it('shows Relative Strength with an honest unavailable state -- no fake percentiles', () => {
    renderAllTime();

    const card = screen.getByTestId('progress-all-time-relative-strength');
    expect(card).toHaveTextContent(/Relative Strength/);
    expect(card).toHaveTextContent(/not available yet/i);
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/[Tt]op \d/)).toBeNull();
  });
});
