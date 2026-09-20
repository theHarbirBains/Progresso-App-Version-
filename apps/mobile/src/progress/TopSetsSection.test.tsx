import { fireEvent, render, screen } from '@testing-library/react-native';
import type { HistoricalSetWithExercise } from '../workouts/allExerciseHistoryQueries';
import { TopSetsSection } from './TopSetsSection';

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate };

function set(overrides: Partial<HistoricalSetWithExercise> = {}): HistoricalSetWithExercise {
  return {
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
    weightKg: 100,
    reps: 8,
    performedAt: '2026-01-01T12:00:00Z',
    workoutExerciseId: 'we1',
    ...overrides,
  };
}

const history: HistoricalSetWithExercise[] = [
  // Bench Press: two qualifying sets -- 120kg x 8 should win over 100kg x 8.
  set({
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    weightKg: 100,
    reps: 8,
  }),
  set({
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    weightKg: 120,
    reps: 8,
  }),
  // Squat: only a sub-5-rep set -- never qualifies, must not appear.
  set({
    exerciseId: 'ex-squat',
    exerciseName: 'Squat',
    muscleGroup: 'quadriceps',
    weightKg: 150,
    reps: 3,
  }),
  // Lat Pulldown: one qualifying set, a different muscle group (back).
  set({
    exerciseId: 'ex-lat',
    exerciseName: 'Lat Pulldown',
    muscleGroup: 'back',
    weightKg: 80,
    reps: 7,
  }),
];

function renderTopSets(overrideHistory: HistoricalSetWithExercise[] = history) {
  return render(
    <TopSetsSection
      history={overrideHistory}
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
  it('shows a compact "Top Sets" title and supporting text, even when empty', () => {
    renderTopSets([set({ reps: 3 })]);

    expect(screen.getByText('Top Sets')).toBeTruthy();
    expect(screen.getByText('Your best set for each exercise within the rep range.')).toBeTruthy();
  });

  it('shows the empty state with no qualifying top sets at all', () => {
    renderTopSets([set({ reps: 3 })]);

    expect(screen.getByTestId('progress-topsets-empty')).toHaveTextContent(
      'Your best sets will appear here as you train.',
    );
  });

  it('shows the same compact title/subtitle when the list is populated', () => {
    renderTopSets();

    expect(screen.getByText('Top Sets')).toBeTruthy();
    expect(screen.getByText('Your best set for each exercise within the rep range.')).toBeTruthy();
  });

  it('shows one row per exercise, alphabetically, using each exercise’s best qualifying set', () => {
    renderTopSets();

    // Squat never qualifies (only a 3-rep set) -- Bench Press and Lat
    // Pulldown only, alphabetical: Bench Press before Lat Pulldown.
    expect(screen.getByTestId('progress-topset-row-ex-bench')).toHaveTextContent(/120kg.*8/);
    expect(screen.getByTestId('progress-topset-row-ex-lat')).toHaveTextContent(/80kg.*7/);
    expect(screen.queryByTestId('progress-topset-row-ex-squat')).toBeNull();

    const list = screen.getByTestId('progress-topsets-list');
    const names = list.props.data.map((r: { exerciseName: string }) => r.exerciseName);
    expect(names).toEqual(['Bench Press', 'Lat Pulldown']);
  });

  it('shows the muscle group under each exercise name', () => {
    renderTopSets();

    expect(screen.getByTestId('progress-topset-row-ex-bench')).toHaveTextContent(/Chest/);
    expect(screen.getByTestId('progress-topset-row-ex-lat')).toHaveTextContent(/Back/);
  });

  it('filters by search query', () => {
    renderTopSets();

    fireEvent.changeText(screen.getByTestId('progress-topsets-search'), 'lat');

    expect(screen.getByTestId('progress-topset-row-ex-lat')).toBeTruthy();
    expect(screen.queryByTestId('progress-topset-row-ex-bench')).toBeNull();
  });

  it('filters by muscle group, with "All" selected by default', () => {
    renderTopSets();

    expect(screen.getByTestId('muscle-group-chip-all').props.accessibilityState.selected).toBe(
      true,
    );

    fireEvent.press(screen.getByTestId('muscle-group-chip-back'));

    expect(screen.getByTestId('progress-topset-row-ex-lat')).toBeTruthy();
    expect(screen.queryByTestId('progress-topset-row-ex-bench')).toBeNull();
  });

  it('combines search and muscle-group filtering', () => {
    renderTopSets();

    fireEvent.press(screen.getByTestId('muscle-group-chip-chest'));
    fireEvent.changeText(screen.getByTestId('progress-topsets-search'), 'press');

    expect(screen.getByTestId('progress-topset-row-ex-bench')).toBeTruthy();
    expect(screen.queryByTestId('progress-topset-row-ex-lat')).toBeNull();

    fireEvent.changeText(screen.getByTestId('progress-topsets-search'), 'pulldown');

    expect(screen.queryByTestId('progress-topset-row-ex-bench')).toBeNull();
    expect(screen.getByTestId('progress-topsets-no-results')).toBeTruthy();
  });

  it('shows a "no matching exercises" state when filters exclude everything', () => {
    renderTopSets();

    fireEvent.changeText(screen.getByTestId('progress-topsets-search'), 'nonexistent');

    expect(screen.getByTestId('progress-topsets-no-results')).toHaveTextContent(
      'No matching exercises',
    );
  });

  it('navigates to exercise detail on press', () => {
    renderTopSets();

    fireEvent.press(screen.getByTestId('progress-topset-row-ex-bench'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
    });
  });

  // Unilateral exercises stay one exercise -- both sides' sets are just
  // separate candidates for the same exerciseId (no side field in this
  // history feed), and only the single best-qualifying one is shown.
  it('shows one row for a unilateral exercise, picking its best qualifying set across sides', () => {
    renderTopSets([
      set({
        exerciseId: 'ex-row',
        exerciseName: 'Single-Arm Row',
        muscleGroup: 'back',
        weightKg: 40,
        reps: 8,
      }),
      set({
        exerciseId: 'ex-row',
        exerciseName: 'Single-Arm Row',
        muscleGroup: 'back',
        weightKg: 45,
        reps: 6,
      }),
    ]);

    expect(screen.getByTestId('progress-topsets-list').props.data).toHaveLength(1);
    expect(screen.getByTestId('progress-topset-row-ex-row')).toHaveTextContent(/45kg.*6/);
  });
});
