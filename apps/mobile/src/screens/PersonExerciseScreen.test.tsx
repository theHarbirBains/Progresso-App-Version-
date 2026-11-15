import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getPersonExercise } from '../lib/api';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { PersonExerciseScreen } from './PersonExerciseScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/api', () => ({ getPersonExercise: jest.fn() }));
jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#D99A50', onAccent: '#000000', accentBg: '#332211' },
    weightUnit: 'kg',
  }),
}));

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const routeFor = (userId: string) =>
  ({ params: { userId, exerciseId: 'ex-bench', name: 'Bench Press' } }) as never;

function bench(extra: object = {}) {
  return {
    exercise: {
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
      photoUrl: null,
      gym: 'Downtown',
      attachment: 'Wide Grip',
      measurementType: 'weight_reps',
    },
    topSets: [
      {
        workoutId: 'w2',
        performedAt: '2026-11-10T10:00:00Z',
        weightKg: 110,
        reps: 3,
        durationSeconds: null,
      },
      {
        workoutId: 'w1',
        performedAt: '2026-11-03T10:00:00Z',
        weightKg: 100,
        reps: 5,
        durationSeconds: null,
      },
    ],
    repPRs: [
      { reps: 3, weightKg: 110, achievedAt: '2026-11-10T10:00:00Z' },
      { reps: 5, weightKg: 100, achievedAt: '2026-11-03T10:00:00Z' },
    ],
    oneRepMax: { weightKg: 120, achievedAt: '2026-10-20T10:00:00Z' },
    mostReps: null,
    longest: null,
    ...extra,
  };
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'me' }, session: { access_token: 't' } });
  (getPersonExercise as jest.Mock).mockReset().mockResolvedValue(bench());
  mockNavigate.mockClear();
});

describe('PersonExerciseScreen', () => {
  it("shows a friend's machine, every record they hold on it and each workout's top set", async () => {
    render(<PersonExerciseScreen navigation={navigation} route={routeFor('sam')} />);

    expect(screen.getByTestId('person-exercise-loading')).toBeTruthy();
    expect(await screen.findByTestId('person-exercise-summary')).toHaveTextContent(
      /Bench Press.*Downtown · Wide Grip.*Done in 2 workouts/,
    );
    expect(screen.getByTestId('person-exercise-record-max')).toHaveTextContent(/True 1RM.*120 kg/);
    expect(screen.getByTestId('person-exercise-record-rep-3')).toHaveTextContent(/3 reps.*110 kg/);
    expect(screen.getByTestId('person-exercise-record-rep-5')).toHaveTextContent(/5 reps.*100 kg/);
    expect(screen.getByTestId('person-exercise-top-set-w2')).toHaveTextContent(/110 kg × 3/);
    expect(getPersonExercise).toHaveBeenCalledWith('t', 'sam', 'ex-bench');
    expectNoBareText();
  });

  it("opens a friend's workout read-only from its top set -- yours as your own", async () => {
    const first = render(<PersonExerciseScreen navigation={navigation} route={routeFor('sam')} />);
    fireEvent.press(await screen.findByTestId('person-exercise-top-set-w1'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', {
      workoutId: 'w1',
      authorId: 'sam',
    });
    first.unmount();

    render(<PersonExerciseScreen navigation={navigation} route={routeFor('me')} />);
    fireEvent.press(await screen.findByTestId('person-exercise-top-set-w1'));
    expect(mockNavigate).toHaveBeenLastCalledWith('WorkoutDetail', { workoutId: 'w1' });
  });

  it("shows a bodyweight exercise's most reps, and its top sets in reps", async () => {
    (getPersonExercise as jest.Mock).mockResolvedValue(
      bench({
        exercise: { ...bench().exercise, exerciseName: 'Push-Up', measurementType: 'bodyweight' },
        topSets: [
          {
            workoutId: 'w1',
            performedAt: '2026-11-03T10:00:00Z',
            weightKg: null,
            reps: 25,
            durationSeconds: null,
          },
        ],
        repPRs: [],
        oneRepMax: null,
        mostReps: { reps: 25, achievedAt: '2026-11-03T10:00:00Z' },
      }),
    );
    render(<PersonExerciseScreen navigation={navigation} route={routeFor('sam')} />);

    expect(await screen.findByTestId('person-exercise-record-most-reps')).toHaveTextContent(
      /Most Reps.*25 reps/,
    );
    expect(screen.getByTestId('person-exercise-top-set-w1')).toHaveTextContent(/25 reps/);
  });

  it('says when there are no records yet', async () => {
    (getPersonExercise as jest.Mock).mockResolvedValue(bench({ repPRs: [], oneRepMax: null }));
    render(<PersonExerciseScreen navigation={navigation} route={routeFor('sam')} />);

    expect(await screen.findByTestId('person-exercise-records')).toHaveTextContent(
      /No records on this one yet/,
    );
  });

  it('says so when it cannot be read', async () => {
    (getPersonExercise as jest.Mock).mockRejectedValue(new Error('Follow them to see their lifts'));
    render(<PersonExerciseScreen navigation={navigation} route={routeFor('sam')} />);

    expect(await screen.findByTestId('person-exercise-error')).toHaveTextContent(
      'Follow them to see their lifts',
    );
  });
});
