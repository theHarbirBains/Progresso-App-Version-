import { DIVISIONS, TIERS, divisionFloor, nextRankLabel, rankForPoints } from './ranks';

describe('rankForPoints', () => {
  it.each([
    [0, 'Bronze V'],
    [149, 'Bronze V'],
    [150, 'Bronze IV'],
    [749, 'Bronze I'],
    [750, 'Silver V'],
    [999, 'Silver V'],
    [1_000, 'Silver IV'],
    [1_999, 'Silver I'],
    [2_000, 'Gold V'],
    [3_999, 'Gold I'],
    [4_000, 'Platinum V'],
    [6_999, 'Platinum I'],
    [7_000, 'Diamond V'],
    [10_999, 'Diamond I'],
    [11_000, 'Vanguard V'],
    [15_999, 'Vanguard I'],
    [16_000, 'Titan V'],
    [21_999, 'Titan I'],
    [22_000, 'Sovereign V'],
    [23_600, 'Sovereign IV'],
    [29_999, 'Sovereign I'],
    [30_000, 'Legacy V'],
    [31_999, 'Legacy V'],
    [32_000, 'Legacy IV'],
    [38_000, 'Legacy I'],
    [39_999, 'Legacy I'],
    [40_000, 'Legacy I · 2'],
    [46_500, 'Legacy I · 5'],
  ])('%i AP is %s', (points, label) => {
    expect(rankForPoints(points).label).toBe(label);
  });

  it('leaves no gap and no overlap: every AP from 0 to past Legacy belongs to exactly one division', () => {
    let previous = rankForPoints(0);
    for (let points = 1; points <= 50_000; points += 1) {
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
    expect(TIERS.map((tier) => `${tier.name} ${tier.floor}`)).toEqual([
      'Bronze 0',
      'Silver 750',
      'Gold 2000',
      'Platinum 4000',
      'Diamond 7000',
      'Vanguard 11000',
      'Titan 16000',
      'Sovereign 22000',
      'Legacy 30000',
    ]);
  });

  it('says how far into the division, and what comes next', () => {
    const gold = rankForPoints(2_600);
    expect(gold).toMatchObject({ label: 'Gold IV', from: 2_400, to: 2_800, progress: 0.5 });
    expect(nextRankLabel(gold)).toBe('Gold III');
    expect(nextRankLabel(rankForPoints(29_999))).toBe('Legacy V');
    expect(nextRankLabel(rankForPoints(39_000))).toBe('Legacy I · 2');
  });

  it('never goes below Bronze V, and reads nonsense as nothing', () => {
    expect(rankForPoints(-50).label).toBe('Bronze V');
    expect(rankForPoints(Number.NaN).label).toBe('Bronze V');
  });
});
