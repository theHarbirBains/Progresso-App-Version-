import { brandScore, nameScore, rankCandidates, splitName } from './scoring';
import type { SourceCandidate } from './source.interface';

function candidate(matchedName: string, extra: Partial<SourceCandidate> = {}): SourceCandidate {
  return {
    sourceKind: 'progresso_catalog',
    sourceId: matchedName,
    matchedName,
    brand: null,
    barcode: null,
    basis: { kind: 'per_100g', nutrients: { calories: 100, proteinG: 1, carbsG: 1, fatG: 1 } },
    measures: [],
    dataVersion: 'test',
    retrievedAt: '2026-10-04T00:00:00.000Z',
    ...extra,
  };
}

function rankedNames(term: string, names: string[]): string[] {
  return rankCandidates(
    { term, brand: null, barcode: null, restaurant: null },
    names.map((name) => candidate(name)),
  ).map((scored) => scored.candidate.matchedName);
}

describe('splitName', () => {
  it('treats brackets and text after a comma as descriptors, not name words', () => {
    expect(splitName('Potato (baked)')).toEqual({ core: ['potato'], descriptors: ['baked'] });
    expect(splitName('Egg, Large')).toEqual({ core: ['egg'], descriptors: ['large'] });
  });

  it('keeps everything as the name when there are no descriptors', () => {
    expect(splitName('Sweet Potato')).toEqual({ core: ['sweet', 'potato'], descriptors: [] });
  });
});

describe('nameScore: exact multi-word match', () => {
  it('scores an exact multi-word match as 1', () => {
    expect(nameScore('Big Mac', 'Big Mac')).toBe(1);
    expect(nameScore('Big Mac Sauce', 'Big Mac Sauce')).toBe(1);
    expect(nameScore('chicken breast', 'Chicken Breast')).toBe(1);
    expect(nameScore('Greek yogurt', 'Greek Yogurt')).toBe(1);
  });
});

describe('nameScore: extra trailing and leading words', () => {
  it('penalises a candidate with extra trailing words the query did not mention', () => {
    expect(nameScore('Big Mac', 'Big Mac Sauce')).toBeLessThan(1);
    expect(nameScore('chicken breast', 'Chicken Breast Sandwich')).toBeLessThan(1);
    expect(nameScore('Greek yogurt', 'Greek Yogurt Smoothie')).toBeLessThan(1);
  });

  it('penalises a candidate with extra leading words the query did not mention', () => {
    expect(nameScore('potato', 'Sweet Potato')).toBeLessThan(1);
  });

  it('never penalises descriptors, so "potato" matches "Potato (baked)" fully', () => {
    expect(nameScore('potato', 'Potato (baked)')).toBe(1);
    expect(nameScore('potato', 'Potatoes, raw')).toBe(1);
  });
});

describe('ranking: the exact product beats the longer one', () => {
  it('ranks Big Mac above Big Mac Sauce for "Big Mac"', () => {
    expect(rankedNames('Big Mac', ['Big Mac Sauce', 'Big Mac'])[0]).toBe('Big Mac');
  });

  it('ranks Big Mac Sauce first for "Big Mac Sauce"', () => {
    expect(rankedNames('Big Mac Sauce', ['Big Mac', 'Big Mac Sauce'])[0]).toBe('Big Mac Sauce');
  });

  it('ranks Chicken Breast above Chicken Breast Sandwich for "chicken breast"', () => {
    expect(rankedNames('chicken breast', ['Chicken Breast Sandwich', 'Chicken Breast'])[0]).toBe(
      'Chicken Breast',
    );
  });

  it('ranks Greek Yogurt above Greek Yogurt Smoothie for "Greek yogurt"', () => {
    expect(rankedNames('Greek yogurt', ['Greek Yogurt Smoothie', 'Greek Yogurt'])[0]).toBe(
      'Greek Yogurt',
    );
  });
});

describe('ranking: preparation and cooking state', () => {
  const potatoes = ['Potato (boiled)', 'Potato (baked)', 'Potato (raw)', 'Sweet Potato (baked)'];

  it('prefers the baked potato for "baked potato"', () => {
    expect(rankedNames('baked potato', potatoes)[0]).toBe('Potato (baked)');
  });

  it('prefers the raw potato for "raw potato"', () => {
    expect(rankedNames('raw potato', potatoes)[0]).toBe('Potato (raw)');
  });

  it('prefers the boiled potato for "boiled potato"', () => {
    expect(rankedNames('boiled potato', potatoes)[0]).toBe('Potato (boiled)');
  });

  it('keeps the plain potatoes ambiguous for a bare "potato", so the user chooses the preparation', () => {
    const plain = rankCandidates(
      { term: 'potato', brand: null, barcode: null, restaurant: null },
      ['Potato (boiled)', 'Potato (baked)', 'Potato (raw)'].map((name) => candidate(name)),
    );
    expect(plain.map((s) => s.score)).toEqual([1, 1, 1]);
  });
});

describe('ranking: genuinely ambiguous candidates', () => {
  it('leaves two equally good matches tied, so they are both offered', () => {
    const ranked = rankCandidates({ term: 'milk', brand: null, barcode: null, restaurant: null }, [
      candidate('Whole Milk'),
      candidate('Skim Milk'),
    ]);
    expect(ranked[0]!.score).toBeCloseTo(ranked[1]!.score, 10);
  });
});

describe('branded products', () => {
  it('scores a named brand that is absent as zero', () => {
    expect(brandScore('Fairlife', 'Oreo')).toBe(0);
  });

  it('matches a named brand that is present', () => {
    expect(brandScore('Fairlife', 'Fairlife LLC')).toBe(1);
    expect(brandScore(null, 'Oreo')).toBe(1);
  });

  it('never ranks a branded query above a candidate from another brand', () => {
    const ranked = rankCandidates(
      { term: 'milk', brand: 'Fairlife', barcode: null, restaurant: null },
      [
        candidate('Whole Milk', { brand: 'Dairy Co' }),
        candidate('Whole Milk', { brand: 'Fairlife' }),
      ],
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.candidate.brand).toBe('Fairlife');
  });
});

describe('ranking: cached duplicates count once', () => {
  it('collapses the same product listed twice, including a letter-case difference', () => {
    const ranked = rankCandidates({ term: 'eggs', brand: null, barcode: null, restaurant: null }, [
      candidate('Eggs', { sourceId: '1' }),
      candidate('eggs', { sourceId: '2' }),
    ]);
    expect(ranked).toHaveLength(1);
  });

  it('keeps two different products with the same name when their figures differ', () => {
    const ranked = rankCandidates({ term: 'eggs', brand: null, barcode: null, restaurant: null }, [
      candidate('Eggs', { sourceId: '1' }),
      candidate('Eggs', {
        sourceId: '2',
        basis: {
          kind: 'per_100g',
          nutrients: { calories: 140, proteinG: 12, carbsG: 1, fatG: 10 },
        },
      }),
    ]);
    expect(ranked).toHaveLength(2);
  });
});
