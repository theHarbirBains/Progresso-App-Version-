import { supabase } from '../lib/supabase';
import { recipePerServing, recipeProvenance, type FoodGroupItem } from './foodGroups';
import { FOOD_COLUMNS, createFood, updateFood, type FoodRow } from './foodQueries';
import { itemColumns, itemsFromRows, type ItemDbRow } from './savedMealQueries';

// A recipe is a drink or a meal always made the same way, logged as one food. It IS one of the
// user's own foods (foods.recipe_servings set), whose figures per serving are worked out from
// its ingredients when it's saved: the ingredients added up, divided by the servings it makes.
// Editing it changes what's logged from then on; logs already made keep their own figures.
// Direct-to-Supabase like any of the user's own foods; recipe_ingredients' user_id is set by
// trigger to the recipe's owner, and an ingredient can only be a food the owner can see.

// recipe_ingredients points at foods twice (the recipe and the ingredient), so the embed names
// which one.
const INGREDIENT_COLUMNS = `id, position, quantity, entered_amount, entered_unit, food:foods!recipe_ingredients_food_id_fkey(${FOOD_COLUMNS})`;

/** A recipe's ingredients, in order, each at its food's figures now. */
export async function fetchRecipeIngredients(recipeId: string): Promise<FoodGroupItem[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select(INGREDIENT_COLUMNS)
    .eq('recipe_id', recipeId);
  if (error) throw new Error(error.message);
  return itemsFromRows((data ?? []) as unknown as ItemDbRow[]);
}

export interface RecipeInput {
  name: string;
  /** How many servings the recipe makes. */
  servings: number;
  ingredients: FoodGroupItem[];
}

async function insertIngredients(userId: string, recipeId: string, items: FoodGroupItem[]) {
  if (items.length === 0) throw new Error('Add at least one ingredient');
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .insert(
      itemColumns(items).map((columns) => ({ ...columns, recipe_id: recipeId, user_id: userId })),
    )
    .select('id');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

/** The food a recipe is saved as: one serving, at its ingredients' figures per serving. */
function recipeFood(input: RecipeInput) {
  const perServing = recipePerServing(input.ingredients, input.servings);
  return {
    name: input.name.trim(),
    servingSize: 1,
    servingUnit: 'serving',
    ...perServing,
    recipeServings: input.servings,
    provenance: recipeProvenance(input.ingredients),
  };
}

/** Saves a new recipe and its ingredients. */
export async function createRecipe(userId: string, input: RecipeInput): Promise<FoodRow> {
  if (input.ingredients.length === 0) throw new Error('Add at least one ingredient');
  const recipe = await createFood(userId, recipeFood(input));
  try {
    await insertIngredients(userId, recipe.id, input.ingredients);
  } catch (err) {
    // A recipe without its ingredients can't be edited: put it away again. A food can only be
    // deactivated, never deleted, as logs may point at it.
    await updateFood(recipe.id, { isActive: false }).catch(() => undefined);
    throw err;
  }
  return recipe;
}

/**
 * Saves a recipe's new name, servings and ingredients, and works its figures out again. The
 * new ingredients go in before the old ones come out, so a failure part way never leaves the
 * recipe empty.
 */
export async function updateRecipe(
  userId: string,
  recipeId: string,
  input: RecipeInput,
): Promise<FoodRow> {
  const kept = await insertIngredients(userId, recipeId, input.ingredients);
  const { error } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)
    .not('id', 'in', `(${kept.join(',')})`);
  if (error) throw new Error(error.message);
  return updateFood(recipeId, recipeFood(input));
}

/** Takes a recipe out of the library. Logs already made from it keep their own figures. */
export async function deleteRecipe(recipeId: string): Promise<void> {
  await updateFood(recipeId, { isActive: false });
}
