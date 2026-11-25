import { StyleSheet, View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { EmptyState } from '../design/EmptyState';
import { GlyphWell } from '../design/GlyphWell';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { spacing } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { ChoiceCard } from '../onboarding/ChoiceCard';
import { InfoNote } from '../programs/ProgramParts';
import {
  programById,
  schedulesOf,
  variationById,
  variationLabel,
  variationsOn,
} from '../programs/programs';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProgramVariations'>;

/**
 * A program's variations, schedule by schedule: each a tile with its focus (or schedule) and its
 * line, the one showing ticked. Choosing one goes back to the program on it.
 */
export function ProgramVariationsScreen({ navigation, route }: Props) {
  const accent = useAppTheme().accent.accent;
  const program = programById(route.params.programId);

  if (!program) {
    return (
      <Screen header={<AppHeader title="Program Variations" onBack={() => navigation.goBack()} />}>
        <EmptyState testID="program-variations-missing" title="This program isn't here" />
      </Screen>
    );
  }

  const current = variationById(program, route.params.variationId);
  const schedules = schedulesOf(program);

  return (
    <Screen
      testID="program-variations"
      header={<AppHeader title="Program Variations" onBack={() => navigation.goBack()} />}
    >
      {schedules.map((schedule) => (
        <View key={schedule.schedule} style={styles.group}>
          {schedules.length > 1 ? (
            <SectionHeader
              label={`${schedule.schedule}${schedule.note ? ` (${schedule.note})` : ''}`}
            />
          ) : null}
          {variationsOn(program, schedule.schedule).map((variation) => (
            <ChoiceCard
              key={variation.id}
              testID={`program-variation-${variation.id}`}
              leading={
                <GlyphWell
                  icon={variation.default ? 'sliders' : 'zap'}
                  accentColor={accent}
                  size={40}
                />
              }
              title={`${variationLabel(variation)}${variation.default ? ' (Default)' : ''}`}
              pill={`${variation.daysPerWeek} days a week`}
              description={variation.focusNote ?? variation.note}
              selected={variation.id === current.id}
              onPress={() =>
                navigation.popTo(
                  'ProgramDetail',
                  { programId: program.id, variationId: variation.id },
                  { merge: true },
                )
              }
            />
          ))}
        </View>
      ))}
      <InfoNote text="You can switch variations any time. Using another makes a new split, and your workouts and records are kept." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
});
