import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useAppTheme } from '../theme/appThemeContext';

const mark = require('../../assets/progresso-mark-light.png');
// The mark's own picture is 720 x 598 (the P with room for its shadow).
const MARK_WIDTH = 132;
const MARK_HEIGHT = Math.round((MARK_WIDTH * 598) / 720);
const GLOW = 380;
const RING = 168;

/** How long it holds before it opens onto the first question. */
export const INTRO_HOLD_MS = 2100;
const EXIT_MS = 560;
const REDUCED_HOLD_MS = 1400;
const REDUCED_EXIT_MS = 250;

interface Props {
  /** Picking a draft back up: "Welcome back!" instead. */
  returning: boolean;
  /** As it starts to open: the first question can show beneath it. */
  onReveal: () => void;
  /** Once it's gone. */
  onFinish: () => void;
}

/**
 * What tapping Sign Up opens on: "Let's get you started!" over the theme's background -- the
 * Progresso P springing in at the middle of a soft accent glow, rings rippling out from it, the
 * words rising in one after another -- then it opens onto the first question: the glow swells,
 * the words lift and grow a little, and the whole of it fades as the question's widgets rise in
 * beneath. A tap anywhere opens it at once. Under Reduce Motion it simply shows, then fades.
 */
export function GetStartedIntro({ returning, onReveal, onFinish }: Props) {
  const { accent, theme } = useAppTheme();
  const reduceMotion = useReduceMotionPreference();

  // The preference is read a moment after it opens; whatever's moving then simply settles.
  const reduced = useRef(reduceMotion);
  reduced.current = reduceMotion;

  const fade = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const markIn = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const words = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const leaving = useRef(false);
  const callbacks = useRef({ onReveal, onFinish });
  callbacks.current = { onReveal, onFinish };

  function leave() {
    if (leaving.current) return;
    leaving.current = true;
    callbacks.current.onReveal();
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: reduced.current ? REDUCED_EXIT_MS : EXIT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...(reduced.current
        ? []
        : [
            Animated.timing(lift, {
              toValue: 1,
              duration: EXIT_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
    ]).start(() => callbacks.current.onFinish());
  }

  useEffect(() => {
    if (leaving.current) return undefined;
    const animations: Animated.CompositeAnimation[] = [];
    if (reduceMotion) {
      [glow, markIn, ...words].forEach((value) => value.setValue(1));
      rings.forEach((ring) => ring.setValue(0));
    } else {
      animations.push(
        Animated.timing(glow, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(markIn, { toValue: 1, stiffness: 160, damping: 13, useNativeDriver: true }),
        Animated.stagger(
          130,
          words.map((word) =>
            Animated.timing(word, {
              toValue: 1,
              duration: 460,
              delay: 320,
              easing: Easing.out(Easing.back(1.6)),
              useNativeDriver: true,
            }),
          ),
        ),
        ...rings.map((ring, i) =>
          Animated.sequence([
            Animated.delay(200 + i * 420),
            Animated.loop(
              Animated.timing(ring, {
                toValue: 1,
                duration: 1500,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ),
          ]),
        ),
      );
    }
    const running = Animated.parallel(animations);
    running.start();
    const timer = setTimeout(leave, reduceMotion ? REDUCED_HOLD_MS : INTRO_HOLD_MS);
    return () => {
      clearTimeout(timer);
      running.stop();
    };
    // As it opens, and again if Reduce Motion turns out to be on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const lines = returning
    ? ['Welcome back!', "Let's pick up where you left off."]
    : ["Let's get you", 'started!', 'A few quick questions and Progresso is set up around you.'];
  const title = returning ? lines[0]! : `${lines[0]} ${lines[1]}`;
  const subtitle = returning ? lines[1]! : lines[2]!;

  const rise = (value: Animated.Value) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <Animated.View
      testID="onboarding-intro-screen"
      style={[styles.root, { backgroundColor: theme.background, opacity: fade }]}
    >
      <Pressable
        style={styles.fill}
        onPress={leave}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${subtitle}`}
        accessibilityHint="Opens the first question"
      >
        <Animated.View
          style={[
            styles.centre,
            {
              transform: [
                { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) },
                { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
              ],
            },
          ]}
        >
          <View style={styles.markArea}>
            <Animated.View
              style={[
                styles.glow,
                {
                  opacity: glow,
                  transform: [
                    {
                      scale: Animated.add(
                        glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
                        lift.interpolate({ inputRange: [0, 1], outputRange: [0, 1.4] }),
                      ),
                    },
                  ],
                },
              ]}
            >
              <Svg width={GLOW} height={GLOW}>
                <Defs>
                  <RadialGradient id="introGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={accent.accent} stopOpacity={0.42} />
                    <Stop offset="0.55" stopColor={accent.accent} stopOpacity={0.12} />
                    <Stop offset="1" stopColor={accent.accent} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#introGlow)" />
              </Svg>
            </Animated.View>
            {rings.map((ring, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  {
                    borderColor: accent.accent,
                    opacity: ring.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0, 0.5, 0],
                    }),
                    transform: [
                      { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 2.1] }) },
                    ],
                  },
                ]}
              />
            ))}
            <Animated.View
              style={{
                opacity: markIn,
                transform: [
                  { scale: markIn.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                ],
              }}
            >
              <Image source={mark} style={styles.mark} resizeMode="contain" />
            </Animated.View>
          </View>

          <View style={styles.words}>
            {returning ? (
              <Animated.View style={rise(words[0]!)}>
                <Text style={styles.title}>{lines[0]}</Text>
              </Animated.View>
            ) : (
              <>
                <Animated.View style={rise(words[0]!)}>
                  <Text style={styles.title}>{lines[0]}</Text>
                </Animated.View>
                <Animated.View style={rise(words[1]!)}>
                  <Text style={[styles.title, { color: accent.accent }]}>{lines[1]}</Text>
                </Animated.View>
              </>
            )}
            <Animated.View style={rise(words[returning ? 1 : 2]!)}>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </Animated.View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  fill: {
    flex: 1,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  markArea: {
    width: GLOW,
    height: GLOW * 0.62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: GLOW,
    height: GLOW,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
  },
  mark: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
  },
  words: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typeScale.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typeScale.callout,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 300,
  },
});
