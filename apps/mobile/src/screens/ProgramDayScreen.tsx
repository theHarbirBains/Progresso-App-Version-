import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { ProgramFigure } from '../programs/ProgramFigure';
import { ProgramExerciseList } from '../programs/ProgramParts';
import { musclesText, programById, variationById } from '../programs/programs';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProgramDay'>;

/**
 * One day of a program, as planned: "Day 1 — Push", what it trains (in words and on the figure),
 * and its exercises in order -- each its picture, name, sets and reps -- each opening its page.
 */
export function ProgramDayScreen({ navigation, route }: Props) {
  const { accent } = useAppTheme();
  const { programId, variationId, dayIndex } = route.params;
  const program = programById(programId);
  const day = program ? variationById(program, variationId).days[dayIndex] : undefined;

  if (!program || !day) {
    return (
      <Screen header={<AppHeader title="Workout" onBack={() => navigation.goBack()} />}>
        <EmptyState
          testID="program-day-missing"
          title="This workout isn't here"
          description="Its program may have changed."
        />
      </Screen>
    );
  }

  const sets = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);

  return (
    <Screen
      testID="program-day"
      header={<AppHeader title={program.name} onBack={() => navigation.goBack()} />}
    >
      <AppCard hero>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.title}>
              Day {dayIndex + 1} — {day.name}
            </Text>
            <Text style={styles.muscles}>{musclesText(day.muscleGroups)}</Text>
            <Text style={styles.count}>
              {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'} ·{' '}
              {sets} {sets === 1 ? 'set' : 'sets'}
            </Text>
          </View>
          <View style={[styles.figure, { backgroundColor: withAlpha(accent.accent, 0.08) }]}>
            <ProgramFigure groups={day.muscleGroups} height={96} />
          </View>
        </View>
      </AppCard>

      <ProgramExerciseList
        testID="program-day-exercise"
        day={day}
        onOpen={(exerciseIndex) =>
          navigation.navigate('ProgramExercise', {
            slug: day.exercises[exerciseIndex]!.slug,
            programId,
            variationId,
            dayIndex,
            exerciseIndex,
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  muscles: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
  },
  count: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  figure: {
    borderRadius: radii.md,
    padding: spacing.sm,
  },
});
