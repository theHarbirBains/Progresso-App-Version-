import type { PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { estimateNutrition, getMyProfile } from '../lib/api';
import { uploadFoodPhoto } from '../lib/foodPhotoUpload';
import { createFood } from '../nutrition/foodQueries';
import { ProfileProvider } from '../profile/ProfileProvider';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { AiFoodSearchScreen } from './AiFoodSearchScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  estimateNutrition: jest.fn(),
}));

jest.mock('../lib/foodPhotoUpload', () => ({
  uploadFoodPhoto: jest.fn(),
}));

jest.mock('../nutrition/foodQueries', () => ({
  createFood: jest.fn(),
  updateFood: jest.fn(),
}));

function TestProviders({ children }: PropsWithChildren) {
  return <ProfileProvider>{children}</ProfileProvider>;
}

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockEstimateNutrition = estimateNutrition as jest.Mock;
const mockUploadFoodPhoto = uploadFoodPhoto as jest.Mock;
const mockCreateFood = createFood as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };
const route = {} as never;

const estimate = {
  name: 'Air-Fried Potatoes (100g)',
  servingSize: 100,
  servingUnit: 'g',
  calories: 120,
  proteinG: 2,
  carbsG: 27,
  fatG: 0.2,
};

function renderScreen() {
  return render(<AiFoodSearchScreen navigation={navigation} route={route} />, {
    wrapper: TestProviders,
  });
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId: null,
  });
  mockEstimateNutrition.mockReset().mockResolvedValue(estimate);
  mockUploadFoodPhoto.mockReset();
  mockCreateFood.mockReset().mockResolvedValue({ id: 'food-1', ...estimate, isActive: true });
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

describe('AiFoodSearchScreen', () => {
  it('disables Get Estimate until a description is entered', async () => {
    renderScreen();
    await screen.findByTestId('ai-food-search-input');

    expect(screen.getByTestId('ai-food-search-submit').props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.changeText(
      screen.getByTestId('ai-food-search-input'),
      '100 grams of air fried potatoes with no oil',
    );

    expect(screen.getByTestId('ai-food-search-submit').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('estimates nutrition for the typed description and shows a pre-filled, editable review form', async () => {
    renderScreen();
    fireEvent.changeText(
      screen.getByTestId('ai-food-search-input'),
      '100 grams of air fried potatoes with no oil',
    );

    fireEvent.press(screen.getByTestId('ai-food-search-submit'));

    expect(await screen.findByTestId('food-form-name')).toHaveProp(
      'value',
      'Air-Fried Potatoes (100g)',
    );
    expect(mockEstimateNutrition).toHaveBeenCalledWith(
      'token-123',
      '100 grams of air fried potatoes with no oil',
    );
    expect(screen.getByTestId('food-form-calories')).toHaveProp('value', '120');
  });

  it('saving the reviewed estimate calls createFood and returns to Food Library', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('ai-food-search-input'), 'one egg');
    fireEvent.press(screen.getByTestId('ai-food-search-submit'));
    await screen.findByTestId('food-form-name');

    fireEvent.press(screen.getByTestId('food-form-save'));

    await waitFor(() =>
      expect(mockCreateFood).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ name: 'Air-Fried Potatoes (100g)', calories: 120 }),
      ),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary'));
  });

  it('canceling the review form returns to the description step, not the previous screen', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByTestId('ai-food-search-input'), 'one egg');
    fireEvent.press(screen.getByTestId('ai-food-search-submit'));
    await screen.findByTestId('food-form-name');

    fireEvent.press(screen.getByTestId('food-form-cancel'));

    expect(await screen.findByTestId('ai-food-search-input')).toBeTruthy();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows an error and stays on the input step when the estimate call fails', async () => {
    mockEstimateNutrition.mockRejectedValueOnce(new Error('network error'));
    renderScreen();
    fireEvent.changeText(screen.getByTestId('ai-food-search-input'), 'one egg');

    fireEvent.press(screen.getByTestId('ai-food-search-submit'));

    expect(await screen.findByTestId('ai-food-search-error')).toHaveTextContent('network error');
    expect(screen.getByTestId('ai-food-search-input')).toBeTruthy();
  });

  it('goes back via the header', async () => {
    renderScreen();
    await screen.findByTestId('ai-food-search-input');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalledWith();
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('ai-food-search-input');

    expectNoBareText();
  });
});
