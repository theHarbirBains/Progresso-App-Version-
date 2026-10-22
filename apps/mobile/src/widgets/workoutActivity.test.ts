import { recordQuietFailure } from '../lib/sentry';
import { workoutActivity } from './homeWidgets';
import {
  endClosedWorkoutActivities,
  endWorkoutActivities,
  endWorkoutActivity,
  showWorkoutActivity,
} from './workoutActivity';

jest.mock('../lib/sentry', () => ({ recordQuietFailure: jest.fn() }));

const start = workoutActivity.start as jest.Mock;
const getInstances = workoutActivity.getInstances as jest.Mock;

const PUSH = { title: 'Push Day', kind: 'Your workout', startedAt: 1000 };
const LEGS = { title: 'Thursday legs', kind: 'Group workout', startedAt: 2000 };

/** A card the system already shows -- from before the app was last started, say. */
function shownCard() {
  return { end: jest.fn().mockResolvedValue(undefined) };
}

beforeEach(async () => {
  await endWorkoutActivities();
  jest.clearAllMocks();
});

it('starts one card for a workout, once', async () => {
  await showWorkoutActivity('workout:w1', PUSH, 'progresso://workouts/w1/live');
  await showWorkoutActivity('workout:w1', PUSH, 'progresso://workouts/w1/live');

  expect(start).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledWith(PUSH, 'progresso://workouts/w1/live');
});

it("takes another workout's card off the Lock Screen when a new one starts", async () => {
  const old = shownCard();
  getInstances.mockReturnValueOnce([old]);

  await showWorkoutActivity('group:g1', LEGS, 'progresso://groups/g1');

  expect(start).toHaveBeenCalledWith(LEGS, 'progresso://groups/g1');
  expect(old.end).toHaveBeenCalledWith('immediate');
});

it('carries on without a card when the system refuses one', async () => {
  start.mockImplementationOnce(() => {
    throw new Error('Live Activities are off');
  });
  await expect(showWorkoutActivity('workout:w1', PUSH, 'url')).resolves.toBeUndefined();
  expect(recordQuietFailure).toHaveBeenCalledWith('widget.workoutActivity', expect.any(Error));
});

describe('ending cards for workouts that are no longer open', () => {
  it("ends the app's card once its workout isn't open", async () => {
    await showWorkoutActivity('workout:w1', PUSH, 'url');
    const card = start.mock.results[0].value;
    getInstances.mockReturnValueOnce([card]);

    await endClosedWorkoutActivities(['group:g9']);

    expect(card.end).toHaveBeenCalledWith('immediate');
  });

  it("keeps the app's card while its workout is open", async () => {
    await showWorkoutActivity('workout:w1', PUSH, 'url');
    const card = start.mock.results[0].value;
    getInstances.mockReturnValue([card]);

    await endClosedWorkoutActivities(['workout:w1']);

    expect(card.end).not.toHaveBeenCalled();
    getInstances.mockReturnValue([]);
  });

  it('after a restart, ends cards only when nothing is open', async () => {
    const leftOver = shownCard();
    getInstances.mockReturnValue([leftOver]);

    await endClosedWorkoutActivities(['workout:w1']);
    expect(leftOver.end).not.toHaveBeenCalled();

    await endClosedWorkoutActivities([]);
    expect(leftOver.end).toHaveBeenCalledWith('immediate');
    getInstances.mockReturnValue([]);
  });
});

it("ends a group's card when that group is found finished, and nothing else", async () => {
  await showWorkoutActivity('workout:w1', PUSH, 'url');
  const card = start.mock.results[0].value;
  getInstances.mockReturnValue([card]);

  await endWorkoutActivity('group:g1');
  expect(card.end).not.toHaveBeenCalled();

  await endWorkoutActivity('workout:w1');
  expect(card.end).toHaveBeenCalledWith('immediate');
  getInstances.mockReturnValue([]);
});
