import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultReminderSettings,
  loadReminderSettings,
  readStoredSettings,
  saveReminderSettings,
  timeLabel,
} from './reminderSettings';

describe('defaultReminderSettings', () => {
  it('turns every reminder on: training nudges with no days or time, the weekly summary as Sunday starts', () => {
    const defaults = defaultReminderSettings();
    expect(defaults.workout).toEqual({ on: true });
    expect(defaults.weekly).toEqual({ on: true, time: 0 });
    expect(defaults.prCheers.on).toBe(true);
  });
});

describe('readStoredSettings', () => {
  const defaults = defaultReminderSettings();

  it('keeps what was saved, and fills in anything missing or unreadable from the defaults', () => {
    const read = readStoredSettings(
      JSON.stringify({
        // Saved before nudges replaced workout days: only whether it's on is kept.
        workout: { on: false, time: 6 * 60, days: [6, 0] },
        meals: { on: 'yes', time: 99999 },
      }),
      defaults,
    );
    expect(read.workout).toEqual({ on: false });
    expect(read.meals).toEqual(defaults.meals);
    expect(read.weekly).toEqual(defaults.weekly);
  });

  it('falls back to the defaults for nothing saved, or something that is not JSON', () => {
    expect(readStoredSettings(null, defaults)).toBe(defaults);
    expect(readStoredSettings('not json', defaults)).toBe(defaults);
  });
});

it('saves per person on the phone, and reads it back', async () => {
  const settings = { ...defaultReminderSettings(), meals: { on: false, time: 13 * 60 } };
  await saveReminderSettings('user-1', settings);

  expect(await loadReminderSettings('user-1')).toEqual(settings);
  expect(await loadReminderSettings('user-2')).toEqual(defaultReminderSettings());
  await AsyncStorage.clear();
});

it('labels a time', () => {
  expect(timeLabel(0)).toBe('12:00 AM');
  expect(timeLabel(12 * 60 + 30)).toBe('12:30 PM');
  expect(timeLabel(17 * 60 + 5)).toBe('5:05 PM');
});
