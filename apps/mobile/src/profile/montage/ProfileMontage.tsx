import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  AppState,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { colors, radii } from '../../design/theme';
import type { MontageItem } from '../../lib/api';
import { useReduceMotionPreference } from '../../navigation/navigationTransitions';
import { useScreenFocused } from '../../navigation/useScreenFocused';
import { mixHex, withAlpha } from '../../theme/accentColor';
import { framedRect, HEIGHT_RATIO, leanFor, photoSize, SKEW, type Size } from './montageFrame';
import { photoSource, videoSource } from './montageMedia';

// A profile's montage, after Harbir's reference: one strip the width of the page under its
// buttons, four slanted panels in view at once, divided by thin light seams, in a frame of the
// accent that glows, with a brighter streak along its top and bottom edges. No title, count or
// controls. It moves by itself, slowly and steadily left to right, through the photos and videos
// and round again without a seam (fewer than four repeat to fill it); videos play muted, on a
// loop, as they go by. A photo sits where its owner placed it in its panel (montageFrame.ts). It
// holds still, videos paused, while its page isn't the one in view, the app is in the background
// or the montage is open full screen (MontageViewer), and under Reduce Motion it doesn't move (its
// videos still play). Tapped, it opens full screen.

/** How long the strip takes to move one panel along, ms. */
export const MONTAGE_PANEL_MS = 3200;
const RADIUS = radii.md;

/** Whether the app is in front (a montage pauses in the background). */
export function useAppActive(): boolean {
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

/** One panel's picture, in its upright `box`: the photo where its owner placed it, or the video. */
function PanelMedia({
  item,
  player,
  box,
}: {
  item: MontageItem;
  player: VideoPlayer | undefined;
  box: Size;
}) {
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
  const size = photoSize(item);
  return (
    <Image
      source={photoSource(item)}
      style={
        size
          ? { position: 'absolute', ...framedRect(box, size, item.frame ?? null) }
          : StyleSheet.absoluteFill
      }
      contentFit="cover"
      transition={200}
    />
  );
}

/**
 * A slanted panel, `width` wide and `height` tall, its picture upright inside it -- in a box
 * `leanFor(height)` wider, reaching each slanted edge (the box montageFrame.ts places a photo in).
 */
export function MontagePanel({
  left,
  top = 0,
  width,
  height,
  seam,
  style,
  children,
}: {
  left: number;
  top?: number;
  width: number;
  height: number;
  seam: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const lean = leanFor(height);
  return (
    <View
      style={[
        styles.panel,
        {
          left,
          top,
          width,
          height,
          borderLeftColor: seam,
          transform: [{ skewX: `-${SKEW}deg` }],
        },
        style,
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
  onOpen,
  paused = false,
  testID,
}: {
  items: MontageItem[];
  accent: string;
  /** Whose it is, for a screen reader ("Sam"). */
  ownerName: string;
  isOwn: boolean;
  /** Opens it full screen. */
  onOpen?: () => void;
  /** Held still, videos paused -- while it's open full screen. */
  paused?: boolean;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const inView = useScreenFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotionPreference();
  const live = inView && appActive && !paused;
  const players = useVideoPlayers(items, live);

  const count = items.length;
  const height = Math.round(width * HEIGHT_RATIO);
  const slot = width / 4;
  const box = { width: slot + leanFor(height), height };
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

  const strip = (
    <View
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
              <MontagePanel key={key} left={left} width={slot} height={height} seam={seam}>
                <PanelMedia item={item} player={players.get(item.id)} box={box} />
              </MontagePanel>
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

  return onOpen ? (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Plays it full screen"
    >
      {strip}
    </TouchableOpacity>
  ) : (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={label}>
      {strip}
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
