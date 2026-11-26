import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { phonePosition } from './gymLocation';
import { GymPicker } from './GymPicker';
import { gymSearchAvailable, nearbyGyms, searchGyms } from './gymSearch';
import { fetchRecentGyms } from './workoutGyms';

jest.mock('./gymLocation', () => ({ phonePosition: jest.fn() }));
jest.mock('./gymSearch', () => ({
  ...jest.requireActual('./gymSearch'),
  gymSearchAvailable: jest.fn(() => true),
  nearbyGyms: jest.fn(),
  searchGyms: jest.fn(),
}));

const mockPosition = phonePosition as jest.Mock;
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
});
