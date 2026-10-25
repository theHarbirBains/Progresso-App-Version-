import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';
import { daySwipe, isPastKey, shiftDay } from './logDay';

// How the Nutrition screen turns from one day to the next. The day's widgets follow the finger
// and turn back in depth as they go -- a slight tilt and shrink, fading -- like a card turned on a
// spindle; let go past the line (or flick) and the day turns away, the new day swings in from the
// other side and settles with a small overshoot. Short of the line it springs back. Toward a day
// after today it only gives a little: nothing is ahead of today. The date above glides along at
// a slower pace (DayBar). Under Reduce Motion the day just changes.

/** How far the new day starts, as a share of the screen's width. */
const ENTER_FROM = 0.7;
/** The most the widgets tilt and shrink, at a full screen's width. */
const MAX_TILT_DEG = 9;
const MIN_SCALE = 0.92;
/** Toward a day after today, a drag moves the widgets this share of the way. */
const PAST_TODAY_GIVE = 0.22;
const ENTER_SPRING = { stiffness: 210, damping: 21, mass: 1 } as const;

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
 * - `panHandlers`: for the widgets and the day bar -- a sideways drag on either turns the day;
 * - `contentStyle`: the widgets' turn -- depth, tilt, shrink and fade, all from `slide`;
 * - `turnTo`: turns to the day before or after, or to any day (Back to Today), with the same turn.
 */
export type DaySwipe = ReturnType<typeof useDaySwipe>;

export function useDaySwipe({ day, onDay, width, reduceMotion }: Options) {
  const slide = useRef(new Animated.Value(0)).current;
  // Where the widgets are, as far as a drag has taken them (slide's own value isn't readable).
  const position = useRef(0);
  const turning = useRef(false);
  // Where the next day starts, set as a turn hands over and used once that day has rendered.
  const enterFrom = useRef<number | null>(null);
  const dayRef = useRef(day);
  dayRef.current = day;
  const onDayRef = useRef(onDay);
  onDayRef.current = onDay;
  const widthRef = useRef(width);
  widthRef.current = width;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  const turnTo = useRef((direction: DayDirection, to?: string, velocity = 0) => {
    const from = dayRef.current;
    const target = to ?? shiftDay(from, direction === 'previous' ? -1 : 1);
    if (turning.current) return;
    if (target === from || (direction === 'next' && !isPastKey(from))) {
      position.current = 0;
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
      return;
    }
    if (reduceMotionRef.current) {
      slide.setValue(0);
      onDayRef.current(target);
      return;
    }
    turning.current = true;
    // Swiping left goes back a day, so the day leaves to the left and the earlier one comes in
    // from the right; forward in time is the other way round.
    const sign = direction === 'previous' ? -1 : 1;
    const out = sign * widthRef.current;
    // A flick carries on at its own speed; a slow release still leaves briskly.
    const remaining = Math.abs(out - position.current);
    position.current = 0;
    const speed = Math.max(Math.abs(velocity), 1.2);
    const duration = Math.min(220, Math.max(110, remaining / speed));
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
    Animated.spring(slide, {
      toValue: 0,
      ...ENTER_SPRING,
      restDisplacementThreshold: 1,
      restSpeedThreshold: 4,
      useNativeDriver: true,
    }).start(() => {
      turning.current = false;
    });
  }, [day, slide]);

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
    return PanResponder.create({
      // A clearly sideways drag -- never a scroll, nor a tap on a field.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        !turning.current &&
        Math.abs(gesture.dx) > 14 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.7,
      onPanResponderMove: (_event, gesture) => {
        if (turning.current) return;
        const pastToday = gesture.dx > 0 && !isPastKey(dayRef.current);
        position.current = pastToday ? gesture.dx * PAST_TODAY_GIVE : gesture.dx;
        slide.setValue(position.current);
      },
      onPanResponderRelease: (_event, gesture) => {
        const direction = daySwipe(gesture.dx, gesture.vx, isPastKey(dayRef.current));
        if (direction) turnTo(direction, undefined, gesture.vx);
        else springBack();
      },
      onPanResponderTerminate: springBack,
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
            toValue: -36,
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

  return { slide, panHandlers, contentStyle, turnTo };
}
