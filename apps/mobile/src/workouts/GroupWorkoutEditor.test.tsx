import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  addExerciseToWorkout,
  fetchNextExerciseOrderIndex,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  type WorkoutDetail,
} from './workoutQueries';
import { GroupWorkoutEditor } from './GroupWorkoutEditor';

jest.mock('./workoutQueries', () => ({
  addExerciseToWorkout: jest.fn(),
  createSet: jest.fn(),
  fetchNextExerciseOrderIndex: jest.fn(),
  fetchPreviousPerformance: jest.fn(async () => null),
  fetchWorkoutDetail: jest.fn(),
  removeExerciseFromWorkout: jest.fn(async () => undefined),
  updateSet: jest.fn(),
}));

jest.mock('./ExercisePickerModal', () => ({
  ExercisePickerModal: jest.fn(() => null),
}));

jest.mock('../screens/ExerciseFormScreen', () => ({
  ExerciseFormScreen: () => null,
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ weightUnit: 'kg', theme: { accent: '#3DDC97', onAccent: '#000000' } }),
}));

const mockFetch = fetchWorkoutDetail as jest.Mock;
const mockRemove = removeExerciseFromWorkout as jest.Mock;
const mockAdd = addExerciseToWorkout as jest.Mock;
const mockNextOrderIndex = fetchNextExerciseOrderIndex as jest.Mock;

/** One person's workout: the shared squat, with their own weight and reps on its set. */
function workoutFor(workoutId: string, weightKg: number, reps: number): WorkoutDetail {
  return {
    id: workoutId,
    name: 'Leg Day',
    performedAt: '2026-10-06T09:00:00.000Z',
    completedAt: null,
    exercises: [
      {
        id: `${workoutId}-we-1`,
        exerciseId: 'squat',
        exerciseName: 'Back Squat',
        photoUrl: null,
        muscleGroup: 'legs',
        movementType: 'bilateral',
        loggingStyle: 'weight_reps',
        orderIndex: 1,
        sets: [
          {
            id: `${workoutId}-set-1`,
            workoutExerciseId: `${workoutId}-we-1`,
            setIndex: 1,
            side: 'none',
            weightKg,
            reps,
            completedAt: null,
          },
        ],
      },
    ],
  } as unknown as WorkoutDetail;
}

const members = [
  { userId: 'me', displayName: 'Harbir Bains', workoutId: 'w-me' },
  { userId: 'sam', displayName: 'Sam Lifts', workoutId: 'w-sam' },
];

beforeEach(() => {
  mockFetch
    .mockReset()
    .mockImplementation(async (workoutId: string) =>
      workoutId === 'w-me' ? workoutFor('w-me', 100, 5) : workoutFor('w-sam', 60, 8),
    );
  mockRemove.mockClear();
  mockAdd.mockReset().mockResolvedValue('we-new');
  mockNextOrderIndex.mockReset().mockResolvedValue(7);
});

function renderEditor() {
  return render(
    <GroupWorkoutEditor
      members={members}
      startedAt="2026-10-06T09:00:00.000Z"
      userId="me"
      accentColor="#3DDC97"
      onAccentColor="#000000"
      testID="group-workout"
    />,
  );
}

describe('GroupWorkoutEditor', () => {
  it('shows a tab for each person, with you first', async () => {
    renderEditor();

    expect(await screen.findByText('You')).toBeTruthy();
    expect(screen.getByText('Sam')).toBeTruthy();
  });

  it('shows the group exercise on every tab, but each tab shows its own sets', async () => {
    renderEditor();

    expect(await screen.findByDisplayValue('100')).toBeTruthy();
    expect(screen.queryByDisplayValue('60')).toBeNull();

    fireEvent.press(screen.getByText('Sam'));

    expect(await screen.findByDisplayValue('60')).toBeTruthy();
    expect(screen.queryByDisplayValue('100')).toBeNull();
    expect(screen.getByTestId('group-workout-exercise-squat')).toBeTruthy();
  });

  it("removing an exercise removes it from every person's workout", async () => {
    renderEditor();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    fireEvent.press(await screen.findByTestId('group-workout-exercise-squat-remove'));
    // Confirm the removal in the alert: the second button is "Remove".
    const buttons = alertSpy.mock.calls[0][2] ?? [];
    buttons[1].onPress?.();
    alertSpy.mockRestore();

    await waitFor(() => expect(mockRemove).toHaveBeenCalledTimes(2));
    expect(mockRemove).toHaveBeenCalledWith('w-me-we-1');
    expect(mockRemove).toHaveBeenCalledWith('w-sam-we-1');
  });

  it('lets anyone create a custom exercise, from the editor', async () => {
    renderEditor();

    expect(await screen.findByTestId('group-workout-create-custom')).toBeTruthy();
  });

  it("adds a picked exercise to every person's workout, at the order index the workout has never used", async () => {
    // A removed exercise still holds its order index, so the right next one can be far
    // ahead of what the currently visible exercises alone would suggest.
    mockNextOrderIndex.mockResolvedValue(7);
    renderEditor();
    await screen.findByTestId('group-workout-exercise-squat');

    const { ExercisePickerModal } = jest.requireMock('./ExercisePickerModal') as {
      ExercisePickerModal: jest.Mock;
    };
    const onSelect = ExercisePickerModal.mock.calls.at(-1)?.[0].onSelect as (
      exercise: unknown,
    ) => void;
    await act(async () => {
      onSelect({
        id: 'ex-lat-pulldown',
        name: 'Lat Pulldown',
        muscleGroup: 'back',
        movementType: 'bilateral',
        photoUrl: null,
        isActive: true,
        createdBy: null,
      });
    });

    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('w-me', 'ex-lat-pulldown', 7));
    expect(mockAdd).toHaveBeenCalledWith('w-sam', 'ex-lat-pulldown', 7);
  });
});
