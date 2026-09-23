import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { PrimaryButton } from '../design/Button';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
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
  totalSets: 9,
  totalVolumeKg: 4000,
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
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(screen.getByTestId('share-workout-loading')).toBeTruthy();

    await screen.findByTestId('share-card', {}, { timeout: 5000 });
    await settle();
  });

  it('renders the workout name, date, muscles, and top sets on the card', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('share-card-workout-name')).toHaveTextContent('Push Day');
    expect(screen.getByTestId('share-card-muscles')).toHaveTextContent('Chest, Shoulders');
    // The record is headlined; the remaining lift is listed beneath.
    expect(screen.getByTestId('share-card-pr-value-0')).toHaveTextContent('110kg×8');
    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('60kg×8');
    expect(screen.queryByTestId('share-card-top-set-1')).toBeNull();
    await settle();
  });

  it('shows duration when it is non-null', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('share-card-duration')).toHaveTextContent('45 min');
    await settle();
  });

  it('hides duration when it is null', async () => {
    mockFetchShareCardData.mockResolvedValue({ ...cardData, durationMinutes: null });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card-workout-name');

    expect(screen.queryByTestId('share-card-duration')).toBeNull();
    await settle();
  });

  it('shows a PR highlight only for the exercise that actually achieved one', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card-workout-name');

    expect(screen.queryByTestId('share-card-pr-section')).toBeNull();
    await settle();
  });

  it('renders a single-exercise workout correctly', async () => {
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: [cardData.topSets[1]] });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('share-card-workout-name')).toHaveTextContent('A'.repeat(120));
    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('999kg×999');
    await settle();
  });

  it('never renders email, user id, or nutrition information', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('share-workout-load-error')).toHaveTextContent(
      'Only completed workouts can be shared',
    );

    mockFetchShareCardData.mockResolvedValue(cardData);
    fireEvent.press(screen.getByTestId('share-workout-retry'));

    expect(await screen.findByTestId('share-card-workout-name')).toBeTruthy();
    await settle();
  });

  it('goes back when Back is pressed', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-back'));

    expect(mockGoBack).toHaveBeenCalled();
    await settle();
  });
});

describe('ShareWorkoutScreen share action', () => {
  it('captures the card and opens the native share sheet', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
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
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    expect(await screen.findByTestId('share-workout-saved')).toBeTruthy();
    expect(mockSaveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/share.png');
    await settle();
  });

  it('requests permission when not already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    await waitFor(() => expect(mockRequestPermissionsAsync).toHaveBeenCalledWith(true));
    expect(await screen.findByTestId('share-workout-saved')).toBeTruthy();
    await settle();
  });

  it('handles permission denial gracefully without crashing', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    await screen.findByTestId('share-workout-save-error');
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    await settle();
  });
});

describe('ShareWorkoutScreen -- the card, then one primary action', () => {
  it('has one filled button -- Share -- with Save to Photos as the outlined secondary', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expect(screen.getByTestId('share-workout-share')).toHaveTextContent('Share');
    const save = StyleSheet.flatten(screen.getByTestId('share-workout-save').props.style);
    expect(save.backgroundColor).toBeUndefined();
    expect(save.borderWidth).toBe(1);
    await settle();
  });

  it('draws the card from the brand palette and app typography, not hardcoded colours', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    const card = StyleSheet.flatten((await screen.findByTestId('share-card')).props.style);

    expect(card.backgroundColor).toBe(colors.background);
    expect(card.borderColor).toBe(colors.border);
    const set = StyleSheet.flatten(screen.getByTestId('share-card-top-set-0').props.style);
    expect(set.fontFamily).toBe(fonts.monoBold);
    // Personal records are the one accented block, in the user's Workout accent.
    const pr = StyleSheet.flatten(screen.getByTestId('share-card-pr-value-0').props.style);
    expect(pr.color).toBe(DEFAULT_WORKOUT_THEME.accent);
    expect(pr.fontFamily).toBe(fonts.monoBold);
    expect(within(screen.getByTestId('share-card-pr-section')).getByText(/8 Rep PR/)).toBeTruthy();
    await settle();
  });

  it('names the back control for assistive tech', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card');

    expect(screen.getByTestId('share-workout-back').props.accessibilityLabel).toBe('Back');
    await settle();
  });

  it('shows Share as busy while the card is being captured', async () => {
    mockCaptureRef.mockReturnValue(new Promise(() => undefined));
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card');

    fireEvent.press(screen.getByTestId('share-workout-share'));

    await waitFor(() =>
      expect(screen.getByTestId('share-workout-share').props.accessibilityState).toEqual({
        disabled: true,
        busy: true,
      }),
    );
  });

  it('shows the load error with a Retry button that reloads', async () => {
    mockFetchShareCardData.mockRejectedValueOnce(new Error('boom'));
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('share-workout-load-error')).toHaveTextContent('boom');
    fireEvent.press(screen.getByTestId('share-workout-retry'));

    expect(await screen.findByTestId('share-card')).toBeTruthy();
    await settle();
  });

  it('renders no bare text outside <Text>', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card');

    expectNoBareText();
    await settle();
  });
});

describe('ShareWorkoutScreen -- minimal card, formats, units, privacy, own photo', () => {
  async function ready() {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('share-card');
  }

  it('starts private: total volume is off, the date has no year, nothing personal is on the card', async () => {
    await ready();

    expect(screen.queryByTestId('share-card-volume')).toBeNull();
    expect(screen.getByTestId('share-toggle-volume').props.value).toBe(false);
    expect(screen.getByTestId('share-card-date').props.children).not.toMatch(/\d{4}/);
    const card = screen.getByTestId('share-card');
    expect(card).not.toHaveTextContent('a@example.com');
    expect(card).not.toHaveTextContent('user-1');
    await settle();
  });

  it("shows total volume in the user's unit once it is switched on", async () => {
    await ready();

    fireEvent(screen.getByTestId('share-toggle-volume'), 'valueChange', true);

    expect(screen.getByTestId('share-card-volume')).toHaveTextContent('4,000 kg');
    await settle();
  });

  it('shows every weight in pounds when the user prefers lb', async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });
    await ready();
    fireEvent(screen.getByTestId('share-toggle-volume'), 'valueChange', true);

    expect(screen.getByTestId('share-card-pr-value-0')).toHaveTextContent('242.5lb×8');
    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('132.3lb×8');
    expect(screen.getByTestId('share-card-volume')).toHaveTextContent(/lb$/);
    expect(screen.getByTestId('share-card')).not.toHaveTextContent(/\bkg\b/);
    await settle();
  });

  it('lets each block be hidden, and drops a section that has nothing left', async () => {
    await ready();

    fireEvent(screen.getByTestId('share-toggle-duration'), 'valueChange', false);
    fireEvent(screen.getByTestId('share-toggle-sets'), 'valueChange', false);
    expect(screen.queryByTestId('share-card-session')).toBeNull();

    fireEvent(screen.getByTestId('share-toggle-lifts'), 'valueChange', false);
    expect(screen.queryByTestId('share-card-lifts')).toBeNull();

    fireEvent(screen.getByTestId('share-toggle-records'), 'valueChange', false);
    expect(screen.queryByTestId('share-card-pr-section')).toBeNull();

    fireEvent(screen.getByTestId('share-toggle-date'), 'valueChange', false);
    expect(screen.queryByTestId('share-card-date')).toBeNull();
    // The workout's own name is always there.
    expect(screen.getByTestId('share-card-workout-name')).toHaveTextContent('Push Day');
    await settle();
  });

  it('lists the record lift with the others when records are hidden, so no lift is lost', async () => {
    await ready();

    fireEvent(screen.getByTestId('share-toggle-records'), 'valueChange', false);

    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('110kg×8');
    expect(screen.getByTestId('share-card-top-set-1')).toHaveTextContent('60kg×8');
    await settle();
  });

  it("captures the card at the chosen format's size: story 1080x1920, feed 1080x1350", async () => {
    await ready();

    fireEvent.press(screen.getByTestId('share-workout-share'));
    await waitFor(() => expect(mockCaptureRef).toHaveBeenCalledTimes(1));
    expect(mockCaptureRef).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1920 }),
    );

    fireEvent.press(screen.getByTestId('share-format-feed'));
    expect(
      StyleSheet.flatten(screen.getByTestId('share-card').props.style).aspectRatio,
    ).toBeCloseTo(1080 / 1350);
    fireEvent.press(screen.getByTestId('share-workout-share'));
    await waitFor(() => expect(mockCaptureRef).toHaveBeenCalledTimes(2));
    expect(mockCaptureRef).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1350 }),
    );
    await settle();
  });

  it('headlines fewer records and lifts on the shorter feed card so nothing can clip', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      topSets: [
        { exerciseName: 'A', weightKg: 100, reps: 5, prLabel: '5 Rep PR' },
        { exerciseName: 'B', weightKg: 90, reps: 5, prLabel: '5 Rep PR' },
        { exerciseName: 'C', weightKg: 80, reps: 5, prLabel: null },
        { exerciseName: 'D', weightKg: 70, reps: 5, prLabel: null },
        { exerciseName: 'E', weightKg: 60, reps: 5, prLabel: null },
      ],
    });
    await ready();
    expect(screen.getByTestId('share-card-pr-value-1')).toBeTruthy();
    expect(screen.getByTestId('share-card-top-set-2')).toBeTruthy();
    expect(screen.queryByTestId('share-card-top-set-3')).toBeNull();

    fireEvent.press(screen.getByTestId('share-format-feed'));

    expect(screen.queryByTestId('share-card-pr-value-1')).toBeNull();
    expect(screen.getByTestId('share-card-top-set-1')).toBeTruthy();
    expect(screen.queryByTestId('share-card-top-set-2')).toBeNull();
    await settle();
  });

  it("puts the user's own photo behind the card under a dark scrim, and can take it away again", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///my-photo.jpg' }],
    });
    await ready();
    expect(screen.queryByTestId('share-card-photo')).toBeNull();

    fireEvent.press(screen.getByTestId('share-photo-choose'));

    const photo = await screen.findByTestId('share-card-photo');
    expect(photo.props.source).toEqual({ uri: 'file:///my-photo.jpg' });
    const scrim = StyleSheet.flatten(screen.getByTestId('share-card-scrim').props.style);
    expect(scrim.backgroundColor).toMatch(/^rgba\(/);
    expect(screen.getByTestId('share-photo-choose')).toHaveTextContent(/Custom/);

    fireEvent.press(screen.getByTestId('share-photo-remove'));
    expect(screen.queryByTestId('share-card-photo')).toBeNull();
    expect(screen.queryByTestId('share-photo-remove')).toBeNull();
    await settle();
  });

  it('asks the picker to frame the photo to the card, and explains a refused permission', async () => {
    await ready();

    fireEvent.press(screen.getByTestId('share-photo-choose'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1080, 1920] }),
    );

    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
    });
    fireEvent.press(screen.getByTestId('share-photo-choose'));
    expect(await screen.findByTestId('share-photo-error')).toHaveTextContent(
      /permission is required/i,
    );
    await settle();
  });

  it('leaves the card on the plain dark default when the picker is cancelled', async () => {
    await ready();

    fireEvent.press(screen.getByTestId('share-photo-choose'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());

    expect(screen.queryByTestId('share-card-photo')).toBeNull();
    await settle();
  });

  it('says nothing is uploaded and that account details are never included', async () => {
    await ready();

    expect(screen.getByText(/only shared if you tap Share/i)).toBeTruthy();
    expect(screen.getByText(/never included/i)).toBeTruthy();
    await settle();
  });

  it('labels each toggle for assistive tech and marks it as a switch', async () => {
    await ready();

    for (const key of ['date', 'duration', 'sets', 'volume', 'lifts', 'records']) {
      const toggle = screen.getByTestId(`share-toggle-${key}`);
      expect(toggle.props.accessibilityRole).toBe('switch');
      expect(toggle.props.accessibilityLabel).toBeTruthy();
    }
    await settle();
  });

  it('renders no bare text outside <Text>, with a photo and every block on', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///my-photo.jpg' }],
    });
    await ready();
    fireEvent.press(screen.getByTestId('share-photo-choose'));
    await screen.findByTestId('share-card-photo');
    fireEvent(screen.getByTestId('share-toggle-volume'), 'valueChange', true);

    expectNoBareText();
    await settle();
  });
});
