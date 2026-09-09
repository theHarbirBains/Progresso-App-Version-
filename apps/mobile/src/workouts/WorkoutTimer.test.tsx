import { act, render, screen } from '@testing-library/react-native';
import { WorkoutTimer } from './WorkoutTimer';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:30.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('WorkoutTimer', () => {
  it('shows the elapsed time since performedAt', () => {
    render(<WorkoutTimer testID="timer" performedAt="2026-01-01T00:00:00.000Z" active={true} />);
    expect(screen.getByTestId('timer')).toHaveTextContent('00:30');
  });

  it('ticks forward every second while active', () => {
    render(<WorkoutTimer testID="timer" performedAt="2026-01-01T00:00:00.000Z" active={true} />);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId('timer')).toHaveTextContent('00:33');
  });

  it('does not tick while inactive', () => {
    render(<WorkoutTimer testID="timer" performedAt="2026-01-01T00:00:00.000Z" active={false} />);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('timer')).toHaveTextContent('00:30');
  });
});
