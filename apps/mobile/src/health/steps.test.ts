import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import { hasHealthKitNative } from '../lib/nativeModules';
import { askForSteps, stepsAccess, stepsToday } from './steps';

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
