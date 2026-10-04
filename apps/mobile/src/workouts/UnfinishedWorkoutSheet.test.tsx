import { fireEvent, render, screen } from '@testing-library/react-native';
import { UnfinishedWorkoutSheet } from './UnfinishedWorkoutSheet';
import type { UnfinishedWorkoutAssessment } from './unfinishedWorkoutState';

const assessment: UnfinishedWorkoutAssessment = {
  state: 'suspected_complete',
  lastActivityAt: '2026-10-04T14:00:00.000Z',
  idleMinutes: 200,
  completedSetCount: 18,
  completedExerciseCount: 6,
  plannedBlankSetCount: 0,
  suggestedEndAt: '2026-10-04T14:00:00.000Z',
  suggestedDurationMinutes: 58,
};

function renderSheet(overrides: Partial<Parameters<typeof UnfinishedWorkoutSheet>[0]> = {}) {
  const handlers = { onFinish: jest.fn(), onResume: jest.fn(), onNotNow: jest.fn() };
  render(
    <UnfinishedWorkoutSheet
      visible
      workoutName="Chest & Triceps"
      assessment={assessment}
      finishing={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('UnfinishedWorkoutSheet', () => {
  it('asks the question with the workout name and a summary of what was logged', () => {
    renderSheet();

    expect(screen.getByText('Did you finish this workout?')).toBeTruthy();
    expect(screen.getByText('Chest & Triceps')).toBeTruthy();
    expect(screen.getByTestId('unfinished-workout-summary')).toHaveTextContent(
      '6 exercises · 18 sets · 58 min',
    );
  });

  it('calls onFinish from Finish Workout', () => {
    const { onFinish } = renderSheet();

    fireEvent.press(screen.getByTestId('unfinished-workout-finish'));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('calls onResume from Resume Workout without finishing anything', () => {
    const { onResume, onFinish } = renderSheet();

    fireEvent.press(screen.getByTestId('unfinished-workout-resume'));

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('calls onNotNow from Not now', () => {
    const { onNotNow } = renderSheet();

    fireEvent.press(screen.getByTestId('unfinished-workout-not-now'));

    expect(onNotNow).toHaveBeenCalledTimes(1);
  });

  it('offers no Discard action: discarding stays in the existing cancel flow', () => {
    renderSheet();

    expect(screen.queryByText(/discard/i)).toBeNull();
    expect(screen.queryByText(/delete/i)).toBeNull();
  });

  it('hides Finish when there is no duration to suggest, leaving Resume and Not now', () => {
    renderSheet({
      assessment: { ...assessment, suggestedEndAt: null, suggestedDurationMinutes: null },
    });

    expect(screen.queryByTestId('unfinished-workout-finish')).toBeNull();
    expect(screen.getByTestId('unfinished-workout-resume')).toBeTruthy();
    expect(screen.getByTestId('unfinished-workout-not-now')).toBeTruthy();
  });

  it('says how many unfilled sets will be left out, singular and plural', () => {
    const { unmount } = render(
      <UnfinishedWorkoutSheet
        visible
        workoutName="Leg Day"
        assessment={{ ...assessment, plannedBlankSetCount: 1 }}
        finishing={false}
        onFinish={jest.fn()}
        onResume={jest.fn()}
        onNotNow={jest.fn()}
      />,
    );
    expect(screen.getByTestId('unfinished-workout-blank-note')).toHaveTextContent(
      '1 unfilled set will be left out.',
    );
    unmount();

    renderSheet({ assessment: { ...assessment, plannedBlankSetCount: 2 } });
    expect(screen.getByTestId('unfinished-workout-blank-note')).toHaveTextContent(
      '2 unfilled sets will be left out.',
    );
  });

  it('states that the end time is the last logged set', () => {
    renderSheet();

    expect(screen.getByText(/Ends at your last logged set/)).toBeTruthy();
  });
});
