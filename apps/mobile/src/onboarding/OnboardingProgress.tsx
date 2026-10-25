import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  testID: string;
  currentIndex: number;
  totalSteps: number;
}

export function OnboardingProgress({ testID, currentIndex, totalSteps }: Props) {
  const accent = useAppTheme().accent.accent;
  return (
    <View testID={testID} style={styles.row}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          testID={`${testID}-dot-${i}`}
          style={[styles.dot, i <= currentIndex && { backgroundColor: accent }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.divider,
  },
});
