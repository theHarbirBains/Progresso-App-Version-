import { recipeMicronutrients } from '../foodGroups';
import type { FoodRow } from '../foodQueries';
import type { FoodLogRow } from '../foodLogQueries';
import { dayLine, displayName, overUpperLimit, weekLine } from './display';
import { isComplete, nutrientIntake, progressOf, weekIntake } from './intake';
import {
  DRI_FOOTNOTES,
  NUTRIENTS,
  NUTRIENT_SOURCES,
  REFERENCE_VALUES,
} from './nutrientCatalog.generated';
import { formatAmount, nutrientById, readAmounts, scaleAmounts, unitWithBasis } from './nutrients';
import { readStoredChoices } from './referenceSettings';
import {
  lifeStageApplies,
  lifeStageLabel,
  referenceGroupLabel,
  referencePersonFor,
  referenceRowFor,
  upperLimitNotes,
  valueNotes,
} from './referenceValues';
import { logsByDay, weekDayKeys } from './weekDays';

const NOW = new Date(2026, 10, 21, 12);
// Born mid-1990: 36 on November 21, 2026 -- Health Canada's 31-50 group.
const ADULT = { birthday: '1990-06-15', gender: 'female' };
const person = (profile: { birthday: string | null; gender: string | null } | null, choices = {}) =>
  referencePersonFor(profile, choices, NOW).person;
const value = (id: string, p: ReturnType<typeof person>) => referenceRowFor(id, p)?.value;

describe('the reference values that apply', () => {
  it("come from the person's profile: their age and sex", () => {
    const female = person(ADULT);
    expect(female).toEqual({ ageYears: 36, sex: 'female', lifeStage: null });
    expect(value('iron', female)).toBe(18);
    expect(referenceGroupLabel(female)).toBe('Females 31–50');
  });

  it("follow Health Canada's age groups", () => {
    expect(value('iron', person({ birthday: '2010-01-01', gender: 'female' }))).toBe(15);
    expect(value('vitamin_c', person({ birthday: '2010-01-01', gender: 'female' }))).toBe(65);
    // Over 70, vitamin D goes up.
    expect(value('vitamin_d', person({ birthday: '1950-01-01', gender: 'male' }))).toBe(20);
    expect(value('vitamin_d', person({ birthday: '1990-01-01', gender: 'male' }))).toBe(15);
  });

  it('follow the sex categories the tables use', () => {
    expect(value('iron', person({ ...ADULT, gender: 'male' }))).toBe(8);
    expect(value('magnesium', person({ ...ADULT, gender: 'male' }))).toBe(420);
  });

  it('use the pregnancy and breastfeeding values where the tables have them', () => {
    expect(value('iron', person(ADULT, { lifeStage: 'pregnant' }))).toBe(27);
    expect(value('iron', person(ADULT, { lifeStage: 'breastfeeding' }))).toBe(9);
    expect(referenceGroupLabel(person(ADULT, { lifeStage: 'pregnant' }))).toBe('Pregnancy, 31–50');
    // Past 50 the tables have none, so the usual values apply.
    expect(
      value(
        'iron',
        person({ birthday: '1965-01-01', gender: 'female' }, { lifeStage: 'pregnant' }),
      ),
    ).toBe(8);
    // Only a female category in the tables: chosen with male values, it doesn't apply.
    expect(person({ ...ADULT, gender: 'male' }, { lifeStage: 'pregnant' }).lifeStage).toBeNull();
    expect(lifeStageApplies(person(ADULT))).toBe(true);
    expect(lifeStageApplies(person({ birthday: '1965-01-01', gender: 'female' }))).toBe(false);
  });

  it('choose nothing, and say what is missing, without a birthday', () => {
    const { person: p, missing } = referencePersonFor(
      { birthday: null, gender: 'female' },
      {},
      NOW,
    );
    expect(missing).toEqual(['age']);
    expect(referenceRowFor('iron', p)).toBeNull();
  });

  it("ask which table to use when the profile's gender isn't one the tables have", () => {
    const other = { ...ADULT, gender: 'other' };
    const before = referencePersonFor(other, {}, NOW);
    expect(before.missing).toEqual(['sex']);
    expect(referenceRowFor('iron', before.person)).toBeNull();
    const chosen = referencePersonFor(other, { sex: 'male' }, NOW);
    expect(chosen.missing).toEqual([]);
    expect(value('iron', chosen.person)).toBe(8);
    // The profile's own gender wins over a choice made before it was set.
    expect(value('iron', person(ADULT, { sex: 'male' }))).toBe(18);
  });

  it('change when the profile does', () => {
    expect(value('vitamin_c', person(ADULT))).toBe(75);
    expect(value('vitamin_c', person({ ...ADULT, gender: 'male' }))).toBe(90);
  });

  it("tell an Adequate Intake from an RDA, and keep Health Canada's notes word for word", () => {
    expect(referenceRowFor('vitamin_k', person(ADULT))).toMatchObject({ value: 90, type: 'AI' });
    expect(referenceRowFor('iron', person(ADULT))?.type).toBe('RDA');
    const iron = nutrientById('iron')!;
    expect(valueNotes(iron, referenceRowFor('iron', person(ADULT)))).toContain(
      'The requirement for iron is 1.8 times higher for vegetarians due to the lower bioavailability of iron from a vegetarian diet.',
    );
    expect(upperLimitNotes(nutrientById('magnesium')!)).toEqual([
      'The UL for magnesium represents intake from a pharmacological agent only and does not include intake from food and water.',
    ]);
  });

  it('keep an upper limit apart, and never make one up', () => {
    const row = referenceRowFor('vitamin_c', person(ADULT));
    expect(row).toMatchObject({ value: 75, ul: 2000 });
    expect(referenceRowFor('vitamin_k', person(ADULT))?.ul).toBeNull();
    expect(referenceRowFor('sodium', person(ADULT))).toMatchObject({
      value: 1500,
      ul: null,
      cdrr: 2300,
    });
  });

  it('name who they are for', () => {
    expect(
      lifeStageLabel(referenceRowFor('iron', person({ birthday: '2018-01-01', gender: null }))!),
    ).toBe('Children 4–8');
  });
});

describe('the catalogue', () => {
  it('gives every nutrient with a number a value for every adult life stage, and the others guidance', () => {
    for (const nutrient of NUTRIENTS) {
      if ('guidance' in nutrient) {
        expect(REFERENCE_VALUES[nutrient.id]).toBeUndefined();
        continue;
      }
      const rows = REFERENCE_VALUES[nutrient.id]!;
      for (const group of ['males', 'females', 'pregnancy', 'lactation'] as const) {
        for (const row of rows.filter((r) => r.group === group)) {
          expect([nutrient.id, group, row.ageLabel, typeof row.value]).toEqual([
            nutrient.id,
            group,
            row.ageLabel,
            'number',
          ]);
        }
      }
    }
  });

  it('cites a real, listed source for every explanation, and has every note it points to', () => {
    for (const nutrient of NUTRIENTS) {
      for (const part of Object.values(nutrient.about)) {
        if (!part) continue;
        expect(part.sources.length).toBeGreaterThan(0);
        for (const key of part.sources) expect(NUTRIENT_SOURCES[key]?.url).toMatch(/^https:\/\//);
      }
      for (const key of Object.values(nutrient.footnotes).flat()) {
        expect(DRI_FOOTNOTES[key]).toEqual(expect.any(String));
      }
    }
  });

  it('says nothing about manganese or dietary cholesterol, since no readable source covers them', () => {
    expect(nutrientById('manganese')!.about).toEqual({ does: null, low: null, high: null });
    expect(nutrientById('cholesterol')!.about).toEqual({ does: null, low: null, high: null });
  });
});

describe('amounts', () => {
  it('keep only real figures for nutrients that are tracked', () => {
    expect(readAmounts({ iron: 2.5, vitamin_c: '30', bogus: 1, zinc: -1, calcium: 0 })).toEqual({
      iron: 2.5,
      vitamin_c: 30,
      calcium: 0,
    });
    expect(readAmounts(null)).toBeNull();
    expect(readAmounts({})).toBeNull();
  });

  it('scale with the amount logged, and stay unknown when unknown', () => {
    expect(scaleAmounts({ iron: 2.5, calcium: 0 }, 2)).toEqual({ iron: 5, calcium: 0 });
    expect(scaleAmounts(null, 2)).toBeNull();
  });

  it('read naturally', () => {
    expect(formatAmount(1250)).toBe('1,250');
    expect(formatAmount(68.4)).toBe('68');
    expect(formatAmount(2.44)).toBe('2.4');
    expect(formatAmount(0.456)).toBe('0.46');
    expect(unitWithBasis(nutrientById('vitamin_a')!)).toBe('mcg RAE');
    expect(displayName(nutrientById('thiamin')!)).toBe('Vitamin B1 (Thiamin)');
  });
});

const log = (micronutrients: Record<string, number> | null): { micronutrients: never } =>
  ({ micronutrients: readAmounts(micronutrients) }) as never;

describe("a day's intake", () => {
  // 100 g chicken breast, 200 g potatoes, 150 g broccoli -- their own figures for those amounts.
  const day = [
    log({ vitamin_c: 0, iron: 1.04, selenium: 27.6 }),
    log({ vitamin_c: 19.2, iron: 1.62 }),
    log({ vitamin_c: 134, iron: 1.1 }),
  ];

  it('adds up every food logged', () => {
    expect(nutrientIntake(day, 'iron')).toEqual({ amount: 3.76, foodsWithData: 3, foodsLogged: 3 });
    expect(isComplete(nutrientIntake(day, 'vitamin_c'))).toBe(true);
  });

  it("counts a food's real 0, but never a figure it doesn't have", () => {
    const selenium = nutrientIntake(day, 'selenium');
    expect(selenium).toEqual({ amount: 27.6, foodsWithData: 1, foodsLogged: 3 });
    expect(isComplete(selenium)).toBe(false);
    expect(
      dayLine(nutrientById('selenium')!, day, referenceRowFor('selenium', person(ADULT))),
    ).toMatchObject({
      amount: 27.6,
      coverage: 'From 1 of 3 foods',
    });
  });

  it('says there is no data rather than 0 when no food has it', () => {
    const entry = dayLine(
      nutrientById('vitamin_b12')!,
      day,
      referenceRowFor('vitamin_b12', person(ADULT)),
    );
    expect(entry).toMatchObject({ amount: null, figure: '— / 2.4 mcg', fraction: null });
    expect(entry.caption).toBe('No data from the 3 foods logged');
  });

  it('reads as a share of the recommendation, with a bar that stops at full and no warning past it', () => {
    const vitaminC = dayLine(
      nutrientById('vitamin_c')!,
      day,
      referenceRowFor('vitamin_c', person(ADULT)),
    );
    expect(vitaminC).toMatchObject({ figure: '153 / 75 mg', percent: 204, fraction: 1 });
    expect(vitaminC.caption).toBe('204% of daily recommendation');
    expect(progressOf(68, 90)).toEqual({ percent: 76, fraction: 68 / 90 });
    const vitaminK = dayLine(
      nutrientById('vitamin_k')!,
      [log({ vitamin_k: 45 })],
      referenceRowFor('vitamin_k', person(ADULT)),
    );
    expect(vitaminK.caption).toBe('50% of adequate intake');
  });

  it('gives the fats with no target their guidance, never a percentage', () => {
    const entry = dayLine(nutrientById('saturated_fat')!, [log({ saturated_fat: 12 })], null);
    expect(entry).toMatchObject({ figure: '12 g', percent: null, fraction: null });
    expect(entry.caption).toBe('No daily target — as low as possible');
  });

  it("is only held to an upper limit that's about food", () => {
    const adult = person({ ...ADULT, gender: 'male' });
    const magnesium = nutrientById('magnesium')!;
    expect(overUpperLimit(magnesium, referenceRowFor('magnesium', adult), 500)).toBe(false);
    const vitaminC = nutrientById('vitamin_c')!;
    expect(overUpperLimit(vitaminC, referenceRowFor('vitamin_c', adult), 2100)).toBe(true);
    expect(overUpperLimit(vitaminC, referenceRowFor('vitamin_c', adult), 1900)).toBe(false);
    expect(
      overUpperLimit(nutrientById('vitamin_k')!, referenceRowFor('vitamin_k', adult), 9999),
    ).toBe(false);
  });
});

describe("a week's average", () => {
  it('is over the days with data for it, never counting a day with nothing logged as none', () => {
    const days = [
      [],
      [log({ iron: 10 })],
      [log({ iron: 14 }), log(null)],
      [log({ vitamin_c: 5 })],
      [],
    ];
    expect(weekIntake(days, 'iron')).toEqual({
      average: 12,
      daysLogged: 3,
      daysWithData: 2,
      daysComplete: 1,
      days: 5,
    });
    expect(
      weekLine(nutrientById('iron')!, days, referenceRowFor('iron', person(ADULT))),
    ).toMatchObject({
      amount: 12,
      coverage: 'Over 2 days, some foods without data',
      caption: 'Averaging 67% of daily recommendation',
    });
  });

  it('is none at all with no data', () => {
    expect(weekIntake([[], []], 'iron').average).toBeNull();
  });

  it("is the week's days up to today, Sunday first", () => {
    expect(weekDayKeys('2026-11-18', NOW)).toEqual([
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ]);
    expect(weekDayKeys('2026-11-21', new Date(2026, 10, 18, 12))).toEqual([
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
  });

  it('keeps each log on its own day', () => {
    const at = (day: number, hour: number) =>
      ({
        id: `${day}-${hour}`,
        loggedAt: new Date(2026, 10, day, hour).toISOString(),
      }) as FoodLogRow;
    const grouped = logsByDay(
      [at(15, 8), at(16, 23), at(16, 7)],
      ['2026-11-15', '2026-11-16', '2026-11-17'],
    );
    expect(grouped.map((logs) => logs.map((l) => l.id))).toEqual([['15-8'], ['16-23', '16-7'], []]);
  });
});

describe("a recipe's micronutrients", () => {
  const food = (micronutrients: Record<string, number> | null) =>
    ({ micronutrients: readAmounts(micronutrients) }) as FoodRow;

  it('are per serving, only where every ingredient has a figure', () => {
    const items = [
      { food: food({ iron: 2, vitamin_c: 10 }), quantity: 2, entered: null },
      { food: food({ iron: 1 }), quantity: 1, entered: null },
    ];
    // Iron: (2 x 2 + 1) / 4 servings; vitamin C is missing from one ingredient, so unknown.
    expect(recipeMicronutrients(items, 4)).toEqual({ iron: 1.25 });
    expect(recipeMicronutrients([{ food: food(null), quantity: 1, entered: null }], 2)).toBeNull();
  });
});

describe('the choices kept on the phone', () => {
  it('read back only what they can be', () => {
    expect(readStoredChoices(JSON.stringify({ sex: 'female', lifeStage: 'pregnant' }))).toEqual({
      sex: 'female',
      lifeStage: 'pregnant',
    });
    expect(readStoredChoices(JSON.stringify({ sex: 'x', lifeStage: 'y' }))).toEqual({
      sex: null,
      lifeStage: null,
    });
    expect(readStoredChoices('not json')).toEqual({});
    expect(readStoredChoices(null)).toEqual({});
  });
});
