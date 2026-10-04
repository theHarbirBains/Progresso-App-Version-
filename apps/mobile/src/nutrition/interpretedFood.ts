import type {
  ComponentStatus,
  FoodInterpretation,
  NutrientFigures,
  ResolvedComponentFigures,
} from '../lib/api';
import type { FoodInput, FoodProvenance } from './foodQueries';

type FigureStatus = Extract<ComponentStatus, { component: ResolvedComponentFigures }>;

function isFigured(status: ComponentStatus): status is FigureStatus {
  return status.state === 'resolved' || status.state === 'ai_estimate';
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * The interpretation after one component changes state. Mirrors the backend's buildInterpretation,
 * so the client can show totals as soon as the last pending component is resolved. The backend
 * remains the source of every figure. This only adds up figures it has already given.
 */
export function withComponentStatus(
  interpretation: FoodInterpretation,
  status: ComponentStatus,
): FoodInterpretation {
  const components = interpretation.components.map((current) =>
    current.request.index === status.request.index ? status : current,
  );
  const figured = components.filter(isFigured);
  const complete = figured.length === components.length;
  const main = components.find((component) => component.request.role === 'main');
  const mainQuantity = main && isFigured(main) ? main.component.quantity : null;

  let totals: NutrientFigures | null = null;
  if (complete) {
    const sum = figured.reduce(
      (acc, component) => ({
        calories: acc.calories + component.component.nutrients.calories,
        proteinG: acc.proteinG + component.component.nutrients.proteinG,
        carbsG: acc.carbsG + component.component.nutrients.carbsG,
        fatG: acc.fatG + component.component.nutrients.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
    totals = {
      calories: roundTo(sum.calories, 0),
      proteinG: roundTo(sum.proteinG, 1),
      carbsG: roundTo(sum.carbsG, 1),
      fatG: roundTo(sum.fatG, 1),
    };
  }

  return {
    ...interpretation,
    components,
    complete,
    servingSize: mainQuantity ? mainQuantity.amount : null,
    servingUnit: mainQuantity ? mainQuantity.unit : null,
    totals,
    hasEstimate: components.some((component) => component.state === 'ai_estimate'),
  };
}

/**
 * The Food Library name for an interpreted food. Keeps the preparation (so "no oil" isn't lost)
 * and any added ingredients (so their calories are explained). The estimate state is kept in
 * provenance, not in the name.
 */
export function libraryFoodName(interpretation: FoodInterpretation): string {
  let name = interpretation.name.trim();
  const preparation = interpretation.preparation?.trim();
  if (preparation && !name.toLowerCase().includes(preparation.toLowerCase())) {
    name = `${name} (${preparation})`;
  }
  const additions = interpretation.components
    .filter((status) => status.request.role === 'ingredient')
    .map((status) =>
      `${status.request.quantity?.amount ?? ''} ${status.request.quantity?.unit ?? ''} ${status.request.name}`
        .replace(/\s+/g, ' ')
        .trim(),
    );
  if (additions.length > 0) {
    name = `${name} with ${additions.join(', ')}`;
  }
  return name;
}

/**
 * The provenance stored with the library food. One figured component: its own provenance. Several:
 * the calculation from parts, with each part kept in `components`. Any AI estimate makes the whole
 * food an AI-assisted estimate.
 */
export function libraryProvenance(interpretation: FoodInterpretation): FoodProvenance {
  const figured = interpretation.components.filter(isFigured);
  const components = figured.map((status) => ({
    name: status.component.name,
    quantity: status.component.quantity,
    nutrients: status.component.nutrients,
    provenance: status.component.provenance,
  }));
  const anyEstimate = figured.some((status) => status.state === 'ai_estimate');

  if (figured.length === 1 && figured[0]) {
    const only = figured[0].component.provenance;
    return {
      confidence: only.confidence,
      sourceKind: only.sourceKind,
      sourceId: only.sourceId,
      matchedName: only.matchedName,
      dataVersion: only.dataVersion,
      retrievedAt: only.retrievedAt,
      licence: only.licence,
      attribution: only.attribution,
      assumptions: only.assumptions,
      components: null,
    };
  }

  const assumptions = figured.flatMap((status) => status.component.provenance.assumptions);
  return {
    confidence: anyEstimate ? 'ai_estimate' : 'calculated',
    sourceKind: null,
    sourceId: null,
    matchedName: null,
    dataVersion: null,
    retrievedAt: null,
    licence: 'none',
    attribution: null,
    assumptions: [...new Set(assumptions)],
    components,
  };
}

/**
 * The Food Library entry: the amount the user gave as the serving, the totals of every component
 * as its nutrition, and the provenance that says where those figures came from. Only valid for a
 * complete interpretation. Nothing here saves; the user's explicit tap does.
 */
export function libraryFoodInput(interpretation: FoodInterpretation): FoodInput {
  if (
    !interpretation.complete ||
    !interpretation.totals ||
    interpretation.servingSize === null ||
    interpretation.servingUnit === null
  ) {
    throw new Error('Every component needs a figure before this food can be added');
  }
  return {
    name: libraryFoodName(interpretation),
    servingSize: interpretation.servingSize,
    servingUnit: interpretation.servingUnit,
    calories: interpretation.totals.calories,
    proteinG: interpretation.totals.proteinG,
    carbsG: interpretation.totals.carbsG,
    fatG: interpretation.totals.fatG,
    provenance: libraryProvenance(interpretation),
  };
}

/** The line that says where a component's figures came from. */
export function componentSourceLabel(status: ComponentStatus): string {
  if (status.state === 'ai_estimate') return 'AI estimate, not verified';
  if (status.state !== 'resolved') return '';
  const { provenance } = status.component;
  const source = provenance.matchedName
    ? `From Progresso food data: ${provenance.matchedName}`
    : 'From Progresso food data';
  return provenance.confidence === 'calculated' ? `${source} (calculated)` : `${source} (verified)`;
}

/**
 * An amount typed by the user, such as "2 large", "150 g" or "1 cup". Null unless it has a
 * positive number and a unit, so a bare number is never taken as an amount.
 */
export function parseAmount(text: string): { amount: number; unit: string } | null {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z][a-zA-Z /]*)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]!.trim().toLowerCase();
  if (!(amount > 0) || unit.length === 0) return null;
  return { amount, unit };
}
