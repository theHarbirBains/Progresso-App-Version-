import { recordQuietFailure } from '../lib/sentry';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { nextWorkoutWidget } from './homeWidgets';
import { refreshNextWorkout } from './nextWorkoutRefresh';

jest.mock('../lib/sentry', () => ({ recordQuietFailure: jest.fn() }));
jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
  fetchLastWorkoutSplitDayId: jest.fn(),
}));

const SPLIT = {
  id: 's1',
  name: 'PPL',
  days: [
    { id: 'd1', name: 'Push', orderIndex: 0, muscleGroups: [] },
    { id: 'd2', name: 'Pull', orderIndex: 1, muscleGroups: [] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('moves Next Workout on to the day after the one just finished', async () => {
  (fetchWorkoutSplitDetail as jest.Mock).mockResolvedValue(SPLIT);
  (fetchLastWorkoutSplitDayId as jest.Mock).mockResolvedValue('d1');

  await refreshNextWorkout('user-1', 's1');

  expect(fetchLastWorkoutSplitDayId).toHaveBeenCalledWith('user-1');
  expect(nextWorkoutWidget.updateSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ eyebrow: 'Next Workout', title: 'Pull', action: 'Start' }),
  );
});

it('says there is no split yet without one, reading nothing', async () => {
  await refreshNextWorkout('user-1', null);

  expect(fetchWorkoutSplitDetail).not.toHaveBeenCalled();
  expect(nextWorkoutWidget.updateSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'No split yet' }),
  );
});

it('leaves the widget as it was, and records why, when the split cannot be read', async () => {
  const failure = new Error('offline');
  (fetchWorkoutSplitDetail as jest.Mock).mockRejectedValue(failure);
  (fetchLastWorkoutSplitDayId as jest.Mock).mockResolvedValue(null);

  await refreshNextWorkout('user-1', 's1');

  expect(nextWorkoutWidget.updateSnapshot).not.toHaveBeenCalled();
  expect(recordQuietFailure).toHaveBeenCalledWith('widget.nextWorkout', failure);
});
