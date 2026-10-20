import type { TrainingPhase } from './phaseQueries';
import {
  activePhase,
  dayBefore,
  effectiveTargets,
  hasOwnTargets,
  phaseAdherence,
  phaseDays,
  phaseLabel,
  phaseOn,
  validatePhase,
} from './phaseRules';

function phase(overrides: Partial<TrainingPhase> = {}): TrainingPhase {
  return {
    id: 'p1',
    kind: 'cut',
    name: null,
    startDate: '2026-10-01',
    endDate: null,
    startWeightKg: null,
    targetWeightKg: null,
    targets: { calories: null, proteinG: null, carbsG: null, fatG: null },
    notes: null,
    ...overrides,
  };
}

const TODAY = new Date(2026, 9, 20, 12, 0);

describe('phaseLabel', () => {
  it('names a phase by its own name, or its kind', () => {
    expect(phaseLabel(phase())).toBe('Cut');
    expect(phaseLabel(phase({ name: 'Summer Cut' }))).toBe('Summer Cut');
    expect(phaseLabel(phase({ kind: 'custom', name: 'Strength Block' }))).toBe('Strength Block');
  });
});

describe('which phase is going', () => {
  const past = phase({ id: 'past', kind: 'bulk', startDate: '2026-06-01', endDate: '2026-08-31' });
  const now = phase({ id: 'now', startDate: '2026-10-01' });

  it('finds the phase a day belongs to', () => {
    expect(phaseOn([now, past], '2026-07-04')?.id).toBe('past');
    expect(phaseOn([now, past], '2026-09-15')).toBeNull();
    expect(phaseOn([now, past], '2026-10-20')?.id).toBe('now');
  });

  it('only counts a phase with no end as going', () => {
    expect(activePhase([now, past], TODAY)?.id).toBe('now');
    expect(activePhase([past], TODAY)).toBeNull();
  });
});

describe('effectiveTargets', () => {
  const daily = { calories: 2400, proteinG: 160, carbsG: 300, fatG: 70 };

  it("uses the phase's own targets where it has them, and the daily ones everywhere else", () => {
    const cut = phase({ targets: { calories: 1900, proteinG: 180, carbsG: null, fatG: null } });
    expect(effectiveTargets(daily, cut)).toEqual({
      calories: 1900,
      proteinG: 180,
      carbsG: 300,
      fatG: 70,
    });
    expect(hasOwnTargets(cut)).toBe(true);
  });

  it('is the daily targets with no phase, or a phase without targets', () => {
    expect(effectiveTargets(daily, null)).toEqual(daily);
    expect(effectiveTargets(daily, phase())).toEqual(daily);
    expect(hasOwnTargets(phase())).toBe(false);
  });
});

describe('phaseDays', () => {
  it('counts the first day as day 1, up to the end or today', () => {
    expect(phaseDays(phase(), TODAY)).toBe(20);
    expect(phaseDays(phase({ endDate: '2026-10-01' }), TODAY)).toBe(1);
  });
});

describe('validatePhase', () => {
  const others = [phase({ id: 'past', startDate: '2026-06-01', endDate: '2026-08-31' })];

  it('accepts a phase that starts today or before and shares no day', () => {
    expect(
      validatePhase(
        { kind: 'cut', name: null, startDate: '2026-09-01', endDate: null },
        others,
        TODAY,
      ),
    ).toBeNull();
  });

  it('explains each rule it breaks', () => {
    expect(
      validatePhase(
        { kind: 'custom', name: ' ', startDate: '2026-10-01', endDate: null },
        [],
        TODAY,
      ),
    ).toBe('Give your phase a name.');
    expect(
      validatePhase({ kind: 'cut', name: null, startDate: '2026-10-21', endDate: null }, [], TODAY),
    ).toBe('A phase starts today or on a day before.');
    expect(
      validatePhase(
        { kind: 'cut', name: null, startDate: '2026-10-10', endDate: '2026-10-01' },
        [],
        TODAY,
      ),
    ).toBe("A phase can't end before it starts.");
    expect(
      validatePhase(
        { kind: 'cut', name: null, startDate: '2026-08-15', endDate: null },
        others,
        TODAY,
      ),
    ).toMatch(/share days with your Cut/);
  });

  it('gives the day before for ending a phase', () => {
    expect(dayBefore('2026-10-01')).toBe('2026-09-30');
  });
});

describe('phaseAdherence', () => {
  const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();

  it('judges only the days food was logged, within 10% of the calorie target', () => {
    const result = phaseAdherence({
      phase: phase({ startDate: '2026-10-06' }),
      calorieTarget: 2000,
      foodLogs: [
        { loggedAt: at(6, 8), calories: 1200 },
        { loggedAt: at(6, 19), calories: 900 },
        { loggedAt: at(7), calories: 2500 },
        { loggedAt: at(8), calories: 1800 },
        // Before the phase.
        { loggedAt: at(5), calories: 5000 },
      ],
      workouts: [{ performedAt: at(6) }, { performedAt: at(9) }, { performedAt: at(2) }],
      today: new Date(2026, 9, 19, 12),
    });

    expect(result).toEqual({
      days: 14,
      loggedDays: 3,
      daysOnCalories: 2,
      avgCalories: 2133,
      workouts: 2,
      workoutsPerWeek: 1,
    });
  });

  it('has no days on target without a calorie target', () => {
    const result = phaseAdherence({
      phase: phase(),
      calorieTarget: null,
      foodLogs: [],
      workouts: [],
      today: TODAY,
    });
    expect(result).toMatchObject({ loggedDays: 0, daysOnCalories: null, avgCalories: null });
  });
});
