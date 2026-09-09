import { ScrollView, Text, View } from 'react-native';
import { SectionHeader } from '../design/SectionHeader';
import { colors } from '../design/theme';
import { MuscleVisualization } from '../workouts/MuscleVisualization';
import type { ExerciseHistoryGroup } from '../workouts/allExerciseHistoryQueries';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';
import type { MuscleGroupSetCount } from './muscleGroupProgress';
import { ProgressEmptyState } from './ProgressEmptyState';
import { progressStyles as styles } from './progressStyles';
import { StrengthJourneySection } from './StrengthJourneySection';

interface Props {
  groups: ExerciseHistoryGroup[];
  weightUnit: 'kg' | 'lb';
  theme: { accent: string; onAccent: string };
  oneRepMaxes: OneRepMaxWithExercise[];
  repPRs: RepPRWithExercise[];
  muscleGroupCounts: MuscleGroupSetCount[];
  muscleGroupVisualization: SplitMuscleGroup[];
}

// Strength: the full "how has my strength actually changed" deep-dive --
// same chart as Overview's (detailed=true adds the metrics grid + this
// exercise's own milestone history), plus real per-muscle-group training
// exposure. No fake muscle-growth percentages -- only real completed-set
// counts, per the explicit product rule.
export function StrengthSection({
  groups,
  weightUnit,
  theme,
  oneRepMaxes,
  repPRs,
  muscleGroupCounts,
  muscleGroupVisualization,
}: Props) {
  if (groups.length === 0) {
    return (
      <View style={styles.sectionFill}>
        <ProgressEmptyState
          testID="progress-strength-empty"
          title="Log a workout to start tracking your strength."
          icon="trending-up"
        />
      </View>
    );
  }

  return (
    <ScrollView
      testID="progress-strength-scroll"
      style={styles.sectionFill}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <StrengthJourneySection
        groups={groups}
        weightUnit={weightUnit}
        accentColor={theme.accent}
        onAccentColor={theme.onAccent}
        destructiveColor={colors.destructive}
        oneRepMaxes={oneRepMaxes}
        repPRs={repPRs}
        detailed
        testIDPrefix="progress-strength"
      />

      {muscleGroupCounts.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader label="Muscle Group Progress" />
          <MuscleVisualization
            testID="progress-muscle-visualization"
            muscleGroups={muscleGroupVisualization}
            accentColor={theme.accent}
            side="front"
            scale={0.7}
          />
          {muscleGroupCounts.map((mg) => {
            const max = muscleGroupCounts[0].count;
            const percent = max > 0 ? mg.count / max : 0;
            return (
              <View
                key={mg.group}
                testID={`progress-muscle-group-${mg.group}`}
                style={styles.muscleGroupRow}
              >
                <View style={styles.muscleGroupLabelRow}>
                  <Text style={styles.muscleGroupLabel}>{mg.label}</Text>
                  <Text style={styles.muscleGroupCount}>
                    {mg.count} {mg.count === 1 ? 'set' : 'sets'}
                  </Text>
                </View>
                <View style={styles.muscleGroupBarTrack}>
                  <View
                    style={[
                      styles.muscleGroupBarFill,
                      { width: `${percent * 100}%`, backgroundColor: theme.accent },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}
