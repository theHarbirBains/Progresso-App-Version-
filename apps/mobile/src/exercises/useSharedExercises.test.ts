import { act, renderHook, waitFor } from '@testing-library/react-native';
import { copyExercise, fetchSharedExercises } from '../lib/exercisesApi';
import { invalidateExerciseCache } from './exerciseQueries';
import { useSharedExercises } from './useSharedExercises';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'token-1' } }),
}));
jest.mock('../lib/exercisesApi', () => ({
  fetchSharedExercises: jest.fn(),
  copyExercise: jest.fn(),
}));
jest.mock('./exerciseQueries', () => ({
  ...jest.requireActual('./exerciseQueries'),
  invalidateExerciseCache: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const response = (id: string, extra: object = {}) => ({
  id,
  name: 'Seated Row',
  muscleGroup: 'back',
  movementType: 'bilateral',
  loggingStyle: null,
  measurementType: 'weight_reps',
  photoUrl: null,
  gym: 'Fit4Less Downtown',
  feelNotes: null,
  attachment: 'V-handle',
  isActive: true,
  createdBy: 'sam',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...extra,
});

beforeEach(() => {
  jest.mocked(fetchSharedExercises).mockReset();
  jest.mocked(copyExercise).mockReset();
  jest.mocked(invalidateExerciseCache).mockClear();
});

describe('useSharedExercises', () => {
  it("reads what's shared as it opens, saying whose each one is", async () => {
    jest.mocked(fetchSharedExercises).mockResolvedValue([
      {
        ...response('ex-sams'),
        source: 'friend',
        owner: { id: 'sam', username: 'sam', displayName: 'Sam Lee', avatarUrl: null },
        inLibrary: false,
      },
    ] as never);

    const { result } = renderHook(() => useSharedExercises(true));

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0]).toMatchObject({
      id: 'ex-sams',
      gym: 'Fit4Less Downtown',
      shared: { source: 'friend', ownerId: 'sam', ownerName: 'Sam Lee', inLibrary: false },
    });
    expect(fetchSharedExercises).toHaveBeenCalledWith('token-1');
  });

  it('reads nothing while closed', () => {
    renderHook(() => useSharedExercises(false));

    expect(fetchSharedExercises).not.toHaveBeenCalled();
  });

  it('says why when they cannot be read, sharing nothing', async () => {
    jest.mocked(fetchSharedExercises).mockRejectedValue(new Error('Network request failed'));

    const { result } = renderHook(() => useSharedExercises(true));

    await waitFor(() => expect(result.current.error).toBe('Network request failed'));
    expect(result.current.rows).toEqual([]);
  });

  it('makes one theirs: the copy comes back, their library is read again, and so is what is shared', async () => {
    jest.mocked(fetchSharedExercises).mockResolvedValue([]);
    jest
      .mocked(copyExercise)
      .mockResolvedValue(response('ex-copy', { createdBy: 'user-1' }) as never);
    const { result } = renderHook(() => useSharedExercises(true));
    await waitFor(() => expect(fetchSharedExercises).toHaveBeenCalledTimes(1));

    let own: unknown;
    await act(async () => {
      own = await result.current.makeOwn({
        id: 'ex-sams',
        name: 'Seated Row',
        muscleGroup: 'back',
        movementType: 'bilateral',
        loggingStyle: null,
        measurementType: 'weight_reps',
        photoUrl: null,
        isActive: true,
        createdBy: 'sam',
        shared: { source: 'friend', ownerId: 'sam', ownerName: 'Sam', inLibrary: false },
      });
    });

    expect(copyExercise).toHaveBeenCalledWith('token-1', 'ex-sams');
    expect(own).toMatchObject({ id: 'ex-copy', createdBy: 'user-1', attachment: 'V-handle' });
    expect(own).not.toHaveProperty('shared');
    expect(invalidateExerciseCache).toHaveBeenCalledWith('user-1');
    await waitFor(() => expect(fetchSharedExercises).toHaveBeenCalledTimes(2));
  });

  it('returns a built-in or their own as it is, copying nothing', async () => {
    jest.mocked(fetchSharedExercises).mockResolvedValue([]);
    const { result } = renderHook(() => useSharedExercises(true));
    const builtIn = {
      id: 'ex-built-in',
      name: 'Barbell Row',
      muscleGroup: 'back' as const,
      movementType: 'bilateral' as const,
      loggingStyle: null,
      measurementType: 'weight_reps' as const,
      photoUrl: null,
      isActive: true,
      createdBy: null,
    };

    await expect(result.current.makeOwn(builtIn)).resolves.toBe(builtIn);
    expect(copyExercise).not.toHaveBeenCalled();
  });
});
