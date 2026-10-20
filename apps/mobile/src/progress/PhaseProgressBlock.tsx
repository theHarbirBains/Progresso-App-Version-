import { TouchableOpacity, View } from 'react-native';
import { TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { formatDayKey } from '../phases/DateField';
import { usePhases } from '../phases/PhaseProvider';
import { PhaseSummary } from '../phases/PhaseSummary';
import { phaseDays, phaseLabel } from '../phases/phaseRules';
import { progressStyles as styles } from './progressStyles';

interface Props {
  weightUnit: 'kg' | 'lb';
  accentColor: string;
  onOpenPhases: () => void;
}

/**
 * Progress Overview's phase block: the phase going now -- its name, how long it has run and how
 * it has gone (PhaseSummary) -- with View opening Phases. With none going, one quiet link to
 * start one; someone who never uses phases sees nothing more than that.
 */
export function PhaseProgressBlock({ weightUnit, accentColor, onOpenPhases }: Props) {
  const { active } = usePhases();
  const { goals } = useNutritionGoals();

  if (!active) {
    return (
      <View testID="progress-phase-none" style={styles.overviewCard}>
        <TextButton
          testID="progress-phase-start"
          label="Track a cut, bulk or maintenance phase"
          onPress={onOpenPhases}
        />
      </View>
    );
  }

  return (
    <View testID="progress-phase" style={styles.overviewCard}>
      <View style={styles.overviewCardHeader}>
        <View style={styles.overviewCardTitleColumn}>
          <Text testID="progress-phase-name" style={styles.overviewCardTitle}>
            {phaseLabel(active)}
          </Text>
          <Text style={styles.overviewCardSubtitle}>
            Day {phaseDays(active)} · since {formatDayKey(active.startDate)}
          </Text>
        </View>
        <TouchableOpacity
          testID="progress-phase-view"
          onPress={onOpenPhases}
          accessibilityRole="button"
          accessibilityLabel={`View your ${phaseLabel(active)}`}
        >
          <Text style={[styles.viewAllText, { color: accentColor }]}>View</Text>
        </TouchableOpacity>
      </View>
      <PhaseSummary
        testID="progress-phase-summary"
        phase={active}
        calorieTarget={active.targets.calories ?? goals?.calories ?? null}
        weightUnit={weightUnit}
      />
    </View>
  );
}
