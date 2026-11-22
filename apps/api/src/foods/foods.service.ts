import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AnthropicNutritionProvider,
  type ParsedFoodDescription,
} from './providers/anthropic-nutrition.provider';
import { FOOD_PROVIDER, type FoodProvider, type NormalizedFood } from './food-provider.interface';
import type { Amount } from '../nutrition-resolution/quantity';
import { resolveComponent } from '../nutrition-resolution/resolver';
import type { NutritionSource } from '../nutrition-resolution/source.interface';
import { cookingWordsIn, withoutCookingWords } from '../nutrition-resolution/cooking';
import { CatalogNutritionSource } from './sources/catalog.source';
import { OpenFoodFactsNutritionSource } from './sources/open-food-facts.source';
import { timeLimited } from './sources/time-limited.source';
import { USDA_CITATION, UsdaNutritionSource } from './sources/usda.source';
import { rankFoods, type RankableFood } from './search-ranking';
import { correctWord, searchTermsFor, type SearchTerms } from './search-terms';
import { SearchVocabulary } from './search-vocabulary';
import {
  buildInterpretation,
  requestsFromParsed,
  roundTo,
  statusFromOutcome,
  type ComponentPick,
  type ComponentRequest,
  type ComponentStatus,
  type InterpretFoodResponse,
} from './interpretation';

/** Rounds to a fixed number of decimal places, for figures shown to the user. */
export interface FoodRecord {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  servingSize: number;
  servingUnit: string;
  /** The provider's wording of the serving ("3 cookies (34 g)"), or null when there is none. */
  servingLabel: string | null;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  provider: string | null;
  barcode: string | null;
}

export interface FoodSearchResponse {
  foods: FoodRecord[];
  hasMore: boolean;
  /** What was searched for instead, when the query as typed found nothing ("broccoli" for "brocoli"). */
  correctedQuery?: string | null;
}

/** The provider name a USDA reference food is cached under, its FDC id as provider_food_id. */
export const USDA_PROVIDER = 'usda_fdc';

// How long Search Food waits for Open Food Facts' branded products before answering without them.
export const BRANDED_SEARCH_BUDGET_MS = 2_000;
// How many of each database source's matches are ranked.
// Plenty, since the database returns matches in no particular order: a plain food must not be
// left out of the ranking because forty prepared ones happened to come back first.
const CATALOG_CANDIDATES = 150;
const REFERENCE_CANDIDATES = 250;
// USDA's plain reference foods; Branded and FNDDS are not imported.
const REFERENCE_DATA_TYPES = ['Foundation', 'SR Legacy'] as const;
const REFERENCE_COLUMNS =
  'fdc_id, description, data_type, gtin_upc, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, micronutrients_per_100g, data_version';
// The household measure a reference food's serving wording names, in this order of preference.
const PREFERRED_MEASURES = ['medium', 'large', 'small', 'cup', 'slice', 'piece', 'tbsp', 'oz'];

interface ReferenceFoodRow {
  fdc_id: number;
  description: string;
  data_type: string;
  gtin_upc: string | null;
  calories_per_100g: number | string;
  protein_g_per_100g: number | string;
  carbs_g_per_100g: number | string;
  fat_g_per_100g: number | string;
  micronutrients_per_100g?: Record<string, number> | null;
  data_version: string;
}

interface ReferenceMeasureRow {
  fdc_id: number;
  unit: string;
  amount: number | string;
  grams: number | string;
}

/** A catalog row as found, with its provider id kept for telling cached reference foods apart. */
type CatalogRecord = FoodRecord & { providerFoodId: string | null };

type SearchCandidate = RankableFood &
  ({ kind: 'record'; record: CatalogRecord } | { kind: 'reference'; reference: ReferenceFoodRow });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCatalogRecord(row: any): CatalogRecord {
  return { ...toFoodRecord(row), providerFoodId: row.provider_food_id ?? null };
}

function stripProviderFoodId(record: CatalogRecord): FoodRecord {
  const food: Partial<CatalogRecord> = { ...record };
  delete food.providerFoodId;
  return food as FoodRecord;
}

/** Whether a catalog food is one of Progresso's built-ins, a USDA reference food, or a product. */
function rankable(record: FoodRecord): RankableFood {
  const source =
    record.provider === null ? 'builtin' : record.provider === USDA_PROVIDER ? 'usda' : 'branded';
  return { name: record.name, brand: record.brand, source };
}

/**
 * Each food once. What a person would see twice -- the same name, brand, serving and figures --
 * keeps only its first. A reference food is also left out when a shared food already has its
 * name (USDA lists some foods under both Foundation and SR Legacy), since the catalog holds one
 * shared food per name and brand.
 */
function withoutRepeats(candidates: SearchCandidate[]): SearchCandidate[] {
  const seen = new Set<string>();
  const names = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.kind === 'record') {
      names.add(`${candidate.record.name}|${candidate.record.brand ?? ''}`.toLowerCase());
    }
  }
  return candidates.filter((candidate) => {
    if (candidate.kind === 'reference') {
      const name = `${candidate.reference.description}|`.toLowerCase();
      if (names.has(name)) return false;
      names.add(name);
      return true;
    }
    const { record } = candidate;
    const key = [
      record.name,
      record.brand ?? '',
      record.servingSize,
      record.servingUnit,
      Math.round(record.calories),
    ]
      .join('|')
      .toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Each word as a stem in the column, every word required; a word's spellings are alternatives.
 * Stems are letters and digits only (matchStem), so they need no escaping in either form.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matchingEveryWord(request: any, column: string, terms: SearchTerms): any {
  let filtered = request;
  for (const stems of terms.stems) {
    filtered =
      stems.length === 1
        ? filtered.ilike(column, `%${stems[0]}%`)
        : filtered.or(stems.map((stem) => `${column}.ilike.%${stem}%`).join(','));
  }
  return filtered;
}

function shortAmount(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * A reference food's serving wording: its 100 g basis, and the household measure most people
 * count it in -- "100 g · 1 medium ≈ 110 g" -- so its weight is plain. Empty when USDA lists no
 * measure. The weight comes first, so the log step reads the serving as 100 g.
 */
export function referenceServingLabel(
  measures: { unit: string; amount: number; grams: number }[],
): string {
  const usable = measures
    .map((measure) => ({
      ...measure,
      // "medium (2-1/2" dia)" is worded "medium".
      wording: measure.unit.replace(/\s*\([^)]*\)/g, '').trim(),
    }))
    .filter(
      (measure) =>
        measure.amount > 0 &&
        measure.grams > 0 &&
        measure.wording.length > 0 &&
        !/nlea|serving/i.test(measure.wording),
    );
  const preferred =
    PREFERRED_MEASURES.map((word) =>
      usable.find((measure) => measure.wording.toLowerCase().startsWith(word)),
    ).find((measure) => measure !== undefined) ?? usable[0];
  if (!preferred) return '';
  return `100 g · ${shortAmount(preferred.amount)} ${preferred.wording} ≈ ${Math.round(preferred.grams)} g`;
}

/**
 * A USDA reference food as a catalog row: per 100 g, verified, with USDA's own citation -- its
 * micronutrients too, as FoodData Central gives them (the serving is 100 g, so per 100 g is per
 * serving).
 */
function referenceFoodRow(food: ReferenceFoodRow, measureRows: ReferenceMeasureRow[]) {
  const measures = measureRows
    .filter((measure) => Number(measure.fdc_id) === food.fdc_id)
    .map((measure) => ({
      unit: String(measure.unit),
      amount: Number(measure.amount),
      grams: Number(measure.grams),
    }));
  return {
    name: food.description,
    brand: null,
    image_url: null,
    serving_size: 100,
    serving_unit: 'g',
    serving_label: referenceServingLabel(measures),
    calories: Number(food.calories_per_100g),
    protein_g: Number(food.protein_g_per_100g),
    carbs_g: Number(food.carbs_g_per_100g),
    fat_g: Number(food.fat_g_per_100g),
    micronutrients: food.micronutrients_per_100g ?? null,
    provider: USDA_PROVIDER,
    provider_food_id: String(food.fdc_id),
    barcode: food.gtin_upc ?? null,
    created_by: null,
    is_active: true,
    nutrition_confidence: 'verified',
    nutrition_source_kind: 'usda_fdc',
    nutrition_source_id: String(food.fdc_id),
    nutrition_matched_name: food.description,
    nutrition_data_version: food.data_version,
    nutrition_retrieved_at: new Date().toISOString(),
    nutrition_licence: 'public_domain',
    nutrition_attribution: `${USDA_CITATION} ${food.data_version}. https://fdc.nal.usda.gov/`,
  };
}

/** A parser question about how much was eaten: a missing amount, not a missing food. */
const AMOUNT_QUESTION = /\b(how much|how many|what amount|quantity|serving size)\b/i;
/** A leading amount and unit the parser didn't keep ("100 g potato" -> "potato" after this). */
const LEADING_AMOUNT = /^\s*\d+(?:\.\d+)?\s*[a-zA-Z]{0,12}\s+/;

// How long a scan of an older cached product waits for it to be read again before answering with
// the cached row (see getByBarcode).
export const BARCODE_REFRESH_BUDGET_MS = 1_000;
// A cached product older than this is read from its provider again when it's scanned, so a label
// corrected there (or a figure added) reaches the person scanning it.
export const BARCODE_REFRESH_AFTER_DAYS = 30;
// Products were cached without their micronutrients until the server read them
// (20261214100000_micronutrients.sql went live on 2026-11-21): one cached before then, with none,
// is read again on its next scan.
const MICRONUTRIENTS_READ_SINCE = Date.parse('2026-11-21T21:00:00Z');
const DAY_MS = 86_400_000;

/** The work's result if it settles within `ms`, otherwise null; the work itself carries on. */
async function withinBudget<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The app waits 45 s for an AI Food Search request (see the mobile foodsApi). The server stops
// looking well before that, so the user gets what was found in time instead of a timeout.
const AI_REQUEST_BUDGET_MS = 30_000;
// How long one source may take per search. Progresso's own tables answer in well under a
// second; Open Food Facts is a public service that is sometimes slow.
const DATABASE_SOURCE_LIMIT_MS = 5_000;
const OPEN_FOOD_FACTS_LIMIT_MS = 8_000;
// An AI estimate is only started with at least this much of the budget left.
const MIN_ESTIMATE_MS = 5_000;

const FOOD_COLUMNS =
  'id, name, brand, image_url, serving_size, serving_unit, serving_label, calories, protein_g, carbs_g, fat_g, provider, barcode';

// provider_food_id is never part of FoodRecord (toFoodRecord doesn't read
// it) -- selected only so upsertExternalFoods can re-match a batch
// upsert's returned rows back to the provider's own result order.
const FOOD_COLUMNS_WITH_PROVIDER_ID = `${FOOD_COLUMNS}, provider_food_id`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFoodRecord(row: any): FoodRecord {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? null,
    imageUrl: row.image_url ?? null,
    servingSize: Number(row.serving_size),
    servingUnit: row.serving_unit,
    // Empty means the provider was read and had no wording (see the serving_label migration).
    servingLabel: row.serving_label || null,
    calories: Number(row.calories),
    proteinG: row.protein_g === null ? null : Number(row.protein_g),
    carbsG: row.carbs_g === null ? null : Number(row.carbs_g),
    fatG: row.fat_g === null ? null : Number(row.fat_g),
    provider: row.provider ?? null,
    barcode: row.barcode ?? null,
  };
}

/**
 * Searches Progresso's own cached default-food catalog (the generic seeded
 * foods from Phase 6, plus anything a previous search has already cached
 * from an external provider -- both live in the same public.foods,
 * created_by is null, rows) AND, on the first page only, the live external
 * FoodProvider for fresh branded results, which get upserted into
 * public.foods (never duplicated -- see FOOD_PROVIDER_UNIQUE below) before
 * being merged into the response. This is the one place that knows both
 * "our database" and "the external provider" exist; the mobile app and its
 * FoodRow type never see the difference.
 */
@Injectable()
export class FoodsService implements OnModuleInit {
  private readonly logger = new Logger(FoodsService.name);
  private readonly vocabulary: SearchVocabulary;

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(FOOD_PROVIDER) private readonly provider: FoodProvider,
    private readonly nutritionProvider: AnthropicNutritionProvider,
  ) {
    this.vocabulary = new SearchVocabulary(supabaseService);
  }

  // The words a misspelt search is put right with are read as the server starts, so the first
  // search with a typo doesn't wait for them.
  onModuleInit(): void {
    void this.vocabulary.get();
  }

  /**
   * AI Food Search. Claude parses the description into its parts. The resolver then matches
   * each component against the best source for it, in the order sourcesFor() gives. Figures
   * come from data. Claude's memory is used only as a labelled last resort, for a component
   * no source matched and whose amount is known. Nothing is saved here: the client saves only
   * when the user taps Add to Food Library.
   *
   * The whole request answers within AI_REQUEST_BUDGET_MS. The parts are looked up at the same
   * time, so a meal takes about as long as its slowest part.
   */
  async interpretDescription(description: string): Promise<InterpretFoodResponse> {
    const startedAt = Date.now();
    const deadline = startedAt + AI_REQUEST_BUDGET_MS;
    const parsed = await this.withFoodFromAmountQuestion(
      description,
      await this.nutritionProvider.parse(description, deadline),
    );
    // Only a description with no food to look up is sent back as a question. A missing amount is
    // handled by the resolver, which asks for it with the source's own options.
    if (parsed.main === null) {
      return {
        status: 'clarification',
        question: parsed.clarification ?? 'What did you eat?',
      };
    }

    const statuses = await Promise.all(
      requestsFromParsed(parsed).map((request) => this.resolveRequest(request, null, deadline)),
    );
    this.logger.log(`AI food search: ${statuses.length} parts in ${Date.now() - startedAt} ms`);
    return {
      status: 'ok',
      interpretation: buildInterpretation(parsed.main.name, parsed.preparation, statuses),
    };
  }

  /**
   * Resolves one component the user was still waiting on: after they picked a candidate
   * (pick is set), or after they gave an amount. Only that component is re-run, within the same
   * time budget as a whole search.
   */
  async resolveComponent(
    request: ComponentRequest,
    pick: ComponentPick | null,
  ): Promise<ComponentStatus> {
    return this.resolveRequest(request, pick, Date.now() + AI_REQUEST_BUDGET_MS);
  }

  /**
   * The parser sometimes returns no food but asks "how much?". That is a missing amount, not an
   * unidentified food, so the description's own words become the food with no amount. The
   * resolver then asks for the amount with the source's own options. Any other question is still
   * sent back to the user, unchanged.
   */
  private withFoodFromAmountQuestion(
    description: string,
    parsed: ParsedFoodDescription,
  ): ParsedFoodDescription {
    if (parsed.main !== null || !parsed.clarification) return parsed;
    if (!AMOUNT_QUESTION.test(parsed.clarification)) return parsed;
    const food = description.trim().replace(LEADING_AMOUNT, '').trim();
    if (food.length === 0) return parsed;
    return {
      ...parsed,
      clarification: null,
      main: { name: food, searchTerm: food, quantity: null, unit: null, brand: null },
    };
  }

  private async resolveRequest(
    request: ComponentRequest,
    pick: ComponentPick | null,
    deadline: number,
  ): Promise<ComponentStatus> {
    const outcome = await resolveComponent(
      {
        name: request.name,
        query: {
          term: request.term,
          brand: request.brand,
          barcode: request.barcode,
          restaurant: null,
        },
        quantity: request.quantity,
        pick,
      },
      this.sourcesFor(request, deadline),
    );
    const status = statusFromOutcome(request, outcome);
    if (status.state !== 'not_found' || pick !== null) return status;

    // No food data for this exact preparation. Retry with the food itself, and say so.
    const base = withoutCookingWords(request.term);
    const cooking = cookingWordsIn(request.term);
    if (cooking.length > 0 && base.length > 0) {
      const retry = await resolveComponent(
        {
          name: request.name,
          query: { term: base, brand: request.brand, barcode: request.barcode, restaurant: null },
          quantity: request.quantity,
          pick: null,
        },
        this.sourcesFor(request, deadline),
      );
      const retried = statusFromOutcome(request, retry);
      if (retried.state === 'resolved') {
        retried.component.provenance.assumptions.push(
          `No food data for "${cooking.join(' ')}" in this form; used the closest match, ${retried.component.provenance.matchedName}.`,
        );
        return retried;
      }
      if (retried.state !== 'not_found') return retried;
    }

    // No source matched. The amount is needed before any estimate can be stated for it.
    if (request.quantity === null) {
      return {
        state: 'needs_quantity',
        request,
        matchedName: null,
        options: [],
        reason: 'No food data matched this. How much did you have?',
      };
    }
    return this.estimateRequest(request, request.quantity, deadline);
  }

  /**
   * The order sources are tried in. A named brand or a barcode points at a product, so branded
   * sources come before generic data. Otherwise generic data comes first, and branded products
   * after it. The Progresso catalog is always first. Each source has a time limit (see
   * timeLimited): one that runs out is skipped, so the next source still gets its turn.
   */
  private sourcesFor(request: ComponentRequest, deadline: number): NutritionSource[] {
    const limit = (source: NutritionSource, limitMs: number) =>
      timeLimited(source, limitMs, deadline, (slow, waitedMs) =>
        this.logger.warn(`Nutrition source ${slow.kind} took longer than ${waitedMs} ms; skipped`),
      );
    const catalog = limit(
      new CatalogNutritionSource(this.supabaseService),
      DATABASE_SOURCE_LIMIT_MS,
    );
    const usda = limit(new UsdaNutritionSource(this.supabaseService), DATABASE_SOURCE_LIMIT_MS);
    const offSearch = limit(
      new OpenFoodFactsNutritionSource(this.provider, 'search'),
      OPEN_FOOD_FACTS_LIMIT_MS,
    );
    const offBarcode = limit(
      new OpenFoodFactsNutritionSource(this.provider, 'barcode'),
      OPEN_FOOD_FACTS_LIMIT_MS,
    );
    if (request.barcode) return [catalog, offBarcode, offSearch];
    if (request.brand) return [catalog, offSearch, usda];
    return [catalog, usda, offSearch];
  }

  private async estimateRequest(
    request: ComponentRequest,
    quantity: Amount,
    deadline: number,
  ): Promise<ComponentStatus> {
    // Too little of the budget is left for an estimate; the user can search again.
    if (deadline - Date.now() < MIN_ESTIMATE_MS) {
      return {
        state: 'not_found',
        request,
        reason: 'This took too long to look up. Please try again.',
      };
    }
    try {
      const estimate = await this.nutritionProvider.estimate(
        `${quantity.amount} ${quantity.unit} of ${request.name}`,
        deadline,
      );
      return {
        state: 'ai_estimate',
        request,
        component: {
          name: request.name,
          quantity,
          grams: null,
          nutrients: {
            calories: Math.round(estimate.calories),
            proteinG: roundTo(estimate.proteinG, 1),
            carbsG: roundTo(estimate.carbsG, 1),
            fatG: roundTo(estimate.fatG, 1),
          },
          provenance: {
            confidence: 'ai_estimate',
            sourceKind: 'ai_estimate',
            sourceId: null,
            matchedName: null,
            brand: null,
            dataVersion: null,
            retrievedAt: new Date().toISOString(),
            licence: 'none',
            attribution: null,
            assumptions: ['AI estimate: no food data matched this. Not verified.'],
          },
        },
      };
    } catch {
      return {
        state: 'not_found',
        request,
        reason: 'We could not estimate this. Try describing it differently.',
      };
    }
  }

  /**
   * Search Food. Three sources are read at the same time: Progresso's shared catalog (its
   * built-in foods, and every product and reference food already cached), USDA FoodData
   * Central's reference foods (plain whole foods: "Onions, raw"), and, on the first page, Open
   * Food Facts' branded products. Everything found is ranked together (search-ranking.ts), so
   * the plain food comes before products that only mention it. Open Food Facts is a public
   * service that is often slow: the search waits for it at most BRANDED_SEARCH_BUDGET_MS, and
   * products still arriving after that are cached for the next search. `branded: false` skips
   * it altogether -- the app asks that way first, to show the quick results at once.
   *
   * A reference food is cached into the catalog (on its USDA id, never twice) only when it's
   * shown, so it has a row to be logged against, with where its figures came from. When the
   * query as typed finds nothing, its misspelt words are put right ("brocoli") and the search
   * runs once more; the response then says what was searched for.
   */
  async search(
    query: string,
    page: number,
    pageSize: number,
    options: { branded?: boolean } = {},
  ): Promise<FoodSearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) return { foods: [], hasMore: false };
    const branded = (options.branded ?? true) && page === 0;

    let terms = searchTermsFor(trimmed);
    let found = await this.findFoods(trimmed, terms, branded, pageSize);
    let correctedQuery: string | null = null;
    if (found.length === 0) {
      const corrected = await this.correctedTerms(terms);
      if (corrected) {
        terms = corrected.terms;
        found = await this.findFoods(corrected.query, terms, branded, pageSize);
        if (found.length > 0) correctedQuery = corrected.query;
      }
    }

    const from = page * pageSize;
    const foods = await this.withReferenceFoodsCached(found.slice(from, from + pageSize));
    return { foods, hasMore: found.length > from + pageSize, correctedQuery };
  }

  /** Every source's foods for the query, ranked, with each food once. */
  private async findFoods(
    query: string,
    terms: SearchTerms,
    branded: boolean,
    pageSize: number,
  ): Promise<SearchCandidate[]> {
    if (terms.words.length === 0) return [];
    const [byName, byBrand, reference, products] = await Promise.all([
      this.queryCatalogByName(terms),
      this.queryCatalogByBrand(query),
      this.queryReferenceFoods(terms),
      branded ? this.brandedWithinBudget(query, pageSize) : Promise.resolve([]),
    ]);

    const cachedReferenceIds = new Set<string>();
    const candidates: SearchCandidate[] = [];
    for (const record of [...byName, ...byBrand]) {
      if (record.provider === USDA_PROVIDER && record.providerFoodId) {
        cachedReferenceIds.add(record.providerFoodId);
      }
      candidates.push({ kind: 'record', record, ...rankable(record) });
    }
    const productCandidates: SearchCandidate[] = products.map((record) => ({
      kind: 'record',
      record,
      ...rankable(record),
    }));
    for (const food of reference) {
      if (cachedReferenceIds.has(String(food.fdc_id))) continue;
      candidates.push({
        kind: 'reference',
        reference: food,
        name: food.description,
        brand: null,
        source: 'usda',
      });
    }
    const ranked = rankFoods(terms, [...candidates, ...productCandidates]);
    // Open Food Facts matches on more than a product's name (its category, its ingredients), so
    // a product it found that names none of the query's words ("Coca-Cola" for "coke") still
    // comes, after everything that does, in its own order.
    const shown = new Set(ranked);
    const unnamed = productCandidates.filter((candidate) => !shown.has(candidate));
    return withoutRepeats([...ranked, ...unnamed]);
  }

  /** The query with its misspelt words put right, or null when none could be. */
  private async correctedTerms(
    terms: SearchTerms,
  ): Promise<{ query: string; terms: SearchTerms } | null> {
    const vocabulary = await this.vocabulary.get();
    if (!vocabulary) return null;
    let changed = false;
    const words = terms.words.map((word) => {
      const corrected = correctWord(word, vocabulary);
      if (corrected) changed = true;
      return corrected ?? word;
    });
    if (!changed) return null;
    const query = words.join(' ');
    return { query, terms: searchTermsFor(query) };
  }

  private async queryCatalogByName(terms: SearchTerms): Promise<CatalogRecord[]> {
    const request = this.supabaseService
      .getClient()
      .from('foods')
      .select(FOOD_COLUMNS_WITH_PROVIDER_ID)
      .is('created_by', null)
      .eq('is_active', true);
    const { data, error } = await matchingEveryWord(request, 'name', terms).limit(
      CATALOG_CANDIDATES,
    );
    if (error) {
      throw new InternalServerErrorException('Failed to search foods');
    }
    return (data ?? []).map(toCatalogRecord);
  }

  // A brand is matched as the whole query, so "Kirkland" finds Kirkland's products. A plain
  // ilike() rather than .or(): a brand pattern is the user's own text, which .or()'s filter
  // language would need its own escaping for.
  private async queryCatalogByBrand(query: string): Promise<CatalogRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .select(FOOD_COLUMNS_WITH_PROVIDER_ID)
      .is('created_by', null)
      .eq('is_active', true)
      .ilike('brand', `%${escapeIlike(query)}%`)
      .limit(CATALOG_CANDIDATES);
    if (error) {
      throw new InternalServerErrorException('Failed to search foods');
    }
    return (data ?? []).map(toCatalogRecord);
  }

  /** USDA reference foods matching every word, with their household measures. Empty if unreadable. */
  private async queryReferenceFoods(terms: SearchTerms): Promise<ReferenceFoodRow[]> {
    const request = this.supabaseService
      .getClient()
      .from('usda_food_reference')
      .select(REFERENCE_COLUMNS)
      .in('data_type', [...REFERENCE_DATA_TYPES]);
    const { data, error } = await matchingEveryWord(request, 'description', terms).limit(
      REFERENCE_CANDIDATES,
    );
    if (error) {
      // Reference foods add to the search; the catalog's results still stand without them.
      this.logger.warn(`USDA reference search failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as unknown as ReferenceFoodRow[];
  }

  /** The household measures of the reference foods about to be cached; none if unreadable. */
  private async referenceMeasures(fdcIds: number[]): Promise<ReferenceMeasureRow[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('usda_food_measure')
      .select('fdc_id, unit, amount, grams')
      .in('fdc_id', fdcIds)
      .order('seq', { ascending: true });
    if (error) {
      // The serving is still 100 g; only the household measure's wording is missing.
      this.logger.warn(`USDA measure lookup failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as unknown as ReferenceMeasureRow[];
  }

  /** Open Food Facts' products, cached, if they come within the budget; the caching carries on regardless. */
  private async brandedWithinBudget(query: string, pageSize: number): Promise<CatalogRecord[]> {
    // Caught here, not only by the race below: work still going after the budget must never
    // reject with no one waiting for it.
    const work = this.fetchAndCacheExternal(query, pageSize).catch((err: unknown) => {
      this.logger.warn(
        `Caching Open Food Facts products failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [] as FoodRecord[];
    });
    const products = await withinBudget(work, BRANDED_SEARCH_BUDGET_MS);
    if (products === null) {
      this.logger.warn(
        `Open Food Facts took longer than ${BRANDED_SEARCH_BUDGET_MS} ms; answered without it`,
      );
      return [];
    }
    return products.map((record) => ({ ...record, providerFoodId: null }));
  }

  /**
   * The foods to answer with, each a catalog row: a USDA reference food not cached yet is
   * cached now, in one upsert, so it can be logged. One that can't be cached is left out rather
   * than shown with nothing to log it against.
   */
  private async withReferenceFoodsCached(found: SearchCandidate[]): Promise<FoodRecord[]> {
    const uncached = found.filter(
      (candidate): candidate is Extract<SearchCandidate, { kind: 'reference' }> =>
        candidate.kind === 'reference',
    );
    const cached = new Map<string, FoodRecord>();
    if (uncached.length > 0) {
      const measures = await this.referenceMeasures(uncached.map((c) => c.reference.fdc_id));
      const rows = uncached.map((candidate) => referenceFoodRow(candidate.reference, measures));
      const { data, error } = await this.supabaseService
        .getClient()
        .from('foods')
        .upsert(rows, { onConflict: 'provider,provider_food_id' })
        .select(FOOD_COLUMNS_WITH_PROVIDER_ID);
      if (!error && data) {
        for (const row of data) cached.set(String(row.provider_food_id), toFoodRecord(row));
      } else {
        this.logger.warn(`Caching USDA reference foods failed, one by one: ${error?.message}`);
        for (const row of rows) {
          const { data: one, error: oneError } = await this.supabaseService
            .getClient()
            .from('foods')
            .upsert(row, { onConflict: 'provider,provider_food_id' })
            .select(FOOD_COLUMNS_WITH_PROVIDER_ID)
            .maybeSingle();
          if (one && !oneError) cached.set(String(one.provider_food_id), toFoodRecord(one));
        }
      }
    }
    return found
      .map((candidate) =>
        candidate.kind === 'record'
          ? stripProviderFoodId(candidate.record)
          : cached.get(String(candidate.reference.fdc_id)),
      )
      .filter((record): record is FoodRecord => record !== undefined);
  }

  /**
   * Barcode lookup for the Scan Barcode flow: checks Progresso's own cached
   * catalog first (a previously-scanned/searched product, or a seeded
   * default food that happens to carry a barcode), and only calls the
   * external provider on a cache miss -- the same "cache by barcode" the
   * unique (provider, provider_food_id) index and the barcode index exist
   * for. A provider hit is cached via the same upsertExternalFood path
   * search() already uses, so re-scanning the same product never hits the
   * provider twice. Returns null (never throws) both when the product
   * genuinely doesn't exist and when the provider degrades -- barcode
   * lookup failing is an expected, normal outcome (Open Food Facts doesn't
   * have every product), not an exceptional one; the controller/mobile
   * side render this as a friendly "Product not found" state either way.
   *
   * The local lookup is scoped to the caller: the shared catalog
   * (created_by is null) plus the caller's OWN custom foods. A custom food a
   * user entered by hand for an unknown barcode is private to them -- it must
   * never be returned to anyone else who scans the same code (user data
   * isolation) -- and preferring the caller's own means their entry wins on
   * the next scan.
   *
   * A provider product cached a while ago is read from the provider once more and its row
   * refreshed, so a scan's figures are the label's as the provider has them now: one cached
   * before its serving wording was kept (serving_label still null) or before its micronutrients
   * were read, and any older than BARCODE_REFRESH_AFTER_DAYS. The scan waits at most
   * BARCODE_REFRESH_BUDGET_MS for that: past it, or if the read fails, the cached row is returned
   * as it is, and the refresh carries on in the background so the next scan has it.
   */
  async getByBarcode(barcode: string, userId: string): Promise<FoodRecord | null> {
    const trimmed = barcode.trim();
    if (!trimmed) return null;

    const cached = await this.queryLocalByBarcode(trimmed, userId);
    if (!cached) return this.lookUpAndCacheBarcode(trimmed);
    if (!cached.needsRefresh) return cached.record;

    const refreshed = await withinBudget(
      this.lookUpAndCacheBarcode(trimmed),
      BARCODE_REFRESH_BUDGET_MS,
    );
    return refreshed ?? cached.record;
  }

  /** The provider's product for this barcode, cached; null when it has none or the read fails. Never rejects. */
  private async lookUpAndCacheBarcode(barcode: string): Promise<FoodRecord | null> {
    let food: NormalizedFood | null;
    try {
      food = await this.provider.getFoodByBarcode(barcode);
    } catch (err) {
      this.logger.warn(
        `Food provider barcode lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
    if (!food) return null;
    return this.upsertExternalFood(food);
  }

  /**
   * The caller's own food or the shared catalog's for this barcode, and whether it's a provider
   * product to read from the provider again (see getByBarcode).
   */
  private async queryLocalByBarcode(
    barcode: string,
    userId: string,
  ): Promise<{ record: FoodRecord; needsRefresh: boolean } | null> {
    // The id comes from the verified auth token, but it is interpolated into a
    // PostgREST filter string, so it must be a plain UUID -- anything else can
    // only match the shared catalog.
    const ownFilter = UUID_PATTERN.test(userId) ? `,created_by.eq.${userId}` : '';
    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .select(`${FOOD_COLUMNS}, micronutrients, updated_at`)
      .eq('barcode', barcode)
      .eq('is_active', true)
      .or(`created_by.is.null${ownFilter}`)
      // Own custom food first (a non-null created_by), then the shared catalog.
      .order('created_by', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to look up food by barcode');
    }
    if (!data) return null;
    const record = toFoodRecord(data);
    const updatedAt = Date.parse(String(data.updated_at ?? ''));
    const needsRefresh =
      record.provider === this.provider.name &&
      (data.serving_label == null ||
        (data.micronutrients == null && !(updatedAt >= MICRONUTRIENTS_READ_SINCE)) ||
        !(Date.now() - updatedAt <= BARCODE_REFRESH_AFTER_DAYS * DAY_MS));
    return { record, needsRefresh };
  }

  private async fetchAndCacheExternal(query: string, pageSize: number): Promise<FoodRecord[]> {
    let result: { foods: NormalizedFood[] };
    try {
      result = await this.provider.searchFoods(query, 0, pageSize);
    } catch (err) {
      // A provider outage degrades to local-only results, never fails the
      // whole search -- see NutritionTodayScreen-style "show what we have"
      // precedent elsewhere in this app.
      this.logger.warn(
        `Food provider search failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    return this.upsertExternalFoods(result.foods);
  }

  private toUpsertRow(food: NormalizedFood) {
    return {
      name: food.name,
      brand: food.brand,
      image_url: food.imageUrl,
      serving_size: food.servingSize,
      serving_unit: food.servingUnit,
      // Empty, not null, when the provider had no wording: null means "not read yet".
      serving_label: food.servingLabel ?? '',
      calories: food.calories,
      protein_g: food.proteinG,
      carbs_g: food.carbsG,
      fat_g: food.fatG,
      // Only what the product's label data gives (see the provider): unknown ones are absent.
      micronutrients: food.micronutrients ?? null,
      provider: food.provider,
      provider_food_id: food.providerFoodId,
      barcode: food.barcode,
      created_by: null,
      is_active: true,
      // Where the figures came from, as the provenance migration recorded it for products cached
      // before: so a product logged now carries it into the person's copy and their log too.
      ...(food.provider === 'open_food_facts'
        ? {
            nutrition_confidence: 'verified',
            nutrition_source_kind: 'open_food_facts',
            nutrition_source_id: food.providerFoodId,
            nutrition_licence: 'odbl',
            nutrition_attribution: 'Open Food Facts contributors (ODbL)',
          }
        : {}),
    };
  }

  /**
   * Upserts a whole search page in one round trip -- on (provider,
   * provider_food_id), so re-searching the same product refreshes its
   * cached nutrition data instead of inserting a duplicate row. A single
   * batch upsert either applies entirely or not at all, so one malformed
   * row would otherwise silently drop an entire, mostly-good page of
   * results; falls back to one upsert per food (the old behavior, which
   * degrades a single bad row rather than the whole page) only if the
   * batch itself fails.
   */
  private async upsertExternalFoods(foods: NormalizedFood[]): Promise<FoodRecord[]> {
    if (foods.length === 0) return [];

    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .upsert(
        foods.map((food) => this.toUpsertRow(food)),
        { onConflict: 'provider,provider_food_id' },
      )
      .select(FOOD_COLUMNS_WITH_PROVIDER_ID);

    if (!error && data) {
      // A multi-row upsert's returned rows aren't guaranteed to preserve
      // input order (no ORDER BY on an upsert) -- re-matched back onto the
      // provider's own relevance ranking (foods) rather than whatever
      // order Postgres happened to return.
      const byProviderFoodId = new Map(
        data.map((row) => [row.provider_food_id as string, toFoodRecord(row)]),
      );
      return foods
        .map((food) => byProviderFoodId.get(food.providerFoodId))
        .filter((record): record is FoodRecord => record !== undefined);
    }

    this.logger.warn(
      `Batch external food cache upsert failed, falling back per-item: ${error?.message}`,
    );
    const cached = await Promise.all(foods.map((food) => this.upsertExternalFood(food)));
    return cached.filter((food): food is FoodRecord => food !== null);
  }

  private async upsertExternalFood(food: NormalizedFood): Promise<FoodRecord | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .upsert(this.toUpsertRow(food), { onConflict: 'provider,provider_food_id' })
      .select(FOOD_COLUMNS)
      .maybeSingle();

    if (error) {
      this.logger.warn(`Failed to cache external food ${food.providerFoodId}: ${error.message}`);
      return null;
    }
    return data ? toFoodRecord(data) : null;
  }
}

/** Escapes ILIKE's own wildcard characters so a literal "%"/"_" a user typed is matched literally, same convention as the mobile app's own lib/ilike.ts. */
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}
