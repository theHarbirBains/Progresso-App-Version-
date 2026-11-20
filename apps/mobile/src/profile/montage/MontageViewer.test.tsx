import { AccessibilityInfo, Animated, AppState } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createVideoPlayer } from 'expo-video';
import type { MontageItem } from '../../lib/api';
import { MONTAGE_PHOTO_MS, MontageViewer } from './MontageViewer';

const photo = (id: string): MontageItem => ({
  id,
  kind: 'photo',
  url: `https://cdn.test/${id}.jpg?token=x`,
  width: 1200,
  height: 1600,
  durationSeconds: null,
});
const video = (id: string): MontageItem => ({
  id,
  kind: 'video',
  url: `https://cdn.test/${id}.mp4?token=x`,
  width: 720,
  height: 1280,
  durationSeconds: 12,
});

/** Each photo's timer as it's started: finish one to move on. */
let timers: { duration: number; finish: () => void }[] = [];

beforeEach(() => {
  timers = [];
  (createVideoPlayer as jest.Mock).mockClear();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  jest.spyOn(Animated, 'timing').mockImplementation((_value, config) => {
    let done: ((result: { finished: boolean }) => void) | undefined;
    timers.push({ duration: config.duration ?? 0, finish: () => done?.({ finished: true }) });
    return {
      start: (callback?: (result: { finished: boolean }) => void) => {
        done = callback;
      },
      stop: jest.fn(),
      reset: jest.fn(),
    } as never;
  });
});

afterEach(() => jest.restoreAllMocks());

function open(items: MontageItem[], onClose = jest.fn()) {
  render(
    <MontageViewer
      testID="viewer"
      items={items}
      visible
      ownerName="Sam"
      isOwn={false}
      onClose={onClose}
      accent="#D99A50"
    />,
  );
  return onClose;
}

const players = () => (createVideoPlayer as jest.Mock).mock.results.map((result) => result.value);

describe('MontageViewer', () => {
  it('plays a montage full screen from its first, each whole, with a bar for each', async () => {
    open([photo('a'), video('b'), photo('c')]);
    await act(async () => {});

    expect(screen.getByTestId('viewer-title')).toHaveTextContent("Sam's montage");
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('1 of 3');
    expect(screen.getByTestId('viewer-photo')).toHaveProp('contentFit', 'contain');
    for (const at of [0, 1, 2]) expect(screen.getByTestId(`viewer-bar-${at}`)).toBeTruthy();
    // A photo shows for its time, then the next.
    expect(timers.at(-1)!.duration).toBe(MONTAGE_PHOTO_MS);
    act(() => timers.at(-1)!.finish());
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('2 of 3');
  });

  it('plays a video muted to its end, then moves on -- and round again from the first', async () => {
    open([photo('a'), video('b')]);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('viewer-next'));

    // (expo-video's stand-in names every video view `video-view`.)
    expect(screen.getByTestId('video-view')).toHaveProp('contentFit', 'contain');
    const player = players().at(-1)!;
    expect(player.loop).toBe(false);
    expect(player.muted).toBe(true);
    expect(player.play).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('viewer-sound'));
    expect(player.muted).toBe(false);

    act(() => player.listeners.playToEnd());
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('1 of 2');
  });

  it('goes back with a tap on the left, and pauses with Pause', async () => {
    open([video('a'), photo('b')]);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('viewer-next'));
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('2 of 2');
    fireEvent.press(screen.getByTestId('viewer-previous'));
    expect(screen.getByTestId('viewer-position')).toHaveTextContent('1 of 2');

    const player = players().at(-1)!;
    fireEvent.press(screen.getByTestId('viewer-pause'));
    expect(player.pause).toHaveBeenCalled();
    expect(screen.getByTestId('viewer-pause')).toHaveProp('accessibilityLabel', 'Play');
  });

  it('plays a montage of one round and round, from its start each time', async () => {
    open([video('a')]);
    await act(async () => {});
    act(() => players().at(-1)!.listeners.playToEnd());
    expect(createVideoPlayer).toHaveBeenCalledTimes(2);
    expect(players()[0]!.release).toHaveBeenCalled();
  });

  it('starts paused under VoiceOver, so nothing moves on before it is read', async () => {
    (AccessibilityInfo.isScreenReaderEnabled as jest.Mock).mockResolvedValue(true);
    open([photo('a'), photo('b')]);
    await act(async () => {});
    expect(screen.getByTestId('viewer-pause')).toHaveProp('accessibilityLabel', 'Play');
  });

  it('closes with Close', async () => {
    const onClose = open([photo('a')]);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('viewer-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
