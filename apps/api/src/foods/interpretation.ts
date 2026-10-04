// The AI Food Search result contract, and the pure logic that builds it from resolver
// outcomes. Every component reports its own state, so the client can resolve only what is
// pending, without restarting the whole search.

import type { Amount } from '../nutrition-resolution/quantity';
import { normalizeUnit } from './nutrition-units';
import type { Choice, QuantityOption, ResolutionOutcome } from '../nutrition-resolution/resolver';
import type {
  Nutrients,
  ResolvedComponent,
  SourceKind,
} from '../nutrition-resolution/source.interface';
import type { ParsedFoodDescription } from './providers/anthropic-nutrition.provider';

/** The candidate a user picked from a choice list. */
export interface ComponentPick {
  sourceKind: SourceKind;
  sourceId: string;
}

/** Everything the resolver needs for one component. Sent back by the client when resolving it. */
export interface ComponentRequest {
  index: number;
  role: 'main' | 'ingredient';
  name: string;
  term: string;
  brand: string | null;
  barcode: string | null;
  quantity: Amount | null;
}

export type ComponentStatus =
  /** Matched to a verified or calculated source. */
  | { state: 'resolved'; request: ComponentRequest; component: ResolvedComponent }
  /** No reliable source matched; Claude's own estimate, clearly labelled. */
  | { state: 'ai_estimate'; request: ComponentRequest; component: ResolvedComponent }
  /** The amount is needed, and the options are the source's own amounts to pick from. */
  | {
      state: 'needs_quantity';
      request: ComponentRequest;
      matchedName: string | null;
      options: QuantityOption[];
      reason: string;
    }
  /** Several plausible matches; the user picks one. */
  | { state: 'choose'; request: ComponentRequest; choices: Choice[] }
  /** Nothing usable, and no estimate could be made. */
  | { state: 'not_found'; request: ComponentRequest; reason: string };

export interface NutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodInterpretation {
  /** The main food, as the user described it. */
  name: string;
  preparation: string | null;
  components: ComponentStatus[];
  /** True when every component has a figure. Only then are totals and a save offered. */
  complete: boolean;
  /** The main amount, once known. Null while the main component is still pending. */
  servingSize: number | null;
  servingUnit: string | null;
  totals: NutritionTotals | null;
  /** True when any component is an unverified AI estimate. The review must say so. */
  hasEstimate: boolean;
}

export type InterpretFoodResponse =
  | { status: 'clarification'; question: string }
  | { status: 'ok'; interpretation: FoodInterpretation };

/**
 * The parsed description as components to resolve. The main food comes first (index 0), then
 * each added ingredient. A missing amount stays null, so the resolver can ask for it.
 */
export function requestsFromParsed(parsed: ParsedFoodDescription): ComponentRequest[] {
  const requests: ComponentRequest[] = [];
  const toRequest = (
    component: NonNullable<ParsedFoodDescription['main']>,
    index: number,
    role: ComponentRequest['role'],
  ): ComponentRequest => ({
    index,
    role,
    name: component.name,
    term: component.searchTerm,
    brand: component.brand,
    barcode: null,
    quantity:
      component.quantity !== null && component.unit !== null
        ? { amount: component.quantity, unit: normalizeUnit(component.unit) }
        : null,
  });
  if (parsed.main) requests.push(toRequest(parsed.main, 0, 'main'));
  parsed.addedIngredients.forEach((ingredient, i) => {
    requests.push(toRequest(ingredient, i + 1, 'ingredient'));
  });
  return requests;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Totals of the resolved parts, rounded for display. Calories whole, macros to 0.1 g. */
export function sumNutrients(parts: Nutrients[]): NutritionTotals {
  const totals = parts.reduce(
    (sum, part) => ({
      calories: sum.calories + part.calories,
      proteinG: sum.proteinG + part.proteinG,
      carbsG: sum.carbsG + part.carbsG,
      fatG: sum.fatG + part.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    calories: roundTo(totals.calories, 0),
    proteinG: roundTo(totals.proteinG, 1),
    carbsG: roundTo(totals.carbsG, 1),
    fatG: roundTo(totals.fatG, 1),
  };
}

/** A component's status from the resolver's outcome. An unresolved name gets an AI estimate only when the amount is known. */
export function statusFromOutcome(
  request: ComponentRequest,
  outcome: ResolutionOutcome,
): ComponentStatus {
  switch (outcome.status) {
    case 'resolved':
      return { state: 'resolved', request, component: outcome.component };
    case 'needs_quantity':
      return {
        state: 'needs_quantity',
        request,
        matchedName: outcome.matchedName,
        options: outcome.options,
        reason: outcome.reason,
      };
    case 'choose':
      return { state: 'choose', request, choices: outcome.choices };
    case 'not_found':
      return { state: 'not_found', request, reason: 'No food data matched this.' };
  }
}

/** Builds the interpretation from every component's status. */
export function buildInterpretation(
  name: string,
  preparation: string | null,
  components: ComponentStatus[],
): FoodInterpretation {
  const figured = components.filter(
    (status): status is Extract<ComponentStatus, { component: ResolvedComponent }> =>
      status.state === 'resolved' || status.state === 'ai_estimate',
  );
  const complete = figured.length === components.length;
  const main = components.find((status) => status.request.role === 'main');
  const mainFigure =
    main && (main.state === 'resolved' || main.state === 'ai_estimate')
      ? main.component.quantity
      : null;

  return {
    name,
    preparation,
    components,
    complete,
    servingSize: mainFigure ? mainFigure.amount : null,
    servingUnit: mainFigure ? mainFigure.unit : null,
    totals: complete ? sumNutrients(figured.map((status) => status.component.nutrients)) : null,
    hasEstimate: components.some((status) => status.state === 'ai_estimate'),
  };
}
