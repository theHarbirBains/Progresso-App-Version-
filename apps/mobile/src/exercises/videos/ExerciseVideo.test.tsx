import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createVideoPlayer } from 'expo-video';
import { ExerciseVideo } from './ExerciseVideo';

const urls = {
  video: 'https://cdn.example.com/exercise-videos/male/barbell-curl.mp4',
  poster: 'https://cdn.example.com/exercise-posters/male/barbell-curl.jpg',
};

type MockPlayer = {
  play: jest.Mock;
  pause: jest.Mock;
  release: jest.Mock;
  currentTime?: number;
  listeners: Record<string, (event?: unknown) => void>;
};

function latestPlayer(): MockPlayer {
  const made = jest.mocked(createVideoPlayer).mock.results;
  return made[made.length - 1]!.value as MockPlayer;
}

function renderVideo(props: Partial<Parameters<typeof ExerciseVideo>[0]> = {}) {
  return render(
    <ExerciseVideo
      urls={urls}
      width={300}
      height={240}
      accentColor="#D99A50"
      exerciseName="Barbell Curl"
      {...props}
    />,
  );
}

beforeEach(() => jest.mocked(createVideoPlayer).mockClear());

describe('ExerciseVideo', () => {
  it('shows its poster and a spinner while it loads, muted, never looping', () => {
    renderVideo();
    expect(screen.getByTestId('exercise-video-poster')).toBeTruthy();
    expect(screen.getByTestId('exercise-video-loading')).toBeTruthy();
    expect(screen.queryByTestId('exercise-video-control')).toBeNull();
    expect(createVideoPlayer).toHaveBeenCalledWith({ uri: urls.video, useCaching: true });
    const player = latestPlayer() as unknown as { muted: boolean; loop: boolean };
    expect(player.muted).toBe(true);
    expect(player.loop).toBe(false);
  });

  it('plays once by itself when ready, then pauses, plays and replays from its control', () => {
    renderVideo();
    const player = latestPlayer();
    act(() => player.listeners.statusChange!({ status: 'readyToPlay' }));
    expect(player.play).toHaveBeenCalledTimes(1);
    act(() => player.listeners.playingChange!({ isPlaying: true }));
    expect(screen.getByLabelText('Pause')).toBeTruthy();

    fireEvent.press(screen.getByTestId('exercise-video-control'));
    expect(player.pause).toHaveBeenCalled();
    act(() => player.listeners.playingChange!({ isPlaying: false }));
    expect(screen.getByLabelText('Play')).toBeTruthy();

    act(() => player.listeners.playToEnd!());
    expect(screen.getByLabelText('Replay')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exercise-video-control'));
    expect(player.currentTime).toBe(0);
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it("doesn't play by itself where it's told not to, or while out of view", () => {
    const { rerender } = renderVideo({ autoPlay: false });
    const player = latestPlayer();
    act(() => player.listeners.statusChange!({ status: 'readyToPlay' }));
    expect(player.play).not.toHaveBeenCalled();
    rerender(
      <ExerciseVideo
        urls={urls}
        width={300}
        height={240}
        accentColor="#D99A50"
        exerciseName="Barbell Curl"
        active={false}
      />,
    );
    expect(player.pause).toHaveBeenCalled();
  });

  it("says when it can't load, and tries again with a new player", () => {
    renderVideo();
    const first = latestPlayer();
    act(() => first.listeners.statusChange!({ status: 'error' }));
    expect(screen.getByTestId('exercise-video-error')).toHaveTextContent(/couldn't load/);
    fireEvent.press(screen.getByTestId('exercise-video-retry'));
    expect(first.release).toHaveBeenCalled();
    expect(createVideoPlayer).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('exercise-video-loading')).toBeTruthy();
  });

  it('lets its player go when it leaves', () => {
    const { unmount } = renderVideo();
    const player = latestPlayer();
    unmount();
    expect(player.release).toHaveBeenCalled();
  });
});
