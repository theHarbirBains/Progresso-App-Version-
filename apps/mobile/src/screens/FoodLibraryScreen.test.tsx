import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { logFood } from '../nutrition/foodLogQueries';
import { createFood, fetchFoods, updateFood } from '../nutrition/foodQueries';
import { FoodLibraryScreen } from './FoodLibraryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../nutrition/foodQueries', () => ({
  fetchFoods: jest.fn(),
  createFood: jest.fn(),
  updateFood: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  logFood: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchFoods = fetchFoods as jest.Mock;
const mockCreateFood = createFood as jest.Mock;
const mockUpdateFood = updateFood as jest.Mock;
const mockLogFood = logFood as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = {} as never;

const chickenBreast = {
  id: 'food-1',
  name: 'Chicken Breast',
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  isActive: true,
};

// FlatList schedules a deferred internal setState via a real setTimeout
// that can otherwise fire after a test ends -- see ExerciseLibraryScreen's
// original diagnosis of this pattern.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchFoods.mockReset().mockResolvedValue({ rows: [chickenBreast], hasMore: false });
  mockCreateFood.mockReset();
  mockUpdateFood.mockReset();
  mockLogFood.mockReset();
  mockGoBack.mockClear();
});

describe('FoodLibraryScreen', () => {
  it('loads and displays the current user custom foods', async () => {
    render(<FoodLibraryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('food-item-food-1')).toHaveTextContent(/Chicken Breast/);
    expect(mockFetchFoods).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', search: '', page: 0, pageSize: 20 }),
    );
    await settle();
  });

  it('shows an empty state with a create action when there are no foods yet', async () => {
    mockFetchFoods.mockResolvedValue({ rows: [], hasMore: false });

    render(<FoodLibraryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('food-library-empty')).toHaveTextContent('No foods yet');
    expect(screen.getByTestId('food-empty-create')).toBeTruthy();
    await settle();
  });

  it('debounces search input into a query', async () => {
    jest.useFakeTimers();
    render(<FoodLibraryScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
    });
    mockFetchFoods.mockClear();

    fireEvent.changeText(screen.getByTestId('food-search'), 'chicken');
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockFetchFoods).toHaveBeenCalledWith(expect.objectContaining({ search: 'chicken' }));
    jest.useRealTimers();
  });

  it('shows an error message when loading fails', async () => {
    mockFetchFoods.mockRejectedValue(new Error('network error'));

    render(<FoodLibraryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('food-library-error')).toHaveTextContent('network error');
    await settle();
  });

  it('creates a food and returns to the list', async () => {
    mockCreateFood.mockResolvedValue({ ...chickenBreast, id: 'food-2', name: 'Rice' });

    render(<FoodLibraryScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-item-food-1');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Rice');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '150');
    fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '200');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '4');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '45');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '0');

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockCreateFood).toHaveBeenCalledWith('user-1', {
      name: 'Rice',
      servingSize: 150,
      servingUnit: 'g',
      calories: 200,
      proteinG: 4,
      carbsG: 45,
      fatG: 0,
    });
    expect(await screen.findByTestId('food-search')).toBeTruthy();
    await settle();
  });

  it('edits an existing food', async () => {
    mockUpdateFood.mockResolvedValue({ ...chickenBreast, calories: 170 });

    render(<FoodLibraryScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-item-food-1');

    fireEvent.press(screen.getByTestId('food-edit-food-1'));
    expect(await screen.findByTestId('food-form-name')).toBeTruthy();
    expect(screen.getByTestId('food-form-name').props.value).toBe('Chicken Breast');

    fireEvent.changeText(screen.getByTestId('food-form-calories'), '170');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockUpdateFood).toHaveBeenCalledWith(
      'food-1',
      expect.objectContaining({ calories: 170 }),
    );
    await settle();
  });

  it('logs a food with the default quantity of 1', async () => {
    mockLogFood.mockResolvedValue({});

    render(<FoodLibraryScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-item-food-1');

    fireEvent.press(screen.getByTestId('food-item-food-1'));

    expect(await screen.findByTestId('log-food-quantity')).toHaveProp('value', '1');
    expect(screen.getByTestId('log-food-preview')).toHaveTextContent(/165 cal/);

    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith('user-1', chickenBreast, 1);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('scales the preview totals when quantity changes', async () => {
    render(<FoodLibraryScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-item-food-1');

    fireEvent.press(screen.getByTestId('food-item-food-1'));
    await screen.findByTestId('log-food-quantity');

    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '2');

    expect(screen.getByTestId('log-food-preview')).toHaveTextContent(/330 cal/);
  });

  it('goes back when Back is pressed', async () => {
    render(<FoodLibraryScreen navigation={navigation} route={route} />);
    await screen.findByTestId('food-item-food-1');

    fireEvent.press(screen.getByTestId('food-library-back'));

    expect(mockGoBack).toHaveBeenCalled();
    await settle();
  });
});
