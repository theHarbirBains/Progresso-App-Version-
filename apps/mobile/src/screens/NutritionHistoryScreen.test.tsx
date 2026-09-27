import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { addMonths, MONTH_LABELS, toLocalDateKey } from '../design/calendarGrid';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { ProfileProvider } from '../profile/ProfileProvider';
import { fetchFoodLogsForMonth } from '../nutrition/foodLogQueries';
import { NutritionHistoryScreen } from './NutritionHistoryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  fetchFoodLogsForMonth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchFoodLogsForMonth = fetchFoodLogsForMonth as jest.Mock;

const navigation = {
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const mockOpenMenu = jest.fn();

// NutritionHistoryScreen opens the app-level side menu (via AppMenuContext)
// from its own header, same as every other tab-root/menu-destination screen
// -- this stands in for that root-level provider.
function renderScreen() {
  return render(
    <ProfileProvider>
      <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
        <NutritionHistoryScreen navigation={navigation} route={{} as never} />
      </AppMenuContext.Provider>
    </ProfileProvider>,
  );
}

// Never hardcode "today" -- every fixture/assertion is built relative to
// whenever the suite actually runs, so this never rots into a flaky
// date-dependent test.
const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const CURRENT_MONTH = today.getMonth() + 1;
const CURRENT_MONTH_LABEL = `${MONTH_LABELS[CURRENT_MONTH - 1]} ${CURRENT_YEAR}`;
const fixtureDate = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 5, 12, 0, 0);
const FIXTURE_DATE_KEY = toLocalDateKey(fixtureDate);
const OTHER_DAY_KEY = toLocalDateKey(new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 20));

function log(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    foodId: 'food-1',
    foodNameSnapshot: 'Chicken Breast',
    servingSize: 100,
    servingUnit: 'g',
    quantity: 1,
    calories: 330,
    proteinG: 62,
    carbsG: 0,
    fatG: 7.2,
    mealType: 'lunch',
    loggedAt: fixtureDate.toISOString(),
    imageUrl: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchFoodLogsForMonth.mockReset().mockResolvedValue([]);
  mockOpenMenu.mockClear();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}

describe('NutritionHistoryScreen', () => {
  it('shows the current month by default', async () => {
    renderScreen();

    expect(await screen.findByText(CURRENT_MONTH_LABEL)).toBeTruthy();
    expect(mockFetchFoodLogsForMonth).toHaveBeenCalledWith('user-1', CURRENT_YEAR, CURRENT_MONTH);
    await settle();
  });

  it('opens the app-level side menu when the header button is pressed', async () => {
    renderScreen();
    await screen.findByText(CURRENT_MONTH_LABEL);

    fireEvent.press(screen.getByTestId('nutrition-history-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
    await settle();
  });

  it('renders the hamburger and the "Nutrition History" title on the shared AppHeader row', async () => {
    renderScreen();
    await screen.findByText(CURRENT_MONTH_LABEL);

    const header = screen.getByTestId('nutrition-history-header');
    expect(within(header).getByTestId('nutrition-history-open-menu')).toBeTruthy();
    expect(within(header).getByText('Nutrition History')).toBeTruthy();
    await settle();
  });

  it("navigates to the previous/next month and reloads that month's data", async () => {
    renderScreen();
    await screen.findByText(CURRENT_MONTH_LABEL);
    mockFetchFoodLogsForMonth.mockClear();

    fireEvent.press(screen.getByTestId('calendar-prev-month'));

    const prev = addMonths(CURRENT_YEAR, CURRENT_MONTH, -1);
    expect(await screen.findByText(`${MONTH_LABELS[prev.month - 1]} ${prev.year}`)).toBeTruthy();
    expect(mockFetchFoodLogsForMonth).toHaveBeenCalledWith('user-1', prev.year, prev.month);
    await settle();
  });

  it('marks real logged dates on the calendar', async () => {
    mockFetchFoodLogsForMonth.mockResolvedValue([log()]);

    renderScreen();
    await screen.findByTestId('nutrition-history-calendar');

    const dot = await screen.findByTestId(`nutrition-history-calendar-dot-${FIXTURE_DATE_KEY}`);
    expect(dot.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: 1 })]),
    );
    await settle();
  });

  it('shows the foods logged for a selected date', async () => {
    mockFetchFoodLogsForMonth.mockResolvedValue([log()]);

    renderScreen();
    await screen.findByTestId('nutrition-history-calendar');

    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));

    expect(await screen.findByTestId('nutrition-history-log-row-log-1')).toHaveTextContent(
      /Chicken Breast/,
    );
    expect(screen.getByTestId('nutrition-history-log-row-log-1')).toHaveTextContent(/330 cal/);
    await settle();
  });

  it('shows a clean empty state for a selected date with nothing logged', async () => {
    mockFetchFoodLogsForMonth.mockResolvedValue([log()]);

    renderScreen();
    await screen.findByTestId('nutrition-history-calendar');

    fireEvent.press(screen.getByTestId(`calendar-day-${OTHER_DAY_KEY}`));

    expect(await screen.findByTestId('nutrition-history-day-empty')).toHaveTextContent(
      'No food logged on this day',
    );
    await settle();
  });

  it('deselects a date when it is tapped again', async () => {
    mockFetchFoodLogsForMonth.mockResolvedValue([log()]);

    renderScreen();
    await screen.findByTestId('nutrition-history-calendar');

    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));
    expect(await screen.findByTestId('nutrition-history-selected-day')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));
    expect(screen.queryByTestId('nutrition-history-selected-day')).toBeNull();
    await settle();
  });

  it('shows the month summary once loaded', async () => {
    mockFetchFoodLogsForMonth.mockResolvedValue([
      log({ id: 'log-1', calories: 400 }),
      log({ id: 'log-2', calories: 600, loggedAt: fixtureDate.toISOString() }),
    ]);

    renderScreen();

    expect(await screen.findByTestId('nutrition-history-days-logged')).toHaveTextContent(/^1/);
    expect(screen.getByTestId('nutrition-history-total-calories')).toHaveTextContent(/^1000/);
    expect(screen.getByTestId('nutrition-history-avg-calories')).toHaveTextContent(/^1000/);
    await settle();
  });

  it('shows an error with a retry-free message when the month fails to load', async () => {
    mockFetchFoodLogsForMonth.mockRejectedValue(new Error('network down'));

    renderScreen();

    expect(await screen.findByTestId('nutrition-history-month-error')).toHaveTextContent(
      'network down',
    );
    await settle();
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchFoodLogsForMonth.mockResolvedValue([log()]);
    renderScreen();
    await screen.findByTestId('nutrition-history-calendar');
    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));
    await screen.findByTestId('nutrition-history-selected-day');

    expectNoBareText();
    await settle();
  });
});
