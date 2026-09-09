import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExercisesSection } from './ExercisesSection';

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate };

const groups = [
  {
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    sets: [
      { weightKg: 100, reps: 5, performedAt: '2026-01-01T12:00:00Z', workoutExerciseId: 'we1' },
      { weightKg: 120, reps: 5, performedAt: '2026-02-15T12:00:00Z', workoutExerciseId: 'we2' },
    ],
  },
  {
    exerciseId: 'ex-squat',
    exerciseName: 'Squat',
    sets: [
      { weightKg: 150, reps: 5, performedAt: '2026-01-01T12:00:00Z', workoutExerciseId: 'we3' },
    ],
  },
];

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('ExercisesSection', () => {
  it('shows the empty state with no tracked exercises', () => {
    render(
      <ExercisesSection
        groups={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    expect(screen.getByTestId('progress-exercises-empty')).toHaveTextContent(
      'Complete a workout to start tracking your strength.',
    );
  });

  it('lists every tracked exercise, most-improved first', () => {
    render(
      <ExercisesSection
        groups={groups}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    expect(screen.getByTestId('progress-exercise-row-ex-bench')).toHaveTextContent(/Bench Press/);
    expect(screen.getByTestId('progress-exercise-row-ex-squat')).toHaveTextContent(/Squat/);
  });

  it('filters by search query', () => {
    render(
      <ExercisesSection
        groups={groups}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    fireEvent.changeText(screen.getByTestId('progress-exercises-search'), 'squat');

    expect(screen.getByTestId('progress-exercise-row-ex-squat')).toBeTruthy();
    expect(screen.queryByTestId('progress-exercise-row-ex-bench')).toBeNull();
  });

  it('shows a no-results state for a search that matches nothing', () => {
    render(
      <ExercisesSection
        groups={groups}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    fireEvent.changeText(screen.getByTestId('progress-exercises-search'), 'deadlift');

    expect(screen.getByTestId('progress-exercises-no-results')).toHaveTextContent(
      'No matching exercises',
    );
  });

  it('navigates to the existing exercise detail screen on press -- no duplicate detail experience', () => {
    render(
      <ExercisesSection
        groups={groups}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    fireEvent.press(screen.getByTestId('progress-exercise-row-ex-bench'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
    });
  });
});
