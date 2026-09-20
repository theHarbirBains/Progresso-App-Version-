import {
  AGGRESSIVE_DEFICIT_DELTA,
  buildCalorieProfileInput,
  computeBMR,
  computeCalorieTargets,
  computeMaintenanceCalories,
  DEFICIT_DELTA,
  SURPLUS_DELTA,
} from './calorieTargets';

describe('computeBMR', () => {
  it('computes the Mifflin-St Jeor BMR for a male', () => {
    // 10*80 + 6.25*180 - 5*24 + 5 = 800 + 1125 - 120 + 5 = 1810
    expect(computeBMR({ gender: 'male', age: 24, heightCm: 180, weightKg: 80 })).toBe(1810);
  });

  it('computes the Mifflin-St Jeor BMR for a female', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    expect(computeBMR({ gender: 'female', age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(
      1320.25,
    );
  });
});

describe('computeMaintenanceCalories', () => {
  it('applies the activity multiplier for the given tier', () => {
    const bmr = computeBMR({ gender: 'male', age: 24, heightCm: 180, weightKg: 80 });
    expect(
      computeMaintenanceCalories({
        gender: 'male',
        age: 24,
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'sedentary',
      }),
    ).toBe(Math.round(bmr * 1.2));
    expect(
      computeMaintenanceCalories({
        gender: 'male',
        age: 24,
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'extra_active',
      }),
    ).toBe(Math.round(bmr * 1.9));
  });
});

describe('computeCalorieTargets', () => {
  it('derives surplus/deficit/aggressive deficit from real maintenance, never hardcoded', () => {
    const input = {
      gender: 'male' as const,
      age: 24,
      heightCm: 180,
      weightKg: 78.1,
      activityLevel: 'moderately_active' as const,
    };
    const maintenance = computeMaintenanceCalories(input);

    expect(computeCalorieTargets(input)).toEqual({
      maintenance,
      surplus: maintenance + SURPLUS_DELTA,
      deficit: maintenance - DEFICIT_DELTA,
      aggressiveDeficit: maintenance - AGGRESSIVE_DEFICIT_DELTA,
    });
  });
});

describe('buildCalorieProfileInput', () => {
  const now = new Date('2026-09-17T00:00:00Z');
  const completeProfile = {
    gender: 'male' as const,
    birthday: '2002-01-01',
    heightCm: 180,
    weightKg: 78,
    activityLevel: 'moderately_active' as const,
  };

  it('builds real formula input from a complete profile', () => {
    expect(buildCalorieProfileInput(completeProfile, now)).toEqual({
      gender: 'male',
      age: 24,
      heightCm: 180,
      weightKg: 78,
      activityLevel: 'moderately_active',
    });
  });

  it('returns null when gender is unset', () => {
    expect(buildCalorieProfileInput({ ...completeProfile, gender: null }, now)).toBeNull();
  });

  it('returns null for a gender Mifflin-St Jeor does not support -- never guesses', () => {
    expect(buildCalorieProfileInput({ ...completeProfile, gender: 'other' }, now)).toBeNull();
    expect(
      buildCalorieProfileInput({ ...completeProfile, gender: 'prefer_not_to_say' }, now),
    ).toBeNull();
  });

  it('returns null when birthday is unset', () => {
    expect(buildCalorieProfileInput({ ...completeProfile, birthday: null }, now)).toBeNull();
  });

  it('returns null when height or weight is unset', () => {
    expect(buildCalorieProfileInput({ ...completeProfile, heightCm: null }, now)).toBeNull();
    expect(buildCalorieProfileInput({ ...completeProfile, weightKg: null }, now)).toBeNull();
  });

  it('returns null when activity level is unset', () => {
    expect(buildCalorieProfileInput({ ...completeProfile, activityLevel: null }, now)).toBeNull();
  });
});
