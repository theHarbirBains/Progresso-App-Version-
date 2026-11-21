import type { FoodSearchResult } from '../lib/foodsApi';
import { forgetSearches, narrowResults, recallSearch, rememberSearch } from './foodSearchMemory';

const food = (id: string, name: string, brand: string | null = null): FoodSearchResult => ({
  id,
  name,
  brand,
  imageUrl: null,
  servingSize: 100,
  servingUnit: 'g',
  calories: 100,
  proteinG: null,
  carbsG: null,
  fatG: null,
  provider: null,
  barcode: null,
});

const answer = (foods: FoodSearchResult[]) => ({ foods, hasMore: false });

beforeEach(() => forgetSearches());

describe('foodSearchMemory', () => {
  it('remembers a search, however it was typed, its quick and full answers apart', () => {
    rememberSearch('Chicken ', { quick: answer([food('1', 'Chicken')]) });
    expect(recallSearch('chicken')?.full).toBeUndefined();
    rememberSearch('chicken', { full: answer([food('2', 'Chicken Breast')]) });
    expect(recallSearch('  CHICKEN')).toMatchObject({
      quick: { foods: [{ id: '1' }] },
      full: { foods: [{ id: '2' }] },
    });
    expect(recallSearch('chickpeas')).toBeUndefined();
  });

  it('keeps only the latest forty', () => {
    for (let i = 0; i < 45; i += 1) rememberSearch(`food ${i}`, { full: answer([]) });
    expect(recallSearch('food 0')).toBeUndefined();
    expect(recallSearch('food 44')).toBeDefined();
  });

  it('narrows the rows to those that still match every word as the search is typed on', () => {
    const shown = [
      food('1', 'Chicken Breast (cooked)'),
      food('2', 'Chicken Thigh'),
      food('3', 'Chicken Nuggets', 'Brand Breaded'),
    ];
    expect(narrowResults(shown, 'chicken', 'chicken br').map((f) => f.id)).toEqual(['1', '3']);
    expect(narrowResults(shown, 'chicken', 'chicken thi').map((f) => f.id)).toEqual(['2']);
    // A new search, or one with words taken away, shows nothing stale.
    expect(narrowResults(shown, 'chicken', 'beef')).toEqual([]);
    expect(narrowResults(shown, 'chicken thigh', 'chicken')).toEqual([]);
    expect(narrowResults(shown, null, 'chicken')).toEqual([]);
  });
});
