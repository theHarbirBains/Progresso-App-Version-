import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchNutritionGoals, saveNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsScreen } from './NutritionGoalsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
  saveNutritionGoals: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;
const mockSaveNutritionGoals = saveNutritionGoals as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = {} as never;

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchNutritionGoals.mockReset().mockResolvedValue({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  mockSaveNutritionGoals.mockReset();
  mockGoBack.mockClear();
});

describe('NutritionGoalsScreen', () => {
  it('shows a loading indicator while fetching', async () => {
    render(<NutritionGoalsScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('nutrition-goals-loading')).toBeTruthy();

    await screen.findByTestId('goal-calories');
  });

  it('shows empty inputs when the user has no goals yet', async () => {
    render(<NutritionGoalsScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('goal-calories')).toHaveProp('value', '');
    expect(screen.getByTestId('goal-protein')).toHaveProp('value', '');
    expect(screen.getByTestId('goal-carbs')).toHaveProp('value', '');
    expect(screen.getByTestId('goal-fat')).toHaveProp('value', '');
  });

  it('populates inputs from existing goals', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });

    render(<NutritionGoalsScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('goal-calories')).toHaveProp('value', '2000');
    expect(screen.getByTestId('goal-protein')).toHaveProp('value', '180');
  });

  it('saves entered goals', async () => {
    mockSaveNutritionGoals.mockResolvedValue({
      calories: 2200,
      proteinG: 170,
      carbsG: null,
      fatG: null,
    });

    render(<NutritionGoalsScreen navigation={navigation} route={route} />);
    await screen.findByTestId('goal-calories');

    fireEvent.changeText(screen.getByTestId('goal-calories'), '2200');
    fireEvent.changeText(screen.getByTestId('goal-protein'), '170');

    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    expect(mockSaveNutritionGoals).toHaveBeenCalledWith('user-1', {
      calories: 2200,
      proteinG: 170,
      carbsG: null,
      fatG: null,
    });
    expect(screen.getByTestId('nutrition-goals-saved')).toBeTruthy();
  });

  it('clears a goal by blanking its input and saving', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });
    mockSaveNutritionGoals.mockResolvedValue({
      calories: null,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });

    render(<NutritionGoalsScreen navigation={navigation} route={route} />);
    await screen.findByTestId('goal-calories');

    fireEvent.changeText(screen.getByTestId('goal-calories'), '');

    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    expect(mockSaveNutritionGoals).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ calories: null }),
    );
  });

  it('shows an error message when saving fails', async () => {
    mockSaveNutritionGoals.mockRejectedValue(new Error('network error'));

    render(<NutritionGoalsScreen navigation={navigation} route={route} />);
    await screen.findByTestId('goal-calories');

    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    expect(screen.getByTestId('nutrition-goals-error')).toHaveTextContent('network error');
  });

  it('shows an error message when loading fails', async () => {
    mockFetchNutritionGoals.mockRejectedValue(new Error('network error'));

    render(<NutritionGoalsScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('nutrition-goals-error')).toHaveTextContent('network error');
  });

  it('goes back when Back is pressed', async () => {
    render(<NutritionGoalsScreen navigation={navigation} route={route} />);
    await screen.findByTestId('goal-calories');

    fireEvent.press(screen.getByTestId('nutrition-goals-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
