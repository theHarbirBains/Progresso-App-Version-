import { supabase } from '../lib/supabase';
import type { FoodGroupItem } from './foodGroups';
import {
  createSavedMeal,
  deleteSavedMeal,
  fetchSavedMeals,
  updateSavedMeal,
} from './savedMealQueries';
import { createRecipe, deleteRecipe, fetchRecipeIngredients, updateRecipe } from './recipeQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// Same chainable-and-thenable mock builder pattern used throughout this
// codebase (see workoutQueries.test.ts).
function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = ['select', 'eq', 'not', 'order', 'insert', 'update', 'delete'] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    calls[m] = [];
    builder[m] = jest.fn((...args: unknown[]) => {
      calls[m].push(args);
      return builder;
    });
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { builder, calls };
}

/** Each next supabase.from() call answers with the next result, in order. */
function mockReads(...results: Result[]) {
  const builders = results.map((result) => createQueryBuilder(result));
  for (const { builder } of builders) mockFrom.mockImplementationOnce(() => builder);
  return builders;
}

beforeEach(() => {
  mockFrom.mockReset();
});

const foodRow = {
  id: 'food-oats',
  name: 'Oats',
  brand: null,
  barcode: null,
  image_url: null,
  serving_size: '40.00',
  serving_unit: 'g',
  serving_label: null,
  calories: '150.00',
  protein_g: '5.00',
  carbs_g: '27.00',
  fat_g: '3.00',
  is_active: true,
  recipe_servings: null,
};

const oats: FoodGroupItem = {
  food: {
    id: 'food-oats',
    name: 'Oats',
    brand: null,
    barcode: null,
    imageUrl: null,
    servingSize: 40,
    servingUnit: 'g',
    calories: 150,
    proteinG: 5,
    carbsG: 27,
    fatG: 3,
    isActive: true,
  },
  quantity: 2,
  entered: { amount: 80, unit: 'g' },
};
const banana: FoodGroupItem = {
  food: { ...oats.food, id: 'food-banana', name: 'Banana', calories: 105 },
  quantity: 1,
  entered: null,
};

describe('fetchSavedMeals', () => {
  it("reads the user's meals by name, each with its foods in the order they were added", async () => {
    const [read] = mockReads({
      data: [
        {
          id: 'meal-1',
          name: 'Breakfast',
          saved_meal_items: [
            {
              id: 'i2',
              position: 1,
              quantity: '1.00',
              entered_amount: null,
              entered_unit: null,
              food: { ...foodRow, id: 'food-banana', name: 'Banana' },
            },
            {
              id: 'i1',
              position: 0,
              quantity: '2.00',
              entered_amount: '80.00',
              entered_unit: 'g',
              food: foodRow,
            },
            // A food that can't be read any more is left out.
            {
              id: 'i3',
              position: 2,
              quantity: '1.00',
              entered_amount: null,
              entered_unit: null,
              food: null,
            },
          ],
        },
      ],
      error: null,
    });

    const [meal] = await fetchSavedMeals('user-1');

    expect(mockFrom).toHaveBeenCalledWith('saved_meals');
    expect(read!.calls.eq).toEqual([['user_id', 'user-1']]);
    expect(read!.calls.order).toEqual([['name', { ascending: true }]]);
    expect(meal!.name).toBe('Breakfast');
    expect(meal!.items.map((item) => [item.food.name, item.quantity, item.entered])).toEqual([
      ['Oats', 2, { amount: 80, unit: 'g' }],
      ['Banana', 1, null],
    ]);
  });

  it('throws on a query error', async () => {
    mockReads({ data: null, error: { message: 'boom' } });

    await expect(fetchSavedMeals('user-1')).rejects.toThrow('boom');
  });
});

describe('createSavedMeal', () => {
  it('saves the meal, then its foods in order with their amounts', async () => {
    const [meal, items] = mockReads(
      { data: { id: 'meal-1', name: 'Breakfast' }, error: null },
      { data: [{ id: 'i1' }, { id: 'i2' }], error: null },
    );

    const saved = await createSavedMeal('user-1', '  Breakfast ', [oats, banana]);

    expect(meal!.calls.insert).toEqual([[{ user_id: 'user-1', name: 'Breakfast' }]]);
    expect(items!.calls.insert).toEqual([
      [
        [
          {
            food_id: 'food-oats',
            position: 0,
            quantity: 2,
            entered_amount: 80,
            entered_unit: 'g',
            saved_meal_id: 'meal-1',
            user_id: 'user-1',
          },
          {
            food_id: 'food-banana',
            position: 1,
            quantity: 1,
            entered_amount: null,
            entered_unit: null,
            saved_meal_id: 'meal-1',
            user_id: 'user-1',
          },
        ],
      ],
    ]);
    expect(saved).toEqual({ id: 'meal-1', name: 'Breakfast', items: [oats, banana] });
  });

  it('takes the meal away again when its foods could not be saved', async () => {
    const [, , cleanup] = mockReads(
      { data: { id: 'meal-1', name: 'Breakfast' }, error: null },
      { data: null, error: { message: 'food not available' } },
      { data: null, error: null },
    );

    await expect(createSavedMeal('user-1', 'Breakfast', [oats])).rejects.toThrow(
      'food not available',
    );
    expect(cleanup!.calls.delete).toHaveLength(1);
    expect(cleanup!.calls.eq).toEqual([['id', 'meal-1']]);
  });

  it('refuses a meal with no foods', async () => {
    await expect(createSavedMeal('user-1', 'Breakfast', [])).rejects.toThrow(
      'Add at least one food',
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('updateSavedMeal', () => {
  it('adds the new foods before taking the old ones out, then renames it', async () => {
    const [insert, remove, rename] = mockReads(
      { data: [{ id: 'new-1' }], error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    await updateSavedMeal('user-1', 'meal-1', 'Big Breakfast', [banana]);

    expect(insert!.calls.insert[0]![0]).toEqual([
      expect.objectContaining({ food_id: 'food-banana', saved_meal_id: 'meal-1' }),
    ]);
    expect(remove!.calls.eq).toEqual([['saved_meal_id', 'meal-1']]);
    expect(remove!.calls.not).toEqual([['id', 'in', '(new-1)']]);
    expect(rename!.calls.update).toEqual([[{ name: 'Big Breakfast' }]]);
  });

  it('leaves the old foods when the new ones could not be saved', async () => {
    mockReads({ data: null, error: { message: 'boom' } });

    await expect(updateSavedMeal('user-1', 'meal-1', 'Breakfast', [banana])).rejects.toThrow(
      'boom',
    );
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe('deleteSavedMeal', () => {
  it('deletes the meal', async () => {
    const [remove] = mockReads({ data: null, error: null });

    await deleteSavedMeal('meal-1');

    expect(mockFrom).toHaveBeenCalledWith('saved_meals');
    expect(remove!.calls.eq).toEqual([['id', 'meal-1']]);
  });
});

describe('recipes', () => {
  const recipeRow = {
    ...foodRow,
    id: 'recipe-1',
    name: 'Overnight Oats',
    serving_size: '1.00',
    serving_unit: 'serving',
    calories: '202.50',
    recipe_servings: '2.00',
  };

  it("reads a recipe's ingredients, through the ingredient's food", async () => {
    const [read] = mockReads({
      data: [
        {
          id: 'r1',
          position: 0,
          quantity: '2.00',
          entered_amount: '80.00',
          entered_unit: 'g',
          food: foodRow,
        },
      ],
      error: null,
    });

    const ingredients = await fetchRecipeIngredients('recipe-1');

    expect(mockFrom).toHaveBeenCalledWith('recipe_ingredients');
    expect(read!.calls.select[0]![0]).toContain('food:foods!recipe_ingredients_food_id_fkey(');
    expect(read!.calls.eq).toEqual([['recipe_id', 'recipe-1']]);
    expect(ingredients).toEqual([
      expect.objectContaining({ quantity: 2, entered: { amount: 80, unit: 'g' } }),
    ]);
  });

  it('saves a recipe as one food: one serving, at its figures per serving', async () => {
    const [food, ingredients] = mockReads(
      { data: recipeRow, error: null },
      { data: [{ id: 'r1' }, { id: 'r2' }], error: null },
    );

    const recipe = await createRecipe('user-1', {
      name: ' Overnight Oats ',
      servings: 2,
      ingredients: [oats, banana],
    });

    expect(food!.calls.insert[0]![0]).toMatchObject({
      created_by: 'user-1',
      name: 'Overnight Oats',
      serving_size: 1,
      serving_unit: 'serving',
      // (300 + 105) / 2
      calories: 202.5,
      recipe_servings: 2,
      nutrition_confidence: 'calculated',
    });
    expect(ingredients!.calls.insert[0]![0]).toEqual([
      expect.objectContaining({ recipe_id: 'recipe-1', food_id: 'food-oats', position: 0 }),
      expect.objectContaining({ recipe_id: 'recipe-1', food_id: 'food-banana', position: 1 }),
    ]);
    expect(recipe.recipeServings).toBe(2);
  });

  it('puts the recipe away again when its ingredients could not be saved', async () => {
    const [, , deactivate] = mockReads(
      { data: recipeRow, error: null },
      { data: null, error: { message: 'food not available' } },
      { data: recipeRow, error: null },
    );

    await expect(
      createRecipe('user-1', { name: 'Oats', servings: 1, ingredients: [oats] }),
    ).rejects.toThrow('food not available');
    expect(deactivate!.calls.update).toEqual([[{ is_active: false }]]);
  });

  it('replaces the ingredients, then works the figures out again', async () => {
    const [insert, remove, food] = mockReads(
      { data: [{ id: 'new-1' }], error: null },
      { data: null, error: null },
      { data: recipeRow, error: null },
    );

    await updateRecipe('user-1', 'recipe-1', { name: 'Oats', servings: 4, ingredients: [oats] });

    expect(insert!.calls.insert[0]![0]).toEqual([
      expect.objectContaining({ recipe_id: 'recipe-1', food_id: 'food-oats' }),
    ]);
    expect(remove!.calls.eq).toEqual([['recipe_id', 'recipe-1']]);
    expect(remove!.calls.not).toEqual([['id', 'in', '(new-1)']]);
    expect(food!.calls.update[0]![0]).toMatchObject({
      name: 'Oats',
      calories: 75,
      recipe_servings: 4,
      nutrition_confidence: 'calculated',
    });
    expect(food!.calls.eq).toEqual([['id', 'recipe-1']]);
  });

  it('deletes a recipe by taking it out of the library', async () => {
    const [food] = mockReads({ data: recipeRow, error: null });

    await deleteRecipe('recipe-1');

    expect(food!.calls.update).toEqual([[{ is_active: false }]]);
  });
});
