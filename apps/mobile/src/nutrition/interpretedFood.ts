import type { FoodInterpretation, InterpretedComponent } from '../lib/api';
import type { FoodInput } from './foodQueries';

/**
 * The Food Library name for an interpreted food. Keeps what the user said
 * that the nutrition figures depend on: the preparation (so "no oil" is not
 * lost) and any added ingredients (so the calories of their oil or butter are
 * explained). When any figure is an unverified AI estimate, the name says so.
 */
export function libraryFoodName(interpretation: FoodInterpretation): string {
  let name = interpretation.name.trim();
  const preparation = interpretation.preparation?.trim();
  if (preparation && !name.toLowerCase().includes(preparation.toLowerCase())) {
    name = `${name} (${preparation})`;
  }
  const additions = interpretation.components
    .filter((component) => component.role === 'ingredient')
    .map((component) => `${component.quantity} ${component.unit} ${component.name}`);
  if (additions.length > 0) {
    name = `${name} with ${additions.join(', ')}`;
  }
  if (interpretation.hasEstimate) {
    name = `${name} (AI estimate)`;
  }
  return name;
}

/**
 * The Food Library entry for an interpretation: the amount the user gave as the
 * serving, and the totals of every component as its nutrition. Written only
 * when the user taps Add to Food Library -- nothing here saves on its own.
 */
export function libraryFoodInput(interpretation: FoodInterpretation): FoodInput {
  return {
    name: libraryFoodName(interpretation),
    servingSize: interpretation.servingSize,
    servingUnit: interpretation.servingUnit,
    calories: interpretation.totals.calories,
    proteinG: interpretation.totals.proteinG,
    carbsG: interpretation.totals.carbsG,
    fatG: interpretation.totals.fatG,
  };
}

/** The line that says where a component's numbers came from. */
export function componentSourceLabel(component: InterpretedComponent): string {
  if (component.source === 'ai_estimate') return 'AI estimate, not verified';
  return component.matchedName
    ? `From Progresso food data: ${component.matchedName}`
    : 'From Progresso food data';
}
