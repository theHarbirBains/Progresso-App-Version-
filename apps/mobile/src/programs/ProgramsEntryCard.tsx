import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { GlyphWell } from '../design/GlyphWell';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import { WORKOUT_PROGRAMS } from './programCatalog';
import { LIBRARY_SPLIT_COUNT, PROGRAM_LIBRARY, readySplitCount } from './programLibrary';

/**
 * The way into the Split Library, as one widget: a `book-open` glyph, "Split Library", how many
 * splits it has and how many are ready to use (or that their workouts are coming) -- or, once
 * one's chosen in onboarding, which. On Workout Splits' My Splits, and on onboarding's split
 * question.
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
  const ready = readySplitCount(WORKOUT_PROGRAMS);
  const library = `${LIBRARY_SPLIT_COUNT} splits in ${PROGRAM_LIBRARY.length} categories`;
  const line = chosen
    ? `Chosen: ${chosen}`
    : ready > 0
      ? `${library}, ${ready} ready to use`
      : `${library}. Workouts coming soon.`;
  return (
    <AppCard
      hero={hero}
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`Split Library. ${line}`}
    >
      <View style={styles.row}>
        <GlyphWell icon="book-open" accentColor={accent} size={44} />
        <View style={styles.text}>
          <Text style={styles.title}>Split Library</Text>
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
