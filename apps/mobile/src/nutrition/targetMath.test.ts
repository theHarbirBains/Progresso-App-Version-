import {
  caloriesFromMacros,
  canSaveTargets,
  carbsFor,
  draftFromTargets,
  macroGuidance,
  macroTotal,
  parseField,
  parseTargets,
} from './targetMath';

const LB = 0.45359237;
const blank = { calories: '', proteinG: '', carbsG: '', fatG: '' };

describe('macroGuidance', () => {
  it('is 0.8 g protein and 0.3 g fat per pound of body weight, every time', () => {
    expect(macroGuidance(200 * LB)).toEqual({ weightLb: 200, proteinG: 160, fatG: 60 });
    expect(macroGuidance(150 * LB)).toEqual({ weightLb: 150, proteinG: 120, fatG: 45 });
  });

  it('works from a body weight stored in kilograms', () => {
    // 80 kg is 176.4 lb.
    expect(macroGuidance(80)).toEqual({ weightLb: 176, proteinG: 141, fatG: 53 });
  });
});

describe('carbsFor', () => {
  it('is the calories left after protein and fat, at 4 cal a gram', () => {
    // 2,200 - 160 x 4 - 60 x 9 = 1,020 cal, or 255 g.
    expect(carbsFor(2200, 160, 60)).toEqual({
      kind: 'carbs',
      carbsG: 255,
      remainingCalories: 1020,
    });
  });

  it('says so when protein and fat alone pass the calories, rather than giving zero', () => {
    expect(carbsFor(1000, 200, 60)).toEqual({
      kind: 'conflict',
      proteinFatCalories: 1340,
      overBy: 340,
    });
  });
});

describe('caloriesFromMacros', () => {
  it('counts protein and carbs at 4 cal a gram and fat at 9', () => {
    expect(caloriesFromMacros(160, 255, 60)).toBe(2200);
  });
});

describe('parseField', () => {
  it('reads blank as nothing typed and rejects what is not a positive number', () => {
    expect(parseField('', 'calories')).toBeNull();
    expect(parseField(' 2200 ', 'calories')).toBe(2200);
    expect(parseField('2200.5', 'calories')).toBe('invalid');
    expect(parseField('0', 'proteinG')).toBe('invalid');
    expect(parseField('abc', 'carbsG')).toBe('invalid');
    expect(parseField('62.5', 'fatG')).toBe(62.5);
  });
});

describe('parseTargets (a blank field is its recommendation)', () => {
  it('fills every blank macro with its recommendation', () => {
    const parsed = parseTargets({ ...blank, calories: '2200' }, 200 * LB);

    expect(parsed.values).toEqual({ calories: 2200, proteinG: 160, carbsG: 255, fatG: 60 });
    expect(parsed.recommended).toEqual({ proteinG: 160, fatG: 60, carbsG: 255 });
    expect(canSaveTargets(parsed)).toBe(true);
  });

  it('keeps what is typed, and recommends carbs from the protein and fat that will be saved', () => {
    const parsed = parseTargets({ ...blank, calories: '2200', proteinG: '180' }, 200 * LB);

    // 2,200 - 180 x 4 - 60 x 9 = 940 cal, or 235 g.
    expect(parsed.values).toEqual({ calories: 2200, proteinG: 180, carbsG: 235, fatG: 60 });
    expect(parsed.recommended).toEqual({ proteinG: 160, fatG: 60, carbsG: 235 });
  });

  it('keeps typed carbs over the recommendation', () => {
    const parsed = parseTargets({ ...blank, calories: '2200', carbsG: '300' }, 200 * LB);

    expect(parsed.values.carbsG).toBe(300);
    expect(parsed.recommended.carbsG).toBe(255);
  });

  it('recommends nothing for protein and fat without a body weight, nor carbs without calories', () => {
    expect(parseTargets({ ...blank, calories: '2200' }, null).values).toEqual({
      calories: 2200,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    expect(parseTargets(blank, 200 * LB).values).toEqual({
      calories: null,
      proteinG: 160,
      carbsG: null,
      fatG: 60,
    });
  });

  it('explains protein and fat past the calories, recommends no carbs, and still saves', () => {
    const parsed = parseTargets({ ...blank, calories: '1000' }, 200 * LB);

    expect(parsed.carbs).toEqual({ kind: 'conflict', proteinFatCalories: 1180, overBy: 180 });
    expect(parsed.values.carbsG).toBeNull();
    expect(canSaveTargets(parsed)).toBe(true);
  });

  it('names each field that is wrong, and cannot be saved with one', () => {
    const parsed = parseTargets({ calories: '-5', proteinG: 'x', carbsG: '0', fatG: '60' }, null);

    expect(parsed.errors).toEqual({
      calories: 'Enter whole calories, above 0',
      proteinG: 'Enter grams above 0',
      carbsG: 'Enter grams above 0',
    });
    expect(canSaveTargets(parsed)).toBe(false);
  });
});

describe('macroTotal', () => {
  it('compares what the macros come to with the calorie target', () => {
    expect(macroTotal({ calories: 2200, proteinG: 160, carbsG: 255, fatG: 60 })).toEqual({
      total: 2200,
      difference: 0,
      matches: true,
    });
    expect(macroTotal({ calories: 2200, proteinG: 160, carbsG: 230, fatG: 60 })).toEqual({
      total: 2100,
      difference: -100,
      matches: false,
    });
    expect(macroTotal({ calories: 2200, proteinG: 160, carbsG: null, fatG: 60 })).toBeNull();
  });
});

describe('draftFromTargets', () => {
  it('fills each field from saved targets', () => {
    expect(
      draftFromTargets({ calories: 2200, proteinG: 160, carbsG: 300, fatG: null }, null),
    ).toEqual({
      calories: '2200',
      proteinG: '160',
      carbsG: '300',
      fatG: '',
    });
  });

  it('leaves a saved macro that is its recommendation blank, so it keeps following it', () => {
    // Fat 70 g leaves 2,200 - 640 - 630 = 930 cal, or 233 g of carbs: the recommendation.
    expect(
      draftFromTargets({ calories: 2200, proteinG: 160, carbsG: 233, fatG: 70 }, 200 * LB),
    ).toEqual({ calories: '2200', proteinG: '', carbsG: '', fatG: '70' });
    // Carbs that aren't the recommendation stay as saved.
    expect(
      draftFromTargets({ calories: 2200, proteinG: 160, carbsG: 300, fatG: 60 }, 200 * LB).carbsG,
    ).toBe('300');
  });
});
