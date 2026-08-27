import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
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
    render(<NutritionTodayScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('nutrition-today-loading')).toBeTruthy();

    // Let the in-flight load settle inside act() before the test ends, so
    // React doesn't warn about a state update after the test already returned.
    await screen.findByTestId('food-log-empty');
  });

  it('shows an error message when loading fails', async () => {
    mockFetchTodaysFoodLogs.mockRejectedValue(new Error('network error'));

    render(<NutritionTodayScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('nutrition-today-error')).toHaveTextContent('network error');
  });

  it('shows an empty state when no foods are logged today', async () => {
    render(<NutritionTodayScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('food-log-empty')).toBeTruthy();
    expect(screen.getByTestId('calories-consumed')).toHaveTextContent('Calories: 0');
  });

  it('shows consumed totals without targets/remaining when no goals are set', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);

    render(<NutritionTodayScreen navigation={navigation} route={route} />);

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

    render(<NutritionTodayScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('calories-consumed')).toHaveTextContent(
      'Calories: 330 / 2000',
    );
    expect(screen.getByTestId('calories-remaining')).toHaveTextContent('1670 remaining');
    expect(screen.getByTestId('protein-remaining')).toHaveTextContent('118g remaining');
  });

  it('lists each logged food with its snapshot values', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);

    render(<NutritionTodayScreen navigation={navigation} route={route} />);

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

    render(<NutritionTodayScreen navigation={navigation} route={route} />);
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

    render(<NutritionTodayScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-log-row-log-1');

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-log-delete-log-1'));
    });

    expect(mockDeleteFoodLog).toHaveBeenCalledWith('log-1');
    await waitFor(() => expect(screen.queryByTestId('food-log-row-log-1')).toBeNull());
    expect(screen.getByTestId('food-log-empty')).toBeTruthy();
  });

  it('navigates to FoodLibrary when Log Food is pressed', async () => {
    render(<NutritionTodayScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('log-food-button'));

    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary');
  });

  it('navigates to NutritionGoals when the goals link is pressed', async () => {
    render(<NutritionTodayScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('nutrition-goals-link'));

    expect(mockNavigate).toHaveBeenCalledWith('NutritionGoals');
  });

  it('goes back when Back is pressed', async () => {
    render(<NutritionTodayScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('nutrition-today-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
