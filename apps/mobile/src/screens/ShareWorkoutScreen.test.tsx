import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fetchShareCardData } from '../sharing/shareCardData';
import { ShareWorkoutScreen } from './ShareWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../sharing/shareCardData', () => ({
  fetchShareCardData: jest.fn(),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchShareCardData = fetchShareCardData as jest.Mock;
const mockCaptureRef = captureRef as jest.Mock;
const mockIsAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;
const mockGetPermissionsAsync = MediaLibrary.getPermissionsAsync as jest.Mock;
const mockRequestPermissionsAsync = MediaLibrary.requestPermissionsAsync as jest.Mock;
const mockSaveToLibraryAsync = MediaLibrary.saveToLibraryAsync as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = { params: { workoutId: 'w1' } } as never;

const cardData = {
  workoutName: 'Push Day',
  performedAt: '2026-01-01T10:00:00Z',
  musclesTrained: 'Chest, Shoulders',
  durationMinutes: 45,
  topSets: [
    { exerciseName: 'Bench Press', weightKg: 110, reps: 8, prLabel: '8 Rep PR' },
    { exerciseName: 'Overhead Press', weightKg: 60, reps: 8, prLabel: null },
  ],
};

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
  });
  mockFetchShareCardData.mockReset().mockResolvedValue(cardData);
  mockCaptureRef.mockReset().mockResolvedValue('file:///tmp/share.png');
  mockIsAvailableAsync.mockReset().mockResolvedValue(true);
  mockShareAsync.mockReset().mockResolvedValue(undefined);
  mockGetPermissionsAsync.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  mockRequestPermissionsAsync.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  mockSaveToLibraryAsync.mockReset().mockResolvedValue(undefined);
  mockGoBack.mockClear();
});

describe('ShareWorkoutScreen loading and preview', () => {
  it('shows a loading indicator while fetching', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('share-workout-loading')).toBeTruthy();

    await screen.findByTestId('share-card', {}, { timeout: 5000 });
    await settle();
  });

  it('renders the workout name, date, muscles, and top sets on the card', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('share-card-workout-name')).toHaveTextContent('Push Day');
    expect(screen.getByTestId('share-card-muscles')).toHaveTextContent('Chest, Shoulders');
    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('110kg×8');
    expect(screen.getByTestId('share-card-top-set-1')).toHaveTextContent('60kg×8');
    await settle();
  });

  it('shows duration when it is non-null', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('share-card-duration')).toHaveTextContent('45 min');
    await settle();
  });

  it('hides duration when it is null', async () => {
    mockFetchShareCardData.mockResolvedValue({ ...cardData, durationMinutes: null });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    expect(screen.queryByTestId('share-card-duration')).toBeNull();
    await settle();
  });

  it('shows a PR highlight only for the exercise that actually achieved one', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />);

    const prSection = await screen.findByTestId('share-card-pr-section');
    expect(prSection).toHaveTextContent(/Bench Press.*8 Rep PR/);
    expect(prSection).not.toHaveTextContent('Overhead Press');
    await settle();
  });

  it('omits the PR section entirely for a workout with no PRs', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      topSets: cardData.topSets.map((s) => ({ ...s, prLabel: null })),
    });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    expect(screen.queryByTestId('share-card-pr-section')).toBeNull();
    await settle();
  });

  it('renders a single-exercise workout correctly', async () => {
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: [cardData.topSets[0]] });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    expect(screen.getByTestId('share-card-top-set-0')).toBeTruthy();
    expect(screen.queryByTestId('share-card-top-set-1')).toBeNull();
    await settle();
  });

  it('handles a long workout name and long exercise name without crashing', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      workoutName: 'A'.repeat(120),
      topSets: [{ exerciseName: 'B'.repeat(120), weightKg: 999, reps: 999, prLabel: null }],
    });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('share-card-workout-name')).toHaveTextContent('A'.repeat(120));
    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('999kg×999');
    await settle();
  });

  it('never renders email, user id, or nutrition information', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    const card = screen.getByTestId('share-card');
    expect(card).not.toHaveTextContent('a@example.com');
    expect(card).not.toHaveTextContent('user-1');
    expect(card).not.toHaveTextContent(/calor/i);
    expect(card).not.toHaveTextContent(/protein/i);
    await settle();
  });

  it('shows an error state with retry when loading fails', async () => {
    mockFetchShareCardData.mockRejectedValue(new Error('Only completed workouts can be shared'));

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('share-workout-load-error')).toHaveTextContent(
      'Only completed workouts can be shared',
    );

    mockFetchShareCardData.mockResolvedValue(cardData);
    fireEvent.press(screen.getByTestId('share-workout-retry'));

    expect(await screen.findByTestId('share-card-workout-name')).toBeTruthy();
    await settle();
  });

  it('goes back when Back is pressed', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-back'));

    expect(mockGoBack).toHaveBeenCalled();
    await settle();
  });
});

describe('ShareWorkoutScreen share action', () => {
  it('captures the card and opens the native share sheet', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-share'));

    await waitFor(() =>
      expect(mockShareAsync).toHaveBeenCalledWith('file:///tmp/share.png', {
        mimeType: 'image/png',
        UTI: 'public.png',
      }),
    );
    expect(mockCaptureRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1920, format: 'png' }),
    );
    await settle();
  });

  it('shows an error and does not crash when capture fails', async () => {
    mockCaptureRef.mockRejectedValue(new Error('capture failed'));

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-share'));

    expect(await screen.findByTestId('share-workout-share-error')).toHaveTextContent(
      'capture failed',
    );
    // The already-loaded workout data must survive a share failure.
    expect(screen.getByTestId('share-card-workout-name')).toHaveTextContent('Push Day');
    await settle();
  });

  it('allows retrying after a share failure', async () => {
    mockCaptureRef.mockRejectedValueOnce(new Error('capture failed'));

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-share'));
    await screen.findByTestId('share-workout-share-error');

    fireEvent.press(screen.getByTestId('share-workout-share'));

    await waitFor(() => expect(mockShareAsync).toHaveBeenCalled());
    expect(screen.queryByTestId('share-workout-share-error')).toBeNull();
    await settle();
  });
});

describe('ShareWorkoutScreen save action', () => {
  it('saves the captured image to the device after granted permission', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    expect(await screen.findByTestId('share-workout-saved')).toBeTruthy();
    expect(mockSaveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/share.png');
    await settle();
  });

  it('requests permission when not already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    await waitFor(() => expect(mockRequestPermissionsAsync).toHaveBeenCalledWith(true));
    expect(await screen.findByTestId('share-workout-saved')).toBeTruthy();
    await settle();
  });

  it('handles permission denial gracefully without crashing', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    expect(await screen.findByTestId('share-workout-save-error')).toHaveTextContent(
      'Permission to save photos was denied.',
    );
    expect(mockSaveToLibraryAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('share-card-workout-name')).toHaveTextContent('Push Day');
    await settle();
  });

  it('does not re-prompt when permission cannot be asked again', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    await screen.findByTestId('share-workout-save-error');
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    await settle();
  });
});
