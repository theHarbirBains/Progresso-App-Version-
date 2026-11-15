import { supabase } from '../lib/supabase';
import type { NutritionFigures } from './achievements';

/** The phone's own time zone ("America/Toronto"), so a day logged is a day where you are. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Your own nutrition figures for your nutrition achievements (my_nutrition_totals): read straight
 * from Supabase under your own RLS, so it can only ever count your own logs, foods and meals.
 */
export async function fetchMyNutritionFigures(): Promise<NutritionFigures> {
  const { data, error } = await supabase.rpc('my_nutrition_totals', {
    p_time_zone: deviceTimeZone(),
  });
  if (error) throw new Error(error.message);
  const row = (
    (data ?? []) as {
      days_logged: number;
      foods_logged: number;
      protein_g: string | number;
      calories: string | number;
      recipes: number;
      saved_meals: number;
    }[]
  )[0];
  return {
    daysLogged: row?.days_logged ?? 0,
    foodsLogged: row?.foods_logged ?? 0,
    proteinG: Number(row?.protein_g ?? 0),
    calories: Number(row?.calories ?? 0),
    recipes: row?.recipes ?? 0,
    savedMeals: row?.saved_meals ?? 0,
  };
}
