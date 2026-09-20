import {
  ACTIVITY_LEVELS,
  ageFromBirthday,
  isCalorieEstimationInputValid,
  MAX_AGE,
  MIN_AGE,
  validateCalorieEstimationInput,
} from './calorieEstimationInput';

describe('ACTIVITY_LEVELS', () => {
  it('has exactly the 5 specified tiers, in order, with the exact labels/descriptions', () => {
    expect(ACTIVITY_LEVELS).toEqual([
      { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
      {
        value: 'lightly_active',
        label: 'Lightly active',
        description: 'Light exercise 1-3 days/week',
      },
      {
        value: 'moderately_active',
        label: 'Moderately active',
        description: 'Moderate exercise 3-5 days/week',
      },
      { value: 'very_active', label: 'Very active', description: 'Hard exercise 6-7 days/week' },
      {
        value: 'extra_active',
        label: 'Extra active',
        description: 'Very hard exercise + physical job',
      },
    ]);
  });
});

describe('ageFromBirthday', () => {
  // `now` is always a local-time Date (never an ISO string) so these assertions
  // don't depend on the machine's timezone -- ageFromBirthday itself parses
  // the birthday argument as plain Y-M-D components for the same reason.
  const now = new Date(2026, 5, 1); // June 1, 2026

  it("returns the age when this year's birthday has already passed", () => {
    expect(ageFromBirthday('2000-01-15', now)).toBe(26);
  });

  it("returns one less than the year difference when this year's birthday hasn't happened yet", () => {
    expect(ageFromBirthday('2000-12-15', now)).toBe(25);
  });

  it('returns the age exactly on the birthday itself', () => {
    expect(ageFromBirthday('2000-06-01', now)).toBe(26);
  });

  it('returns null for an unparseable birthday rather than a garbage number', () => {
    expect(ageFromBirthday('not-a-date', now)).toBeNull();
  });
});

describe('validateCalorieEstimationInput', () => {
  const validInput = { gender: 'male' as const, age: '30', activityLevel: 'sedentary' as const };

  it('has no errors for fully valid input', () => {
    expect(validateCalorieEstimationInput(validInput)).toEqual({});
    expect(isCalorieEstimationInputValid(validInput)).toBe(true);
  });

  it('requires a gender selection', () => {
    const errors = validateCalorieEstimationInput({ ...validInput, gender: null });
    expect(errors.gender).toBeDefined();
    expect(isCalorieEstimationInputValid({ ...validInput, gender: null })).toBe(false);
  });

  it('requires a non-empty age', () => {
    expect(validateCalorieEstimationInput({ ...validInput, age: '' }).age).toBeDefined();
    expect(validateCalorieEstimationInput({ ...validInput, age: '   ' }).age).toBeDefined();
  });

  it('rejects a non-numeric age', () => {
    expect(validateCalorieEstimationInput({ ...validInput, age: 'abc' }).age).toBeDefined();
    expect(validateCalorieEstimationInput({ ...validInput, age: '25.5' }).age).toBeDefined();
  });

  it(`rejects an age below ${MIN_AGE} or above ${MAX_AGE}`, () => {
    expect(
      validateCalorieEstimationInput({ ...validInput, age: String(MIN_AGE - 1) }).age,
    ).toBeDefined();
    expect(
      validateCalorieEstimationInput({ ...validInput, age: String(MAX_AGE + 1) }).age,
    ).toBeDefined();
  });

  it(`accepts the boundary ages ${MIN_AGE} and ${MAX_AGE}`, () => {
    expect(
      validateCalorieEstimationInput({ ...validInput, age: String(MIN_AGE) }).age,
    ).toBeUndefined();
    expect(
      validateCalorieEstimationInput({ ...validInput, age: String(MAX_AGE) }).age,
    ).toBeUndefined();
  });

  it('requires an activity level selection', () => {
    const errors = validateCalorieEstimationInput({ ...validInput, activityLevel: null });
    expect(errors.activityLevel).toBeDefined();
    expect(isCalorieEstimationInputValid({ ...validInput, activityLevel: null })).toBe(false);
  });
});
