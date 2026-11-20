import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { colors, radii } from '../../design/theme';
import type { MontageItem } from '../../lib/api';
import { useReduceMotionPreference } from '../../navigation/navigationTransitions';
import { useScreenFocused } from '../../navigation/useScreenFocused';
import { mixHex, withAlpha } from '../../theme/accentColor';
import { photoSource, videoSource } from './montageMedia';

// A profile's montage, after Harbir's reference: one strip the width of the page under its
// buttons, four slanted panels in view at once, divided by thin light seams, in a frame of the
// accent that glows, with a brighter streak along its top and bottom edges. No title, count or
// controls. It moves by itself, slowly and steadily left to right, through the photos and videos
// and round again without a seam (fewer than four repeat to fill it); videos play muted, on a
// loop, as they go by. It holds still, videos paused, while its page isn't the one in view or the
// app is in the background, and under Reduce Motion it doesn't move (its videos still play).

/** The strip's height for its width -- the reference's proportions. */
const HEIGHT_RATIO = 0.235;
/** How far each panel leans, degrees. */
const SKEW = 12;
/** How long the strip takes to move one panel along, ms. */
export const MONTAGE_PANEL_MS = 3200;
const RADIUS = radii.md;

/** Whether the app is in front (a montage pauses in the background). */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return active;
}

/** A muted player for each video, playing while `playing` -- one per video, shared by its panels. */
function useVideoPlayers(items: MontageItem[], playing: boolean): Map<string, VideoPlayer> {
  const videos = items.filter((item) => item.kind === 'video');
  // By the videos themselves, never their links: those are signed afresh each time the profile
  // is read, and a video already playing shouldn't start over because of it.
  const key = videos.map((item) => item.id).join('|');
  const [players, setPlayers] = useState<Map<string, VideoPlayer>>(() => new Map());
  useEffect(() => {
    const made = new Map(
      videos.map((item) => {
        const player = createVideoPlayer(videoSource(item));
        player.muted = true;
        player.loop = true;
        // A muted video never stops what the person is listening to.
        player.audioMixingMode = 'mixWithOthers';
        return [item.id, player] as const;
      }),
    );
    setPlayers(made);
    return () => made.forEach((player) => player.release());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    players.forEach((player) => (playing ? player.play() : player.pause()));
  }, [players, playing]);
  return players;
}

/** One panel's picture: the photo (a tall one kept toward its top, where a face usually is) or video. */
function PanelMedia({ item, player }: { item: MontageItem; player: VideoPlayer | undefined }) {
  if (item.kind === 'video') {
    return player ? (
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    ) : null;
  }
  const tall = (item.height ?? 0) > (item.width ?? 0) * 1.1;
  return (
    <Image
      source={photoSource(item)}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      contentPosition={tall ? { top: '25%', left: '50%' } : 'center'}
      transition={200}
    />
  );
}

/** A slanted panel, `width` wide and `height` tall, its picture upright inside it. */
function Panel({
  left,
  width,
  height,
  seam,
  children,
}: {
  left: number;
  width: number;
  height: number;
  seam: string;
  children?: ReactNode;
}) {
  // Wide enough that, leant back upright, the picture still reaches each slanted edge.
  const lean = height * Math.tan((SKEW * Math.PI) / 180);
  return (
    <View
      style={[
        styles.panel,
        {
          left,
          width,
          height,
          borderLeftColor: seam,
          transform: [{ skewX: `-${SKEW}deg` }],
        },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -lean / 2,
          width: width + lean,
          transform: [{ skewX: `${SKEW}deg` }],
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function ProfileMontage({
  items,
  accent,
  ownerName,
  isOwn,
  testID,
}: {
  items: MontageItem[];
  accent: string;
  /** Whose it is, for a screen reader ("Sam"). */
  ownerName: string;
  isOwn: boolean;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const inView = useScreenFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotionPreference();
  const live = inView && appActive;
  const players = useVideoPlayers(items, live);

  const count = items.length;
  const height = Math.round(width * HEIGHT_RATIO);
  const slot = width / 4;
  // The panels in a row, starting a period (every item once) and a panel to the left, with enough
  // to fill the strip and its slanted edges at every point between: moving the row right by a
  // period brings it back to just how it started.
  const period = slot * count;
  const panels = count === 0 ? 0 : count + 6;
  const offset = useRef(new Animated.Value(0)).current;
  const moving = live && !reduceMotion && width > 0 && count > 0;

  useEffect(() => {
    offset.setValue(0);
  }, [offset, period]);

  useEffect(() => {
    if (!moving) return undefined;
    const lap = MONTAGE_PANEL_MS * count;
    const glide = (toValue: number, duration: number) =>
      Animated.timing(offset, {
        toValue,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      });
    let loop: Animated.CompositeAnimation | null = null;
    let stopped = false;
    // On from wherever it was paused, then round and round.
    offset.stopAnimation((from) => {
      if (stopped) return;
      glide(period, Math.max(0, ((period - from) / period) * lap)).start(({ finished }) => {
        if (!finished || stopped) return;
        offset.setValue(0);
        loop = Animated.loop(glide(period, lap));
        loop.start();
      });
    });
    return () => {
      stopped = true;
      loop?.stop();
      offset.stopAnimation();
    };
  }, [moving, offset, period, count]);

  const highlight = mixHex(accent, colors.textPrimary, 0.55);
  const seam = withAlpha(colors.textPrimary, 0.7);
  const row = useMemo(
    () =>
      Array.from({ length: panels }, (_, index) => {
        const item = items[(((index - 1) % count) + count) % count]!;
        return { key: `${item.id}-${index}`, item, left: (index - count - 1) * slot };
      }),
    [panels, items, count, slot],
  );

  if (count === 0) return null;

  const videos = items.filter((item) => item.kind === 'video').length;
  const photos = count - videos;
  const contents = [
    photos ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : null,
    videos ? `${videos} ${videos === 1 ? 'video' : 'videos'}` : null,
  ]
    .filter(Boolean)
    .join(' and ');
  const label = `${isOwn ? 'Your' : `${ownerName}'s`} montage: ${contents}`;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.glow, { height: height || undefined, shadowColor: accent }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={[styles.frame, { borderColor: accent }]}>
        {width > 0 ? (
          <Animated.View
            testID={testID ? `${testID}-row` : undefined}
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: offset }] }]}
          >
            {row.map(({ key, item, left }) => (
              <Panel key={key} left={left} width={slot} height={height} seam={seam}>
                <PanelMedia item={item} player={players.get(item.id)} />
              </Panel>
            ))}
          </Animated.View>
        ) : null}
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(highlight, 0), highlight, withAlpha(highlight, 0)]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.streak, styles.streakTop]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[withAlpha(highlight, 0), highlight, withAlpha(highlight, 0)]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.streak, styles.streakBottom]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    borderRadius: RADIUS,
    backgroundColor: colors.surface,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  frame: {
    flex: 1,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  panel: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
    borderLeftWidth: 1.5,
    backgroundColor: colors.surfaceRaised,
  },
  // A brighter run of light along the frame's edge.
  streak: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  streakTop: {
    top: -0.5,
    left: '36%',
    width: '26%',
  },
  streakBottom: {
    bottom: -0.5,
    left: '24%',
    width: '56%',
  },
});
