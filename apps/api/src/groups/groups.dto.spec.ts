import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGroupDto } from './dto/groups.dto';

// The payloads the app actually sends when a group is started. The API's validation
// pipe rejects unknown fields, so each must pass this check.
async function errorsFor(payload: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreateGroupDto, payload);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((error) => error.property);
}

describe('CreateGroupDto as the app sends it', () => {
  it('accepts a group started on a split day', async () => {
    expect(
      await errorsFor({ name: 'Push', splitDayId: '99999999-9999-4999-8999-999999999999' }),
    ).toEqual([]);
  });

  it('accepts a group started outside the split, by name', async () => {
    expect(await errorsFor({ name: 'Arms', workoutName: 'Arms' })).toEqual([]);
  });

  it('accepts a group started from an open workout', async () => {
    expect(
      await errorsFor({ name: 'Legs', workoutId: '66666666-6666-4666-8666-666666666666' }),
    ).toEqual([]);
  });
});
