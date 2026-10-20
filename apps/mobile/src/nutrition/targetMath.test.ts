import {
  caloriesFromMacros,
  draftFromTargets,
  editDraft,
  macroCalorieDifference,
  parseTargets,
  perKgGuidelines,
  suggestCarbs,
  suggestMacros,
  takeSuggestedCarbs,
  type TargetDraft,
} from './targetMath';

const LB = 0.45359237;

describe('suggestMacros', () => {
  it('suggests 0.7-0.8 g protein and about 0.3 g fat per pound of body weight', () => {
    // 200 lb.
    const suggestion = suggestMacros(200 * LB);
    expect(suggestion).toEqual({ proteinLowG: 140, proteinHighG: 160, proteinG: 150, fatG: 60 });
  });

  it('works from a body weight stored in kilograms', () => {
    // 80 kg is 176.4 lb.
    expect(suggestMacros(80)).toEqual({
      proteinLowG: 123,
      proteinHighG: 141,
      proteinG: 132,
      fatG: 53,
    });
  });

  it('gives the same guidelines per kilogram', () => {
    expect(perKgGuidelines()).toEqual({ proteinLow: 1.5, proteinHigh: 1.8, fat: 0.7 });
  });
});

describe('suggestCarbs', () => {
  it('fills the calories left after protein and fat with carbs', () => {
    expect(suggestCarbs(2200, 160, 60)).toEqual({
      kind: 'carbs',
      carbsG: 255,
      remainingCalories: 1020,
    });
  });

  it('says when protein and fat alone pass the calorie target, rather than suggesting zero', () => {
    expect(suggestCarbs(1500, 200, 100)).toEqual({
      kind: 'conflict',
      proteinFatCalories: 1700,
      overBy: 200,
    });
  });

  it('suggests no carbs when protein and fat use the calories exactly', () => {
    expect(suggestCarbs(1180, 160, 60)).toEqual({ kind: 'carbs', carbsG: 0, remainingCalories: 0 });
  });
});

describe('caloriesFromMacros', () => {
  it('counts 4 per gram of protein and carbs, 9 per gram of fat', () => {
    expect(caloriesFromMacros(160, 255, 60)).toBe(2200);
    expect(macroCalorieDifference(2200, 160, 250, 60)).toBe(-20);
    expect(macroCalorieDifference(2000, 160, 255, 60)).toBe(200);
  });
});

describe('the target draft', () => {
  const empty: TargetDraft = {
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    carbsFollow: true,
  };

  it('fills carbs in as calories, protein and fat are set, while they follow', () => {
    let draft = editDraft(empty, 'calories', '2200');
    draft = editDraft(draft, 'proteinG', '160');
    expect(draft.carbsG).toBe('');
    draft = editDraft(draft, 'fatG', '60');
    expect(draft.carbsG).toBe('255');
    draft = editDraft(draft, 'calories', '2000');
    expect(draft.carbsG).toBe('205');
  });

  it('keeps carbs the person typed, whatever else changes', () => {
    let draft = editDraft(empty, 'calories', '2200');
    draft = editDraft(draft, 'proteinG', '160');
    draft = editDraft(draft, 'fatG', '60');
    draft = editDraft(draft, 'carbsG', '230');
    expect(draft.carbsFollow).toBe(false);
    draft = editDraft(draft, 'calories', '2400');
    expect(draft.carbsG).toBe('230');
    // ...until they take the suggestion again.
    draft = takeSuggestedCarbs(draft);
    expect(draft).toMatchObject({ carbsG: '305', carbsFollow: true });
  });

  it("doesn't move carbs while protein and fat pass the calories", () => {
    let draft = editDraft(empty, 'calories', '2200');
    draft = editDraft(draft, 'proteinG', '160');
    draft = editDraft(draft, 'fatG', '60');
    draft = editDraft(draft, 'calories', '1000');
    expect(draft.carbsG).toBe('255');
  });

  it("reads saved carbs as following when they match, and as the person's own when not", () => {
    expect(
      draftFromTargets({ calories: 2200, proteinG: 160, carbsG: 255, fatG: 60 }).carbsFollow,
    ).toBe(true);
    expect(
      draftFromTargets({ calories: 2200, proteinG: 160, carbsG: 200, fatG: 60 }).carbsFollow,
    ).toBe(false);
    // No carb target, but everything to work one out: kept as no target, suggested beside it.
    expect(
      draftFromTargets({ calories: 2200, proteinG: 160, carbsG: null, fatG: 60 }),
    ).toMatchObject({
      carbsG: '',
      carbsFollow: false,
    });
    // Nothing set yet: carbs fill in as the rest is set.
    expect(
      draftFromTargets({ calories: null, proteinG: null, carbsG: null, fatG: null }).carbsFollow,
    ).toBe(true);
  });

  it('parses blank as no target, and flags what is not a positive number', () => {
    expect(
      parseTargets({
        calories: '2200',
        proteinG: '',
        carbsG: '255.5',
        fatG: '0',
        carbsFollow: false,
      }),
    ).toEqual({
      values: { calories: 2200, proteinG: null, carbsG: 255.5, fatG: null },
      errors: { fatG: 'Enter grams above 0, or leave it blank' },
    });
    expect(parseTargets({ ...empty, calories: '2200.5' }).errors.calories).toBe(
      'Enter whole calories, above 0',
    );
  });
});
