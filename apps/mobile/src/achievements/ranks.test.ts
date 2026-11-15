import { DIVISIONS, TIERS, divisionFloor, nextRankLabel, rankForPoints } from './ranks';

describe('rankForPoints', () => {
  it.each([
    [0, 'Bronze V'],
    [99, 'Bronze V'],
    [100, 'Bronze IV'],
    [499, 'Bronze I'],
    [500, 'Silver V'],
    [699, 'Silver V'],
    [700, 'Silver IV'],
    [1_499, 'Silver I'],
    [1_500, 'Gold V'],
    [2_999, 'Gold I'],
    [3_000, 'Platinum V'],
    [4_999, 'Platinum I'],
    [5_000, 'Diamond V'],
    [7_999, 'Diamond I'],
    [8_000, 'Vanguard V'],
    [11_999, 'Vanguard I'],
    [12_000, 'Titan V'],
    [16_999, 'Titan I'],
    [17_000, 'Sovereign V'],
    [22_999, 'Sovereign I'],
    [23_000, 'Legacy V'],
    [24_999, 'Legacy V'],
    [25_000, 'Legacy IV'],
    [31_000, 'Legacy I'],
    [32_999, 'Legacy I'],
    [33_000, 'Legacy I · 2'],
    [39_500, 'Legacy I · 5'],
  ])('%i AP is %s', (points, label) => {
    expect(rankForPoints(points).label).toBe(label);
  });

  it('leaves no gap and no overlap: every AP from 0 to Legacy belongs to exactly one division', () => {
    let previous = rankForPoints(0);
    for (let points = 1; points <= 40_000; points += 1) {
      const rank = rankForPoints(points);
      if (rank.label !== previous.label) {
        // A new division starts exactly where the last one said the next would.
        expect(rank.from).toBe(points);
        expect(previous.to).toBe(points);
      }
      expect(rank.from).toBeLessThanOrEqual(points);
      expect(rank.to).toBeGreaterThan(points);
      previous = rank;
    }
  });

  it('splits each tier into five divisions, V to I, ending where the next tier starts', () => {
    TIERS.slice(0, -1).forEach((tier, index) => {
      expect(divisionFloor(index, 0)).toBe(tier.floor);
      expect(divisionFloor(index, 4) + tier.step).toBe(TIERS[index + 1]!.floor);
    });
    expect(DIVISIONS).toEqual(['V', 'IV', 'III', 'II', 'I']);
    expect(TIERS.map((tier) => tier.name)).toEqual([
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Vanguard',
      'Titan',
      'Sovereign',
      'Legacy',
    ]);
  });

  it('says how far into the division, and what comes next', () => {
    const gold = rankForPoints(2_250);
    expect(gold).toMatchObject({ label: 'Gold III', from: 2_100, to: 2_400, progress: 0.5 });
    expect(nextRankLabel(gold)).toBe('Gold II');
    expect(nextRankLabel(rankForPoints(22_999))).toBe('Legacy V');
    expect(nextRankLabel(rankForPoints(32_000))).toBe('Legacy I · 2');
  });

  it('never goes below Bronze V, and reads nonsense as nothing', () => {
    expect(rankForPoints(-50).label).toBe('Bronze V');
    expect(rankForPoints(Number.NaN).label).toBe('Bronze V');
  });
});
