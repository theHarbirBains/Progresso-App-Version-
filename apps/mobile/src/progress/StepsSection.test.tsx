import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsCollectionForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { homeWidgets } from '../widgets/homeWidgets';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { StepsSection } from './StepsSection';

const { stepsWidget } = homeWidgets();
const STEPS = 'HKQuantityTypeIdentifierStepCount';
// Friday, November 13, 2026.
const NOW = new Date(2026, 10, 13, 15, 42);

/** Apple Health's daily totals from Monday, October 19 on, one count a day. */
function dailyTotals(counts: number[]) {
  return counts.map((quantity, i) => ({
    startDate: new Date(2026, 9, 19 + i),
    endDate: new Date(2026, 9, 20 + i),
    sumQuantity: { unit: 'count', quantity },
    sources: [],
  }));
}

function renderSection() {
  return render(<StepsSection accentColor="#E8A33D" now={() => NOW} />);
}

beforeEach(() => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(true);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(2);
  jest.mocked(stepsWidget.updateTimeline).mockClear();
});

afterEach(() => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(false);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
  jest.mocked(queryStatisticsCollectionForQuantity).mockResolvedValue([]);
});

it('shows today, this week and the 7-day average, then each day and each week', async () => {
  jest
    .mocked(queryStatisticsCollectionForQuantity)
    .mockResolvedValue(dailyTotals(Array.from({ length: 26 }, (_, i) => 1000 + i * 100)) as never);
  renderSection();

  expect(await screen.findByTestId('progress-steps-today')).toHaveTextContent('3,500Today');
  expect(screen.getByTestId('progress-steps-this-week')).toHaveTextContent('16,500This Week');
  expect(screen.getByTestId('progress-steps-average')).toHaveTextContent('3,1007-Day Average');
  expect(screen.getByTestId('progress-steps-day-2026-11-13')).toHaveTextContent('Today3,500');
  expect(screen.getByTestId('progress-steps-day-2026-11-12')).toHaveTextContent('Thu, Nov 123,400');
  expect(screen.getByTestId('progress-steps-week-current')).toHaveTextContent(
    'This Week3,300 a day so far16,500',
  );
  expect(screen.getAllByTestId('progress-steps-week')[0]).toHaveTextContent(
    'Nov 2 – 82,700 a day18,900',
  );
  expect(screen.queryByTestId('progress-steps-hint')).toBeNull();
  expectNoBareText();
});

it('reads the days back to the Monday three weeks ago, only to read steps', async () => {
  renderSection();
  await screen.findByTestId('progress-steps-today');

  expect(queryStatisticsCollectionForQuantity).toHaveBeenCalledWith(
    STEPS,
    ['cumulativeSum'],
    new Date(2026, 9, 19),
    { day: 1 },
    { filter: { date: { startDate: new Date(2026, 9, 19), endDate: NOW } }, unit: 'count' },
  );
});

it("hands today's count to the Steps widget, as Feed does", async () => {
  jest
    .mocked(queryStatisticsCollectionForQuantity)
    .mockResolvedValue(dailyTotals(Array.from({ length: 26 }, () => 8412)) as never);
  renderSection();
  await screen.findByTestId('progress-steps-today');

  expect(jest.mocked(stepsWidget.updateTimeline).mock.calls.at(-1)?.[0][0].props.steps).toBe(
    '8,412',
  );
});

it('says where to check when no steps come back', async () => {
  renderSection();
  expect(await screen.findByTestId('progress-steps-today')).toHaveTextContent('0Today');
  expect(screen.getByTestId('progress-steps-hint')).toHaveTextContent(/Health app/);
});

it('offers to connect Apple Health until it has asked, then shows the steps', async () => {
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValueOnce(1);
  jest
    .mocked(queryStatisticsCollectionForQuantity)
    .mockResolvedValue(dailyTotals(Array.from({ length: 26 }, () => 5000)) as never);
  renderSection();

  fireEvent.press(await screen.findByTestId('progress-steps-connect'));

  expect(await screen.findByTestId('progress-steps-today')).toHaveTextContent('5,000Today');
  expect(requestAuthorization).toHaveBeenCalledWith({ toRead: [STEPS] });
});

it('says Apple Health is not available where it is not', async () => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(false);
  renderSection();
  expect(await screen.findByTestId('progress-steps-unavailable')).toBeTruthy();
});

it("says Apple Health couldn't be reached, and why", async () => {
  jest.mocked(isHealthDataAvailable).mockImplementation(() => {
    throw new Error('NitroModules are not installed');
  });
  renderSection();
  expect(await screen.findByTestId('progress-steps-failure')).toHaveTextContent(
    'NitroModules are not installed',
  );
  jest.mocked(isHealthDataAvailable).mockReset();
});
