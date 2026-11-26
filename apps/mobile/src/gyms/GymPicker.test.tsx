import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { locationAllowed, phonePosition } from './gymLocation';
import { GymPicker, mapRegion } from './GymPicker';
import { gymSearchAvailable, nearbyGyms, searchGyms } from './gymSearch';
import { fetchRecentGyms } from './workoutGyms';

jest.mock('./gymLocation', () => ({
  phonePosition: jest.fn(),
  locationAllowed: jest.fn(async () => false),
}));
jest.mock('./gymSearch', () => ({
  ...jest.requireActual('./gymSearch'),
  gymSearchAvailable: jest.fn(() => true),
  nearbyGyms: jest.fn(),
  searchGyms: jest.fn(),
}));

const mockPosition = phonePosition as jest.Mock;
const mockAllowed = locationAllowed as jest.Mock;
const mockNearby = nearbyGyms as jest.Mock;
const mockSearch = searchGyms as jest.Mock;
const mockAvailable = gymSearchAvailable as jest.Mock;
const mockRecent = fetchRecentGyms as jest.Mock;

const downtown = {
  name: 'Fit4Less Downtown',
  address: '123 Main St, Vancouver, BC',
  latitude: 49.28,
  longitude: -123.12,
  distanceMeters: 420,
};
const kits = {
  name: 'Kits Iron',
  address: '9 4th Ave, Vancouver, BC',
  latitude: 49.27,
  longitude: -123.16,
  distanceMeters: 2300,
};

const onConfirm = jest.fn();
const onRemove = jest.fn();
const onClose = jest.fn();

function renderPicker(current: Parameters<typeof GymPicker>[0]['current'] = null) {
  return render(
    <GymPicker
      visible
      userId="user-1"
      current={current}
      onClose={onClose}
      onConfirm={onConfirm}
      onRemove={onRemove}
      accentColor="#EBC27C"
      onAccentColor="#1A1206"
    />,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockAvailable.mockReturnValue(true);
  mockPosition.mockReset();
  mockAllowed.mockReset().mockResolvedValue(false);
  mockNearby.mockReset();
  mockSearch.mockReset();
  mockRecent.mockReset().mockResolvedValue([]);
  onConfirm.mockClear();
  onRemove.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GymPicker', () => {
  it('finds gyms near you only when asked, on a map and a list -- choosing none for you', async () => {
    mockPosition.mockResolvedValue({
      status: 'found',
      coordinates: { latitude: 49.27, longitude: -123.1 },
    });
    mockNearby.mockResolvedValue([downtown, kits]);
    renderPicker();
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockPosition).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByTestId('gym-picker-nearby'));
    });
    // Asked for location, as the button was tapped.
    expect(mockPosition).toHaveBeenCalledWith({ ask: true });

    expect(screen.getByTestId('gym-picker-map')).toBeTruthy();
    expect(screen.getByTestId('gym-picker-nearby-0')).toHaveTextContent(
      /Fit4Less Downtown.*123 Main St, Vancouver, BC.*420 m/,
    );
    expect(screen.getByTestId('gym-picker-nearby-1')).toHaveTextContent(/Kits Iron.*2\.3 km/);
    // Nothing chosen for them: Confirm waits for a tap.
    expect(screen.getByTestId('gym-picker-confirm').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(screen.getByTestId('gym-picker-nearby-1'));
    expect(screen.getByTestId('gym-picker-chosen')).toHaveTextContent(/Kits Iron/);
    fireEvent.press(screen.getByTestId('gym-picker-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(kits);
  });

  it('searches Apple Maps as a name is typed, near you once it knows where that is', async () => {
    mockSearch.mockResolvedValue([downtown]);
    renderPicker();

    fireEvent.changeText(screen.getByTestId('gym-picker-search'), 'Fit4');
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(mockSearch).toHaveBeenCalledWith('Fit4', null);
    expect(screen.getByTestId('gym-picker-results-0')).toHaveTextContent(/Fit4Less Downtown/);
  });

  it('says how to search instead when location is off', async () => {
    mockPosition.mockResolvedValue({ status: 'denied' });
    renderPicker();
    await act(async () => {
      fireEvent.press(screen.getByTestId('gym-picker-nearby'));
    });

    expect(screen.getByTestId('gym-picker-denied')).toHaveTextContent(
      /Location is off for Progresso, so search for your gym by name/,
    );
    expect(mockNearby).not.toHaveBeenCalled();
  });

  it('offers the gyms trained at lately, the one chosen already ticked, with Remove', async () => {
    mockRecent.mockResolvedValue([downtown, kits]);
    renderPicker(downtown);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('gym-picker-recent-0').props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(screen.getByTestId('gym-picker-remove'));
    expect(onRemove).toHaveBeenCalled();
  });

  it("uses what's typed as the gym's name where Apple Maps can't be searched", async () => {
    mockAvailable.mockReturnValue(false);
    renderPicker();

    expect(screen.getByTestId('gym-picker-no-maps')).toBeTruthy();
    expect(screen.queryByTestId('gym-picker-nearby')).toBeNull();
    fireEvent.changeText(screen.getByTestId('gym-picker-search'), 'Garage Gym');
    fireEvent.press(screen.getByTestId('gym-picker-typed'));
    fireEvent.press(screen.getByTestId('gym-picker-confirm'));

    expect(onConfirm).toHaveBeenCalledWith({
      name: 'Garage Gym',
      address: '',
      latitude: null,
      longitude: null,
    });
  });

  it("offers what's typed when Apple Maps finds nothing for it", async () => {
    mockSearch.mockResolvedValue([]);
    renderPicker();
    fireEvent.changeText(screen.getByTestId('gym-picker-search'), 'Basement Barbell');
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByTestId('gym-picker-none')).toHaveTextContent(
      'No gyms found for "Basement Barbell".',
    );
    expect(screen.getByTestId('gym-picker-typed')).toHaveTextContent(/Use "Basement Barbell"/);
  });

  it('lists every gym near you as it opens where location is allowed already -- never asking', async () => {
    mockAllowed.mockResolvedValue(true);
    mockPosition.mockResolvedValue({
      status: 'found',
      coordinates: { latitude: 49.27, longitude: -123.1 },
    });
    mockNearby.mockResolvedValue([downtown, kits]);
    renderPicker();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPosition).toHaveBeenCalledWith({ ask: false });
    expect(screen.queryByTestId('gym-picker-nearby')).toBeNull();
    expect(screen.getByTestId('gym-picker-nearby-list')).toBeTruthy();
    expect(screen.getByText(/Near You · 2 gyms/i)).toBeTruthy();
    expect(screen.getByTestId('gym-picker-map')).toBeTruthy();
    // One tap chooses one; Confirm saves it.
    fireEvent.press(screen.getByTestId('gym-picker-nearby-0'));
    fireEvent.press(screen.getByTestId('gym-picker-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(downtown);
  });
});

describe('mapRegion', () => {
  it('fits every gym and the phone, with room at the edges', () => {
    const region = mapRegion([downtown, kits], { latitude: 49.26, longitude: -123.1 })!;
    expect(region.latitude).toBeCloseTo(49.27, 2);
    expect(region.latitudeDelta).toBeCloseTo(0.026, 3);
    expect(region.longitudeDelta).toBeCloseTo(0.078, 3);
  });

  it('never zooms in closer than a few streets, and is nothing with nothing to show', () => {
    expect(mapRegion([downtown], null)!.latitudeDelta).toBe(0.012);
    expect(mapRegion([], null)).toBeNull();
  });
});
