import { AccessibilityInfo, Animated, AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createVideoPlayer } from 'expo-video';
import type { MontageItem } from '../../lib/api';
import { Image } from 'expo-image';
import { framedRect, leanFor } from './montageFrame';
import { MONTAGE_PANEL_MS, ProfileMontage } from './ProfileMontage';

const photo = (id: string, extra: Partial<MontageItem> = {}): MontageItem => ({
  id,
  kind: 'photo',
  url: `https://cdn.test/${id}.jpg?token=x`,
  width: 1200,
  height: 1600,
  durationSeconds: null,
  ...extra,
});
const video = (id: string): MontageItem => ({
  id,
  kind: 'video',
  url: `https://cdn.test/${id}.mp4?token=x`,
  width: 720,
  height: 1280,
  durationSeconds: 12,
});

/** Lays the strip out at `width` across, as the page would. */
function layOut(width = 360) {
  const strip = screen.getByTestId('montage').children[0] as never;
  fireEvent(strip, 'layout', { nativeEvent: { layout: { width, height: 0, x: 0, y: 0 } } });
}

let appStateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  (createVideoPlayer as jest.Mock).mockClear();
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

describe('ProfileMontage', () => {
  it('is nothing at all with nothing in it, even your own', () => {
    render(
      <ProfileMontage testID="montage" items={[]} accent="#D99A50" ownerName="Sam" isOwn={false} />,
    );
    expect(screen.queryByTestId('montage')).toBeNull();
    render(<ProfileMontage testID="mine" items={[]} accent="#D99A50" ownerName="Your" isOwn />);
    expect(screen.queryByTestId('mine')).toBeNull();
  });

  it('shows four panels at a time with no title, count or play button, round and round', () => {
    render(
      <ProfileMontage
        testID="montage"
        items={[photo('a'), video('b')]}
        accent="#D99A50"
        ownerName="Sam"
        isOwn={false}
      />,
    );
    layOut();
    // Two items fill the strip by repeating, with enough either side to loop without a seam.
    expect(screen.getAllByTestId('video-view')).toHaveLength(4);
    expect(screen.getByTestId('montage')).toHaveProp(
      'accessibilityLabel',
      "Sam's montage: 1 photo and 1 video",
    );
    for (const text of [/montage/i, /play/i, /\d+ (photos|videos)/i]) {
      expect(screen.queryByText(text)).toBeNull();
    }
    // One muted, looping player per video, shared by its panels, playing as the strip shows.
    expect(createVideoPlayer).toHaveBeenCalledTimes(1);
    const player = (createVideoPlayer as jest.Mock).mock.results[0]!.value;
    expect(player).toMatchObject({ muted: true, loop: true, audioMixingMode: 'mixWithOthers' });
    expect(player.play).toHaveBeenCalled();
  });

  it('moves steadily left to right, one panel every few seconds, and pauses in the background', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    render(
      <ProfileMontage
        testID="montage"
        items={[photo('a'), photo('b'), video('c')]}
        accent="#D99A50"
        ownerName="Sam"
        isOwn={false}
      />,
    );
    layOut(360);
    await act(async () => {});
    // Three items: a period of three 90-wide panels, gone across in three panels' time, by the
    // native driver -- rightward, so it moves left to right.
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 270, useNativeDriver: true }),
    );
    const durations = timing.mock.calls.map(([, config]) => config.duration ?? 0);
    expect(Math.max(...durations)).toBeLessThanOrEqual(MONTAGE_PANEL_MS * 3);

    const player = (createVideoPlayer as jest.Mock).mock.results[0]!.value;
    player.pause.mockClear();
    act(() => appStateListener?.('background'));
    expect(player.pause).toHaveBeenCalled();
  });

  it('keeps its videos playing when the profile is read again with new links', () => {
    const { rerender } = render(
      <ProfileMontage
        testID="montage"
        items={[video('b')]}
        accent="#D99A50"
        ownerName="Sam"
        isOwn={false}
      />,
    );
    const player = (createVideoPlayer as jest.Mock).mock.results[0]!.value;
    rerender(
      <ProfileMontage
        testID="montage"
        items={[{ ...video('b'), url: 'https://cdn.test/b.mp4?token=fresh' }]}
        accent="#D99A50"
        ownerName="Sam"
        isOwn={false}
      />,
    );
    expect(createVideoPlayer).toHaveBeenCalledTimes(1);
    expect(player.release).not.toHaveBeenCalled();
  });

  it('holds still under Reduce Motion', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    render(
      <ProfileMontage
        testID="montage"
        items={[photo('a'), photo('b')]}
        accent="#D99A50"
        ownerName="Sam"
        isOwn={false}
      />,
    );
    layOut();
    await act(async () => {});
    timing.mockClear();
    await act(async () => {});
    expect(timing).not.toHaveBeenCalled();
  });

  it('shows with just one photo -- it needs no more than that -- repeated to fill the strip', () => {
    render(
      <ProfileMontage
        testID="montage"
        items={[photo('a')]}
        accent="#D99A50"
        ownerName="Sam"
        isOwn={false}
      />,
    );
    layOut();
    expect(screen.getByTestId('montage')).toHaveProp(
      'accessibilityLabel',
      "Sam's montage: 1 photo",
    );
    expect(screen.UNSAFE_getAllByType(Image).length).toBeGreaterThanOrEqual(4);
  });

  it('draws a photo where its owner placed it in its panel', () => {
    const frame = { x: 0.2, y: 0.3, zoom: 2 };
    render(
      <ProfileMontage
        testID="montage"
        items={[photo('a', { width: 1000, height: 1500, frame })]}
        accent="#D99A50"
        ownerName="Sam"
        isOwn={false}
      />,
    );
    layOut(400);
    const height = Math.round(400 * 0.235);
    const box = { width: 100 + leanFor(height), height };
    const placed = framedRect(box, { width: 1000, height: 1500 }, frame);
    expect(screen.UNSAFE_getAllByType(Image)[0]!.props.style).toEqual(
      expect.objectContaining({ position: 'absolute', ...placed }),
    );
  });

  it('opens full screen when tapped, and holds still while it is', () => {
    const onOpen = jest.fn();
    render(
      <ProfileMontage
        testID="montage"
        items={[video('b')]}
        accent="#D99A50"
        ownerName="Sam"
        isOwn={false}
        onOpen={onOpen}
        paused
      />,
    );
    const strip = screen.getByTestId('montage');
    expect(strip).toHaveProp('accessibilityRole', 'button');
    fireEvent.press(strip);
    expect(onOpen).toHaveBeenCalled();
    const player = (createVideoPlayer as jest.Mock).mock.results[0]!.value;
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).toHaveBeenCalled();
  });

  it('shows your own just as others see it, with nothing to tap', () => {
    render(
      <ProfileMontage
        testID="montage"
        items={[photo('a')]}
        accent="#D99A50"
        ownerName="Your"
        isOwn
      />,
    );
    const strip = screen.getByTestId('montage');
    expect(strip).toHaveProp('accessibilityLabel', 'Your montage: 1 photo');
    expect(strip).toHaveProp('accessibilityRole', 'image');
    expect(strip.props.onPress).toBeUndefined();
  });
});
