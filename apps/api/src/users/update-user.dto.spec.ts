import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './dto/update-user.dto';

// Checked the way the API's validation pipe checks it, unknown fields rejected.
async function errorsFor(payload: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdateUserDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property).sort();
}

describe('UpdateUserDto -- fitness goals and membership tier', () => {
  it('takes up to three different, known fitness goals', async () => {
    expect(await errorsFor({ fitnessGoals: [] })).toEqual([]);
    expect(await errorsFor({ fitnessGoals: ['lose_fat', 'get_stronger', 'other'] })).toEqual([]);
  });

  it('refuses more than three goals, a repeat, or one it does not know', async () => {
    expect(
      await errorsFor({ fitnessGoals: ['lose_fat', 'get_stronger', 'other', 'general_health'] }),
    ).toEqual(['fitnessGoals']);
    expect(await errorsFor({ fitnessGoals: ['lose_fat', 'lose_fat'] })).toEqual(['fitnessGoals']);
    expect(await errorsFor({ fitnessGoals: ['get_ripped'] })).toEqual(['fitnessGoals']);
    expect(await errorsFor({ fitnessGoals: 'lose_fat' })).toEqual(['fitnessGoals']);
  });

  it('still takes the one goal older app versions send', async () => {
    expect(await errorsFor({ fitnessGoal: 'build_muscle' })).toEqual([]);
  });

  it('takes one of the three membership tiers', async () => {
    for (const membershipTier of ['workouts', 'workouts_nutrition', 'everything']) {
      expect(await errorsFor({ membershipTier })).toEqual([]);
    }
    expect(await errorsFor({ membershipTier: 'platinum' })).toEqual(['membershipTier']);
  });
});
