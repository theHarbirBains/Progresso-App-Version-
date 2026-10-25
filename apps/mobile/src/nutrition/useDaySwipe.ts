import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';
import { isSidewaysDrag } from '../design/sidewaysDrag';
import { daySwipe, shiftDay } from './logDay';

// How the Nutrition screen turns from one day to the next. The day's widgets follow the finger
// and turn back in depth as they go -- tilting and shrinking, fading -- like a card turned on a
// spindle; let go past the line (or flick) and the day turns away, the new day swings in from the
// other side and settles with a small overshoot, its widgets dealt in one after another like a
// hand of cards (`widgetStyle`). Short of the line it springs back. Any day turns to the next,
// today to tomorrow too. The date above glides along at a slower pace (DayBar). Under Reduce
// Motion the day just changes.

/** How far the new day starts, as a share of the screen's width. */
const ENTER_FROM = 0.8;
/** The most the widgets tilt and shrink, at a full screen's width. */
const MAX_TILT_DEG = 14;
const MIN_SCALE = 0.9;
const ENTER_SPRING = { stiffness: 190, damping: 20, mass: 1 } as const;
/** How long a turn away takes, at its quickest and slowest. */
const EXIT_MS = { min: 170, max: 260 } as const;
/**
 * The new day's widgets, dealt in one after another: each starts this much further out than the
 * one above it, and this much later in the arrival -- the arrival taking ARRIVE_MS in all.
 */
const DEAL_OFFSET = 28;
const DEAL_STEP = 0.1;
const DEAL_WIDGETS = 5;
const ARRIVE_MS = 520;

const HINT_KEY = '@progresso/nutritionSwipeHint';

export type DayDirection = 'previous' | 'next';

interface Options {
  day: string;
  /** Shows a day. Called mid-turn, once the old day is out of sight. */
  onDay: (day: string) => void;
  width: number;
  reduceMotion: boolean;
}

/**
 * - `slide`: the widgets' movement, in points, negative while they go left (DayBar's date follows
 *   it);
 * - `swiping`: a swipe is under way -- the screen holds its scroll still meanwhile
 *   (`Screen`'s `scrollEnabled`), so the page neither drifts nor takes the touch;
 * - `panHandlers`: for the widgets and the day bar -- a sideways drag on either turns the day;
 * - `contentStyle`: the widgets' turn -- depth, tilt, shrink and fade, all from `slide`;
 * - `widgetStyle(index)`: the day's widget at `index` (0 at the top), as the new day's widgets are
 *   dealt in one after another;
 * - `turnTo`: turns to the day before or after, as a swipe does (VoiceOver's way to change day).
 */
export type DaySwipe = ReturnType<typeof useDaySwipe>;

export function useDaySwipe({ day, onDay, width, reduceMotion }: Options) {
  const slide = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);
  // Where the widgets are, as far as a drag has taken them (slide's own value isn't readable).
  const position = useRef(0);
  const turning = useRef(false);
  // Where the next day starts, set as a turn hands over and used once that day has rendered.
  const enterFrom = useRef<number | null>(null);
  // The new day's arrival, 0 to 1 (1 at rest), and the side it comes from (1 right, -1 left).
  const arrive = useRef(new Animated.Value(1)).current;
  const fromSide = useRef(new Animated.Value(1)).current;
  const dayRef = useRef(day);
  dayRef.current = day;
  const onDayRef = useRef(onDay);
  onDayRef.current = onDay;
  const widthRef = useRef(width);
  widthRef.current = width;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  const turnTo = useRef((direction: DayDirection, velocity = 0) => {
    const target = shiftDay(dayRef.current, direction === 'previous' ? -1 : 1);
    if (turning.current) return;
    if (reduceMotionRef.current) {
      slide.setValue(0);
      onDayRef.current(target);
      return;
    }
    turning.current = true;
    // Swiping right goes back a day, so the day leaves to the right and the earlier one comes in
    // from the left; forward in time (swiping left) is the other way round.
    const sign = direction === 'previous' ? 1 : -1;
    const out = sign * widthRef.current;
    // A flick carries on at its own speed; a slow release still leaves briskly.
    const remaining = Math.abs(out - position.current);
    position.current = 0;
    const speed = Math.max(Math.abs(velocity), 1);
    const duration = Math.min(EXIT_MS.max, Math.max(EXIT_MS.min, remaining / speed));
    Animated.timing(slide, {
      toValue: out,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        turning.current = false;
        return;
      }
      enterFrom.current = -sign * widthRef.current * ENTER_FROM;
      onDayRef.current(target);
    });
  }).current;

  // The new day swings in once it has rendered, never the old day on the far side for a frame.
  useLayoutEffect(() => {
    const start = enterFrom.current;
    if (start === null) return;
    enterFrom.current = null;
    slide.setValue(start);
    fromSide.setValue(Math.sign(start));
    arrive.setValue(0);
    Animated.spring(slide, {
      toValue: 0,
      ...ENTER_SPRING,
      restDisplacementThreshold: 1,
      restSpeedThreshold: 4,
      useNativeDriver: true,
    }).start(() => {
      turning.current = false;
    });
    // The deal plays out on its own: the next swipe needn't wait for the last widget to land.
    Animated.timing(arrive, {
      toValue: 1,
      duration: ARRIVE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [day, slide, arrive, fromSide]);

  const panHandlers = useMemo(() => {
    const springBack = () => {
      position.current = 0;
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 260,
        damping: 18,
        mass: 1,
      }).start();
    };
    const claims = (gesture: { dx: number; dy: number }) =>
      !turning.current && isSidewaysDrag(gesture.dx, gesture.dy);
    return PanResponder.create({
      // Asked on the way down (capture), so the day takes a sideways drag before anything inside
      // it -- or the page's scroll -- can; never a scroll, nor a tap on a field.
      onMoveShouldSetPanResponderCapture: (_event, gesture) => claims(gesture),
      onMoveShouldSetPanResponder: (_event, gesture) => claims(gesture),
      // Once it's the day's, the page's ScrollView can't take it back mid-swipe.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setSwiping(true),
      onPanResponderMove: (_event, gesture) => {
        if (turning.current) return;
        position.current = gesture.dx;
        slide.setValue(position.current);
      },
      onPanResponderRelease: (_event, gesture) => {
        setSwiping(false);
        const direction = daySwipe(gesture.dx, gesture.vx);
        if (direction) turnTo(direction, gesture.vx);
        else springBack();
      },
      onPanResponderTerminate: () => {
        setSwiping(false);
        springBack();
      },
    }).panHandlers;
  }, [slide, turnTo]);

  const contentStyle = useMemo(() => {
    const range = [-width, 0, width];
    return {
      opacity: slide.interpolate({
        inputRange: [-width, -width * 0.55, 0, width * 0.55, width],
        outputRange: [0, 0.6, 1, 0.6, 0],
        extrapolate: 'clamp',
      }),
      transform: [
        { perspective: 1200 },
        { translateX: slide },
        {
          // Turning on a spindle: the edge it moves toward goes back.
          rotateY: slide.interpolate({
            inputRange: range,
            outputRange: [`-${MAX_TILT_DEG}deg`, '0deg', `${MAX_TILT_DEG}deg`],
            extrapolate: 'clamp',
          }),
        },
        {
          scale: slide.interpolate({
            inputRange: range,
            outputRange: [MIN_SCALE, 1, MIN_SCALE],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }, [slide, width]);

  // Each of the new day's widgets comes in from the side the day does, a little further out and a
  // little later than the one above it, fading up as it lands.
  const widgetStyles = useMemo(
    () =>
      Array.from({ length: DEAL_WIDGETS }, (_, index) => {
        const inputRange = [
          index * DEAL_STEP,
          index * DEAL_STEP + (1 - (DEAL_WIDGETS - 1) * DEAL_STEP),
        ];
        return {
          opacity: arrive.interpolate({ inputRange, outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [
            {
              translateX: Animated.multiply(
                fromSide,
                arrive.interpolate({
                  inputRange,
                  outputRange: [DEAL_OFFSET * (index + 1), 0],
                  extrapolate: 'clamp',
                }),
              ),
            },
          ],
        };
      }),
    [arrive, fromSide],
  );
  const widgetStyle = (index: number) => widgetStyles[Math.min(index, DEAL_WIDGETS - 1)];

  // The first time the screen is seen on this phone, the day nudges left and back: a hint that it
  // turns. Once only, and never under Reduce Motion.
  useEffect(() => {
    if (reduceMotion) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        if (await AsyncStorage.getItem(HINT_KEY)) return;
        await AsyncStorage.setItem(HINT_KEY, '1');
      } catch {
        return;
      }
      if (cancelled) return;
      timer = setTimeout(() => {
        if (cancelled || turning.current) return;
        Animated.sequence([
          Animated.timing(slide, {
            toValue: 36,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 10 }),
        ]).start();
      }, 900);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Re-run only when Reduce Motion is learned to be on, which cancels a hint not yet shown.
  }, [reduceMotion, slide]);

  return { slide, swiping, panHandlers, contentStyle, widgetStyle, turnTo };
}
