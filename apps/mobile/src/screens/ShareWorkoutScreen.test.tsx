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
import { CARD_MAX_HEIGHT, CARD_SCALE, CARD_WIDTH, STORY_SAFE_AREA } from '../sharing/ShareCard';
import { DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { DEFAULT_THEME_ID, themeById } from '../theme/appThemes';
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
const justFinished = { params: { workoutId: 'w1', justFinished: true } } as never;

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

  it("renders the workout's own name and the date on a plain card, with nothing under the name", async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-workout-name')).toHaveTextContent('Push Day');
    // No year on the date.
    expect(screen.getByTestId('share-card-date')).not.toHaveTextContent('2026');
    // Plain: no background photo.
    expect(screen.queryByTestId('share-card-photo')).toBeNull();
    // The logo the app opens with, not a written brand name.
    expect(screen.getByTestId('share-card-logo')).toBeTruthy();
    expect(screen.getByTestId('share-card')).not.toHaveTextContent(/PROGRESSO/);
    // The name is the user's own -- the muscles worked aren't spelled out under it.
    expect(screen.queryByTestId('share-card-muscles')).toBeNull();
    expect(screen.getByTestId('share-card')).not.toHaveTextContent('Chest, Shoulders');
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

  it('leaves Duration out when it is unknown (logged with none)', async () => {
    mockFetchShareCardData.mockResolvedValue({ ...cardData, durationMinutes: null });

    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-exercises')).toBeTruthy();
    expect(screen.queryByTestId('share-card-duration')).toBeNull();
    await settle();
  });

  it("lists every exercise's top set, in workout order, under Top Sets", async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    const list = await screen.findByTestId('share-card-top-sets');
    expect(list).toHaveTextContent(/TOP SETS.*Bench Press.*Overhead Press/);
    expect(screen.getByTestId('share-card-top-set-0')).toHaveTextContent('110 kg × 8');
    expect(screen.getByTestId('share-card-top-set-1')).toHaveTextContent('60 kg × 8');
    // No separate Personal Records block.
    expect(screen.getByTestId('share-card')).not.toHaveTextContent(/PERSONAL RECORDS/);
    await settle();
  });

  it('marks a top set that is a personal record quietly -- its value in the accent and a small PR tag', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    // Bench Press is a PR; Overhead Press isn't.
    expect(await screen.findByTestId('share-card-top-set-0-pr')).toHaveTextContent(/^PR$/);
    expect(StyleSheet.flatten(screen.getByTestId('share-card-top-set-0').props.style).color).toBe(
      DEFAULT_WORKOUT_COLOR,
    );
    expect(screen.queryByTestId('share-card-top-set-1-pr')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('share-card-top-set-1').props.style).color).toBe(
      colors.textPrimary,
    );
    await settle();
  });

  it('tags a true one-rep max as 1RM', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      topSets: [{ ...topSet('Deadlift', '1RM'), weightKg: 200, reps: 1 }],
    });
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-top-set-0-pr')).toHaveTextContent(/^1RM$/);
    await settle();
  });

  it('shows no tag at all for a workout with no records', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      topSets: cardData.topSets.map((s) => ({ ...s, prLabel: null })),
    });
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card-top-sets');

    expect(screen.queryByTestId('share-card-top-set-0-pr')).toBeNull();
    expect(screen.queryByTestId('share-card-top-set-1-pr')).toBeNull();
    await settle();
  });

  it("gives cardio its own section -- each activity its glyph, name and figures -- and the active time in Duration's place", async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      activeMinutes: 65,
      cardio: [
        {
          activity: 'outdoor_run',
          icon: 'wind',
          name: 'Outdoor Running',
          figures: '30 min · 5 km · 6:00 /km',
        },
      ],
      cardioSeconds: 1800,
      cardioDistanceM: 5000,
    });
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-active')).toHaveTextContent('65 min');
    expect(screen.getByTestId('share-card-stats')).toHaveTextContent(/Active/);
    expect(screen.queryByTestId('share-card-duration')).toBeNull();
    expect(screen.getByTestId('share-card-top-set-1')).toBeTruthy();
    expect(screen.getByTestId('share-card-cardio')).toHaveTextContent(
      /CARDIO.*Outdoor Running.*30 min · 5 km · 6:00 \/km/,
    );
    await settle();
  });

  it('shows a workout of cardio alone as its time, activities and distance -- no sets or volume', async () => {
    mockFetchShareCardData.mockResolvedValue({
      ...cardData,
      exerciseCount: 0,
      totalSets: 0,
      totalVolumeKg: 0,
      topSets: [],
      activeMinutes: 40,
      cardio: [
        {
          activity: 'walking',
          icon: 'map',
          name: 'Walking',
          figures: '25 min · 2.5 km · 10:00 /km',
        },
        {
          activity: 'stairmaster',
          icon: 'chevrons-up',
          name: 'StairMaster',
          figures: '15 min · 40 floors',
        },
      ],
      cardioSeconds: 2400,
      cardioDistanceM: 2500,
    });
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('share-card-cardio-time')).toHaveTextContent('40 min');
    expect(screen.getByTestId('share-card-stats')).toHaveTextContent(/Time.*Activities.*Distance/);
    expect(screen.getByTestId('share-card-activities')).toHaveTextContent('2');
    expect(screen.getByTestId('share-card-distance')).toHaveTextContent(/2.5 km/);
    expect(screen.queryByTestId('share-card-sets')).toBeNull();
    expect(screen.queryByTestId('share-card-volume')).toBeNull();
    expect(screen.queryByTestId('share-card-top-sets')).toBeNull();
    expect(screen.getByTestId('share-card-cardio-1')).toHaveTextContent('15 min · 40 floors');
    await settle();
  });

  it('gives each of up to seven exercises its own row, tightening the rows to fit', async () => {
    const seven = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => topSet(`Lift ${n}`));
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: seven });
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card-top-sets');

    expect(screen.getByTestId('share-card-top-set-6')).toBeTruthy();
    expect(screen.queryByTestId('share-card-top-sets-more')).toBeNull();
    const tall = StyleSheet.flatten(screen.getByTestId('share-card-top-set-row-0').props.style);
    expect(tall.height).toBeLessThan(46 * CARD_SCALE);
    await settle();
  });

  it('fits up to twelve exercises on the compact card: a shorter photo and slimmer rows, every top set its own row', async () => {
    const twelve = 'ABCDEFGHIJKL'.split('').map((n) => topSet(`Lift ${n}`));
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: twelve });
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card-top-sets');

    expect(screen.getByTestId('share-card-top-set-11')).toBeTruthy();
    expect(screen.queryByTestId('share-card-top-sets-more')).toBeNull();
    const hero = StyleSheet.flatten(screen.getByTestId('share-card-hero').props.style);
    expect(hero.height).toBe(120 * CARD_SCALE);
    // Twelve rows and their gaps fit the list's room (270 + the 51 the photo gave up).
    const row = StyleSheet.flatten(screen.getByTestId('share-card-top-set-row-0').props.style);
    expect(12 * row.height + 11 * 3 * CARD_SCALE).toBeLessThanOrEqual(321 * CARD_SCALE + 0.001);
    await settle();
  });

  it('keeps the full card for seven or fewer', async () => {
    const seven = 'ABCDEFG'.split('').map((n) => topSet(`Lift ${n}`));
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: seven });
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card-top-sets');

    const hero = StyleSheet.flatten(screen.getByTestId('share-card-hero').props.style);
    expect(hero.height).toBe(171 * CARD_SCALE);
    await settle();
  });

  it('past twelve exercises, lists the first eleven and says how many more there are', async () => {
    const fifteen = 'ABCDEFGHIJKLMNO'.split('').map((n) => topSet(`Lift ${n}`));
    mockFetchShareCardData.mockResolvedValue({ ...cardData, topSets: fifteen });
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card-top-sets');

    expect(screen.getByTestId('share-card-top-set-10')).toBeTruthy();
    expect(screen.queryByTestId('share-card-top-set-11')).toBeNull();
    expect(screen.getByTestId('share-card-top-sets-more')).toHaveTextContent('+4 more');
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
  it('is just the card and one button, Share -- no size switch, background photo, toggles or Save', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-card');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expect(screen.getByTestId('share-workout-share')).toHaveTextContent(/^Share$/);
    expect(screen.queryByTestId('share-format')).toBeNull();
    expect(screen.queryByTestId('share-photo-choose')).toBeNull();
    expect(screen.queryByTestId('share-toggle-volume')).toBeNull();
    expect(screen.queryByTestId('share-workout-save')).toBeNull();
    await settle();
  });

  it('lays the story out at its one size and scales only the preview to fit the space', async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
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
    // The story itself is untouched, so the image is the same on every phone.
    expect(StyleSheet.flatten(screen.getByTestId('share-story').props.style).width).toBe(360);
    await settle();
  });

  it("keeps the card inside the story's safe area, clear of Instagram's and TikTok's own controls", async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('share-story');

    const safe = StyleSheet.flatten(screen.getByTestId('share-story-safe-area').props.style);
    expect(safe.top).toBe(STORY_SAFE_AREA.top);
    expect(safe.bottom).toBe(STORY_SAFE_AREA.bottom);
    // The card is laid out at its drawn size -- every length scaled, no shrinking
    // transform -- so its text is drawn sharp at the size it's shown.
    const card = StyleSheet.flatten(screen.getByTestId('share-card').props.style);
    expect(card.width).toBeCloseTo(CARD_WIDTH * CARD_SCALE, 6);
    expect(card.transform).toBeUndefined();
    expect(screen.queryByTestId('share-card-scale')).toBeNull();
    const name = StyleSheet.flatten(screen.getByTestId('share-card-workout-name').props.style);
    expect(name.fontSize).toBeCloseTo(32 * CARD_SCALE, 6);
    // Even the tallest card, scaled, fits between the margins on every side.
    expect(CARD_WIDTH * CARD_SCALE).toBeLessThanOrEqual(360 - 2 * STORY_SAFE_AREA.side);
    expect(CARD_MAX_HEIGHT * CARD_SCALE).toBeCloseTo(
      640 - STORY_SAFE_AREA.top - STORY_SAFE_AREA.bottom,
      6,
    );
    // Roughly a quarter-safe margin top and bottom of the 1920px image.
    expect(STORY_SAFE_AREA.top * 3).toBeGreaterThanOrEqual(250);
    expect(STORY_SAFE_AREA.bottom * 3).toBeGreaterThanOrEqual(250);
    await settle();
  });

  it("sets the card on the app theme's own plain background colour -- no photo, no gradient", async () => {
    render(<ShareWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    const story = await screen.findByTestId('share-story');

    expect(StyleSheet.flatten(story.props.style).backgroundColor).toBe(
      themeById(DEFAULT_THEME_ID).background,
    );
    expect(screen.queryByTestId('share-story-frame')).toBeNull();
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
    // A record's value (Bench Press, here) is the one accented text on the card.
    const prValue = screen.getByTestId('share-card-top-set-0');
    expect(StyleSheet.flatten(prValue.props.style).color).toBe(DEFAULT_WORKOUT_COLOR);
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
