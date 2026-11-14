import * as Notifications from 'expo-notifications';
import type { ShareTopSet } from '../sharing/shareCardData';
import type { PlannedReminder } from './reminderPlan';
import {
  clearReminders,
  forgetScheduledReminders,
  notificationLink,
  prCheer,
  scheduleReminders,
  showPrCheer,
} from './reminderScheduler';

const reminder: PlannedReminder = {
  id: 'progresso-reminder-meals-2026-11-14',
  kind: 'meals',
  at: new Date(2026, 10, 14, 12, 30),
  title: 'Log your meals',
  body: 'Nothing logged yet today.',
  path: 'nutrition',
};

beforeEach(() => {
  jest.clearAllMocks();
  forgetScheduledReminders();
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([]);
});

describe('scheduleReminders', () => {
  it('puts each reminder on the phone at its time, with the link it opens', async () => {
    await scheduleReminders([reminder]);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'progresso-reminder-meals-2026-11-14',
      content: {
        title: 'Log your meals',
        body: 'Nothing logged yet today.',
        data: { url: expect.stringMatching(/nutrition$/) },
      },
      trigger: { type: 'date', date: reminder.at },
    });
  });

  it("replaces Progresso's earlier reminders, and leaves any other notification alone", async () => {
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockResolvedValue([
        { identifier: 'progresso-reminder-workout-2026-11-13' },
        { identifier: 'something-else' },
      ] as never);

    await scheduleReminders([reminder]);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'progresso-reminder-workout-2026-11-13',
    );
  });

  it('leaves the phone alone when the plan is the same as last time', async () => {
    await scheduleReminders([reminder]);
    await scheduleReminders([{ ...reminder }]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    await scheduleReminders([{ ...reminder, body: 'Something new.' }]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('clears every reminder', async () => {
    await scheduleReminders([reminder]);
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockResolvedValue([{ identifier: reminder.id }] as never);

    await clearReminders();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(reminder.id);
  });
});

it("reads a tapped notification's link, if it has one", () => {
  const tapped = (data: unknown) =>
    ({ notification: { request: { content: { data } } } }) as Notifications.NotificationResponse;
  expect(notificationLink(tapped({ url: 'progresso://nutrition' }))).toBe('progresso://nutrition');
  expect(notificationLink(tapped({}))).toBeNull();
  expect(notificationLink(null)).toBeNull();
});

describe('prCheer', () => {
  function topSet(overrides: Partial<ShareTopSet>): ShareTopSet {
    return {
      exerciseName: 'Lat Pulldown',
      photoUrl: null,
      measurementType: 'weight_reps',
      weightKg: 63.5,
      reps: 8,
      durationSeconds: null,
      prLabel: null,
      ...overrides,
    };
  }

  it("cheers by name, on the workout's PR", () => {
    expect(
      prCheer('Harbir', 'Back Day', [topSet({}), topSet({ prLabel: '8 Rep PR' })], 'lb'),
    ).toEqual({
      title: 'KEEP GOING, HARBIR!',
      body: 'You hit a new PR on your Back Day workout: Lat Pulldown, 140 lb × 8.',
    });
  });

  it('counts several PRs, and cheers without a name', () => {
    expect(
      prCheer(
        null,
        'Pull Day',
        [
          topSet({
            prLabel: 'PR',
            measurementType: 'bodyweight',
            weightKg: null,
            reps: 15,
            exerciseName: 'Pull-Up',
          }),
          topSet({ prLabel: '1RM' }),
        ],
        'kg',
      ),
    ).toEqual({
      title: 'KEEP GOING!',
      body: 'You hit 2 new PRs on your Pull Day workout, including Pull-Up, 15 reps.',
    });
  });

  it('is nothing without a PR', () => {
    expect(prCheer('Harbir', 'Leg Day', [topSet({})], 'lb')).toBeNull();
  });
});

it('shows the cheer at once', async () => {
  await showPrCheer({ title: 'KEEP GOING!', body: 'A new PR.' });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: { title: 'KEEP GOING!', body: 'A new PR.' },
    trigger: null,
  });
});
