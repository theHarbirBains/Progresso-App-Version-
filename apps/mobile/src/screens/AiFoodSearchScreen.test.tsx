import type { PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, interpretFoodDescription } from '../lib/api';
import { createFood, findOwnFoodByName } from '../nutrition/foodQueries';
import { ProfileProvider } from '../profile/ProfileProvider';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { AiFoodSearchScreen } from './AiFoodSearchScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  interpretFoodDescription: jest.fn(),
}));

jest.mock('../nutrition/foodQueries', () => ({
  createFood: jest.fn(),
  findOwnFoodByName: jest.fn(),
}));

function TestProviders({ children }: PropsWithChildren) {
  return <ProfileProvider>{children}</ProfileProvider>;
}

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockInterpret = interpretFoodDescription as jest.Mock;
const mockCreateFood = createFood as jest.Mock;
const mockFindOwnFoodByName = findOwnFoodByName as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };
const route = {} as never;

// A grams query matched to the catalog: 100 g of potato, no added ingredients.
const POTATO_INTERPRETATION = {
  status: 'ok' as const,
  interpretation: {
    name: 'air fried potatoes',
    servingSize: 100,
    servingUnit: 'g',
    preparation: 'air fried, no oil',
    components: [
      {
        role: 'main' as const,
        name: 'air fried potatoes',
        quantity: 100,
        unit: 'g',
        source: 'database' as const,
        matchedName: 'Potato (baked)',
        assumption: null,
        calories: 93,
        proteinG: 2.5,
        carbsG: 21.2,
        fatG: 0.1,
      },
    ],
    totals: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
    hasEstimate: false,
  },
};

// A meal with an added ingredient matched to the catalog and one AI estimate.
const MIXED_INTERPRETATION = {
  status: 'ok' as const,
  interpretation: {
    name: 'dragon fruit bowl',
    servingSize: 1,
    servingUnit: 'item',
    preparation: null,
    components: [
      {
        role: 'main' as const,
        name: 'dragon fruit bowl',
        quantity: 1,
        unit: 'item',
        source: 'ai_estimate' as const,
        matchedName: null,
        assumption: null,
        calories: 120,
        proteinG: 2,
        carbsG: 27,
        fatG: 0.5,
      },
      {
        role: 'ingredient' as const,
        name: 'butter',
        quantity: 1,
        unit: 'tsp',
        source: 'database' as const,
        matchedName: 'Butter',
        assumption: null,
        calories: 34,
        proteinG: 0,
        carbsG: 0,
        fatG: 3.8,
      },
    ],
    totals: { calories: 154, proteinG: 2, carbsG: 27, fatG: 4.3 },
    hasEstimate: true,
  },
};

function renderScreen() {
  return render(<AiFoodSearchScreen navigation={navigation} route={route} />, {
    wrapper: TestProviders,
  });
}

function describeFood(text: string) {
  fireEvent.changeText(screen.getByTestId('ai-food-search-input'), text);
  fireEvent.press(screen.getByTestId('ai-food-search-submit'));
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
    weightUnit: 'lb',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId: null,
  });
  mockInterpret.mockReset().mockResolvedValue(POTATO_INTERPRETATION);
  mockCreateFood.mockReset().mockResolvedValue({ id: 'food-1', isActive: true });
  mockFindOwnFoodByName.mockReset().mockResolvedValue(null);
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

describe('AiFoodSearchScreen', () => {
  it('disables Get Estimate until a description is entered', async () => {
    renderScreen();

    const submit = await screen.findByTestId('ai-food-search-submit');
    expect(submit.props.accessibilityState?.disabled ?? submit.props.disabled).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('ai-food-search-input'), '   ');
    expect(mockInterpret).not.toHaveBeenCalled();
  });

  it('shows the accuracy guidance and a secondary example near the input', async () => {
    renderScreen();

    expect(await screen.findByTestId('ai-food-search-accuracy')).toHaveTextContent(
      'include the amount, serving unit, preparation method',
      { exact: false },
    );
    expect(screen.getByTestId('ai-food-search-example')).toHaveTextContent(
      '150 g chicken breast, air fried with 1 tsp olive oil.',
      { exact: false },
    );
  });

  it('interprets the description and shows a review, saving nothing', async () => {
    renderScreen();
    describeFood('100 grams of air fried potatoes with no oil');

    expect(await screen.findByTestId('ai-food-review')).toBeTruthy();
    expect(mockInterpret).toHaveBeenCalledWith(
      'token-123',
      '100 grams of air fried potatoes with no oil',
    );
    expect(screen.getByTestId('ai-food-review-serving')).toHaveTextContent(
      '100 g air fried potatoes',
    );
    expect(screen.getByTestId('ai-food-review-preparation')).toHaveTextContent(
      'air fried, no oil',
      { exact: false },
    );
    expect(screen.getByTestId('ai-food-review-calories')).toHaveTextContent('93', { exact: false });
    expect(screen.getByTestId('ai-food-review-protein')).toHaveTextContent('2.5 g', {
      exact: false,
    });
    expect(screen.getByTestId('ai-food-review-component-0')).toHaveTextContent(
      'From Progresso food data: Potato (baked)',
      { exact: false },
    );
    expect(mockCreateFood).not.toHaveBeenCalled();
  });

  it('labels AI estimates as unverified and warns before adding', async () => {
    mockInterpret.mockResolvedValue(MIXED_INTERPRETATION);
    renderScreen();
    describeFood('dragon fruit bowl with 1 tsp butter');

    expect(await screen.findByTestId('ai-food-review-estimate-warning')).toBeTruthy();
    expect(screen.getByTestId('ai-food-review-component-0')).toHaveTextContent(
      'AI estimate, not verified',
      { exact: false },
    );
    expect(screen.getByTestId('ai-food-review-component-1')).toHaveTextContent(
      'From Progresso food data: Butter',
      { exact: false },
    );
  });

  it('does not show the AI warning when every figure came from food data', async () => {
    renderScreen();
    describeFood('100 grams of air fried potatoes with no oil');

    await screen.findByTestId('ai-food-review');
    expect(screen.queryByTestId('ai-food-review-estimate-warning')).toBeNull();
  });

  it('shows a clarification question and no review when the description is too vague', async () => {
    mockInterpret.mockResolvedValue({
      status: 'clarification',
      question: 'How much rice did you eat?',
    });
    renderScreen();
    describeFood('rice');

    expect(await screen.findByTestId('ai-food-search-clarification')).toHaveTextContent(
      'How much rice did you eat?',
    );
    expect(screen.queryByTestId('ai-food-review')).toBeNull();
    expect(mockCreateFood).not.toHaveBeenCalled();
  });

  it('shows an error and no review when the estimate call fails', async () => {
    mockInterpret.mockRejectedValue(new Error('AI food search failed. Please try again.'));
    renderScreen();
    describeFood('100g rice');

    expect(await screen.findByTestId('ai-food-search-error')).toHaveTextContent(
      'AI food search failed. Please try again.',
    );
    expect(screen.queryByTestId('ai-food-review')).toBeNull();
  });

  it('adds the reviewed food to the Food Library with its serving and totals, then returns there', async () => {
    renderScreen();
    describeFood('100 grams of air fried potatoes with no oil');
    await screen.findByTestId('ai-food-review');

    fireEvent.press(screen.getByTestId('ai-food-add'));

    await waitFor(() =>
      expect(mockCreateFood).toHaveBeenCalledWith('user-1', {
        name: 'air fried potatoes (air fried, no oil)',
        servingSize: 100,
        servingUnit: 'g',
        calories: 93,
        proteinG: 2.5,
        carbsG: 21.2,
        fatG: 0.1,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary');
  });

  it('does not add a food the library already has by name, and says so', async () => {
    mockFindOwnFoodByName.mockResolvedValue({
      id: 'existing',
      name: 'air fried potatoes (air fried, no oil)',
    });
    renderScreen();
    describeFood('100 grams of air fried potatoes with no oil');

    expect(await screen.findByTestId('ai-food-review-duplicate')).toHaveTextContent(
      'already in your Food Library',
      { exact: false },
    );
    expect(screen.getByTestId('ai-food-add').props.accessibilityState?.disabled).toBeTruthy();
    expect(mockCreateFood).not.toHaveBeenCalled();
  });

  it('checks for a duplicate again at the moment of adding, so a race cannot create one', async () => {
    renderScreen();
    describeFood('100 grams of air fried potatoes with no oil');
    await screen.findByTestId('ai-food-review');

    // Added elsewhere while this review was open.
    mockFindOwnFoodByName.mockResolvedValue({ id: 'existing', name: 'air fried potatoes' });
    fireEvent.press(screen.getByTestId('ai-food-add'));

    expect(await screen.findByTestId('ai-food-review-duplicate')).toBeTruthy();
    expect(mockCreateFood).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows an error and stays on the review when adding fails', async () => {
    mockCreateFood.mockRejectedValue(new Error('network down'));
    renderScreen();
    describeFood('100 grams of air fried potatoes with no oil');
    await screen.findByTestId('ai-food-review');

    fireEvent.press(screen.getByTestId('ai-food-add'));

    expect(await screen.findByTestId('ai-food-search-error')).toHaveTextContent('network down');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Describe again returns to the input without saving anything', async () => {
    renderScreen();
    describeFood('100 grams of air fried potatoes with no oil');
    await screen.findByTestId('ai-food-review');

    fireEvent.press(screen.getByTestId('ai-food-describe-again'));

    expect(screen.queryByTestId('ai-food-review')).toBeNull();
    expect(screen.getByTestId('ai-food-search-input')).toBeTruthy();
    expect(mockCreateFood).not.toHaveBeenCalled();
  });

  it('goes back via the header', async () => {
    renderScreen();
    fireEvent.press(await screen.findByLabelText('Back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('ai-food-search-input');

    expectNoBareText();
  });
});
