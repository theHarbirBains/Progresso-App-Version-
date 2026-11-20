import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../../design/IconButton';
import { Text } from '../../design/Text';
import { colors, radii, spacing, typeScale } from '../../design/theme';
import type { MontageItem } from '../../lib/api';
import { useReduceMotionPreference } from '../../navigation/navigationTransitions';
import { withAlpha } from '../../theme/accentColor';
import { photoSource, videoSource } from './montageMedia';
import { useAppActive } from './ProfileMontage';

// A montage full screen, as one video to watch -- yours, or a friend's from their profile (whoever
// can see the strip can open it). Each photo or video in turn, whole (never cropped), on the
// lightbox's plain black: a photo for MONTAGE_PHOTO_MS, a video to its end, then the next, and
// round again from the first. A bar for each along the top fills as it plays. Tap the right of the
// screen for the next, the left for the one before; hold to pause, or Pause; videos start muted,
// with Sound to hear them. Swipe down or Close to leave. It pauses in the background, and starts
// paused under VoiceOver, so nothing moves on before it's read.

/** How long a photo shows before the next, ms. */
export const MONTAGE_PHOTO_MS = 5000;
/** How far down a swipe closes it, pt. */
const CLOSE_DISTANCE = 120;

/**
 * A video playing its part of the montage: from the start -- each `turn` it's shown, a new
 * showing -- to its end, reporting how far it is.
 */
function useViewerVideo(
  item: MontageItem | undefined,
  turn: number,
  {
    playing,
    muted,
    onProgress,
    onEnd,
  }: {
    playing: boolean;
    muted: boolean;
    onProgress: (share: number) => void;
    onEnd: () => void;
  },
): VideoPlayer | null {
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const handlers = useRef({ onProgress, onEnd });
  handlers.current = { onProgress, onEnd };
  const id = item?.kind === 'video' ? item.id : null;

  useEffect(() => {
    if (!id || !item) {
      setPlayer(null);
      return undefined;
    }
    const made = createVideoPlayer(videoSource(item));
    made.loop = false;
    made.audioMixingMode = 'mixWithOthers';
    made.timeUpdateEventInterval = 0.1;
    const listeners = [
      made.addListener('timeUpdate', ({ currentTime }) => {
        const length = made.duration || item.durationSeconds || 0;
        if (length > 0) handlers.current.onProgress(Math.min(1, currentTime / length));
      }),
      made.addListener('playToEnd', () => handlers.current.onEnd()),
    ];
    setPlayer(made);
    return () => {
      listeners.forEach((listener) => listener.remove());
      made.release();
    };
    // A new player for each showing, never for a fresh link to the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, turn]);

  useEffect(() => {
    if (player) player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    if (!player) return;
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);
  return player;
}

export function MontageViewer({
  items,
  visible,
  ownerName,
  isOwn,
  onClose,
  accent,
  testID,
}: {
  items: MontageItem[];
  visible: boolean;
  /** Whose it is ("Sam"). */
  ownerName: string;
  isOwn: boolean;
  onClose: () => void;
  accent: string;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const appActive = useAppActive();
  // Which is showing, and how many moves there have been: every move -- even onto the same one, in
  // a montage of one -- is a new showing, from its start.
  const [{ index, turn }, setShowing] = useState({ index: 0, turn: 0 });
  // Paused with Pause (or, under VoiceOver, from the start), and while held down.
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [muted, setMuted] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  const count = items.length;
  const item = items[Math.min(index, count - 1)];
  const playing = visible && appActive && !paused && !held;

  // Each opening starts from the first (put back as it closes), playing -- paused for VoiceOver.
  useEffect(() => {
    if (!visible) {
      setShowing((was) => (was.index === 0 ? was : { index: 0, turn: was.turn + 1 }));
      return;
    }
    setHeld(false);
    setPaused(false);
    progress.setValue(0);
    drag.setValue(0);
    let open = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (open && on) setPaused(true);
    });
    return () => {
      open = false;
    };
  }, [visible, drag, progress]);

  const next = useCallback(
    () => setShowing((was) => ({ index: count ? (was.index + 1) % count : 0, turn: was.turn + 1 })),
    [count],
  );
  const previous = useCallback(
    () => setShowing((was) => ({ index: Math.max(0, was.index - 1), turn: was.turn + 1 })),
    [],
  );

  // Each showing starts its bar from empty.
  useEffect(() => {
    progress.setValue(0);
  }, [turn, progress]);

  // A photo's bar runs for its time, from wherever it was paused.
  useEffect(() => {
    if (!item || item.kind !== 'photo' || !playing) return undefined;
    let stopped = false;
    let run: Animated.CompositeAnimation | null = null;
    progress.stopAnimation((from) => {
      if (stopped) return;
      run = Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(0, (1 - from) * MONTAGE_PHOTO_MS),
        useNativeDriver: false,
      });
      run.start(({ finished }) => {
        if (finished && !stopped) next();
      });
    });
    return () => {
      stopped = true;
      run?.stop();
    };
  }, [item, turn, playing, progress, next]);

  const player = useViewerVideo(visible ? item : undefined, turn, {
    playing,
    muted,
    onProgress: (share) => progress.setValue(share),
    onEnd: next,
  });

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Swipe down to close.
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onPanResponderMove: (_event, gesture) => drag.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > CLOSE_DISTANCE) {
          onCloseRef.current();
          return;
        }
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  if (!item) return null;

  const whose = isOwn ? 'Your montage' : `${ownerName}'s montage`;
  const kindName = item.kind === 'video' ? 'Video' : 'Photo';
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <Animated.View
        testID={testID}
        style={[styles.root, { transform: [{ translateY: drag }] }]}
        {...swipe.panHandlers}
      >
        {item.kind === 'video' ? (
          player ? (
            <VideoView
              testID={testID ? `${testID}-video` : undefined}
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
              allowsPictureInPicture={false}
            />
          ) : null
        ) : (
          <Image
            testID={testID ? `${testID}-photo` : undefined}
            source={photoSource(item)}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={reduceMotion ? 0 : 150}
            accessibilityIgnoresInvertColors
          />
        )}

        {/* Tap the left for the one before, the right for the next; hold anywhere to pause. */}
        <View style={styles.zones}>
          <Pressable
            testID={testID ? `${testID}-previous` : undefined}
            style={styles.previousZone}
            onPress={previous}
            onLongPress={() => setHeld(true)}
            onPressOut={() => setHeld(false)}
            delayLongPress={200}
            accessibilityRole="button"
            accessibilityLabel="Previous"
          />
          <Pressable
            testID={testID ? `${testID}-next` : undefined}
            style={styles.nextZone}
            onPress={next}
            onLongPress={() => setHeld(true)}
            onPressOut={() => setHeld(false)}
            delayLongPress={200}
            accessibilityRole="button"
            accessibilityLabel="Next"
          />
        </View>

        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.bars}>
            {items.map((each, at) => (
              <View
                key={each.id}
                testID={testID ? `${testID}-bar-${at}` : undefined}
                style={styles.bar}
              >
                {at < index ? (
                  <View style={[styles.barFill, { width: '100%', backgroundColor: accent }]} />
                ) : at === index ? (
                  <Animated.View
                    style={[styles.barFill, { width: fill, backgroundColor: accent }]}
                  />
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.header}>
            <View style={styles.title}>
              <Text testID={testID ? `${testID}-title` : undefined} style={styles.titleText}>
                {whose}
              </Text>
              <Text
                testID={testID ? `${testID}-position` : undefined}
                style={styles.positionText}
                accessibilityLabel={`${kindName} ${index + 1} of ${count}`}
              >
                {`${index + 1} of ${count}`}
              </Text>
            </View>
            <IconButton
              testID={testID ? `${testID}-pause` : undefined}
              icon={paused ? 'play' : 'pause'}
              onPress={() => setPaused((was) => !was)}
              accessibilityLabel={paused ? 'Play' : 'Pause'}
            />
            {item.kind === 'video' ? (
              <IconButton
                testID={testID ? `${testID}-sound` : undefined}
                icon={muted ? 'volume-x' : 'volume-2'}
                onPress={() => setMuted((was) => !was)}
                accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
              />
            ) : null}
            <IconButton
              testID={testID ? `${testID}-close` : undefined}
              icon="x"
              onPress={onClose}
              accessibilityLabel="Close montage"
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  zones: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  previousZone: {
    flex: 1,
  },
  nextZone: {
    flex: 2,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.sm,
    // A soft shade behind the bars and buttons, so they read over a bright photo.
    backgroundColor: withAlpha(colors.background, 0.35),
  },
  bars: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.textPrimary, 0.3),
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  title: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  titleText: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  positionText: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
  },
});
