import type { SupabaseService } from '../../supabase/supabase.service';
import { tokenize } from '../../nutrition-resolution/scoring';
import type {
  FoodQuery,
  NutritionSource,
  SourceCandidate,
} from '../../nutrition-resolution/source.interface';

const CANDIDATE_LIMIT = 25;

/** Escapes the characters ILIKE treats as wildcards, so a user's word is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * The Progresso catalog: built-in foods (created_by is null), seeded and cached. Matched word
 * by word, so "baked potato" finds "Potato (baked)". Its values are per serving as recorded.
 */
export class CatalogNutritionSource implements NutritionSource {
  readonly kind = 'progresso_catalog' as const;
  readonly licence = 'none' as const;
  readonly storable = true;

  constructor(private readonly supabaseService: SupabaseService) {}

  async search(query: FoodQuery): Promise<SourceCandidate[]> {
    const words = tokenize(query.term).slice(0, 3);
    if (words.length === 0) return [];

    let request = this.supabaseService
      .getClient()
      .from('foods')
      .select(
        'id, name, brand, barcode, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g',
      )
      .is('created_by', null)
      .eq('is_active', true)
      .limit(CANDIDATE_LIMIT);
    for (const word of words) {
      request = request.ilike('name', `%${escapeLike(word)}%`);
    }
    const { data, error } = await request;
    if (error) throw new Error(`Catalog search failed: ${error.message}`);

    const retrievedAt = new Date().toISOString();
    return (data ?? [])
      .filter((row) => row.protein_g !== null && row.carbs_g !== null && row.fat_g !== null)
      .map((row) => ({
        sourceKind: 'progresso_catalog' as const,
        sourceId: String(row.id),
        matchedName: String(row.name),
        brand: (row.brand as string | null) ?? null,
        barcode: (row.barcode as string | null) ?? null,
        basis: {
          kind: 'per_serving' as const,
          size: Number(row.serving_size),
          unit: String(row.serving_unit),
          nutrients: {
            calories: Number(row.calories),
            proteinG: Number(row.protein_g),
            carbsG: Number(row.carbs_g),
            fatG: Number(row.fat_g),
          },
        },
        measures: [],
        dataVersion: 'progresso-catalog',
        retrievedAt,
      }));
  }

  // The catalog's own provenance is captured on each result (see the resolver's catalog
  // assumption). No attribution is required for it.
  attribution(): null {
    return null;
  }
}
