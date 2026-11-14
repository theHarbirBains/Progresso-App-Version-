import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  daysLabel,
  defaultReminderSettings,
  loadReminderSettings,
  readStoredSettings,
  saveReminderSettings,
  timeLabel,
} from './reminderSettings';

describe('defaultReminderSettings', () => {
  it('turns every reminder on, on the days that suit how often they train', () => {
    const defaults = defaultReminderSettings(4);
    expect(defaults.workout).toEqual({ on: true, time: 17 * 60, days: [1, 2, 4, 5] });
    expect(defaults.prCheers.on).toBe(true);
    expect(defaultReminderSettings(null).workout.days).toEqual([1, 3, 5]);
    expect(defaultReminderSettings(9).workout.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('readStoredSettings', () => {
  const defaults = defaultReminderSettings(3);

  it('keeps what was saved, and fills in anything missing or unreadable from the defaults', () => {
    const read = readStoredSettings(
      JSON.stringify({
        workout: { on: false, time: 6 * 60, days: [6, 0, 6] },
        meals: { on: 'yes', time: 99999 },
      }),
      defaults,
    );
    expect(read.workout).toEqual({ on: false, time: 6 * 60, days: [0, 6] });
    expect(read.meals).toEqual(defaults.meals);
    expect(read.weekly).toEqual(defaults.weekly);
  });

  it('falls back to the defaults for nothing saved, or something that is not JSON', () => {
    expect(readStoredSettings(null, defaults)).toBe(defaults);
    expect(readStoredSettings('not json', defaults)).toBe(defaults);
  });
});

it('saves per person on the phone, and reads it back', async () => {
  const settings = { ...defaultReminderSettings(3), meals: { on: false, time: 13 * 60 } };
  await saveReminderSettings('user-1', settings);

  expect(await loadReminderSettings('user-1', 3)).toEqual(settings);
  expect(await loadReminderSettings('user-2', 3)).toEqual(defaultReminderSettings(3));
  await AsyncStorage.clear();
});

it('labels a time and a set of days', () => {
  expect(timeLabel(0)).toBe('12:00 AM');
  expect(timeLabel(12 * 60 + 30)).toBe('12:30 PM');
  expect(timeLabel(17 * 60 + 5)).toBe('5:05 PM');
  expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
  expect(daysLabel([1, 2, 3, 4, 5])).toBe('Weekdays');
  expect(daysLabel([0, 1, 3])).toBe('Mon, Wed, Sun');
  expect(daysLabel([])).toBe('No days');
});
