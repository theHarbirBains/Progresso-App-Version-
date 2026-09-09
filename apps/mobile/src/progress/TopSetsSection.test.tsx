import { fireEvent, render, screen } from '@testing-library/react-native';
import { TopSetsSection } from './TopSetsSection';

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
      { weightKg: 150, reps: 3, performedAt: '2026-01-10T12:00:00Z', workoutExerciseId: 'we3' },
    ],
  },
];

function renderTopSets() {
  return render(
    <TopSetsSection
      groups={groups}
      weightUnit="kg"
      accentColor="#2F80FF"
      onAccentColor="#FFFFFF"
      navigation={navigation}
    />,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('TopSetsSection', () => {
  it('shows the empty state with no logged sets', () => {
    render(
      <TopSetsSection
        groups={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        onAccentColor="#FFFFFF"
        navigation={navigation}
      />,
    );

    expect(screen.getByTestId('progress-topsets-empty')).toHaveTextContent(
      'Your best sets will appear here as you train.',
    );
  });

  it('shows the most recent top set first by default', () => {
    renderTopSets();

    expect(screen.getByTestId('progress-topset-row-0')).toHaveTextContent(/120/);
  });

  it('sorts by heaviest weight when selected', () => {
    renderTopSets();

    fireEvent.press(screen.getByTestId('progress-topsets-sort-weight'));

    expect(screen.getByTestId('progress-topset-row-0')).toHaveTextContent(/150/);
  });

  it('filters by search query', () => {
    renderTopSets();

    fireEvent.changeText(screen.getByTestId('progress-topsets-search'), 'squat');

    expect(screen.getByTestId('progress-topset-row-0')).toHaveTextContent(/Squat/);
  });

  it('navigates to exercise detail on press', () => {
    renderTopSets();

    fireEvent.press(screen.getByTestId('progress-topset-row-0'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
    });
  });
});
