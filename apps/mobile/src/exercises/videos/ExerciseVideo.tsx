import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { TextButton } from '../../design/Button';
import { Text } from '../../design/Text';
import { colors, radii, spacing, typeScale } from '../../design/theme';
import { useReduceMotionPreference } from '../../navigation/navigationTransitions';
import { withAlpha } from '../../theme/accentColor';
import type { ExerciseVideoUrls } from './exerciseVideoSource';

type Status = 'loading' | 'ready' | 'error';

/**
 * An exercise's demonstration video, the same everywhere it's shown: on the surface the picture
 * would be on, the size its page gives it, muted (a demonstration has nothing to hear). Its poster
 * frame and a small spinner while it loads; then it plays once by itself (never under Reduce
 * Motion, and only while `active`), with one small round control in a corner -- Pause, Play, or
 * Replay once it's done -- and a tap on the video doing the same. It pauses when the app goes to
 * the background. One that can't load says so, with Try Again; the page around it is whole either
 * way. Its player is made for its video alone and let go when it leaves, so one page never has
 * two playing.
 */
export function ExerciseVideo({
  urls,
  width,
  height,
  accentColor,
  exerciseName,
  autoPlay = true,
  active = true,
  testID = 'exercise-video',
}: {
  urls: ExerciseVideoUrls;
  width: number;
  height: number;
  accentColor: string;
  exerciseName: string;
  autoPlay?: boolean;
  /** False while its page is out of view: it pauses. */
  active?: boolean;
  testID?: string;
}) {
  const reduceMotion = useReduceMotionPreference();
  const [attempt, setAttempt] = useState(0);
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  // Whether it has played by itself yet, this video and this try.
  const started = useRef(false);

  useEffect(() => {
    const made = createVideoPlayer({ uri: urls.video, useCaching: true });
    made.muted = true;
    made.loop = false;
    made.audioMixingMode = 'mixWithOthers';
    started.current = false;
    setStatus('loading');
    setPlaying(false);
    setEnded(false);
    const listeners = [
      made.addListener('statusChange', ({ status: next }) => {
        if (next === 'readyToPlay') setStatus('ready');
        else if (next === 'error') setStatus('error');
      }),
      made.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying)),
      made.addListener('playToEnd', () => {
        setEnded(true);
        setPlaying(false);
      }),
    ];
    setPlayer(made);
    return () => {
      listeners.forEach((listener) => listener.remove());
      made.release();
    };
  }, [urls.video, attempt]);

  // Once it's ready: it plays by itself the first time, if it may; out of view, it pauses.
  useEffect(() => {
    if (!player || status !== 'ready') return;
    if (!active) {
      player.pause();
      return;
    }
    if (!started.current && autoPlay && !reduceMotion) {
      started.current = true;
      player.play();
    }
  }, [player, status, active, autoPlay, reduceMotion]);

  // In the background, it pauses.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player?.pause();
    });
    return () => subscription.remove();
  }, [player]);

  const toggle = () => {
    if (!player || status !== 'ready') return;
    if (ended) {
      player.currentTime = 0;
      setEnded(false);
      player.play();
    } else if (playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const action = ended ? 'Replay' : playing ? 'Pause' : 'Play';
  const icon = ended ? 'rotate-ccw' : playing ? 'pause' : 'play';

  return (
    <View testID={testID} style={[styles.frame, { width, height }]}>
      {player ? (
        <VideoView
          testID={`${testID}-view`}
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      ) : null}
      {status !== 'ready' && urls.poster ? (
        <Image
          testID={`${testID}-poster`}
          source={{ uri: urls.poster }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {status === 'loading' ? (
        <View style={styles.center} testID={`${testID}-loading`}>
          <ActivityIndicator color={accentColor} />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[styles.center, styles.errorShade]} testID={`${testID}-error`}>
          <Text style={styles.errorText}>{"This video couldn't load."}</Text>
          <TextButton
            testID={`${testID}-retry`}
            label="Try Again"
            onPress={() => setAttempt((n) => n + 1)}
          />
        </View>
      ) : null}

      {status === 'ready' ? (
        <>
          <Pressable
            testID={`${testID}-surface`}
            style={StyleSheet.absoluteFill}
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={`${exerciseName} demonstration. ${action}`}
          />
          <Pressable
            testID={`${testID}-control`}
            onPress={toggle}
            hitSlop={4}
            style={styles.control}
            accessibilityRole="button"
            accessibilityLabel={action}
          >
            <Feather name={icon} size={16} color={colors.textPrimary} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const CONTROL = 36;

const styles = StyleSheet.create({
  frame: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  errorShade: {
    backgroundColor: withAlpha(colors.background, 0.6),
  },
  errorText: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  // Subtle: a small dark circle in the corner, never over the movement.
  control: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.background, 0.6),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorderStrong,
  },
});
