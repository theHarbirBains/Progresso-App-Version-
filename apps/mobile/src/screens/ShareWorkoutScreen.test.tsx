import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PrimaryButton } from '../design/Button';
import { colors, fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { fetchShareCardData } from '../sharing/shareCardData';
import { ShareWorkoutScreen } from './ShareWorkoutScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
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

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockFetchShareCardData = fetchShareCardData as jest.Mock;
const mockCaptureRef = captureRef as jest.Mock;
const mockIsAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = { params: { workoutId: 'w1' } } as never;

const cardData = {
  workoutName: 'Push Day',
  performedAt: '2026-01-01T10:00:00Z',
  musclesTrained: 'Chest, Shoulders',
  durationMinutes: 45,
  exerciseCount: 2,
  totalSets: 9,
  totalVolumeKg: 8620,
  topSets: [
    { exerciseName: 'Bench Press', photoUrl: null, weightKg: 110, reps: 8, prLabel: '8 Rep PR' },
    { exerciseName: 'Overhead Press', photoUrl: null, weightKg: 60, reps: 8, prLabel: null },
  ],
};

function topSet(name: string, prLabel: string | null = null) {
  return { exerciseName: name, photoUrl: null, weightKg: 50, reps: 10, prLabel };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchMyProfile.mockReset().mockResolvedValue({
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
  mockGoBack.mockClear();
});

describe('ShareWorkoutScreen loading and preview', () => {
  it('shows a loading indicator while fetching', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(screen.getByTestId('share-workout-loading')).toBeTruthy();

    await screen.findByTestId('share-card', {}, { timeout: 5000 });
    await settle();
  });

  it('renders the workout name, date and muscles over the photo at the top of the card', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-workout-name')).toHaveTextContent('Push Day');
    expect(screen.getByTestId('share-card-muscles')).toHaveTextContent('Chest, Shoulders');
    // No year on the date.
    expect(screen.getByTestId('share-card-date')).not.toHaveTextContent('2026');
    expect(screen.getByTestId('share-card-photo')).toBeTruthy();
    await settle();
  });

  it("shows the session as four stats -- duration, exercises, sets and volume in the user's unit", async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-duration')).toHaveTextContent('45 min');
    expect(screen.getByTestId('share-card-exercises')).toHaveTextContent('2');
    expect(screen.getByTestId('share-card-sets')).toHaveTextContent('9');
    expect(screen.getByTestId('share-card-volume')).toHaveTextContent('8,620');
    expect(screen.getByTestId('share-card-stats')).toHaveTextContent(/Volume \(kg\)/);
    await settle();
  });

  it('shows a dash for duration when it is unknown', async () => {
    mockFetchShareCardData.mockResolvedValue({ ...cardData, durationMinutes: null });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-duration')).toHaveTextContent('—');
    await settle();
  });

  it('lists personal records with their label and value, only for exercises that set one', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    const prSection = await screen.findByTestId('share-card-pr-section');
    expect(prSection).toHaveTextContent(/Bench Press.*8 Rep PR/);
    expect(prSection).not.toHaveTextContent('Overhead Press');
    expect(screen.getByTestId('share-card-pr-value-0')).toHaveTextContent('110 kg × 8');
    expect(screen.getByTestId('share-card-pr-count')).toHaveTextContent('1 PR');
    await settle();
  });

  it('counts every record in the workout but lists at most two', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      topSets: [
        topSet('Squat', '5 Rep PR'),
        topSet('Leg Press', '7 Rep PR'),
        topSet('Lunge'),
        topSet('Leg Curl', '1RM'),
      ],
    });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-pr-count')).toHaveTextContent('3 PRs');
    expect(screen.getByTestId('share-card-pr-value-1')).toBeTruthy();
    expect(screen.queryByTestId('share-card-pr-value-2')).toBeNull();
    await settle();
  });

  it('omits the PR section entirely for a workout with no PRs', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      topSets: cardData.topSets.map((s) => ({ ...s, prLabel: null })),
    });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card-workout-name');

    expect(screen.queryByTestId('share-card-pr-section')).toBeNull();
    await settle();
  });

  it("numbers the workout's first three exercises, in order, records included", async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      topSets: [
        topSet('Leg Press', '7 Rep PR'),
        topSet('Leg Extension'),
        topSet('Hack Squat'),
        topSet('Calf Raise'),
      ],
    });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    const lifts = await screen.findByTestId('share-card-lifts');
    expect(lifts).toHaveTextContent(/1.*Leg Press.*2.*Leg Extension.*3.*Hack Squat/);
    expect(lifts).not.toHaveTextContent('Calf Raise');
    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('50 kg × 10');
    await settle();
  });

  it('handles a long workout name and long exercise name without crashing', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      workoutName: 'A'.repeat(120),
      topSets: [
        { exerciseName: 'B'.repeat(120), photoUrl: null, weightKg: 999, reps: 999, prLabel: null },
      ],
    });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-workout-name')).toHaveTextContent('A'.repeat(120));
    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('999 kg × 999');
    await settle();
  });

  it('never renders email, user id, or nutrition information', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-workout-load-error')).toHaveTextContent(
      'Only completed workouts can be shared',
    );

    mockFetchShareCardData.mockResolvedValue(cardData);
    fireEvent.press(screen.getByTestId('share-workout-retry'));

    expect(await screen.findByTestId('share-card-workout-name')).toBeTruthy();
    await settle();
  });

  it('closes when Close is pressed', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-close'));

    expect(mockGoBack).toHaveBeenCalled();
    await settle();
  });
});

describe('ShareWorkoutScreen share action', () => {
  it('captures the card and opens the native share sheet', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
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

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-share'));
    await screen.findByTestId('share-workout-share-error');

    fireEvent.press(screen.getByTestId('share-workout-share'));

    await waitFor(() => expect(mockShareAsync).toHaveBeenCalled());
    expect(screen.queryByTestId('share-workout-share-error')).toBeNull();
    await settle();
  });
});

describe('ShareWorkoutScreen -- the card, then one primary action', () => {
  it('is just the card and one button, Share to Story -- no size switch, background photo, toggles or Save', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expect(screen.getByTestId('share-workout-share')).toHaveTextContent('Share to Story');
    expect(screen.queryByTestId('share-format')).toBeNull();
    expect(screen.queryByTestId('share-photo-choose')).toBeNull();
    expect(screen.queryByTestId('share-toggle-volume')).toBeNull();
    expect(screen.queryByTestId('share-workout-save')).toBeNull();
    await settle();
  });

  it('lays the card out at its one story size and scales only the preview to fit the space', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    const card = StyleSheet.flatten((await screen.findByTestId('share-card')).props.style);
    expect(card.width).toBe(360);
    expect(card.height).toBe(640);

    act(() => {
      fireEvent(screen.getByTestId('share-card-stage'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 480 } },
      });
    });

    // Height-bound: 480 / 640 = 0.75.
    const preview = StyleSheet.flatten(screen.getByTestId('share-card-preview').props.style);
    expect(preview.width).toBe(270);
    expect(preview.height).toBe(480);
    // The card itself is untouched, so the image is the same on every phone.
    expect(StyleSheet.flatten(screen.getByTestId('share-card').props.style).width).toBe(360);
    await settle();
  });

  it('draws the card from the app palette and typography, not hardcoded colours', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    const card = StyleSheet.flatten((await screen.findByTestId('share-card')).props.style);

    expect(card.backgroundColor).toBe(colors.surface);
    expect(card.borderColor).toBe(colors.glassBorderStrong);
    const set = StyleSheet.flatten(screen.getByTestId('share-card-top-set-0').props.style);
    expect(set.fontFamily).toBe(fonts.mono);
    // The PR *value* (not its name/label line, which stays plain text) is
    // the one accented element on the card.
    const prValue = screen.getByTestId('share-card-pr-value-0');
    expect(StyleSheet.flatten(prValue.props.style).color).toBe(colors.accent);
    await settle();
  });

  it('names the close control for assistive tech', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card');

    expect(screen.getByTestId('share-workout-close').props.accessibilityLabel).toBe('Close');
    await settle();
  });

  it('shows Share as busy while the card is being captured', async () => {
    mockCaptureRef.mockReturnValue(new Promise(() => undefined));
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
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
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-workout-load-error')).toHaveTextContent('boom');
    fireEvent.press(screen.getByTestId('share-workout-retry'));

    expect(await screen.findByTestId('share-card')).toBeTruthy();
    await settle();
  });

  it('renders no bare text outside <Text>', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card');

    expectNoBareText();
    await settle();
  });
});
