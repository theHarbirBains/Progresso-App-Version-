import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchMyProfile } from '../profile/profileQueries';
import { ProfileProvider } from '../profile/ProfileProvider';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import {
  addPlannedExercise,
  fetchDayPlan,
  removePlannedExercise,
  reorderPlan,
  setPlannedSets,
  type PlannedExercise,
} from '../workouts/splitPlanQueries';
import { SplitDayPlanScreen } from './SplitDayPlanScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../profile/profileQueries', () => ({ fetchMyProfile: jest.fn() }));
jest.mock('../workouts/splitPlanQueries', () => ({
  fetchDayPlan: jest.fn(),
  addPlannedExercise: jest.fn(),
  setPlannedSets: jest.fn(),
  removePlannedExercise: jest.fn(),
  reorderPlan: jest.fn(),
}));
// The picker is the live workout's own, tested there: here it only needs to hand an exercise back.
jest.mock('../workouts/ExercisePickerModal', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    ExercisePickerModal: ({
      visible,
      onSelect,
    }: {
      visible: boolean;
      onSelect: (exercise: { id: string }) => void;
    }) =>
      visible ? (
        <Pressable testID="picker-pick-squat" onPress={() => onSelect({ id: 'squat' })}>
          <Text>Squat</Text>
        </Pressable>
      ) : null,
  };
});
jest.mock('./ExerciseFormScreen', () => ({ ExerciseFormScreen: () => null }));

const navigation = { goBack: jest.fn() } as never;
const route = { params: { dayId: 'day-1', dayName: 'Legs' } } as never;

function planned(overrides: Partial<PlannedExercise>): PlannedExercise {
  return {
    id: 'p1',
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
    measurementType: 'weight_reps',
    position: 0,
    targetSets: 3,
    ...overrides,
  };
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
  (fetchMyProfile as jest.Mock).mockResolvedValue({ id: 'user-1', weightUnit: 'kg' });
  (fetchDayPlan as jest.Mock).mockReset().mockResolvedValue([]);
  for (const fn of [addPlannedExercise, setPlannedSets, removePlannedExercise, reorderPlan]) {
    (fn as jest.Mock).mockReset().mockResolvedValue(undefined);
  }
});

function renderScreen() {
  render(<SplitDayPlanScreen navigation={navigation} route={route} />, {
    wrapper: ProfileProvider,
  });
}

describe('SplitDayPlanScreen', () => {
  it('says what a plan does when the day has none, and adds an exercise to the end', async () => {
    (addPlannedExercise as jest.Mock).mockResolvedValue(
      planned({ id: 'p9', exerciseId: 'squat', exerciseName: 'Squat' }),
    );
    renderScreen();

    expect(await screen.findByTestId('split-day-plan-empty')).toHaveTextContent(
      /No exercises planned/,
    );
    fireEvent.press(screen.getByTestId('split-day-plan-add'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-pick-squat'));
    });

    expect(addPlannedExercise).toHaveBeenCalledWith('day-1', 'squat', 0);
    expect(screen.getByTestId('split-day-plan-item-p9')).toHaveTextContent(/Squat/);
  });

  it('changes the sets, the order and what is in the plan, saving each at once', async () => {
    (fetchDayPlan as jest.Mock).mockResolvedValue([
      planned({ id: 'p1', exerciseName: 'Bench Press', position: 0 }),
      planned({
        id: 'p2',
        exerciseId: 'row',
        exerciseName: 'Row',
        muscleGroup: 'back',
        position: 1,
      }),
    ]);
    renderScreen();

    await screen.findByTestId('split-day-plan-item-p1');
    fireEvent.press(screen.getByTestId('split-day-plan-more-p1'));
    expect(screen.getByTestId('split-day-plan-sets-p1')).toHaveTextContent('4');
    expect(setPlannedSets).toHaveBeenCalledWith('p1', 4);

    fireEvent.press(screen.getByTestId('split-day-plan-down-p1'));
    await waitFor(() =>
      expect(reorderPlan).toHaveBeenCalledWith([
        { id: 'p2', position: 0 },
        { id: 'p1', position: 1 },
      ]),
    );

    fireEvent.press(screen.getByTestId('split-day-plan-remove-p2'));
    expect(removePlannedExercise).toHaveBeenCalledWith('p2');
    expect(screen.queryByTestId('split-day-plan-item-p2')).toBeNull();
    expectNoBareText();
  });

  it('keeps at least one set', async () => {
    (fetchDayPlan as jest.Mock).mockResolvedValue([planned({ targetSets: 1 })]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('split-day-plan-fewer-p1'));

    expect(setPlannedSets).not.toHaveBeenCalled();
    expect(screen.getByTestId('split-day-plan-sets-p1')).toHaveTextContent('1');
  });
});
