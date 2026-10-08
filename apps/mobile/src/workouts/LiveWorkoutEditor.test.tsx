import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LiveWorkoutEditor } from './LiveWorkoutEditor';
import {
  addExerciseToWorkout,
  createSet,
  deleteSet,
  fetchNextExerciseOrderIndex,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  updateSet,
} from './workoutQueries';

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ weightUnit: 'kg' }),
}));

jest.mock('./ExercisePickerModal', () => ({
  ExercisePickerModal: jest.fn(() => null),
}));

jest.mock('./workoutQueries', () => ({
  addExerciseToWorkout: jest.fn(),
  createSet: jest.fn(),
  deleteSet: jest.fn(),
  fetchNextExerciseOrderIndex: jest.fn(),
  fetchWorkoutDetail: jest.fn(),
  removeExerciseFromWorkout: jest.fn(),
  updateSet: jest.fn(),
}));

const mockDetail = fetchWorkoutDetail as jest.Mock;
const mockCreateSet = createSet as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;
const mockAdd = addExerciseToWorkout as jest.Mock;
const mockNextOrderIndex = fetchNextExerciseOrderIndex as jest.Mock;
const mockDeleteSet = deleteSet as jest.Mock;
const mockRemove = removeExerciseFromWorkout as jest.Mock;

const workout = (sets: unknown[]) => ({
  id: 'w1',
  name: 'Legs',
  performedAt: '2026-10-06T09:00:00.000Z',
  completedAt: null,
  workoutSplitDayId: null,
  exercises: [
    {
      id: 'we1',
      exerciseId: 'ex1',
      exerciseName: 'Barbell Back Squat',
      photoUrl: null,
      muscleGroup: 'quadriceps',
      movementType: 'bilateral',
      loggingStyle: null,
      orderIndex: 1,
      sets,
    },
  ],
});

const set = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  setIndex: 1,
  weightKg: 100,
  reps: 5,
  completedAt: null,
  side: 'none',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDetail.mockResolvedValue(workout([set()]));
  mockCreateSet.mockResolvedValue({});
  mockUpdateSet.mockResolvedValue({});
  mockAdd.mockResolvedValue('we2');
  mockNextOrderIndex.mockResolvedValue(7);
  mockDeleteSet.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
});

describe('LiveWorkoutEditor', () => {
  it('shows the workout’s exercises and their sets with the saved values', async () => {
    render(<LiveWorkoutEditor workoutId="w1" userId="u1" testID="ed" />);

    expect(await screen.findByText('Barbell Back Squat')).toBeTruthy();
    expect(screen.getByTestId('ed-set-s1-weight').props.value).toBe('100');
    expect(screen.getByTestId('ed-set-s1-reps').props.value).toBe('5');
  });

  it('adds the next set to an exercise', async () => {
    render(<LiveWorkoutEditor workoutId="w1" userId="u1" testID="ed" />);

    fireEvent.press(await screen.findByTestId('ed-add-set-we1'));

    await waitFor(() => expect(mockCreateSet).toHaveBeenCalledWith('we1', 2));
  });

  it('saves an edited weight when the field loses focus, in the unit the person uses', async () => {
    render(<LiveWorkoutEditor workoutId="w1" userId="u1" testID="ed" />);

    fireEvent.changeText(await screen.findByTestId('ed-set-s1-weight'), '102.5');
    fireEvent(screen.getByTestId('ed-set-s1-weight'), 'blur');

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ weightKg: 102.5 }),
      ),
    );
  });

  it('marks a set done with a time, and undoes it', async () => {
    render(<LiveWorkoutEditor workoutId="w1" userId="u1" testID="ed" />);

    fireEvent.press(await screen.findByTestId('ed-set-s1-done'));

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith('s1', { completedAt: expect.any(String) }),
    );
  });

  it('removes a set, and an exercise, from the workout', async () => {
    render(<LiveWorkoutEditor workoutId="w1" userId="u1" testID="ed" />);

    fireEvent.press(await screen.findByTestId('ed-set-s1-remove'));
    await waitFor(() => expect(mockDeleteSet).toHaveBeenCalledWith('s1'));

    fireEvent.press(await screen.findByTestId('ed-remove-exercise-we1'));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('we1'));
  });

  it('uses the resolved exercise when a live session picks one', async () => {
    const resolveExerciseId = jest.fn(async () => 'client-copy-1');
    render(
      <LiveWorkoutEditor
        workoutId="w1"
        userId="trainer-1"
        resolveExerciseId={resolveExerciseId}
        testID="ed"
      />,
    );
    await screen.findByText('Barbell Back Squat');

    // The picker is mocked closed; exercise to add is exercised through the resolver contract.
    expect(resolveExerciseId).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("adds a picked exercise at the order index the workout has never used, resolved to the client's copy", async () => {
    // A removed exercise still holds its order index, so the right next one can be far
    // ahead of what the one currently visible exercise alone would suggest (which would be 2).
    mockNextOrderIndex.mockResolvedValue(7);
    const resolveExerciseId = jest.fn(async () => 'client-copy-1');
    render(
      <LiveWorkoutEditor
        workoutId="w1"
        userId="trainer-1"
        resolveExerciseId={resolveExerciseId}
        testID="ed"
      />,
    );
    await screen.findByText('Barbell Back Squat');

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

    await waitFor(() => expect(resolveExerciseId).toHaveBeenCalledWith('ex-lat-pulldown'));
    expect(mockAdd).toHaveBeenCalledWith('w1', 'client-copy-1', 7);
  });
});
