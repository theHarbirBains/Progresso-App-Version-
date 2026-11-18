import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../../design/Text';
import { colors, radii, spacing, typeScale } from '../../design/theme';
import { useReduceMotionPreference } from '../../navigation/navigationTransitions';
import { withAlpha } from '../../theme/accentColor';
import { BUILTIN_CATALOG } from './builtinCatalog.generated';
import { guidePhases } from './exerciseArt';
import { EXERCISE_RENDERS } from './renders.generated';

// How to Do It's demonstration for an exercise with rendered 3D phases (renders.generated.ts, from
// the Blender pipeline in tools/exercise-renders): one large picture that steps through its three
// phases -- the setup, the movement, the way back -- cross-fading on a loop, the current phase's
// numbered pill lit in the accent. A pill tapped holds that phase; with Reduce Motion it stays on
// the first until one is tapped.

/** How long each phase shows before the next, ms. */
const PHASE_MS = 1700;

/** Whether an exercise has rendered phases. */
export function hasRenders(slug: string | null | undefined): slug is string {
  return !!slug && slug in EXERCISE_RENDERS;
}

export function RenderedPhases({
  slug,
  accent,
  testID,
}: {
  slug: string;
  accent: string;
  testID?: string;
}) {
  const frames = EXERCISE_RENDERS[slug];
  const phases = guidePhases(slug);
  const reduceMotion = useReduceMotionPreference();
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held || reduceMotion || phases.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % phases.length), PHASE_MS);
    return () => clearInterval(timer);
  }, [held, reduceMotion, phases.length]);
  if (!frames || phases.length === 0) return null;
  const phase = phases[index] ?? phases[0];
  const name = BUILTIN_CATALOG[slug]?.name ?? 'the exercise';
  return (
    <View testID={testID} style={styles.wrap}>
      <View
        style={styles.stage}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`How ${name} is done: ${phases.map((p) => p.label).join(', then ')}. Showing ${phase.label}.`}
      >
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={frames[Math.min(phase.frame, frames.length - 1)]}
          style={styles.image}
          contentFit="contain"
          transition={260}
        />
      </View>
      <View style={styles.pills}>
        {phases.map((p, i) => {
          const on = i === index;
          return (
            <TouchableOpacity
              key={i}
              testID={testID ? `${testID}-label-${i}` : undefined}
              onPress={() => {
                setIndex(i);
                setHeld(true);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Phase ${i + 1}, ${p.label}`}
              style={[
                styles.pill,
                on && {
                  backgroundColor: withAlpha(accent, 0.16),
                  borderColor: withAlpha(accent, 0.6),
                },
              ]}
            >
              <View style={[styles.number, { borderColor: accent }]}>
                <Text style={[styles.numberText, { color: accent }]}>{i + 1}</Text>
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  stage: {
    width: '100%',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingLeft: 3,
    paddingRight: spacing.md,
    paddingVertical: 3,
  },
  number: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    ...typeScale.caption,
  },
  label: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
});
