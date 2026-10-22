import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { fetchMyProfile } from '../profile/profileQueries';
import { fetchExerciseSettings, saveExerciseSetting } from '../workouts/exerciseSettingsQueries';
import { RepRangeExceptionsScreen } from './RepRangeExceptionsScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/api', () => ({ updateMyProfile: jest.fn() }));
jest.mock('../profile/profileQueries', () => ({ fetchMyProfile: jest.fn() }));
jest.mock('../workouts/exerciseSettingsQueries', () => ({
  fetchExerciseSettings: jest.fn(),
  saveExerciseSetting: jest.fn(),
}));

// The picker, as a list of buttons: one per exercise in the library.
const LIBRARY = [
  { id: 'ex-bench', name: 'Bench Press', measurementType: 'weight_reps' },
  { id: 'ex-plank', name: 'Plank', measurementType: 'timed' },
];
jest.mock('../workouts/ExercisePickerModal', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    ExercisePickerModal: ({
      visible,
      onSelect,
    }: {
      visible: boolean;
      onSelect: (exercise: (typeof LIBRARY)[number]) => void;
    }) =>
      visible
        ? LIBRARY.map((exercise) => (
            <Pressable
              key={exercise.id}
              testID={`pick-${exercise.id}`}
              onPress={() => onSelect(exercise)}
            >
              <Text>{exercise.name}</Text>
            </Pressable>
          ))
        : null,
  };
});

const profile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: null,
  username: null,
  weightUnit: 'kg',
  workoutAccentColor: null,
  nutritionAccentColor: null,
  activeWorkoutSplitId: null,
  repRangeMin: 8,
  repRangeMax: 12,
};

const deadlift = {
  exerciseId: 'ex-dead',
  exerciseName: 'Deadlift',
  measurementType: 'weight_reps' as const,
  range: { min: 3, max: 5 },
  incrementKg: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  render(
    <ProfileProvider>
      <RepRangeExceptionsScreen navigation={navigation} route={{} as never} />
    </ProfileProvider>,
  );
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  (fetchMyProfile as jest.Mock).mockResolvedValue(profile);
  (fetchExerciseSettings as jest.Mock).mockResolvedValue(new Map([['ex-dead', deadlift]]));
  (saveExerciseSetting as jest.Mock).mockReset();
  (updateMyProfile as jest.Mock).mockReset();
});

describe('RepRangeExceptionsScreen', () => {
  it('shows the range everything follows and the exercises outside it', async () => {
    renderScreen();

    expect(await screen.findByTestId('rep-ranges-exception-ex-dead')).toHaveTextContent(
      /Deadlift.*Range 3–5/,
    );
    expect(screen.getByTestId('rep-ranges-range-row')).toHaveTextContent(/Your rep range.*8–12/);
  });

  it('adds an exception: picks an exercise, opens it on its own range, and saves it', async () => {
    (saveExerciseSetting as jest.Mock).mockResolvedValue({
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
      measurementType: 'weight_reps',
      range: { min: 10, max: 14 },
      incrementKg: null,
    });
    renderScreen();
    await screen.findByTestId('rep-ranges-exception-ex-dead');

    fireEvent.press(screen.getByTestId('rep-ranges-add'));
    fireEvent.press(screen.getByTestId('pick-ex-bench'));

    // It opens on "Its Own", from the range it's an exception to.
    expect(
      screen.getByTestId('exercise-progression-source-own').props.accessibilityState.selected,
    ).toBe(true);
    fireEvent.press(screen.getByTestId('exercise-range-min-item-10'));
    fireEvent.press(screen.getByTestId('exercise-range-max-item-14'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('exercise-progression-save'));
    });

    expect(saveExerciseSetting).toHaveBeenCalledWith('user-1', 'ex-bench', {
      range: { min: 10, max: 14 },
      incrementKg: null,
    });
    expect(await screen.findByTestId('rep-ranges-exception-ex-bench')).toHaveTextContent(
      /Bench Press.*Range 10–14/,
    );
  });

  it("won't make a timed exercise an exception -- it has no range", async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderScreen();
    await screen.findByTestId('rep-ranges-exception-ex-dead');

    fireEvent.press(screen.getByTestId('rep-ranges-add'));
    fireEvent.press(screen.getByTestId('pick-ex-plank'));

    expect(alert).toHaveBeenCalledWith('No rep range', expect.stringContaining('Plank'));
    expect(screen.queryByTestId('exercise-progression-save')).toBeNull();
    alert.mockRestore();
  });

  it('removes an exception, putting the exercise back on the range', async () => {
    (saveExerciseSetting as jest.Mock).mockResolvedValue(null);
    renderScreen();
    await screen.findByTestId('rep-ranges-exception-ex-dead');

    await act(async () => {
      fireEvent.press(screen.getByTestId('rep-ranges-remove-ex-dead'));
    });

    expect(saveExerciseSetting).toHaveBeenCalledWith('user-1', 'ex-dead', {
      range: null,
      incrementKg: null,
    });
    await waitFor(() =>
      expect(screen.getByTestId('rep-ranges-empty')).toHaveTextContent(
        'No exceptions yet: every exercise follows 8–12.',
      ),
    );
  });

  it('changes the range everything follows', async () => {
    (updateMyProfile as jest.Mock).mockImplementation(async (_t: string, updates: object) => ({
      ...profile,
      ...updates,
    }));
    renderScreen();
    await screen.findByTestId('rep-ranges-range-row');

    fireEvent.press(screen.getByTestId('rep-ranges-range-row'));
    fireEvent.press(screen.getByTestId('rep-range-max-item-15'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('rep-range-save'));
    });

    expect(updateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ repRangeMin: 8, repRangeMax: 15 }),
    );
  });
});
