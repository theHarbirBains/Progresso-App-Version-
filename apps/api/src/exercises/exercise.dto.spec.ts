import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

const base = { name: 'Seated Row', muscleGroup: 'back', movementType: 'bilateral' };

async function check(dto: new () => object, payload: Record<string, unknown>) {
  const instance = plainToInstance(dto, payload) as Record<string, unknown>;
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, errors: errors.map((error) => error.property).sort() };
}

describe("an exercise's machine details", () => {
  it('are all optional: only the name is needed', async () => {
    expect((await check(CreateExerciseDto, base)).errors).toEqual([]);
  });

  it('are trimmed, and a blank one is left out', async () => {
    const { instance, errors } = await check(CreateExerciseDto, {
      ...base,
      gym: '  Downtown ',
      feelNotes: '   ',
      attachment: 'V-handle',
    });
    expect(errors).toEqual([]);
    expect(instance).toMatchObject({ gym: 'Downtown', feelNotes: null, attachment: 'V-handle' });
  });

  it('are kept short', async () => {
    const { errors } = await check(CreateExerciseDto, {
      ...base,
      gym: 'x'.repeat(61),
      feelNotes: 'x'.repeat(301),
      attachment: 'x'.repeat(61),
    });
    expect(errors).toEqual(['attachment', 'feelNotes', 'gym']);
  });

  it('can each be changed or cleared on their own', async () => {
    const { instance, errors } = await check(UpdateExerciseDto, { gym: '', attachment: 'Rope' });
    expect(errors).toEqual([]);
    expect(instance).toMatchObject({ gym: null, attachment: 'Rope' });
  });
});
