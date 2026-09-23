import { Image, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { AppMenuContext } from '../navigation/AppMenuContext';
import {
  deleteFoodLog,
  fetchTodaysFoodLogs,
  updateFoodLogQuantity,
} from '../nutrition/foodLogQueries';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionTodayScreen } from './NutritionTodayScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  fetchTodaysFoodLogs: jest.fn(),
  updateFoodLogQuantity: jest.fn(),
  deleteFoodLog: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;
const mockUpdateFoodLogQuantity = updateFoodLogQuantity as jest.Mock;
const mockDeleteFoodLog = deleteFoodLog as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;
const mockOpenMenu = jest.fn();

// NutritionTodayScreen opens the app-level side menu (via AppMenuContext)
// from its own header, same as every other tab-root screen -- this stands in
// for that root-level provider.
function renderScreen() {
  return render(
    <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
      <NutritionTodayScreen navigation={navigation} route={route} />
    </AppMenuContext.Provider>,
  );
}

const sampleLog = {
  id: 'log-1',
  foodId: 'food-1',
  foodNameSnapshot: 'Chicken Breast',
  servingSize: 100,
  servingUnit: 'g',
  quantity: 2,
  calories: 330,
  proteinG: 62,
  carbsG: 0,
  fatG: 7.2,
  loggedAt: '2026-01-01T12:00:00Z',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockFetchNutritionGoals.mockReset().mockResolvedValue({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  mockUpdateFoodLogQuantity.mockReset();
  mockDeleteFoodLog.mockReset();
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

describe('NutritionTodayScreen', () => {
  it('shows a loading indicator while fetching', async () => {
    renderScreen();

    expect(screen.getByTestId('nutrition-today-loading')).toBeTruthy();

    // Let the in-flight load settle inside act() before the test ends, so
    // React doesn't warn about a state update after the test already returned.
    await screen.findByTestId('food-log-empty');
  });

  it('shows an error message when loading fails', async () => {
    mockFetchTodaysFoodLogs.mockRejectedValue(new Error('network error'));

    renderScreen();

    expect(await screen.findByTestId('nutrition-today-error')).toHaveTextContent('network error');
  });

  it('shows an empty state when no foods are logged today', async () => {
    renderScreen();

    expect(await screen.findByTestId('food-log-empty')).toBeTruthy();
    expect(screen.getByTestId('calories-consumed')).toHaveTextContent('Calories: 0');
  });

  it('shows consumed totals without targets/remaining when no goals are set', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);

    renderScreen();

    expect(await screen.findByTestId('food-log-row-log-1')).toBeTruthy();
    expect(screen.getByTestId('calories-consumed')).toHaveTextContent('Calories: 330');
    expect(screen.queryByTestId('calories-remaining')).toBeNull();
  });

  it('shows targets and remaining values when goals are configured', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });

    renderScreen();

    expect(await screen.findByTestId('calories-consumed')).toHaveTextContent(
      'Calories: 330 / 2000',
    );
    expect(screen.getByTestId('calories-remaining')).toHaveTextContent('1670 remaining');
    expect(screen.getByTestId('protein-remaining')).toHaveTextContent('118g remaining');
  });

  it('lists each logged food with its snapshot values', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);

    renderScreen();

    expect(await screen.findByTestId('food-log-row-log-1')).toHaveTextContent(/Chicken Breast/);
    expect(screen.getByTestId('food-log-row-log-1')).toHaveTextContent(/330 cal/);
  });

  it('updates a quantity and re-sums totals from the returned log', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockUpdateFoodLogQuantity.mockResolvedValue({
      ...sampleLog,
      quantity: 3,
      calories: 495,
      proteinG: 93,
    });

    renderScreen();
    await screen.findByTestId('food-log-row-log-1');

    fireEvent.changeText(screen.getByTestId('food-log-quantity-log-1'), '3');
    await act(async () => {
      fireEvent(screen.getByTestId('food-log-quantity-log-1'), 'endEditing');
    });

    expect(mockUpdateFoodLogQuantity).toHaveBeenCalledWith(sampleLog, 3);
    await waitFor(() =>
      expect(screen.getByTestId('calories-consumed')).toHaveTextContent('Calories: 495'),
    );
  });

  it('deletes a food log and removes it from the list', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockDeleteFoodLog.mockResolvedValue(undefined);

    renderScreen();
    await screen.findByTestId('food-log-row-log-1');

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-log-delete-log-1'));
    });

    expect(mockDeleteFoodLog).toHaveBeenCalledWith('log-1');
    await waitFor(() => expect(screen.queryByTestId('food-log-row-log-1')).toBeNull());
    expect(screen.getByTestId('food-log-empty')).toBeTruthy();
  });

  it('navigates to FoodLibrary when Log Food is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('log-food-button'));

    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary');
  });

  it('navigates to NutritionGoals when the goals link is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('nutrition-goals-link'));

    expect(mockNavigate).toHaveBeenCalledWith('NutritionGoals');
  });

  it('opens the app-level side menu when the header button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('nutrition-today-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
  });
});

// Regression coverage for a reported bug: returning to this screen briefly
// blanked it with a full-screen spinner before the refreshed data arrived.
// `load()` only sets `loading` true on the very first call now (see
// `hasLoadedOnce`) -- every later focus-triggered call is a silent
// background refresh.
describe('NutritionTodayScreen background refresh on focus', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('does not show the loading indicator on a focus-triggered refresh', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    const refresh = deferred<unknown[]>();
    mockFetchTodaysFoodLogs.mockReturnValue(refresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    expect(screen.queryByTestId('nutrition-today-loading')).toBeNull();
    expect(screen.getByTestId('nutrition-today-open-menu')).toBeTruthy();

    await act(async () => {
      refresh.resolve([]);
      await refresh.promise;
    });
  });
});

describe('NutritionTodayScreen -- widgets, one primary action', () => {
  it("is three widgets: the macros, the actions and today's foods", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    renderScreen();
    await screen.findByTestId('food-log-row-log-1');

    const cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards.map((c) => Boolean(c.props.hero))).toEqual([true, false, false]);
    expect(
      within(screen.getByTestId('nutrition-today-foods')).getByTestId('food-log-row-log-1'),
    ).toBeTruthy();
  });

  it("shows the logged food's photo when it has one, and a glyph when it does not", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([
      { ...sampleLog, imageUrl: 'https://images.example/a.jpg' },
      { ...sampleLog, id: 'log-2', imageUrl: null },
    ]);
    renderScreen();

    const withPhoto = await screen.findByTestId('food-log-row-log-1');
    expect(within(withPhoto).UNSAFE_getByType(Image).props.source).toEqual({
      uri: 'https://images.example/a.jpg',
    });
    expect(
      within(screen.getByTestId('food-log-row-log-2')).UNSAFE_queryAllByType(Image),
    ).toHaveLength(0);
  });

  it('has one filled button -- Log Food -- with Nutrition Goals outlined', async () => {
    renderScreen();
    await screen.findByTestId('log-food-button');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    const goals = StyleSheet.flatten(screen.getByTestId('nutrition-goals-link').props.style);
    expect(goals.backgroundColor).toBeUndefined();
    expect(goals.borderWidth).toBe(1);
  });

  it('names the menu control for assistive tech', async () => {
    renderScreen();
    await screen.findByTestId('log-food-button');

    expect(screen.getByTestId('nutrition-today-open-menu').props.accessibilityLabel).toBe(
      'Open menu',
    );
  });

  it('shows each logged food as a row with a named quantity field and a quiet destructive Delete', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    renderScreen();

    const row = await screen.findByTestId(`food-log-row-${sampleLog.id}`);
    expect(row).toBeTruthy();
    expect(
      screen.getByTestId(`food-log-quantity-${sampleLog.id}`).props.accessibilityLabel,
    ).toMatch(/^Quantity of /);
    const del = screen.getByTestId(`food-log-delete-${sampleLog.id}`);
    expect(del.props.accessibilityLabel).toMatch(/^Delete /);
    expect(StyleSheet.flatten(del.props.style).borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(del.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    renderScreen();
    await screen.findByTestId(`food-log-row-${sampleLog.id}`);

    expectNoBareText();
  });
});
