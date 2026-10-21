import {
  caloriesFromMacros,
  canSaveTargets,
  carbsFor,
  draftFromTargets,
  macroGuidance,
  parseField,
  parseTargets,
} from './targetMath';

const LB = 0.45359237;

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

  it('gives zero carbs when protein and fat use the calories exactly', () => {
    expect(carbsFor(1180, 160, 60)).toEqual({ kind: 'carbs', carbsG: 0, remainingCalories: 0 });
  });
});

describe('caloriesFromMacros', () => {
  it('counts protein and carbs at 4 cal a gram and fat at 9', () => {
    expect(caloriesFromMacros(160, 255, 60)).toBe(2200);
  });
});

describe('parseField', () => {
  it('reads blank as no target and rejects what is not a positive number', () => {
    expect(parseField('', 'calories')).toBeNull();
    expect(parseField(' 2200 ', 'calories')).toBe(2200);
    expect(parseField('2200.5', 'calories')).toBe('invalid');
    expect(parseField('0', 'proteinG')).toBe('invalid');
    expect(parseField('abc', 'fatG')).toBe('invalid');
    expect(parseField('62.5', 'fatG')).toBe(62.5);
  });
});

describe('parseTargets', () => {
  it('works carbs out from calories, protein and fat', () => {
    const parsed = parseTargets({ calories: '2200', proteinG: '160', fatG: '60' });

    expect(parsed.values).toEqual({ calories: 2200, proteinG: 160, carbsG: 255, fatG: 60 });
    expect(parsed.carbs).toEqual({ kind: 'carbs', carbsG: 255, remainingCalories: 1020 });
    expect(parsed.errors).toEqual({});
    expect(canSaveTargets(parsed)).toBe(true);
  });

  it('leaves carbs without a target until calories, protein and fat are all there', () => {
    const parsed = parseTargets({ calories: '2200', proteinG: '', fatG: '60' });

    expect(parsed.values.carbsG).toBeNull();
    expect(parsed.carbs).toBeNull();
    expect(canSaveTargets(parsed)).toBe(true);
  });

  it('cannot be saved while protein and fat pass the calories', () => {
    const parsed = parseTargets({ calories: '1000', proteinG: '200', fatG: '60' });

    expect(parsed.values.carbsG).toBeNull();
    expect(parsed.carbs?.kind).toBe('conflict');
    expect(canSaveTargets(parsed)).toBe(false);
  });

  it('names each field that is wrong, and cannot be saved with one', () => {
    const parsed = parseTargets({ calories: '-5', proteinG: 'x', fatG: '60' });

    expect(parsed.errors).toEqual({
      calories: 'Enter whole calories, above 0',
      proteinG: 'Enter grams above 0',
    });
    expect(canSaveTargets(parsed)).toBe(false);
  });
});

describe('draftFromTargets', () => {
  it('fills calories, protein and fat from saved targets; carbs are worked out again', () => {
    expect(draftFromTargets({ calories: 2200, proteinG: 160, carbsG: 300, fatG: null })).toEqual({
      calories: '2200',
      proteinG: '160',
      fatG: '',
    });
  });
});
