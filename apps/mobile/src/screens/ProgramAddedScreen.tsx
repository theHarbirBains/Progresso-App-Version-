import { Feather } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { GlyphWell } from '../design/GlyphWell';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgramHost } from '../programs/programHost';
import { programById, splitNameFor, variationById } from '../programs/programs';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProgramAdded'>;

/**
 * After Use Program: a tick in a ringed accent circle springing in, "Program Added!" and that
 * it's now one of their splits, the split as a widget (its days), then View My Split and Explore
 * More Programs. In onboarding it's "Program Chosen!" -- the split is made with the account -- and
 * Continue goes on to the next question.
 */
export function ProgramAddedScreen({ navigation, route }: Props) {
  const host = useProgramHost();
  const { accent } = useAppTheme();
  const reduceMotion = useReduceMotionPreference();
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const program = programById(route.params.programId);
  const onboarding = host.mode === 'onboarding';

  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(1);
      return undefined;
    }
    const animation = Animated.spring(pop, {
      toValue: 1,
      stiffness: 180,
      damping: 12,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [pop, reduceMotion]);

  const variation = program ? variationById(program, route.params.variationId) : null;
  const splitName = program && variation ? splitNameFor(program, variation) : 'Your program';

  return (
    <Screen
      testID="program-added"
      header={<AppHeader title="" onBack={() => navigation.goBack()} />}
    >
      <View style={styles.centre}>
        <Animated.View
          style={[
            styles.halo,
            {
              borderColor: withAlpha(accent.accent, 0.3),
              backgroundColor: withAlpha(accent.accent, 0.06),
              opacity: pop,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
              ],
            },
          ]}
        >
          <View style={[styles.ring, { borderColor: accent.accent }]}>
            <Feather name="check" size={44} color={accent.accent} />
          </View>
        </Animated.View>
        <Text style={styles.title}>{onboarding ? 'Program Chosen!' : 'Program Added!'}</Text>
        <Text style={styles.line}>
          {onboarding
            ? `${program?.name ?? 'Your program'} becomes your split as soon as your account is made.`
            : `${program?.name ?? 'Your program'} has been added to your training splits, and it's your active split.`}
        </Text>
      </View>

      {variation ? (
        <AppCard testID="program-added-split">
          <View style={styles.splitRow}>
            <GlyphWell icon="calendar" accentColor={accent.accent} size={40} />
            <View style={styles.splitText}>
              <Text style={styles.splitName}>{splitName}</Text>
              <Text style={styles.splitDays}>
                {variation.days.length}-Day Split · {variation.days.map((d) => d.name).join(' · ')}
              </Text>
            </View>
          </View>
        </AppCard>
      ) : null}

      <View style={styles.actions}>
        {onboarding ? (
          <PrimaryButton
            testID="program-added-continue"
            label="Continue"
            onPress={() => host.finish?.()}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
        ) : route.params.splitId ? (
          <PrimaryButton
            testID="program-added-view-split"
            label="View My Split"
            onPress={() =>
              navigation.navigate('WorkoutSplitView', { splitId: route.params.splitId! })
            }
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
        ) : null}
        <SecondaryButton
          testID="program-added-explore"
          label="Explore More Programs"
          onPress={() => navigation.popTo('WorkoutPrograms')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  halo: {
    width: 132,
    height: 132,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  ring: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typeScale.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  line: {
    ...typeScale.callout,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  splitText: {
    flex: 1,
    gap: 2,
  },
  splitName: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  splitDays: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
