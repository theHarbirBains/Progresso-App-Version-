import { Logger } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { tokenize } from '../nutrition-resolution/scoring';
import { canonicalWord } from './search-terms';

// PostgREST answers at most this many rows a request.
const PAGE_ROWS = 1000;
// Plenty for the USDA reference data (about 8,000 foods) and the shared catalog.
const MAX_PAGES = 30;

/**
 * Every word in the names Search Food can find -- the USDA reference foods and the shared
 * catalog -- with how often each appears, for putting right a misspelt query ("brocoli"). Read
 * once, the first time it's needed, and kept for the life of the server: USDA's data only
 * changes with a new import, and a word missing for a while only means one typo isn't put right.
 * A failed read is tried again the next time.
 */
export class SearchVocabulary {
  private readonly logger = new Logger(SearchVocabulary.name);
  private words: ReadonlyMap<string, number> | null = null;
  private loading: Promise<ReadonlyMap<string, number> | null> | null = null;

  constructor(private readonly supabaseService: SupabaseService) {}

  /** The vocabulary, read first if it hasn't been; null when it can't be read. */
  async get(): Promise<ReadonlyMap<string, number> | null> {
    if (this.words) return this.words;
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async load(): Promise<ReadonlyMap<string, number> | null> {
    try {
      const counts = new Map<string, number>();
      const add = (text: string) => {
        for (const word of tokenize(text)) {
          const canonical = canonicalWord(word);
          if (canonical.length >= 3 && !/^\d+$/.test(canonical)) {
            counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
          }
        }
      };
      await this.readColumn('usda_food_reference', 'description', add);
      await this.readColumn('foods', 'name', add, true);
      this.words = counts;
      return counts;
    } catch (err) {
      this.logger.warn(
        `Search vocabulary could not be read: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async readColumn(
    table: 'usda_food_reference' | 'foods',
    column: 'description' | 'name',
    add: (text: string) => void,
    sharedOnly = false,
  ): Promise<void> {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      let request = this.supabaseService.getClient().from(table).select(column);
      if (sharedOnly) request = request.is('created_by', null);
      const { data, error } = await request.range(page * PAGE_ROWS, (page + 1) * PAGE_ROWS - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      for (const row of rows) add(String(row[column] ?? ''));
      if (rows.length < PAGE_ROWS) return;
    }
  }
}
