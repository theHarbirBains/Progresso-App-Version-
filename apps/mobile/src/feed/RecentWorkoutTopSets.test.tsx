import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as navigationTransitions from '../navigation/navigationTransitions';
import type { WorkoutTopSet } from '../workouts/recentWorkoutTopSets';
import { RecentWorkoutTopSets } from './RecentWorkoutTopSets';

const topSets: WorkoutTopSet[] = [
  { exerciseId: 'bench', exerciseName: 'Bench Press', photoUrl: null, weightKg: 225, reps: 8 },
  { exerciseId: 'pulldown', exerciseName: 'Lat Pulldown', photoUrl: null, weightKg: 160, reps: 10 },
  { exerciseId: 'row', exerciseName: 'Barbell Row', photoUrl: null, weightKg: 135, reps: 6 },
];

function selectedDot(testID: string): number {
  for (let i = 0; i < 3; i++) {
    if (screen.getByTestId(`${testID}-dot-${i}`).props.accessibilityState.selected) return i;
  }
  return -1;
}

describe('RecentWorkoutTopSets', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(navigationTransitions, 'useReduceMotionPreference').mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the heading, the first exercise and its top-set readout', () => {
    render(<RecentWorkoutTopSets testID="top" topSets={topSets} weightUnit="kg" />);

    expect(screen.getByText('Top Sets')).toBeTruthy();
    expect(screen.getByText('Bench Press')).toBeTruthy();
    expect(screen.getByText('225 kg × 8')).toBeTruthy();
    expect(screen.getByText('Lat Pulldown')).toBeTruthy();
  });

  it('shows one pagination dot per top set, with the first selected', () => {
    render(<RecentWorkoutTopSets testID="top" topSets={topSets} weightUnit="kg" />);

    expect(screen.getByTestId('top-dot-0')).toBeTruthy();
    expect(screen.getByTestId('top-dot-2')).toBeTruthy();
    expect(selectedDot('top')).toBe(0);
  });

  it('advances to the next exercise about every 3.5 seconds, wrapping back to the first', () => {
    render(<RecentWorkoutTopSets testID="top" topSets={topSets} weightUnit="kg" />);

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(selectedDot('top')).toBe(1);

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(selectedDot('top')).toBe(2);

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(selectedDot('top')).toBe(0);
  });

  it('shows a single top set without any pagination or auto-advance', () => {
    render(<RecentWorkoutTopSets testID="top" topSets={[topSets[0]]} weightUnit="kg" />);

    expect(screen.queryByTestId('top-dot-0')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(screen.getByText('Bench Press')).toBeTruthy();
  });

  it('shows a graceful empty state when there is no qualifying top set', () => {
    render(<RecentWorkoutTopSets testID="top" topSets={[]} weightUnit="kg" />);

    expect(screen.getByText('Top Sets')).toBeTruthy();
    expect(screen.getByTestId('top-empty')).toBeTruthy();
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it("formats in the user's own unit", () => {
    render(<RecentWorkoutTopSets testID="top" topSets={[topSets[1]]} weightUnit="lb" />);

    expect(screen.getByText(/lb × 10/)).toBeTruthy();
  });

  it('shows the exercise photo beside its top set only when the exercise has one', () => {
    render(
      <RecentWorkoutTopSets
        testID="top"
        topSets={[{ ...topSets[0], photoUrl: 'https://example.com/bench.jpg' }, topSets[1]]}
        weightUnit="kg"
      />,
    );

    expect(screen.getByTestId('top-photo-bench-zoom')).toBeTruthy();
    expect(screen.queryByTestId('top-photo-pulldown-zoom')).toBeNull();
    expect(screen.getByText('Lat Pulldown')).toBeTruthy();
  });

  it('opens the full-size photo when the exercise photo is tapped', () => {
    render(
      <RecentWorkoutTopSets
        testID="top"
        topSets={[{ ...topSets[0], photoUrl: 'https://example.com/bench.jpg' }]}
        weightUnit="kg"
      />,
    );

    expect(screen.queryByTestId('top-photo-bench-lightbox-close')).toBeNull();
    fireEvent.press(screen.getByTestId('top-photo-bench-zoom'));
    expect(screen.getByTestId('top-photo-bench-lightbox-close')).toBeTruthy();
  });

  it('does not render a photo for an exercise without one', () => {
    render(<RecentWorkoutTopSets testID="top" topSets={[topSets[0]]} weightUnit="kg" />);

    expect(screen.queryByTestId('top-photo-bench-zoom')).toBeNull();
    expect(screen.getByText('Bench Press')).toBeTruthy();
  });
});
