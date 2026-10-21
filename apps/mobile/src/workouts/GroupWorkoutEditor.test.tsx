import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  addExerciseToWorkout,
  createSet,
  fetchNextExerciseOrderIndex,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  type SetRecord,
  type WorkoutDetail,
} from './workoutQueries';
import { GroupWorkoutEditor } from './GroupWorkoutEditor';
import { colors } from '../design/theme';

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

// The signed-in person's own records and settings, for their own tab.
jest.mock('../progress/AllTimeStatsProvider', () => ({
  useAllTimeStats: () => ({
    repPRs: [
      {
        exerciseId: 'squat',
        reps: 5,
        bestWeightKg: 120,
        achievedAt: '2026-09-02T12:00:00.000Z',
        sourceSetId: 'pr-1',
      },
    ],
    exerciseRecords: [],
    refetch: jest.fn(),
  }),
}));

jest.mock('../profile/ProfileProvider', () => ({
  useProfile: () => ({
    profile: {
      repRangeMin: 3,
      repRangeMax: 6,
      progressionCuesEnabled: true,
      trainingComfort: null,
    },
    updateProfile: jest.fn(),
  }),
}));

jest.mock('./exerciseSettingsQueries', () => ({
  fetchExerciseSettings: jest.fn(async () => new Map()),
  saveExerciseSetting: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchAllExercises: jest.fn(async () => []),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ weightUnit: 'kg', theme: { accent: '#3DDC97', onAccent: '#000000' } }),
}));

const mockFetch = fetchWorkoutDetail as jest.Mock;
const mockRemove = removeExerciseFromWorkout as jest.Mock;
const mockAdd = addExerciseToWorkout as jest.Mock;
const mockNextOrderIndex = fetchNextExerciseOrderIndex as jest.Mock;
const mockCreateSet = createSet as jest.Mock;
const mockFetchPrevious = fetchPreviousPerformance as jest.Mock;

// Exercises and sets a test adds through the editor, returned by the next load of their workout.
let addedExercises: Record<string, WorkoutDetail['exercises']> = {};
let addedSets: Record<string, SetRecord[]> = {};

function loadWorkout(workoutId: string): WorkoutDetail {
  const base = workoutId === 'w-me' ? workoutFor('w-me', 100, 5) : workoutFor('w-sam', 60, 8);
  const exercises = [...base.exercises, ...(addedExercises[workoutId] ?? [])].map((exercise) => ({
    ...exercise,
    sets: [...exercise.sets, ...(addedSets[exercise.id] ?? [])],
  }));
  return { ...base, exercises };
}

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
  addedExercises = {};
  addedSets = {};
  mockFetch.mockReset().mockImplementation(async (workoutId: string) => loadWorkout(workoutId));
  mockRemove.mockClear();
  mockAdd.mockReset().mockResolvedValue('we-new');
  mockNextOrderIndex.mockReset().mockResolvedValue(7);
  mockCreateSet
    .mockReset()
    .mockImplementation(
      async (workoutExerciseId: string, setIndex: number, side?: 'left' | 'right') => {
        const set: SetRecord = {
          id: `${workoutExerciseId}-set-${setIndex}${side ? `-${side}` : ''}`,
          setIndex,
          side: side ?? null,
          weightKg: null,
          reps: null,
          completedAt: null,
        };
        addedSets[workoutExerciseId] = [...(addedSets[workoutExerciseId] ?? []), set];
        return set;
      },
    );
  mockFetchPrevious.mockReset().mockResolvedValue(null);
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
  it("shows your own range, all-time best and suggestion on your tab only -- never someone else's", async () => {
    mockFetchPrevious.mockImplementation(async (userId: string) => ({
      performedAt: '2026-10-01T09:00:00.000Z',
      sets: [
        {
          id: `prev-${userId}`,
          setIndex: 1,
          side: null,
          weightKg: userId === 'me' ? 100 : 60,
          reps: 5,
          completedAt: '2026-10-01T09:30:00.000Z',
        },
      ],
    }));
    renderEditor();

    expect(await screen.findByTestId('group-workout-rep-range')).toHaveTextContent(
      /Your rep range 3–6/,
    );
    expect(screen.getByTestId('group-workout-exercise-squat-best')).toHaveTextContent(
      /All-Time Best.*120 kg × 5/,
    );
    expect(await screen.findByTestId('group-workout-exercise-squat-cue')).toHaveTextContent(
      /Keep your top set weight the same until you reach 6 reps/,
    );
    fireEvent.press(screen.getByTestId('group-workout-exercise-squat-menu'));
    expect(screen.getByTestId('group-workout-exercise-squat-range')).toBeTruthy();

    fireEvent.press(screen.getByText('Sam'));

    // Sam's own last time still shows; nothing from your records or settings does.
    expect(await screen.findByTestId('group-workout-exercise-squat-last')).toHaveTextContent(
      /60 kg × 5/,
    );
    expect(screen.queryByTestId('group-workout-rep-range')).toBeNull();
    expect(screen.queryByTestId('group-workout-exercise-squat-best')).toBeNull();
    expect(screen.queryByTestId('group-workout-exercise-squat-cue')).toBeNull();
    expect(screen.queryByTestId('group-workout-exercise-squat-range')).toBeNull();
  });

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
    fireEvent.press(await screen.findByTestId('group-workout-exercise-squat-menu'));
    fireEvent.press(screen.getByTestId('group-workout-exercise-squat-remove'));
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

  it("fills the Create Custom Exercise modal with the warm background -- it's a native Modal, so Screen's own transparent root has nothing behind it otherwise", async () => {
    renderEditor();

    fireEvent.press(await screen.findByTestId('group-workout-create-custom'));

    const modal = StyleSheet.flatten(
      screen.getByTestId('group-workout-create-custom-modal').props.style,
    );
    expect(modal.backgroundColor).toBe(colors.background);
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

  it('starts a new set from the set before it', async () => {
    renderEditor();
    await screen.findByDisplayValue('100');

    fireEvent.press(screen.getByTestId('group-workout-exercise-squat-add-set'));

    const weight = await screen.findByTestId(
      'group-workout-exercise-squat-set-w-me-we-1-set-2-weight',
    );
    expect(weight.props.value).toBe('100');
    expect(
      screen.getByTestId('group-workout-exercise-squat-set-w-me-we-1-set-2-reps').props.value,
    ).toBe('5');
  });

  it("fills each person's first set of a new exercise from their own last session", async () => {
    mockAdd.mockImplementation(
      async (workoutId: string, exerciseId: string, orderIndex: number) => {
        const id = `${workoutId}-we-lat`;
        addedExercises[workoutId] = [
          {
            id,
            exerciseId,
            exerciseName: 'Lat Pulldown',
            photoUrl: null,
            muscleGroup: 'back',
            movementType: 'bilateral',
            loggingStyle: null,
            orderIndex,
            sets: [],
          },
        ];
        return id;
      },
    );
    mockFetchPrevious.mockImplementation(async (userId: string, exerciseId: string) =>
      exerciseId === 'ex-lat-pulldown'
        ? {
            performedAt: '2026-10-01T09:00:00.000Z',
            sets: [
              {
                id: `${userId}-last-1`,
                setIndex: 1,
                side: null,
                weightKg: userId === 'me' ? 50 : 40,
                reps: userId === 'me' ? 10 : 12,
                completedAt: '2026-10-01T09:30:00.000Z',
              },
            ],
          }
        : null,
    );
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

    const mine = await screen.findByTestId(
      'group-workout-exercise-ex-lat-pulldown-set-w-me-we-lat-set-1-weight',
    );
    expect(mine.props.value).toBe('50');
    expect(
      screen.getByTestId('group-workout-exercise-ex-lat-pulldown-set-w-me-we-lat-set-1-reps').props
        .value,
    ).toBe('10');

    fireEvent.press(screen.getByText('Sam'));

    const sams = await screen.findByTestId(
      'group-workout-exercise-ex-lat-pulldown-set-w-sam-we-lat-set-1-weight',
    );
    expect(sams.props.value).toBe('40');
    expect(
      screen.getByTestId('group-workout-exercise-ex-lat-pulldown-set-w-sam-we-lat-set-1-reps').props
        .value,
    ).toBe('12');
  });
});
