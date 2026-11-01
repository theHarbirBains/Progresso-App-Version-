import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddClientDto } from './dto/add-client.dto';
import { TrackClientDto } from './dto/track-client.dto';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';

// The three client forms share their details (ClientDetailsDto); each checks them, and its own
// fields, under the API's validation pipe, which rejects unknown fields.
async function errorsFor(
  dto: new () => object,
  payload: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(dto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property).sort();
}

const details = {
  birthday: '1990-04-02',
  heightValue: 180,
  heightUnit: 'cm',
  weightValue: 80,
  weightUnit: 'kg',
};

describe.each([
  ['AddClientDto', AddClientDto, { email: 'sam@example.com' }],
  ['TrackClientDto', TrackClientDto, { displayName: 'Sam' }],
  ['UpdateClientProfileDto', UpdateClientProfileDto, {}],
] as const)('%s', (_, dto, own) => {
  it('accepts the details', async () => {
    expect(await errorsFor(dto, { ...own, ...details })).toEqual([]);
  });

  it('checks each detail', async () => {
    expect(
      await errorsFor(dto, {
        ...own,
        birthday: 'soon',
        heightValue: 0,
        heightUnit: 'in',
        weightValue: 1001,
        weightUnit: 'st',
      }),
    ).toEqual(['birthday', 'heightUnit', 'heightValue', 'weightUnit', 'weightValue']);
  });

  it('rejects a field it does not take', async () => {
    expect(await errorsFor(dto, { ...own, role: 'admin' })).toEqual(['role']);
  });
});

describe('TrackClientDto', () => {
  it('needs a name', async () => {
    expect(await errorsFor(TrackClientDto, details)).toEqual(['displayName']);
  });
});

describe('UpdateClientProfileDto and AddClientDto', () => {
  it('take a name as optional', async () => {
    expect(await errorsFor(UpdateClientProfileDto, details)).toEqual([]);
    expect(await errorsFor(AddClientDto, { username: 'sam_lifts' })).toEqual([]);
  });
});
