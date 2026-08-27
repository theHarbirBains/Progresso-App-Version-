import { supabase } from '../lib/supabase';

// Direct-to-Supabase: own-row upsert against a table whose only constraint
// beyond ownership RLS is unique(user_id), already enforced by the schema.
export interface NutritionGoals {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

interface NutritionGoalsDbRow {
  calories: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
}

const NUTRITION_GOALS_COLUMNS = 'calories, protein_g, carbs_g, fat_g';

function toNutritionGoals(row: NutritionGoalsDbRow | null): NutritionGoals {
  if (!row) return { calories: null, proteinG: null, carbsG: null, fatG: null };
  return {
    calories: row.calories !== null ? Number(row.calories) : null,
    proteinG: row.protein_g !== null ? Number(row.protein_g) : null,
    carbsG: row.carbs_g !== null ? Number(row.carbs_g) : null,
    fatG: row.fat_g !== null ? Number(row.fat_g) : null,
  };
}

/** No row means the user has never set any goals -- returns all-null, not an error. */
export async function fetchNutritionGoals(userId: string): Promise<NutritionGoals> {
  const { data, error } = await supabase
    .from('nutrition_goals')
    .select(NUTRITION_GOALS_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return toNutritionGoals(data as NutritionGoalsDbRow | null);
}

/**
 * Creates or updates the user's single goals row. Any field left null is
 * cleared (or stays unset) -- each of the four targets is independently
 * optional, matching the schema's nullable columns.
 */
export async function saveNutritionGoals(
  userId: string,
  goals: NutritionGoals,
): Promise<NutritionGoals> {
  const { data, error } = await supabase
    .from('nutrition_goals')
    .upsert(
      {
        user_id: userId,
        calories: goals.calories,
        protein_g: goals.proteinG,
        carbs_g: goals.carbsG,
        fat_g: goals.fatG,
      },
      { onConflict: 'user_id' },
    )
    .select(NUTRITION_GOALS_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toNutritionGoals(data as NutritionGoalsDbRow);
}
