import type { PropsWithChildren } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { getFoodByBarcode, getMyProfile } from '../lib/api';
import { fetchTodaysFoodLogs, logFood } from '../nutrition/foodLogQueries';
import { FoodLogProvider } from '../nutrition/FoodLogProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { BarcodeScannerScreen } from './BarcodeScannerScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  getFoodByBarcode: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  logFood: jest.fn(),
  fetchTodaysFoodLogs: jest.fn(),
}));

function TestProviders({ children }: PropsWithChildren) {
  return (
    <ProfileProvider>
      <FoodLogProvider>{children}</FoodLogProvider>
    </ProfileProvider>
  );
}

// Captures whatever CameraView is currently rendered with, so a test can
// simulate a scan by calling capturedProps().onBarcodeScanned(...) directly
// -- there's no real camera/touch event to fire in this environment.
let capturedCameraProps: Record<string, unknown> | undefined;
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = {
  granted: true,
  canAskAgain: true,
};
const mockRequestPermission = jest.fn();

jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  const ReactActual = require('react');
  return {
    CameraView: (props: Record<string, unknown>) => {
      capturedCameraProps = props;
      return ReactActual.createElement(View, { testID: props.testID });
    },
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockGetFoodByBarcode = getFoodByBarcode as jest.Mock;
const mockLogFood = logFood as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };
const route = {} as never;

const baseProfile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: null,
  username: null,
  weightUnit: 'kg' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
  activeWorkoutSplitId: null,
};

const oreo = {
  id: 'food-2',
  name: 'Oreo Original',
  brand: 'Oreo',
  servingSize: 34,
  servingUnit: 'g',
  calories: 160,
  proteinG: 1.6,
  carbsG: 25,
  fatG: null,
  provider: 'open_food_facts',
  barcode: '0066721016123',
};

async function scan(barcode = '0066721016123') {
  await act(async () => {
    (capturedCameraProps?.onBarcodeScanned as (r: { data: string; type: string }) => void)?.({
      data: barcode,
      type: 'ean13',
    });
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockGetFoodByBarcode.mockReset().mockResolvedValue(null);
  mockLogFood.mockReset();
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockGoBack.mockClear();
  mockNavigate.mockClear();
  mockRequestPermission.mockClear();
  mockPermission = { granted: true, canAskAgain: true };
  capturedCameraProps = undefined;
  jest.spyOn(Linking, 'openSettings').mockImplementation(() => Promise.resolve());
});

describe('BarcodeScannerScreen permission states', () => {
  it('shows a loading state while permission status is still resolving', () => {
    mockPermission = null;
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    expect(screen.getByTestId('barcode-scanner-permission-loading')).toBeTruthy();
  });

  it('shows the live camera once permission is granted', async () => {
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    expect(await screen.findByTestId('barcode-scanner-camera')).toBeTruthy();
  });

  it('offers to request permission when not yet granted but can still ask', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    expect(await screen.findByTestId('barcode-scanner-permission-denied')).toBeTruthy();
    expect(screen.getByTestId('barcode-scanner-request-permission')).toBeTruthy();
    expect(screen.queryByTestId('barcode-scanner-open-settings')).toBeNull();

    fireEvent.press(screen.getByTestId('barcode-scanner-request-permission'));
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('offers to open Settings when permission was previously denied and cannot be asked again', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    expect(await screen.findByTestId('barcode-scanner-open-settings')).toBeTruthy();
    expect(screen.queryByTestId('barcode-scanner-request-permission')).toBeNull();

    fireEvent.press(screen.getByTestId('barcode-scanner-open-settings'));
    expect(Linking.openSettings).toHaveBeenCalled();
  });

  it('always offers a manual search fallback when the camera is unavailable', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-permission-denied');

    fireEvent.press(screen.getByTestId('barcode-scanner-search-instead'));

    expect(mockNavigate).toHaveBeenCalledWith('FoodSearch');
  });
});

describe('BarcodeScannerScreen scan -> lookup flow', () => {
  it('looks up the scanned barcode via the backend and shows the found product', async () => {
    mockGetFoodByBarcode.mockResolvedValue(oreo);
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');

    await scan('0066721016123');

    expect(mockGetFoodByBarcode).toHaveBeenCalledWith('token-123', '0066721016123');
    expect(await screen.findByTestId('barcode-scanner-found-header')).toHaveTextContent(
      /Oreo Original/,
    );
    expect(screen.getByTestId('barcode-scanner-calories')).toHaveTextContent(/160/);
  });

  it('ignores further scans while a lookup is already in flight', async () => {
    let resolveLookup: (value: typeof oreo) => void = () => {};
    mockGetFoodByBarcode.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');

    await scan('0066721016123');
    await scan('0066721016123');

    expect(mockGetFoodByBarcode).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLookup(oreo);
      await Promise.resolve();
    });
  });

  it('shows a friendly "Product not found" state, never a technical error, when the barcode has no match', async () => {
    mockGetFoodByBarcode.mockResolvedValue(null);
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');

    await scan('0000000000000');

    expect(await screen.findByTestId('barcode-scanner-not-found')).toHaveTextContent(
      /Product not found/,
    );
    expect(screen.queryByTestId('barcode-scanner-error')).toBeNull();
  });

  it('lets the user scan again from the not-found state', async () => {
    mockGetFoodByBarcode.mockResolvedValue(null);
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');
    await scan('0000000000000');
    await screen.findByTestId('barcode-scanner-not-found');

    fireEvent.press(screen.getByTestId('barcode-scanner-scan-again'));

    expect(await screen.findByTestId('barcode-scanner-camera')).toBeTruthy();

    // A fresh scan after "Scan Again" must look up again, not be silently
    // dropped by the same-scan guard.
    mockGetFoodByBarcode.mockResolvedValue(oreo);
    await scan('0066721016123');
    expect(mockGetFoodByBarcode).toHaveBeenLastCalledWith('token-123', '0066721016123');
  });

  it('opens manual entry, carrying the scanned barcode, from the not-found state', async () => {
    mockGetFoodByBarcode.mockResolvedValue(null);
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');
    await scan('0000000000000');
    await screen.findByTestId('barcode-scanner-not-found');

    fireEvent.press(screen.getByTestId('barcode-scanner-create-custom'));

    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary', {
      openCreate: true,
      barcode: '0000000000000',
    });
  });

  it('shows a real error state (distinct from not-found) when the lookup itself fails, with a working retry', async () => {
    mockGetFoodByBarcode.mockRejectedValueOnce(new Error('network down'));
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');

    await scan('0066721016123');

    expect(await screen.findByTestId('barcode-scanner-error')).toHaveTextContent('network down');
    expect(screen.queryByTestId('barcode-scanner-not-found')).toBeNull();

    mockGetFoodByBarcode.mockResolvedValueOnce(oreo);
    await act(async () => {
      fireEvent.press(screen.getByTestId('barcode-scanner-error-retry'));
      await Promise.resolve();
    });

    expect(await screen.findByTestId('barcode-scanner-found-header')).toBeTruthy();
  });
});

describe('BarcodeScannerScreen logging', () => {
  it('logs the found product via the shared LogFoodStep, then navigates to the daily log', async () => {
    mockGetFoodByBarcode.mockResolvedValue(oreo);
    mockLogFood.mockResolvedValue({});
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');
    await scan('0066721016123');
    await screen.findByTestId('barcode-scanner-found-header');

    fireEvent.press(screen.getByTestId('barcode-scanner-log-button'));
    expect(await screen.findByTestId('log-food-quantity')).toHaveProp('value', '1');

    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      {
        id: 'food-2',
        name: 'Oreo Original',
        servingSize: 34,
        servingUnit: 'g',
        calories: 160,
        proteinG: 1.6,
        carbsG: 25,
        fatG: 0,
      },
      1,
      // Time-of-day default (see defaultMealTypeForTime) -- any valid meal.
      expect.stringMatching(/^(breakfast|lunch|dinner|snack)$/),
    );
    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('credits Open Food Facts on the found product, matching Search Food and Food Library', async () => {
    mockGetFoodByBarcode.mockResolvedValue(oreo);
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');
    await scan('0066721016123');

    expect(await screen.findByTestId('barcode-scanner-attribution')).toHaveTextContent(
      /Open Food Facts/,
    );
  });
});

describe('BarcodeScannerScreen -- one primary action per state', () => {
  it('shows the found product as the shared fact widgets and one filled button', async () => {
    mockGetFoodByBarcode.mockResolvedValue(oreo);
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');
    await scan();

    await screen.findByTestId('barcode-scanner-found-header');
    expect(screen.getByTestId('barcode-scanner-serving')).toHaveTextContent('Serving: 34 g');
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(2);
    expectNoBareText();
  });

  it('on not-found, makes Enter Manually the one filled button, with Scan Again and Search Food outlined', async () => {
    mockGetFoodByBarcode.mockResolvedValue(null);
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');
    await scan('0000000000000');
    await screen.findByTestId('barcode-scanner-not-found');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expect(screen.getByTestId('barcode-scanner-create-custom')).toHaveTextContent('Enter Manually');
    for (const id of ['barcode-scanner-scan-again', 'barcode-scanner-search-food']) {
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style).borderWidth).toBe(1);
    }
    expect(
      screen.getByText("We couldn't find a match for that barcode in our database."),
    ).toBeTruthy();
    // Two widgets: what happened, and what to do about it.
    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(2);
    expectNoBareText();
  });

  it('shows which barcode had no match, so it can be checked against the packaging', async () => {
    mockGetFoodByBarcode.mockResolvedValue(null);
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');
    await scan('0012345678905');

    expect(await screen.findByTestId('barcode-scanner-not-found-code')).toHaveTextContent(
      '0012345678905',
    );
  });

  it('renders no bare text on the camera and permission states', async () => {
    const { unmount } = render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-camera');
    expectNoBareText();
    unmount();

    mockPermission = { granted: false, canAskAgain: true };
    render(<BarcodeScannerScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('barcode-scanner-permission-denied');
    expectNoBareText();
  });
});
