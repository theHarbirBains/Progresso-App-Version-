import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../auth/AuthProvider';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ProfileProvider } from '../profile/ProfileProvider';
import { fetchShareCardData, type ShareCardData } from '../sharing/shareCardData';
import { DENSITY, STORY_PALETTE } from '../sharing/shareCardStyles';
import { AppThemeContext } from '../theme/appThemeContext';
import { themeById } from '../theme/appThemes';
import { ShareWorkoutScreen } from './ShareWorkoutScreen';
import { fetchMyProfile } from '../profile/profileQueries';
import { fetchOwnMontage } from '../profile/montage/montageQueries';
import { photoRect } from '../sharing/sharePhoto';

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

jest.mock('expo-media-library/legacy', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));

// Your own montage, as the photo chooser reads it.
jest.mock('../profile/montage/montageQueries', () => ({
  fetchOwnMontage: jest.fn(),
}));

// A photo picked from the phone is scaled down (native) and kept in the app's files: these stand
// in for both -- which files exist, and what's deleted.
jest.mock('../lib/imageResize', () => ({
  resizeForUpload: jest.fn(async (uri: string) => uri),
}));
const mockFiles = new Set<string>();
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
      .join('/');
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    copy(to: File) {
      mockFiles.add(to.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: 'file:///docs' } };
});

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockFetchShareCardData = fetchShareCardData as jest.Mock;
const mockCaptureRef = captureRef as jest.Mock;
const mockIsAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;
const mockGetPermissions = MediaLibrary.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = MediaLibrary.requestPermissionsAsync as jest.Mock;
const mockSaveToLibrary = MediaLibrary.saveToLibraryAsync as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = { params: { workoutId: 'w1' } } as never;
const justFinished = { params: { workoutId: 'w1', justFinished: true } } as never;

function topSet(name: string, overrides: Partial<ShareCardData['topSets'][number]> = {}) {
  return {
    exerciseName: name,
    displayName: name,
    label: 'Top Set',
    photoUrl: null,
    measurementType: 'weight_reps' as const,
    weightKg: 50,
    reps: 10,
    durationSeconds: null,
    prLabel: null,
    ...overrides,
  };
}

const cardData: ShareCardData = {
  workoutName: 'Push Day',
  title: 'Push Day',
  performedAt: '2026-01-01T10:00:00Z',
  musclesTrained: 'Chest, Shoulders',
  durationMinutes: 82,
  cardio: [],
  cardioSeconds: 0,
  exerciseCount: 2,
  totalSets: 9,
  totalVolumeKg: 2293,
  recordCount: 1,
  topSets: [
    topSet('Bench Press', { weightKg: 110, reps: 8, prLabel: '8 Rep PR' }),
    topSet('Overhead Press', { weightKg: 60, reps: 8 }),
  ],
};

const treadmill = {
  activity: 'treadmill' as const,
  icon: 'trending-up' as const,
  name: 'Treadmill',
  figures: '15 min · 3 km · Speed 6.5 · Incline 5',
  durationSeconds: 900,
};

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

function renderShare(options: { festive?: boolean; routeValue?: never } = {}) {
  return render(
    <ProfileProvider>
      <AppThemeContext.Provider
        value={{
          theme: themeById('holiday-gym'),
          accent: { accent: '#EBC27C', onAccent: '#1A1206' } as never,
          chosenId: 'holiday-gym',
          followSeasons: false,
          loaded: true,
          choose: () => undefined,
          setFollowSeasons: () => undefined,
          snowSeason: false,
          snowfall: false,
          snowing: false,
          setSnowfall: () => undefined,
          decorations: true,
          decorating: options.festive ?? false,
          setDecorations: () => undefined,
        }}
      >
        <ShareWorkoutScreen navigation={navigation} route={options.routeValue ?? route} />
      </AppThemeContext.Provider>
    </ProfileProvider>,
  );
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
  mockGetPermissions.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  mockRequestPermissions.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  mockSaveToLibrary.mockReset().mockResolvedValue(undefined);
  mockGoBack.mockClear();
});

describe('ShareWorkoutScreen -- the card, after the reference', () => {
  it('shows a loading placeholder while fetching', async () => {
    renderShare();
    expect(screen.getByTestId('share-workout-loading')).toBeTruthy();
    await screen.findByTestId('share-card', {}, { timeout: 5000 });
    await settle();
  });

  it('heads it with the brand, WORKOUT COMPLETE, the workout and its date -- no year', async () => {
    renderShare();
    expect(await screen.findByTestId('share-card-header')).toHaveTextContent(
      /Progresso.*WORKOUT COMPLETE.*Push Day/,
    );
    expect(screen.getByTestId('share-card-date')).not.toHaveTextContent('2026');
    await settle();
  });

  it("gives its four figures: the whole duration, sets, volume in the user's unit and records", async () => {
    mockFetchMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });
    renderShare();
    await screen.findByTestId('share-card-stats');
    await waitFor(() =>
      expect(screen.getByTestId('share-card-volume')).toHaveTextContent('5,055 lb'),
    );
    expect(screen.getByTestId('share-card-duration')).toHaveTextContent('1h 22m');
    expect(screen.getByTestId('share-card-sets')).toHaveTextContent('9');
    expect(screen.getByTestId('share-card-records')).toHaveTextContent('1');
    expect(screen.getByTestId('share-card-stats')).toHaveTextContent(
      /Duration.*Sets.*Volume.*Record/,
    );
    await settle();
  });

  it('says a duration not logged is unknown, never 0', async () => {
    mockFetchShareCardData.mockResolvedValue({ ...cardData, durationMinutes: null });
    renderShare();
    expect(await screen.findByTestId('share-card-duration')).toHaveTextContent('—');
    await settle();
  });

  it('lists only each exercise\'s top set, in order: its name, "Top Set" and the figure in its own pill', async () => {
    renderShare();
    expect(await screen.findByTestId('share-card-top-set-row-0')).toHaveTextContent(
      /Bench Press.*Top Set.*110kg × 8/,
    );
    expect(screen.getByTestId('share-card-top-set-row-1')).toHaveTextContent(
      /Overhead Press.*60kg × 8/,
    );
    expect(screen.queryByTestId('share-card-top-set-row-2')).toBeNull();
    // A bodyweight exercise's best and a timed one's longest read as theirs.
    await settle();
  });

  it('wraps a long name onto more lines at the same size, never shrinking it or crowding the figure', async () => {
    const long = 'Seated Cable Row — Close-Grip V-Handle With A Very Long Gym Name';
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: [topSet(long)] });
    renderShare();
    const name = await screen.findByTestId('share-card-top-set-name-0');
    expect(name).toHaveTextContent(long);
    expect(name.props.numberOfLines).toBe(3);
    expect(name.props.adjustsFontSizeToFit).toBeUndefined();
    const pill = screen.getByTestId('share-card-top-set-pill-0');
    expect(StyleSheet.flatten(pill.props.style).flexShrink).toBe(0);
    await settle();
  });

  it('gives cardio a panel of its own, each activity with what it recorded', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      cardio: [
        treadmill,
        {
          ...treadmill,
          activity: 'rowing',
          icon: 'anchor',
          name: 'Rowing',
          figures: '10 min · 2 km · 2:30 /500 m',
        },
      ],
      cardioSeconds: 1500,
    });
    renderShare();
    expect(await screen.findByTestId('share-card-cardio-row-0')).toHaveTextContent(
      /Treadmill.*15 min · 3 km · Speed 6.5 · Incline 5/,
    );
    expect(screen.getByTestId('share-card-cardio-1')).toHaveTextContent(/2:30 \/500 m$/);
    expect(screen.getByTestId('share-card-summary')).toHaveTextContent(
      /2 Exercises.*\|.*25 min Cardio/,
    );
    expect(screen.getByTestId('share-card')).not.toHaveTextContent(/\bcal\b/);
    await settle();
  });

  it('leaves the cardio panel out without cardio, and says it was strength training', async () => {
    renderShare();
    await screen.findByTestId('share-card');
    expect(screen.queryByTestId('share-card-cardio')).toBeNull();
    expect(screen.getByTestId('share-card-summary')).toHaveTextContent(
      /2 Exercises.*Strength Training/,
    );
    await settle();
  });

  it('shows cardio alone as its duration, activities and time -- no sets, volume or records', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      title: 'Cardio',
      exerciseCount: 0,
      totalSets: 0,
      totalVolumeKg: 0,
      recordCount: 0,
      topSets: [],
      cardio: [treadmill],
      cardioSeconds: 900,
    });
    renderShare();
    expect(await screen.findByTestId('share-card-activities')).toHaveTextContent('1');
    expect(screen.getByTestId('share-card-cardio-time')).toHaveTextContent('15 min');
    expect(screen.getByTestId('share-card-cardio')).toHaveTextContent(/Treadmill/);
    expect(screen.queryByTestId('share-card-sets')).toBeNull();
    expect(screen.queryByTestId('share-card-volume')).toBeNull();
    expect(screen.queryByTestId('share-card-top-sets')).toBeNull();
    await settle();
  });

  it('dresses it for the holidays only while the decorations are on: lights, a hat, the pines and deer', async () => {
    renderShare({ festive: true });
    await screen.findByTestId('share-card');
    expect(screen.getByTestId('share-story-lights', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('share-card-hat', { includeHiddenElements: true })).toBeTruthy();
    await settle();
  });

  it('is plain the rest of the year -- stars, but no lights or hat', async () => {
    renderShare();
    await screen.findByTestId('share-card');
    expect(screen.queryByTestId('share-story-lights', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('share-card-hat', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('share-story-stars', { includeHiddenElements: true })).toBeTruthy();
    await settle();
  });

  it("paints its own palette whatever the app's theme: Holiday Gym's deep green", async () => {
    renderShare();
    const story = StyleSheet.flatten((await screen.findByTestId('share-story')).props.style);
    expect(story.backgroundColor).toBe(themeById('holiday-gym').background);
    expect(STORY_PALETTE.gold).toBe(themeById('holiday-gym').accent);
    await settle();
  });

  it('starts roomy for a short workout and snug or tight for a long one', async () => {
    renderShare();
    const short = await screen.findByTestId('share-card-top-set-name-0');
    expect(StyleSheet.flatten(short.props.style).fontSize).toBe(DENSITY.roomy.name);
    await settle();
  });

  it('tightens when its words would run into the landscape, and at the tightest says how many more there are', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => topSet(`Lift ${i + 1}`));
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: twenty, exerciseCount: 20 });
    renderShare();
    const words = await screen.findByTestId('share-card');
    // Twenty rows start tight.
    expect(
      StyleSheet.flatten(screen.getByTestId('share-card-top-set-name-0').props.style).fontSize,
    ).toBe(DENSITY.tight.name);
    // Measured too tall: a row gives way to "+N more exercises", said on the card.
    act(() => {
      fireEvent(words, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 336, height: 900 } },
      });
    });
    expect(screen.getByTestId('share-card-top-sets-more')).toHaveTextContent('+2 more exercises');
    expect(screen.getByTestId('share-card-top-set-row-17')).toBeTruthy();
    expect(screen.queryByTestId('share-card-top-set-row-18')).toBeNull();
    await settle();
  });

  it('never renders email, user id, or nutrition information', async () => {
    renderShare();
    const card = await screen.findByTestId('share-card');
    expect(card).not.toHaveTextContent('a@example.com');
    expect(card).not.toHaveTextContent('user-1');
    expect(card).not.toHaveTextContent(/protein/i);
    await settle();
  });

  it('lays the story out at its one size and scales only the preview to fit the room', async () => {
    renderShare();
    const story = StyleSheet.flatten((await screen.findByTestId('share-story')).props.style);
    expect(story.width).toBe(360);
    expect(story.height).toBe(640);
    act(() => {
      fireEvent(screen.getByTestId('share-card-stage'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 480 } },
      });
    });
    // Height-bound: 480 / 640 = 0.75.
    const preview = StyleSheet.flatten(screen.getByTestId('share-card-preview').props.style);
    expect(preview.width).toBe(270);
    expect(preview.height).toBe(480);
    await settle();
  });

  it('shows an error state with retry when loading fails', async () => {
    mockFetchShareCardData.mockRejectedValue(new Error('Only completed workouts can be shared'));
    renderShare();
    expect(await screen.findByTestId('share-workout-load-error')).toHaveTextContent(
      'Only completed workouts can be shared',
    );
    mockFetchShareCardData.mockResolvedValue(cardData);
    fireEvent.press(screen.getByTestId('share-workout-retry'));
    expect(await screen.findByTestId('share-card-workout-name')).toBeTruthy();
    await settle();
  });

  it('closes when Close is pressed, named for assistive tech', async () => {
    renderShare();
    await screen.findByTestId('share-card-workout-name');
    expect(screen.getByTestId('share-workout-close').props.accessibilityLabel).toBe('Close');
    fireEvent.press(screen.getByTestId('share-workout-close'));
    expect(mockGoBack).toHaveBeenCalled();
    await settle();
  });

  it('renders no bare text outside <Text>', async () => {
    renderShare();
    await screen.findByTestId('share-card');
    expectNoBareText();
    await settle();
  });
});

describe('ShareWorkoutScreen -- Save to Photos', () => {
  it('saves the same 1080x1920 image into Photos, asking first', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    renderShare();
    await screen.findByTestId('share-card');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    await waitFor(() => expect(mockSaveToLibrary).toHaveBeenCalledWith('file:///tmp/share.png'));
    expect(mockRequestPermissions).toHaveBeenCalledWith(false);
    expect(mockCaptureRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1920, format: 'png' }),
    );
    expect(await screen.findByText('Saved to Photos')).toBeTruthy();
    await settle();
  });

  it('says how to allow it when Photos is turned down, saving nothing', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
    renderShare();
    await screen.findByTestId('share-card');

    fireEvent.press(screen.getByTestId('share-workout-save'));

    expect(await screen.findByTestId('share-workout-share-error')).toHaveTextContent(
      /iPhone Settings/,
    );
    expect(mockSaveToLibrary).not.toHaveBeenCalled();
    await settle();
  });
});

describe('ShareWorkoutScreen share action', () => {
  it('captures the card and opens the native share sheet', async () => {
    renderShare();
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

    renderShare();
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

    renderShare();
    await screen.findByTestId('share-card-workout-name');

    fireEvent.press(screen.getByTestId('share-workout-share'));
    await screen.findByTestId('share-workout-share-error');

    fireEvent.press(screen.getByTestId('share-workout-share'));

    await waitFor(() => expect(mockShareAsync).toHaveBeenCalled());
    expect(screen.queryByTestId('share-workout-share-error')).toBeNull();
    await settle();
  });

  it('shows Share as busy while the card is being captured', async () => {
    mockCaptureRef.mockReturnValue(new Promise(() => undefined));
    renderShare();
    await screen.findByTestId('share-card');

    fireEvent.press(screen.getByTestId('share-workout-share'));

    await waitFor(() =>
      expect(screen.getByTestId('share-workout-share').props.accessibilityState).toEqual({
        disabled: true,
        busy: true,
      }),
    );
  });
});

describe('ShareWorkoutScreen -- cheering a new PR', () => {
  const { scheduleNotificationAsync } = jest.requireMock('expo-notifications') as {
    scheduleNotificationAsync: jest.Mock;
  };
  const { RemindersContext } = jest.requireActual(
    '../notifications/remindersContext',
  ) as typeof import('../notifications/remindersContext');
  const { defaultReminderSettings } = jest.requireActual(
    '../notifications/reminderSettings',
  ) as typeof import('../notifications/reminderSettings');

  function renderFinished(prCheers = true, routeValue: never = justFinished) {
    const settings = defaultReminderSettings();
    return render(
      <ProfileProvider>
        <RemindersContext.Provider
          value={{
            settings: { ...settings, prCheers: { on: prCheers } },
            update: jest.fn(),
            allowed: true,
            refreshAllowed: jest.fn(),
            active: true,
          }}
        >
          <ShareWorkoutScreen navigation={navigation} route={routeValue} />
        </RemindersContext.Provider>
      </ProfileProvider>,
    );
  }

  beforeEach(() => {
    scheduleNotificationAsync.mockClear();
    mockFetchMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: 'Harbir Bains',
      username: null,
      weightUnit: 'kg',
    });
  });

  it('cheers by name as the workout is finished with a new PR', async () => {
    renderFinished();

    await waitFor(() =>
      expect(scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'KEEP GOING, HARBIR!',
          body: 'You hit a new PR on your Push Day workout: Bench Press, 110 kg × 8.',
        },
        trigger: null,
      }),
    );
  });

  it('does not cheer a workout opened to share later, or with PR Cheers off', async () => {
    renderFinished(true, route);
    await screen.findByTestId('share-card', {}, { timeout: 5000 });
    renderFinished(false);
    await settle();

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('ShareWorkoutScreen -- your photo on the card', () => {
  const AVATAR = 'https://cdn.example.com/avatars/user-1/1.jpg';
  const KEY = '@progresso/sharePhoto/user-1';
  const mockFetchOwnMontage = fetchOwnMontage as jest.Mock;
  const withAvatar = () =>
    mockFetchMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      avatarUrl: AVATAR,
    });
  const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockFiles.clear();
    mockFetchOwnMontage.mockReset().mockResolvedValue([]);
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
    } as never);
  });

  it('leaves the card exactly as it was without one, and says how to add one', async () => {
    renderShare();
    await screen.findByTestId('share-card');

    expect(screen.queryByTestId('share-card-photo')).toBeNull();
    expect(screen.getByTestId('share-photo-status')).toHaveTextContent(
      'Add your photo to the card',
    );
    expect(screen.getByTestId('share-photo-switch').props.value).toBe(false);
    expect(
      StyleSheet.flatten(screen.getByTestId('share-card-top-set-name-0').props.style).fontSize,
    ).toBe(DENSITY.roomy.name);
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-workout-share'));
    });
    expect(mockCaptureRef).toHaveBeenCalled();
    expectNoBareText();
  });

  it('puts the profile picture on the card, and shares only once it is drawn', async () => {
    withAvatar();
    renderShare();
    fireEvent.press(await screen.findByTestId('share-photo-open'));
    fireEvent.press(await screen.findByTestId('share-photo-choice-avatar'));

    const image = screen.getByTestId('share-card-photo-image');
    expect(image.props.source).toEqual({ uri: AVATAR });
    // Between the brand and WORKOUT COMPLETE, in its circle.
    expect(screen.getByTestId('share-story').props.accessibilityLabel).toMatch(/With your photo/);
    expect(screen.getByTestId('share-photo-status')).toHaveTextContent(
      'Profile Picture · On the card',
    );
    // Not captured before it's there.
    fireEvent.press(screen.getByTestId('share-workout-share'));
    expect(mockCaptureRef).not.toHaveBeenCalled();

    fireEvent(image, 'load');
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-workout-share'));
    });
    expect(mockCaptureRef).toHaveBeenCalled();
    expect(await stored()).toEqual({ include: true, choice: { kind: 'avatar' } });
  });

  it('remembers it for the next card, and switches it off and on again without losing it', async () => {
    withAvatar();
    await AsyncStorage.setItem(KEY, JSON.stringify({ include: true, choice: { kind: 'avatar' } }));
    renderShare();
    expect(await screen.findByTestId('share-card-photo')).toBeTruthy();

    fireEvent(screen.getByTestId('share-photo-switch'), 'valueChange', false);
    expect(screen.queryByTestId('share-card-photo')).toBeNull();
    expect(screen.getByTestId('share-photo-status')).toHaveTextContent('Not on the card');
    await waitFor(async () =>
      expect(await stored()).toEqual({ include: false, choice: { kind: 'avatar' } }),
    );

    fireEvent(screen.getByTestId('share-photo-switch'), 'valueChange', true);
    expect(screen.getByTestId('share-card-photo')).toBeTruthy();
  });

  it("offers the montage's photos -- never its videos -- framed as their owner framed them", async () => {
    const photo = {
      id: 'gym',
      kind: 'photo',
      url: 'https://signed.example.com/gym.jpg',
      width: 1080,
      height: 1920,
      durationSeconds: null,
      frame: { x: 0.5, y: 0.3, zoom: 1.5 },
      path: 'user-1/gym.jpg',
    };
    mockFetchOwnMontage.mockResolvedValue([
      { ...photo, id: 'clip', kind: 'video', url: 'https://signed.example.com/clip.mp4' },
      photo,
    ]);
    renderShare();
    fireEvent.press(await screen.findByTestId('share-photo-open'));

    fireEvent.press(await screen.findByTestId('share-photo-choice-montage-gym'));
    expect(screen.queryByTestId('share-photo-choice-montage-clip')).toBeNull();
    expect(mockFetchOwnMontage).toHaveBeenCalledWith('user-1');

    const image = screen.getByTestId('share-card-photo-image');
    expect(image.props.source).toEqual({
      uri: photo.url,
      cacheKey: 'profile-montage-gym',
    });
    // Two lifts and the photo still start roomy; the photo covers its circle at its own shape.
    const rect = photoRect(DENSITY.roomy.photo, {
      size: { width: photo.width, height: photo.height },
      frame: photo.frame,
    })!;
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({
      position: 'absolute',
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
    expect(screen.getByTestId('share-photo-status')).toHaveTextContent(
      'Montage Photo 2 · On the card',
    );
  });

  it("adds one from the phone's photos, cropped square as it's picked, and removes it", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///cache/ImagePicker/p.jpg', width: 900, height: 900 }],
    } as never);
    renderShare();
    fireEvent.press(await screen.findByTestId('share-photo-open'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-photo-library'));
    });

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }),
    );
    const image = await screen.findByTestId('share-card-photo-image');
    const kept = image.props.source.uri as string;
    expect(kept).toMatch(/^file:\/\/\/docs\/share-photo\/user-1\/\d+\.jpg$/);
    expect(screen.getByTestId('share-photo-status')).toHaveTextContent(
      'From Your Photos · On the card',
    );

    fireEvent.press(screen.getByTestId('share-photo-open'));
    fireEvent.press(screen.getByTestId('share-photo-remove'));
    expect(screen.queryByTestId('share-card-photo')).toBeNull();
    expect(mockFiles.has(kept)).toBe(false);
    await waitFor(async () => expect(await stored()).toBeNull());
  });

  it('says how to allow Photos when turned down, adding nothing', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValueOnce({
      granted: false,
    } as never);
    renderShare();
    fireEvent.press(await screen.findByTestId('share-photo-open'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-photo-library'));
    });

    expect(screen.getByTestId('share-photo-error')).toHaveTextContent(
      'Allow Progresso to use Photos in iPhone Settings to add a photo.',
    );
    expect(screen.queryByTestId('share-card-photo')).toBeNull();
  });

  it("leaves a photo that can't be loaded off the card, and still shares", async () => {
    withAvatar();
    await AsyncStorage.setItem(KEY, JSON.stringify({ include: true, choice: { kind: 'avatar' } }));
    renderShare();
    fireEvent(await screen.findByTestId('share-card-photo-image'), 'error');

    expect(screen.queryByTestId('share-card-photo')).toBeNull();
    expect(screen.getByTestId('share-photo-failed')).toHaveTextContent(
      "Your photo couldn't be loaded, so it's left off the card.",
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-workout-share'));
    });
    expect(mockCaptureRef).toHaveBeenCalled();
  });

  it('starts a longer workout a step tighter with the photo, and roomy again without it', async () => {
    withAvatar();
    const six = Array.from({ length: 6 }, (_, i) => topSet(`Lift ${i + 1}`));
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: six, exerciseCount: 6 });
    await AsyncStorage.setItem(KEY, JSON.stringify({ include: true, choice: { kind: 'avatar' } }));
    renderShare();
    await screen.findByTestId('share-card-photo');

    const nameSize = () =>
      StyleSheet.flatten(screen.getByTestId('share-card-top-set-name-0').props.style).fontSize;
    expect(nameSize()).toBe(DENSITY.snug.name);
    fireEvent(screen.getByTestId('share-photo-switch'), 'valueChange', false);
    expect(nameSize()).toBe(DENSITY.roomy.name);
  });

  it('says when there are no profile photos to choose from', async () => {
    renderShare();
    fireEvent.press(await screen.findByTestId('share-photo-open'));

    expect(await screen.findByTestId('share-photo-none')).toHaveTextContent(
      'No profile picture or montage photos yet.',
    );
    expect(screen.queryByTestId('share-photo-remove')).toBeNull();
  });
});
