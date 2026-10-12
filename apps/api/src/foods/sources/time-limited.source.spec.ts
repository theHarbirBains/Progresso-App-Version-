import type { NutritionSource, SourceCandidate } from '../../nutrition-resolution/source.interface';
import { timeLimited } from './time-limited.source';

const QUERY = { term: 'potato', brand: null, barcode: null, restaurant: null };

const CANDIDATE: SourceCandidate = {
  sourceKind: 'open_food_facts',
  sourceId: '123',
  matchedName: 'Potato',
  brand: null,
  barcode: null,
  basis: {
    kind: 'per_100g',
    nutrients: { calories: 77, proteinG: 2, carbsG: 17, fatG: 0.1 },
  },
  measures: [],
  dataVersion: 'test',
  retrievedAt: '2026-10-11T00:00:00.000Z',
};

function source(search: NutritionSource['search']): NutritionSource {
  return {
    kind: 'open_food_facts',
    licence: 'odbl',
    storable: true,
    search: jest.fn(search),
    attribution: () => 'Open Food Facts contributors (ODbL)',
  };
}

/** A search that never answers. */
const NEVER = () => new Promise<SourceCandidate[]>(() => undefined);

describe('timeLimited', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('passes through a source that answers in time, keeping what it is', async () => {
    const inner = source(async () => [CANDIDATE]);
    const limited = timeLimited(inner, 1000, Date.now() + 30_000, jest.fn());

    await expect(limited.search(QUERY)).resolves.toEqual([CANDIDATE]);
    expect(limited).toMatchObject({ kind: 'open_food_facts', licence: 'odbl', storable: true });
    expect(limited.attribution(CANDIDATE)).toBe('Open Food Facts contributors (ODbL)');
  });

  it('fails a search that runs past its limit, and reports it', async () => {
    const onTimeout = jest.fn();
    const inner = source(NEVER);
    const limited = timeLimited(inner, 1000, Date.now() + 30_000, onTimeout);

    const search = limited.search(QUERY);
    const settled = expect(search).rejects.toThrow('open_food_facts took longer than 1000 ms');
    await jest.advanceTimersByTimeAsync(1000);

    await settled;
    expect(onTimeout).toHaveBeenCalledWith(inner, 1000);
  });

  it('never waits past the deadline, even when the limit is longer', async () => {
    const limited = timeLimited(source(NEVER), 8000, Date.now() + 2000, jest.fn());

    const search = limited.search(QUERY);
    const settled = expect(search).rejects.toThrow('took longer than 2000 ms');
    await jest.advanceTimersByTimeAsync(2000);

    await settled;
  });

  it('does not start a search once the deadline has passed', async () => {
    const inner = source(async () => [CANDIDATE]);
    const limited = timeLimited(inner, 1000, Date.now() - 1, jest.fn());

    await expect(limited.search(QUERY)).rejects.toThrow('No time left to search open_food_facts');
    expect(inner.search).not.toHaveBeenCalled();
  });
});
