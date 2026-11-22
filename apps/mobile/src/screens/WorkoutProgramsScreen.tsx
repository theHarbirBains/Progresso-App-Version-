import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { GlyphWell } from '../design/GlyphWell';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { WORKOUT_PROGRAMS } from '../programs/programCatalog';
import { useProgramHost } from '../programs/programHost';
import { frequencyChoices } from '../programs/programs';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'WorkoutPrograms'>;

/** "3, 4, 5 or 6 days a week". */
function frequencyText(): string {
  const days = frequencyChoices(WORKOUT_PROGRAMS);
  if (days.length === 0) return 'Days a week';
  if (days.length === 1) return `${days[0]} days a week`;
  return `${days.slice(0, -1).join(', ')} or ${days[days.length - 1]} days a week`;
}

/**
 * Workout Programs: what they are, then the ways in -- every program, or by goal, by how many days
 * a week, or by focus (each the library, opened on that filter). Until the first programs are
 * written, it says they're on their way. From Workout Splits in the app, and from onboarding's
 * split question (where its first page closes the sheet).
 */
export function WorkoutProgramsScreen({ navigation }: Props) {
  const host = useProgramHost();
  const accent = useAppTheme().accent.accent;
  const count = WORKOUT_PROGRAMS.length;

  return (
    <Screen
      testID="workout-programs"
      header={
        <AppHeader
          title="Workout Programs"
          onBack={host.mode === 'app' ? () => navigation.goBack() : undefined}
          leftAction={
            host.mode === 'onboarding' && host.close
              ? {
                  icon: 'x',
                  onPress: host.close,
                  accessibilityLabel: 'Close',
                  testID: 'workout-programs-close',
                }
              : undefined
          }
        />
      }
    >
      <AppCard hero>
        <View style={styles.intro}>
          <GlyphWell icon="award" accentColor={accent} size={48} />
          <View style={styles.introText}>
            <Text style={styles.introTitle}>Ready-made programs</Text>
            <Text style={styles.introLine}>
              Every workout planned -- each day&apos;s exercises, sets and reps -- with how to do
              each one and the thinking behind it.
            </Text>
          </View>
        </View>
      </AppCard>

      {count === 0 ? (
        <EmptyState
          testID="workout-programs-empty"
          title="Programs are on their way"
          description="Progresso's workout programs are being written. Until then, start from a ready-made split or build your own."
        />
      ) : (
        <AppCard style={styles.list}>
          <ListRow
            testID="workout-programs-all"
            icon="grid"
            title="All Programs"
            subtitle="Browse the whole library"
            value={String(count)}
            onPress={() => navigation.navigate('ProgramLibrary')}
          />
          <ListRow
            testID="workout-programs-by-goal"
            icon="target"
            title="By Goal"
            subtitle="Build muscle, get stronger, lose fat"
            onPress={() => navigation.navigate('ProgramLibrary', { by: 'goal' })}
            divider
          />
          <ListRow
            testID="workout-programs-by-frequency"
            icon="calendar"
            title="By Frequency"
            subtitle={frequencyText()}
            onPress={() => navigation.navigate('ProgramLibrary', { by: 'frequency' })}
            divider
          />
          <ListRow
            testID="workout-programs-by-focus"
            icon="crosshair"
            title="By Focus"
            subtitle="Upper body, lower body, glutes and more"
            onPress={() => navigation.navigate('ProgramLibrary', { by: 'focus' })}
            divider
          />
        </AppCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  introText: {
    flex: 1,
    gap: spacing.xs,
  },
  introTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  introLine: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  list: {
    paddingVertical: spacing.xs,
  },
});
