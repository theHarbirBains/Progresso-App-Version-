import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import {
  NEARBY_RADIUS_METERS,
  formatDistance,
  gymSearchAvailable,
  nearbyGyms,
  sameGym,
  searchGyms,
  toGymPlace,
} from './gymSearch';

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn() }));
const optionalModule = requireOptionalNativeModule as jest.Mock;

const native = {
  nearby: jest.fn(),
  search: jest.fn(),
};

beforeEach(() => {
  optionalModule.mockReset().mockReturnValue(native);
  native.nearby.mockReset();
  native.search.mockReset();
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
});

describe('searching Apple Maps for gyms', () => {
  it('is there only on iPhone, in a build with it', () => {
    expect(gymSearchAvailable()).toBe(true);
    optionalModule.mockReturnValue(null);
    expect(gymSearchAvailable()).toBe(false);
    optionalModule.mockReturnValue(native);
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    expect(gymSearchAvailable()).toBe(false);
  });

  it('finds gyms near a point, 5 km around it', async () => {
    native.nearby.mockResolvedValue([
      {
        name: 'Fit4Less Downtown',
        address: '123 Main St, Vancouver, BC',
        latitude: 49.28,
        longitude: -123.12,
        distanceMeters: 420,
        placeId: 'I123',
      },
    ]);

    await expect(nearbyGyms({ latitude: 49.27, longitude: -123.1 })).resolves.toEqual([
      {
        name: 'Fit4Less Downtown',
        address: '123 Main St, Vancouver, BC',
        latitude: 49.28,
        longitude: -123.12,
        distanceMeters: 420,
        placeId: 'I123',
      },
    ]);
    expect(native.nearby).toHaveBeenCalledWith(49.27, -123.1, NEARBY_RADIUS_METERS);
    expect(NEARBY_RADIUS_METERS).toBe(8000);
  });

  it('searches by name, near the phone when it knows where that is -- never for a letter', async () => {
    native.search.mockResolvedValue([{ name: 'Iron Den', address: '' }]);
    await expect(searchGyms('Iron', null)).resolves.toEqual([
      { name: 'Iron Den', address: '', latitude: null, longitude: null },
    ]);
    expect(native.search).toHaveBeenCalledWith('Iron', null, null);

    await searchGyms(' iron den ', { latitude: 1, longitude: 2 });
    expect(native.search).toHaveBeenLastCalledWith('iron den', 1, 2);

    native.search.mockClear();
    await expect(searchGyms('I', null)).resolves.toEqual([]);
    expect(native.search).not.toHaveBeenCalled();
  });

  it('keeps only well-formed gyms: a name, and both coordinates or neither', () => {
    expect(toGymPlace({ address: 'Nowhere' })).toBeNull();
    expect(toGymPlace({ name: '  ' })).toBeNull();
    expect(toGymPlace({ name: 'Gym', latitude: 1, longitude: Number.NaN })).toEqual({
      name: 'Gym',
      address: '',
      latitude: null,
      longitude: null,
    });
  });

  it('says how far in kilometres, as the app does everywhere', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(1240)).toBe('1.2 km');
    expect(formatDistance(12_600)).toBe('13 km');
  });

  it("tells one gym from another by Apple's id, else its name and address", () => {
    const a = { name: 'Fit4Less', address: '1 Main St', placeId: 'A' };
    expect(sameGym(a, { ...a, placeId: 'B' })).toBe(false);
    expect(
      sameGym(
        { name: 'fit4less ', address: '1 main st' },
        { name: 'Fit4Less', address: '1 Main St' },
      ),
    ).toBe(true);
    expect(sameGym(a, { name: 'Fit4Less', address: '9 Elm St' })).toBe(false);
  });
});
