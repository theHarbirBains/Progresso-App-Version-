import * as Location from 'expo-location';
import { countryFromLocation } from './countryFromLocation';

// jest.setup.js stands expo-location in; each test says what the phone answers.
const mocked = Location as unknown as {
  requestForegroundPermissionsAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  reverseGeocodeAsync: jest.Mock;
};

const position = { coords: { latitude: 49.28, longitude: -123.12 } };

beforeEach(() => {
  mocked.requestForegroundPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
  mocked.getLastKnownPositionAsync.mockReset().mockResolvedValue(null);
  mocked.getCurrentPositionAsync.mockReset().mockResolvedValue(position);
  mocked.reverseGeocodeAsync.mockReset().mockResolvedValue([{ isoCountryCode: 'ca' }]);
});

describe('countryFromLocation', () => {
  it('names the country the phone is in, as its two letters', async () => {
    await expect(countryFromLocation()).resolves.toEqual({ status: 'found', country: 'CA' });
    expect(mocked.reverseGeocodeAsync).toHaveBeenCalledWith({
      latitude: 49.28,
      longitude: -123.12,
    });
  });

  it('uses a recent position when the phone has one, without waiting for a new one', async () => {
    mocked.getLastKnownPositionAsync.mockResolvedValue(position);

    await expect(countryFromLocation()).resolves.toEqual({ status: 'found', country: 'CA' });
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reads nothing when it is not allowed', async () => {
    mocked.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(countryFromLocation()).resolves.toEqual({ status: 'denied' });
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(mocked.reverseGeocodeAsync).not.toHaveBeenCalled();
  });

  it('says so when no country comes back', async () => {
    mocked.reverseGeocodeAsync.mockResolvedValue([{ isoCountryCode: null }]);
    await expect(countryFromLocation()).resolves.toEqual({ status: 'unknown' });

    mocked.getCurrentPositionAsync.mockResolvedValue(null);
    await expect(countryFromLocation()).resolves.toEqual({ status: 'unknown' });
  });
});
