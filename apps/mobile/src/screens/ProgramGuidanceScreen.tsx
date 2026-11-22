import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { GlyphWell } from '../design/GlyphWell';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { CheckLine } from '../programs/ProgramParts';
import { GUIDANCE_TOPICS, programById } from '../programs/programs';
import type { GuidanceTopic } from '../programs/programTypes';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProgramGuidance'>;

// How Progresso itself helps with each topic -- what the app does, never training advice of its
// own: the advice is the program's (its `guidance`).
const IN_PROGRESSO: Record<GuidanceTopic, string[]> = {
  progression: [
    "Each exercise has a rep range: yours from Settings > Workout Preferences, or the exercise's own.",
    'When a set reaches the top of it, the next time you do that exercise its Last Time says to go up in weight. Progresso never says by how much, and never changes a weight for you.',
    'Every rep record, true 1RM and top set is kept, so each step up shows in Progress.',
  ],
  recovery: [
    'Each day lists its exercises with the sets planned. Started from your split, the workout adds the next set as you fill one in, up to the sets planned.',
    "Tap a set's number to mark it a warm-up: warm-ups never count toward your sets, volume or records.",
    "Progress's Weekly Summary shows the sets and volume each muscle group got this week.",
  ],
  exerciseSelection: [
    'Every exercise in a program has its instructions, the muscles it works and its Key Tips -- tap it to see them.',
    "Where the program lists alternatives, any of them can take an exercise's place when the equipment is busy or doesn't suit you.",
    'Machines differ from gym to gym: add yours in the Exercise Library with its gym and photo, so its records stay its own.',
  ],
};

/**
 * One guidance topic of a program: what it covers, the program's own words on it (when it has
 * some), and how Progresso helps with it.
 */
export function ProgramGuidanceScreen({ navigation, route }: Props) {
  const accent = useAppTheme().accent.accent;
  const program = programById(route.params.programId);
  const topic = GUIDANCE_TOPICS.find((t) => t.topic === route.params.topic) ?? GUIDANCE_TOPICS[0]!;
  const words = program?.guidance?.[topic.topic] ?? [];

  return (
    <Screen
      testID="program-guidance"
      header={<AppHeader title={topic.title} onBack={() => navigation.goBack()} />}
    >
      <AppCard hero>
        <View style={styles.head}>
          <GlyphWell icon={topic.icon} accentColor={accent} size={44} />
          <View style={styles.headText}>
            <Text style={styles.title}>{topic.title}</Text>
            <Text style={styles.summary}>{topic.summary}</Text>
          </View>
        </View>
      </AppCard>

      {words.length > 0 && program ? (
        <>
          <SectionHeader label={program.name} />
          <AppCard testID="program-guidance-program" style={styles.paragraphs}>
            {words.map((paragraph, i) => (
              <Text key={i} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </AppCard>
        </>
      ) : null}

      <SectionHeader label="In Progresso" />
      <AppCard testID="program-guidance-app" style={styles.points}>
        {IN_PROGRESSO[topic.topic].map((line) => (
          <CheckLine key={line} text={line} />
        ))}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  headText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  summary: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  paragraphs: {
    gap: spacing.md,
  },
  paragraph: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
  },
  points: {
    gap: spacing.md,
  },
});
