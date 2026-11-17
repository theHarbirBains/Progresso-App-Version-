import { rankFoods, searchRelevance, type RankableFood } from './search-ranking';
import { correctWord, editDistance, matchStem, searchTermsFor, spellingsOf } from './search-terms';

const usda = (name: string): RankableFood => ({ name, brand: null, source: 'usda' });
const builtin = (name: string): RankableFood => ({ name, brand: null, source: 'builtin' });
const product = (name: string, brand: string | null = 'Brand'): RankableFood => ({
  name,
  brand,
  source: 'branded',
});

function order(query: string, foods: RankableFood[]): string[] {
  return rankFoods(searchTermsFor(query), foods).map((food) => food.name);
}

// Names as Progresso's catalog and USDA's reference data have them.
describe('rankFoods: the plain food first', () => {
  it('onion: the raw onion before products and dishes that only mention one', () => {
    expect(
      order('onion', [
        usda('Snacks, potato chips, sour-cream-and-onion-flavor'),
        product('Cream & Onion by Lays', "Lay's"),
        usda('BURGER KING, Onion Rings'),
        product('Onion rings', 'Cavendish Farms'),
        usda('Spices, onion powder'),
        usda('Onions, raw'),
        usda('Onions, cooked, boiled, drained, without salt'),
      ])[0],
    ).toBe('Onions, raw');
  });

  it('a plural query finds the same food as the singular', () => {
    const foods = [usda('Onions, raw'), product('Onion soup mix', 'No Name')];
    expect(order('onions', foods)).toEqual(order('onion', foods));
  });

  it("Progresso's own built-in food leads when it matches", () => {
    expect(
      order('rice', [
        usda('Rice, white, medium-grain, raw, enriched'),
        builtin('White Rice (cooked)'),
        usda('Rice crackers'),
      ])[0],
    ).toBe('White Rice (cooked)');
    expect(
      order('chicken breast', [
        usda('Chicken, broilers or fryers, breast, meat only, cooked, roasted'),
        builtin('Chicken Breast (cooked)'),
        product('Chicken Breast Strips'),
      ])[0],
    ).toBe('Chicken Breast (cooked)');
  });

  it('eggs: the whole egg first, and the fresh egg before the dried powders', () => {
    const ranked = order('eggs', [
      usda('Egg, white, dried, stabilized, glucose reduced'),
      builtin('Egg White, Large'),
      usda('Egg, whole, raw, fresh'),
      builtin('Egg, Large'),
    ]);
    expect(ranked[0]).toBe('Egg, Large');
    expect(ranked.indexOf('Egg, whole, raw, fresh')).toBeLessThan(
      ranked.indexOf('Egg, white, dried, stabilized, glucose reduced'),
    );
  });

  it('egg white: the egg white, not the whole egg', () => {
    const ranked = order('egg white', [
      builtin('Egg, Large'),
      usda('Egg, white, raw, fresh'),
      builtin('Egg White, Large'),
    ]);
    expect(ranked.slice(0, 2)).toEqual(['Egg White, Large', 'Egg, white, raw, fresh']);
  });

  it('the preparation asked for comes first; with none asked, the raw food', () => {
    const potatoes = [
      usda('Potatoes, boiled, cooked in skin, flesh, without salt'),
      usda('Potatoes, baked, flesh, without salt'),
      usda('Potatoes, flesh and skin, raw'),
    ];
    expect(order('baked potato', potatoes)[0]).toBe('Potatoes, baked, flesh, without salt');
    expect(order('boiled potatoes', potatoes)[0]).toBe(
      'Potatoes, boiled, cooked in skin, flesh, without salt',
    );
    expect(order('potato', potatoes)[0]).toBe('Potatoes, flesh and skin, raw');
  });

  it('a spelling variant matches: yoghurt finds yogurt', () => {
    expect(order('yoghurt', [usda('Yogurt, plain, low fat')])).toEqual(['Yogurt, plain, low fat']);
  });

  it('a word that starts a longer one counts for less: "oats" finds Oatmeal, after Oats', () => {
    expect(order('oats', [builtin('Oatmeal (cooked, plain)'), usda('Oats, raw')])).toEqual([
      'Oats, raw',
      'Oatmeal (cooked, plain)',
    ]);
  });

  it('a product asked for by name is not pushed down: "onion rings"', () => {
    expect(
      order('onion rings', [usda('Onions, raw'), product('Onion rings', 'Cavendish Farms')])[0],
    ).toBe('Onion rings');
  });

  it("matches a brand the query names, and leaves out what matches under half the query's words", () => {
    expect(order('kirkland eggs', [product('Egg Whites', 'Kirkland Signature')])).toEqual([
      'Egg Whites',
    ]);
    expect(
      searchRelevance(searchTermsFor('chicken breast sandwich bread'), usda('Bread, white')),
    ).toBeNull();
  });
});

describe('search terms', () => {
  it('cuts a query into singular, canonical words with their stems', () => {
    expect(searchTermsFor('Greek Yoghurt & Berries')).toEqual({
      words: ['greek', 'yogurt', 'berry'],
      stems: [['greek'], ['yogurt', 'yoghurt', 'yogourt'], ['berr']],
      cooking: [],
    });
    expect(searchTermsFor('baked potatoes').cooking).toEqual(['baked']);
    expect(searchTermsFor('peaches').stems).toEqual([['peach']]);
  });

  it('keeps only letters and digits in a stem, so it is safe in a LIKE pattern', () => {
    expect(matchStem('2%')).toBe('2');
    expect(searchTermsFor('100% juice').stems).toEqual([['100'], ['juice']]);
    expect(searchTermsFor('%_\\').words).toEqual([]);
  });

  it('lists every spelling of a word, itself first', () => {
    expect(spellingsOf('chilli')).toEqual(['chilli', 'chili', 'chile']);
    expect(spellingsOf('onion')).toEqual(['onion']);
  });

  it('measures edit distance with swapped letters as one edit', () => {
    expect(editDistance('brocoli', 'broccoli')).toBe(1);
    expect(editDistance('chikcen', 'chicken')).toBe(1);
    expect(editDistance('banana', 'banana')).toBe(0);
  });

  it('puts a misspelt word right from the vocabulary, the most common of the closest', () => {
    const vocabulary = new Map([
      ['broccoli', 40],
      ['banana', 30],
      ['bandana', 1],
      ['chicken', 300],
      ['spinach', 20],
    ]);
    expect(correctWord('brocoli', vocabulary)).toBe('broccoli');
    expect(correctWord('bannana', vocabulary)).toBe('banana');
    expect(correctWord('spinich', vocabulary)).toBe('spinach');
    // A known word, a short word and a far one are left alone.
    expect(correctWord('banana', vocabulary)).toBeNull();
    expect(correctWord('pea', vocabulary)).toBeNull();
    expect(correctWord('xylophone', vocabulary)).toBeNull();
  });
});
