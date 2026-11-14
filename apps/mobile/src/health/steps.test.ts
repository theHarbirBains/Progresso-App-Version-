import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsCollectionForQuantity,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import { hasHealthKitNative } from '../lib/nativeModules';
import { askForSteps, stepsAccess, stepsByDay, stepsToday } from './steps';

const STEPS = 'HKQuantityTypeIdentifierStepCount';

beforeEach(() => {
  jest.clearAllMocks();
  (isHealthDataAvailable as jest.Mock).mockReturnValue(true);
});

afterAll(() => {
  (isHealthDataAvailable as jest.Mock).mockReturnValue(false);
});

describe('stepsAccess', () => {
  it('is unavailable where Apple Health is not', async () => {
    (isHealthDataAvailable as jest.Mock).mockReturnValue(false);
    expect(await stepsAccess()).toBe('unavailable');
  });

  it('is unavailable in Expo Go, which has no Apple Health, without loading it', async () => {
    jest.mocked(hasHealthKitNative).mockReturnValueOnce(false);
    expect(await stepsAccess()).toBe('unavailable');
    expect(isHealthDataAvailable).not.toHaveBeenCalled();
    expect(getRequestStatusForAuthorization).not.toHaveBeenCalled();
  });

  it('is unavailable off iPhone, without asking Apple Health', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      expect(await stepsAccess()).toBe('unavailable');
      expect(getRequestStatusForAuthorization).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  it('knows only whether it has asked -- Apple Health never says whether reading was allowed', async () => {
    (getRequestStatusForAuthorization as jest.Mock).mockResolvedValueOnce(1);
    expect(await stepsAccess()).toBe('notAsked');
    (getRequestStatusForAuthorization as jest.Mock).mockResolvedValueOnce(2);
    expect(await stepsAccess()).toBe('asked');
    expect(getRequestStatusForAuthorization).toHaveBeenCalledWith({ toRead: [STEPS] });
  });
});

it('asks only to read steps -- never to write anything', async () => {
  await askForSteps();
  expect(requestAuthorization).toHaveBeenCalledWith({ toRead: [STEPS] });
});

it("adds up today's steps since midnight, as a whole number", async () => {
  (queryStatisticsForQuantity as jest.Mock).mockResolvedValueOnce({
    sumQuantity: { unit: 'count', quantity: 8411.6 },
    sources: [],
  });
  const now = new Date(2026, 9, 22, 15, 42);

  expect(await stepsToday(now)).toBe(8412);
  expect(queryStatisticsForQuantity).toHaveBeenCalledWith(STEPS, ['cumulativeSum'], {
    filter: { date: { startDate: new Date(2026, 9, 22), endDate: now } },
    unit: 'count',
  });
});

it('is 0 on a day with no steps recorded', async () => {
  (queryStatisticsForQuantity as jest.Mock).mockResolvedValueOnce({ sources: [] });
  expect(await stepsToday()).toBe(0);
});

describe('stepsByDay', () => {
  const now = new Date(2026, 10, 13, 15, 42);

  it("reads each day's total back to midnight `days` days ago, oldest first, today last", async () => {
    (queryStatisticsCollectionForQuantity as jest.Mock).mockResolvedValueOnce([
      { startDate: new Date(2026, 10, 11), sumQuantity: { unit: 'count', quantity: 6020.4 } },
      { startDate: new Date(2026, 10, 12), sumQuantity: { unit: 'count', quantity: 9801.6 } },
      { startDate: new Date(2026, 10, 13), sumQuantity: { unit: 'count', quantity: 3500 } },
    ]);

    expect(await stepsByDay(3, now)).toEqual([
      { day: '2026-11-11', steps: 6020 },
      { day: '2026-11-12', steps: 9802 },
      { day: '2026-11-13', steps: 3500 },
    ]);
    expect(queryStatisticsCollectionForQuantity).toHaveBeenCalledWith(
      STEPS,
      ['cumulativeSum'],
      new Date(2026, 10, 11),
      { day: 1 },
      { filter: { date: { startDate: new Date(2026, 10, 11), endDate: now } }, unit: 'count' },
    );
  });

  it('fills a day Apple Health has nothing for with 0', async () => {
    (queryStatisticsCollectionForQuantity as jest.Mock).mockResolvedValueOnce([
      { startDate: new Date(2026, 10, 12), sumQuantity: { unit: 'count', quantity: 4000 } },
      { startDate: new Date(2026, 10, 13) },
    ]);

    expect(await stepsByDay(3, now)).toEqual([
      { day: '2026-11-11', steps: 0 },
      { day: '2026-11-12', steps: 4000 },
      { day: '2026-11-13', steps: 0 },
    ]);
  });
});
