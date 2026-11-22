import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { GlyphWell } from '../design/GlyphWell';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import { WORKOUT_PROGRAMS } from './programCatalog';

/**
 * The way into Workout Programs, as one widget: an `award` glyph, "Workout Programs" and how
 * many there are (or that they're coming soon) -- or, once one's chosen in onboarding, which.
 * On Workout Splits, and on onboarding's split question.
 */
export function ProgramsEntryCard({
  onPress,
  chosen = null,
  hero = false,
  testID,
}: {
  onPress: () => void;
  /** The program chosen already (onboarding), by its split's name. */
  chosen?: string | null;
  /** The page's most important widget (onboarding's split question); never beside an active
   * split, which is Workout Splits' hero. */
  hero?: boolean;
  testID?: string;
}) {
  const accent = useAppTheme().accent.accent;
  const count = WORKOUT_PROGRAMS.length;
  const line = chosen
    ? `Chosen: ${chosen}`
    : count > 0
      ? `${count} ready-made ${count === 1 ? 'program' : 'programs'}, every workout planned`
      : 'Coming soon: ready-made programs with every workout planned';
  return (
    <AppCard
      hero={hero}
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`Workout Programs. ${line}`}
    >
      <View style={styles.row}>
        <GlyphWell icon="award" accentColor={accent} size={44} />
        <View style={styles.text}>
          <Text style={styles.title}>Workout Programs</Text>
          <Text style={styles.line}>{line}</Text>
        </View>
        <Feather
          name={chosen ? 'check-circle' : 'chevron-right'}
          size={chosen ? 20 : 18}
          color={chosen ? accent : colors.textMuted}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  line: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
});
