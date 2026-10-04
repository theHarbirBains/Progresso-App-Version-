import type { PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, interpretFoodDescription, resolveFoodComponent } from '../lib/api';
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
  resolveFoodComponent: jest.fn(),
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
const mockResolve = resolveFoodComponent as jest.Mock;
const mockCreateFood = createFood as jest.Mock;
const mockFindOwnFoodByName = findOwnFoodByName as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };
const route = {} as never;

const POTATO_FIGURES = {
  name: 'air fried potatoes',
  quantity: { amount: 100, unit: 'g' },
  grams: 100,
  nutrients: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
  provenance: {
    confidence: 'verified' as const,
    sourceKind: 'progresso_catalog' as const,
    sourceId: 'potato-id',
    matchedName: 'Potato (baked)',
    brand: null,
    dataVersion: 'progresso-catalog',
    retrievedAt: '2026-10-04T00:00:00.000Z',
    licence: 'none',
    attribution: null,
    assumptions: [
      'Progresso catalog figures; the original source of these values is not recorded.',
    ],
  },
};

const POTATO_REQUEST = {
  index: 0,
  role: 'main' as const,
  name: 'air fried potatoes',
  term: 'baked potato',
  brand: null,
  barcode: null,
  quantity: { amount: 100, unit: 'g' },
};

// A complete interpretation: one verified part, the totals shown, nothing pending.
const COMPLETE = {
  status: 'ok' as const,
  interpretation: {
    name: 'air fried potatoes',
    preparation: 'air fried, no oil',
    components: [
      { state: 'resolved' as const, request: POTATO_REQUEST, component: POTATO_FIGURES },
    ],
    complete: true,
    servingSize: 100,
    servingUnit: 'g',
    totals: { calories: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1 },
    hasEstimate: false,
  },
};

// An interpretation with an amount still needed for a baked potato.
const NEEDS_AMOUNT = {
  status: 'ok' as const,
  interpretation: {
    name: 'baked potato',
    preparation: null,
    components: [
      {
        state: 'needs_quantity' as const,
        request: { ...POTATO_REQUEST, name: 'baked potato', term: 'baked potato', quantity: null },
        matchedName: 'Potato (baked)',
        options: [
          { label: '100 g', amount: 100, unit: 'g' },
          { label: '1 serving (100 g)', amount: 100, unit: 'g' },
        ],
        reason: 'no amount given',
      },
    ],
    complete: false,
    servingSize: null,
    servingUnit: null,
    totals: null,
    hasEstimate: false,
  },
};

// A choice between two close candidates.
const CHOOSE = {
  status: 'ok' as const,
  interpretation: {
    name: 'potato',
    preparation: null,
    components: [
      {
        state: 'choose' as const,
        request: {
          ...POTATO_REQUEST,
          name: 'potato',
          term: 'potato',
          quantity: { amount: 100, unit: 'g' },
        },
        choices: [
          {
            sourceKind: 'progresso_catalog' as const,
            sourceId: 'potato-id',
            matchedName: 'Potato (baked)',
            brand: null,
            score: 0.88,
            reasons: [],
          },
          {
            sourceKind: 'progresso_catalog' as const,
            sourceId: 'sweet-id',
            matchedName: 'Sweet Potato (baked)',
            brand: null,
            score: 0.83,
            reasons: [],
          },
        ],
      },
    ],
    complete: false,
    servingSize: null,
    servingUnit: null,
    totals: null,
    hasEstimate: false,
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
  mockInterpret.mockReset().mockResolvedValue(COMPLETE);
  mockResolve.mockReset();
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

  it('shows a complete review with its totals and source, and saves nothing', async () => {
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
    expect(screen.getByTestId('ai-food-review-calories')).toHaveTextContent('93', { exact: false });
    expect(screen.getByTestId('ai-food-review-component-0')).toHaveTextContent(
      'From Progresso food data: Potato (baked) (verified)',
      { exact: false },
    );
    expect(mockCreateFood).not.toHaveBeenCalled();
  });

  it("asks for the missing amount with the source's own options, and totals once it is given", async () => {
    mockInterpret.mockResolvedValue(NEEDS_AMOUNT);
    mockResolve.mockResolvedValue(COMPLETE.interpretation.components[0]);
    renderScreen();
    describeFood('baked potato');

    expect(await screen.findByTestId('ai-food-option-0-0')).toBeTruthy();
    expect(screen.queryByTestId('ai-food-review-calories')).toBeNull();
    expect(screen.getByTestId('ai-food-review-incomplete')).toBeTruthy();

    fireEvent.press(screen.getByTestId('ai-food-option-0-0'));

    await waitFor(() =>
      expect(screen.getByTestId('ai-food-review-calories')).toHaveTextContent('93', {
        exact: false,
      }),
    );
    expect(mockResolve).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ index: 0, quantity: { amount: 100, unit: 'g' } }),
      null,
    );
  });

  it('accepts an amount the user types, such as "2 large", and resolves that part', async () => {
    mockInterpret.mockResolvedValue(NEEDS_AMOUNT);
    mockResolve.mockResolvedValue(COMPLETE.interpretation.components[0]);
    renderScreen();
    describeFood('baked potato');

    await screen.findByTestId('ai-food-amount-input-0');
    fireEvent.changeText(screen.getByTestId('ai-food-amount-input-0'), '150 g');
    fireEvent.press(screen.getByTestId('ai-food-amount-submit-0'));

    await waitFor(() =>
      expect(mockResolve).toHaveBeenCalledWith(
        'token-123',
        expect.objectContaining({ quantity: { amount: 150, unit: 'g' } }),
        null,
      ),
    );
  });

  it('resolves a part from the candidate the user picked, sending the pick, not a new search', async () => {
    mockInterpret.mockResolvedValue(CHOOSE);
    mockResolve.mockResolvedValue(COMPLETE.interpretation.components[0]);
    renderScreen();
    describeFood('potato');

    fireEvent.press(await screen.findByTestId('ai-food-choice-0-1'));

    await waitFor(() =>
      expect(mockResolve).toHaveBeenCalledWith('token-123', expect.objectContaining({ index: 0 }), {
        sourceKind: 'progresso_catalog',
        sourceId: 'sweet-id',
      }),
    );
    expect(mockInterpret).toHaveBeenCalledTimes(1);
  });

  it('does not allow adding while any part is still pending', async () => {
    mockInterpret.mockResolvedValue(NEEDS_AMOUNT);
    renderScreen();
    describeFood('baked potato');

    await screen.findByTestId('ai-food-option-0-0');
    expect(screen.getByTestId('ai-food-add').props.accessibilityState?.disabled).toBeTruthy();
  });

  it('labels AI estimates as unverified and warns before adding', async () => {
    mockInterpret.mockResolvedValue({
      status: 'ok',
      interpretation: {
        ...COMPLETE.interpretation,
        components: [
          {
            state: 'ai_estimate',
            request: POTATO_REQUEST,
            component: {
              ...POTATO_FIGURES,
              provenance: {
                ...POTATO_FIGURES.provenance,
                confidence: 'ai_estimate',
                sourceKind: 'ai_estimate',
                matchedName: null,
              },
            },
          },
        ],
        hasEstimate: true,
      },
    });
    renderScreen();
    describeFood('dragon fruit');

    expect(await screen.findByTestId('ai-food-review-estimate-warning')).toBeTruthy();
    expect(screen.getByTestId('ai-food-review-component-0')).toHaveTextContent(
      'AI estimate, not verified',
      { exact: false },
    );
  });

  it('shows a clarification question and no review when the food itself is unclear', async () => {
    mockInterpret.mockResolvedValue({ status: 'clarification', question: 'What food was it?' });
    renderScreen();
    describeFood('some stuff');

    expect(await screen.findByTestId('ai-food-search-clarification')).toHaveTextContent(
      'What food was it?',
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

  it('adds the complete food to the Food Library with its serving, totals and provenance, then returns there', async () => {
    renderScreen();
    describeFood('100 grams of air fried potatoes with no oil');
    await screen.findByTestId('ai-food-review');

    fireEvent.press(screen.getByTestId('ai-food-add'));

    await waitFor(() =>
      expect(mockCreateFood).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          name: 'air fried potatoes (air fried, no oil)',
          servingSize: 100,
          servingUnit: 'g',
          calories: 93,
          proteinG: 2.5,
          carbsG: 21.2,
          fatG: 0.1,
          provenance: expect.objectContaining({
            confidence: 'verified',
            sourceKind: 'progresso_catalog',
            matchedName: 'Potato (baked)',
          }),
        }),
      ),
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
