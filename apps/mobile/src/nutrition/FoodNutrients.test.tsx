import { fireEvent, render, screen } from '@testing-library/react-native';
import { fetchFoodMicronutrients } from './foodQueries';
import { FoodNutrients, forgetFoodMicronutrients } from './FoodNutrients';

jest.mock('./foodQueries', () => ({ fetchFoodMicronutrients: jest.fn() }));
let mockProfile: { id: string; birthday: string | null; gender: string | null } | null = null;
jest.mock('../profile/ProfileProvider', () => ({ useProfileIfAny: () => mockProfile }));

const mockFetch = fetchFoodMicronutrients as jest.Mock;

beforeEach(() => {
  forgetFoodMicronutrients();
  mockFetch.mockReset();
  mockProfile = { id: 'user-1', birthday: '1990-06-15', gender: 'female' };
});

describe('FoodNutrients', () => {
  it('lists what the data gives for the amount, the largest share of the target first', async () => {
    render(
      <FoodNutrients
        foodId="f1"
        perServing={{ vitamin_c: 30, iron: 9, calcium: 100 }}
        servings={2}
        accentColor="#E8A44A"
      />,
    );
    // Two servings: 60 mg of 75 (80%), 18 mg of 18 (100%), 200 mg of 1,000 (20%).
    expect(await screen.findByTestId('food-nutrients-iron')).toHaveTextContent(/Iron.*18 mg.*100%/);
    expect(screen.getByTestId('food-nutrients-vitamin_c')).toHaveTextContent(/60 mg.*80%/);
    expect(screen.getByTestId('food-nutrients')).toHaveTextContent(/Iron.*Vitamin C.*Calcium/);
    // Never listed as 0: a nutrient the data doesn't give isn't there at all.
    expect(screen.queryByTestId('food-nutrients-vitamin_d')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("reads a found food's, once, and says so when its data has none", async () => {
    mockFetch.mockResolvedValue(null);
    const { unmount } = render(<FoodNutrients foodId="f2" servings={1} accentColor="#E8A44A" />);
    expect(await screen.findByTestId('food-nutrients-none')).toHaveTextContent(
      /won’t add to your micronutrients/,
    );
    unmount();
    render(<FoodNutrients foodId="f2" servings={1} accentColor="#E8A44A" />);
    await screen.findByTestId('food-nutrients-none');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows five to start, the rest a tap away -- amounts only without the details for a target', async () => {
    mockProfile = null;
    mockFetch.mockResolvedValue({
      vitamin_c: 1,
      iron: 1,
      calcium: 1,
      zinc: 1,
      magnesium: 1,
      potassium: 1,
    });
    render(<FoodNutrients foodId="f3" servings={1} accentColor="#E8A44A" />);
    await screen.findByTestId('food-nutrients-all');
    expect(screen.queryByText(/%$/)).toBeNull();
    fireEvent.press(screen.getByTestId('food-nutrients-all'));
    expect(screen.getByTestId('food-nutrients-potassium')).toBeTruthy();
  });
});
