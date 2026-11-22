import { StyleSheet, View } from 'react-native';
import { RiseIn } from '../design/RiseIn';
import { colors, radii, spacing } from '../design/theme';
import type { TrainingComfort } from '../lib/api';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { ChoiceCard } from './ChoiceCard';
import { TRAINING_COMFORT_OPTIONS } from './onboardingOptions';

interface Props {
  testID: string;
  value: TrainingComfort | null;
  onChange: (value: TrainingComfort) => void;
}

const BAR_HEIGHTS = [8, 13, 18, 23];

/** How far along an answer is, as four rising bars filled to its place -- decorative. */
function LevelMeter({ level, accent }: { level: number; accent: string }) {
  return (
    <View
      style={[styles.meter, { backgroundColor: withAlpha(accent, 0.14) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {BAR_HEIGHTS.map((height, i) => (
        <View
          key={height}
          style={[
            styles.bar,
            { height, backgroundColor: i < level ? accent : colors.glassBorderStrong },
          ]}
        />
      ))}
    </View>
  );
}

/** The four answers to "How confident are you in planning and progressing your workouts?" */
export function TrainingComfortSelector({ testID, value, onChange }: Props) {
  const accent = useAppTheme().accent.accent;
  return (
    <View testID={testID} style={styles.list}>
      {TRAINING_COMFORT_OPTIONS.map((option, index) => (
        <RiseIn key={option.value}>
          <ChoiceCard
            testID={`${testID}-${option.value}`}
            leading={<LevelMeter level={index + 1} accent={accent} />}
            title={option.label}
            description={option.description}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
          />
        </RiseIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  meter: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    paddingBottom: 11,
  },
  bar: {
    width: 4,
    borderRadius: radii.pill,
  },
});
