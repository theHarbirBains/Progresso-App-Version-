import { fireEvent, render, screen } from '@testing-library/react-native';
import { OneRepMaxSection } from './OneRepMaxSection';

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate };

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('OneRepMaxSection', () => {
  it('shows the empty state with no recorded 1RMs', () => {
    render(
      <OneRepMaxSection
        oneRepMaxes={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    expect(screen.getByTestId('progress-1rm-empty')).toHaveTextContent(
      'Log a single-rep set to record your first 1 Rep Max.',
    );
  });

  it('shows true 1RMs sorted heaviest first', () => {
    render(
      <OneRepMaxSection
        oneRepMaxes={[
          {
            weightKg: 100,
            sourceSetId: 'set-1',
            achievedAt: '2026-01-01T12:00:00Z',
            exerciseId: 'ex-squat',
            exerciseName: 'Squat',
          },
          {
            weightKg: 140,
            sourceSetId: 'set-2',
            achievedAt: '2026-02-01T12:00:00Z',
            exerciseId: 'ex-bench',
            exerciseName: 'Bench Press',
          },
        ]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    expect(screen.getByTestId('progress-1rm-row-ex-bench')).toHaveTextContent(/140/);
  });

  it('navigates to exercise detail on press', () => {
    render(
      <OneRepMaxSection
        oneRepMaxes={[
          {
            weightKg: 140,
            sourceSetId: 'set-2',
            achievedAt: '2026-02-01T12:00:00Z',
            exerciseId: 'ex-bench',
            exerciseName: 'Bench Press',
          },
        ]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    fireEvent.press(screen.getByTestId('progress-1rm-row-ex-bench'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
    });
  });
});
