import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getClientRepRanges, setClientExerciseRange, setClientRepRange } from '../lib/api';
import { TrainerClientRepRangesScreen } from './TrainerClientRepRangesScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/api', () => ({
  getClientRepRanges: jest.fn(),
  setClientRepRange: jest.fn(),
  setClientExerciseRange: jest.fn(),
}));
jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ weightUnit: 'lb', theme: { accent: '#D99A50', onAccent: '#000' } }),
}));
jest.mock('../workouts/ExercisePickerModal', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    ExercisePickerModal: ({
      visible,
      onSelect,
    }: {
      visible: boolean;
      onSelect: (exercise: { id: string; name: string; measurementType: string }) => void;
    }) =>
      visible ? (
        <Pressable
          testID="pick-trainer-row"
          onPress={() =>
            onSelect({ id: 'trainer-row', name: 'Cable Row', measurementType: 'weight_reps' })
          }
        >
          <Text>Cable Row</Text>
        </Pressable>
      ) : null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { clientId: 'client-1', clientName: 'Sam' } } as never;

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'trainer-1' },
    session: { access_token: 'token-123' },
  });
  (getClientRepRanges as jest.Mock).mockResolvedValue({
    range: { min: 6, max: 10 },
    exceptions: [],
  });
  (setClientRepRange as jest.Mock).mockReset();
  (setClientExerciseRange as jest.Mock).mockReset();
});

describe('TrainerClientRepRangesScreen', () => {
  it("shows the client's range, as theirs", async () => {
    render(<TrainerClientRepRangesScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('client-rep-ranges-range-row')).toHaveTextContent(
      /Their rep range.*6–10/,
    );
    expect(getClientRepRanges).toHaveBeenCalledWith('token-123', 'client-1');
    expect(screen.getByTestId('trainer-client-rep-ranges-header')).toHaveTextContent(/Sam/);
  });

  it("starts a client with none set on the app's starting range", async () => {
    (getClientRepRanges as jest.Mock).mockResolvedValue({ range: null, exceptions: [] });
    render(<TrainerClientRepRangesScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('client-rep-ranges-range-row')).toHaveTextContent(/8–12/);
  });

  it("adds an exception through the API, listing it under the client's own copy of the exercise", async () => {
    (setClientExerciseRange as jest.Mock).mockResolvedValue({
      exerciseId: 'client-row',
      exerciseName: 'Cable Row',
      measurementType: 'weight_reps',
      range: { min: 10, max: 15 },
      incrementKg: null,
    });
    render(<TrainerClientRepRangesScreen navigation={navigation} route={route} />);
    await screen.findByTestId('client-rep-ranges-range-row');

    fireEvent.press(screen.getByTestId('client-rep-ranges-add'));
    fireEvent.press(screen.getByTestId('pick-trainer-row'));
    // The sheet speaks of their range, not the trainer's.
    expect(screen.getByTestId('exercise-progression-source-personal')).toHaveTextContent(
      /Their Range \(6–10\)/,
    );
    fireEvent.press(screen.getByTestId('exercise-range-min-item-10'));
    fireEvent.press(screen.getByTestId('exercise-range-max-item-15'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('exercise-progression-save'));
    });

    expect(setClientExerciseRange).toHaveBeenCalledWith('token-123', 'client-1', 'trainer-row', {
      range: { min: 10, max: 15 },
      incrementKg: null,
    });
    expect(await screen.findByTestId('client-rep-ranges-exception-client-row')).toHaveTextContent(
      /Cable Row.*Range 10–15/,
    );
  });

  it("sets the client's range through the API", async () => {
    (setClientRepRange as jest.Mock).mockResolvedValue({ min: 6, max: 12 });
    render(<TrainerClientRepRangesScreen navigation={navigation} route={route} />);
    await screen.findByTestId('client-rep-ranges-range-row');

    fireEvent.press(screen.getByTestId('client-rep-ranges-range-row'));
    fireEvent.press(screen.getByTestId('rep-range-max-item-12'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('rep-range-save'));
    });

    expect(setClientRepRange).toHaveBeenCalledWith('token-123', 'client-1', { min: 6, max: 12 });
    expect(screen.getByTestId('client-rep-ranges-range-row')).toHaveTextContent(/6–12/);
  });

  it('says so when the ranges cannot be loaded', async () => {
    (getClientRepRanges as jest.Mock).mockRejectedValue(new Error('Not an active client'));
    render(<TrainerClientRepRangesScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('trainer-client-rep-ranges-error')).toHaveTextContent(
      'Not an active client',
    );
  });
});
