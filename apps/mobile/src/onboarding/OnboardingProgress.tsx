import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../design/theme';
import { CandyStripes } from '../design/HolidayDecorations';
import { useAppTheme } from '../theme/appThemeContext';

interface Props {
  testID: string;
  /** One per part of onboarding (stepPlace): how many steps it asks, and how many are done or showing. */
  sections: { steps: number; done: number }[];
}

/**
 * Onboarding's progress: a bar per part (About You, Your Training, ...), each filling in the accent
 * as its steps go by -- a handful of parts to read at a glance, rather than a dash per question.
 * Hidden from VoiceOver: the step's own "About You · 2 of 6" line says the same in words.
 */
export function OnboardingProgress({ testID, sections }: Props) {
  const { accent: theme, decorating } = useAppTheme();
  const accent = theme.accent;
  return (
    <View
      testID={testID}
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {sections.map((section, i) => (
        <View key={i} testID={`${testID}-section-${i}`} style={styles.track}>
          <View
            testID={`${testID}-section-${i}-fill`}
            style={[
              styles.fill,
              {
                width: `${section.steps > 0 ? (section.done / section.steps) * 100 : 0}%`,
                backgroundColor: accent,
              },
            ]}
          >
            {/* Through the holidays, a candy cane's stripes. */}
            {decorating ? <CandyStripes radius={radii.pill} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
