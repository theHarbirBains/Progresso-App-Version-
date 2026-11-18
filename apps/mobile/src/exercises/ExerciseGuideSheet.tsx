import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { AppCard } from '../design/AppCard';
import { ErrorState } from '../design/ErrorState';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import { withAlpha } from '../theme/accentColor';
import { readExerciseGuide, type ExerciseGuide } from './builtinExtras';
import type { Equipment } from './equipment';
import { BUILTIN_GUIDES, type TechniqueCard } from './illustrations/builtinGuides.generated';
import { TechniqueVisual } from './illustrations/TechniqueVisuals';
import { ExercisePhases, MuscleFigures } from './illustrations/ExerciseIllustration';
import { guidePhases, hasIllustration, muscleMapFor } from './illustrations/exerciseArt';
import { MUSCLE_GROUP_LABELS } from './muscleGroups';

interface Props {
  visible: boolean;
  onClose: () => void;
  exerciseId: string;
  /** Shown while the guide is read. */
  exerciseName: string;
  testID?: string;
}

/** The icon in the ring beside the exercise's name, by its equipment. */
const EQUIPMENT_ICONS: Record<Equipment, keyof typeof MaterialCommunityIcons.glyphMap> = {
  dumbbell: 'dumbbell',
  barbell: 'weight-lifter',
  kettlebell: 'kettlebell',
  cable: 'arm-flex',
  machine: 'seat-recline-normal',
  bodyweight: 'human-handsup',
  other: 'dumbbell',
};

/** The three phases' text: the bundled guide (howto.mjs), or for an exercise without one, its own. */
function phaseRows(guide: ExerciseGuide): {
  labels: string[];
  rows: string[];
  tips: readonly string[];
} {
  const own = guide.slug ? BUILTIN_GUIDES[guide.slug] : undefined;
  const phases = guide.slug ? guidePhases(guide.slug) : [];
  const labels =
    phases.length === 3 ? phases.map((phase) => phase.label) : ['Setup', 'Movement', 'Finish'];
  if (own) return { labels, rows: [...own.rows], tips: own.tips };
  const steps = guide.executionSteps;
  const rows = [
    guide.setupSteps.join(' '),
    (steps.length > 1 ? steps.slice(0, -1) : steps).join(' '),
    steps.length > 1 ? steps[steps.length - 1] : '',
  ];
  return { labels, rows, tips: [] };
}

/**
 * How to do a built-in exercise, as a page of its own over whatever opened it -- an iPhone page
 * sheet, swiped down or closed with its X. Laid out like a coaching card: its name and what it
 * targets, a line on what it is and the muscles it works (front and back, primary and secondary);
 * the illustrated instructor through its three phases -- the setup, the movement and the way back
 * -- with a numbered row for each; then its Key Tips beside its Common Mistakes. Read when it opens.
 */
export function ExerciseGuideSheet({
  visible,
  onClose,
  exerciseId,
  exerciseName,
  testID = 'exercise-guide',
}: Props) {
  const accent = useAppTheme().accent.accent;
  const [guide, setGuide] = useState<ExerciseGuide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    readExerciseGuide(exerciseId)
      .then((read) => {
        if (cancelled) return;
        if (read) setGuide(read);
        else setError("This exercise's guide isn't available.");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the guide. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [visible, exerciseId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const shown = guide && guide.name ? guide : null;
  // What it targets, under its name: the drawn illustration's primary muscles ("Quads / Glutes"),
  // or the exercise's own muscle group.
  const target = shown
    ? (muscleMapFor(shown.slug)?.primaryNames.join(' / ') ?? MUSCLE_GROUP_LABELS[shown.muscleGroup])
    : null;
  const drawn = shown && !shown.illustrationUrl && hasIllustration(shown.slug);
  // Technique & Setup's cards: only a drawn built-in has them.
  const technique = shown?.slug && drawn ? (BUILTIN_GUIDES[shown.slug]?.technique ?? []) : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View testID={testID} style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <View style={styles.headerRule} />
            <Text style={styles.headerText} accessibilityRole="header">
              HOW TO DO IT
            </Text>
            <View style={styles.headerRule} />
          </View>
          <TouchableOpacity
            testID={`${testID}-close`}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}
          >
            <Feather name="x" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        {shown && !error ? (
          <Pager
            testID={testID}
            pages={[
              <ScrollView key="how" contentContainerStyle={styles.content}>
                <TitleRow
                  name={shown.name}
                  subtitle={target}
                  equipment={shown.equipment}
                  accent={accent}
                  testID={testID}
                />
                <HowToPage guide={shown} drawn={!!drawn} accent={accent} testID={testID} />
              </ScrollView>,
              ...(technique.length > 0 && shown.slug
                ? [
                    <ScrollView key="technique" contentContainerStyle={styles.content}>
                      <TitleRow
                        name={shown.name}
                        subtitle="Technique & Setup"
                        equipment={shown.equipment}
                        accent={accent}
                        testID={`${testID}-technique`}
                      />
                      <TechniquePage
                        slug={shown.slug}
                        cards={technique}
                        accent={accent}
                        testID={`${testID}-technique`}
                      />
                    </ScrollView>,
                  ]
                : []),
            ]}
            accent={accent}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <TitleRow
              name={exerciseName}
              subtitle={null}
              equipment={shown?.equipment ?? null}
              accent={accent}
              testID={testID}
            />
            {error ? (
              <ErrorState testID={`${testID}-error`} message={error} onRetry={retry} />
            ) : (
              <SkeletonRows testID={`${testID}-loading`} count={5} />
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

/** The ringed equipment icon beside the exercise's name, with a line in the accent under it. */
function TitleRow({
  name,
  subtitle,
  equipment,
  accent,
  testID,
}: {
  name: string;
  subtitle: string | null;
  equipment: Equipment | null;
  accent: string;
  testID: string;
}) {
  return (
    <View style={styles.titleRow}>
      <View style={[styles.titleIcon, { borderColor: accent }]}>
        <MaterialCommunityIcons
          name={EQUIPMENT_ICONS[equipment ?? 'other']}
          size={22}
          color={accent}
        />
      </View>
      <View style={styles.titleText}>
        <Text testID={`${testID}-name`} style={styles.name}>
          {name}
        </Text>
        {subtitle ? (
          <Text testID={`${testID}-target`} style={[styles.target, { color: accent }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The guide's pages side by side, swiped between (How to Do It, then Technique & Setup), with the
 * page dots under them -- the current one in the accent -- and a chevron either side to step.
 */
function Pager({
  pages,
  accent,
  testID,
}: {
  pages: React.ReactNode[];
  accent: string;
  testID: string;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const width = measured || windowWidth;
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);
  const go = (to: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, to));
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };
  return (
    <View style={styles.pager} onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller}
        testID={`${testID}-pages`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={pages.length > 1}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {pages.map((page, i) => (
          <View key={i} testID={`${testID}-page-${i}`} style={{ width }}>
            {page}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 ? (
        <View
          testID={`${testID}-page-dots`}
          style={styles.dots}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Page ${index + 1} of ${pages.length}`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) =>
            go(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))
          }
        >
          <TouchableOpacity
            testID={`${testID}-previous`}
            onPress={() => go(index - 1)}
            disabled={index === 0}
            hitSlop={12}
            style={index === 0 && styles.dimmed}
          >
            <Feather name="chevron-left" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          {pages.map((_, i) => (
            <View
              key={i}
              testID={`${testID}-page-dot-${i}`}
              style={[
                styles.dot,
                i === index ? [styles.dotActive, { backgroundColor: accent }] : null,
              ]}
            />
          ))}
          <TouchableOpacity
            testID={`${testID}-next`}
            onPress={() => go(index + 1)}
            disabled={index === pages.length - 1}
            hitSlop={12}
            style={index === pages.length - 1 && styles.dimmed}
          >
            <Feather name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

/** Technique & Setup: each card a picture beside its title and a line or two. */
function TechniquePage({
  slug,
  cards,
  accent,
  testID,
}: {
  slug: string;
  cards: readonly TechniqueCard[];
  accent: string;
  testID: string;
}) {
  return (
    <View style={styles.sections}>
      {cards.map((c, i) => (
        <AppCard key={i} testID={`${testID}-card-${i}`}>
          <View style={styles.techniqueRow}>
            <TechniqueVisual
              slug={slug}
              visual={c.visual}
              accent={accent}
              size={TECHNIQUE_PICTURE}
              testID={`${testID}-card-${i}-picture`}
            />
            <View style={styles.techniqueText}>
              <Text style={styles.techniqueTitle}>{c.title}</Text>
              <Text style={styles.techniqueBody}>{c.text}</Text>
            </View>
          </View>
        </AppCard>
      ))}
    </View>
  );
}

function HowToPage({
  guide,
  drawn,
  accent,
  testID,
}: {
  guide: ExerciseGuide;
  drawn: boolean;
  accent: string;
  testID: string;
}) {
  const { labels, rows, tips } = phaseRows(guide);
  const mistakes = guide.commonMistakes;
  return (
    <View style={styles.sections}>
      <View style={styles.intro}>
        {guide.summary ? (
          <Text testID={`${testID}-summary`} style={styles.summary}>
            {guide.summary}
          </Text>
        ) : (
          <View style={styles.summary} />
        )}
        {drawn ? (
          <MuscleFigures slug={guide.slug} height={112} testID={`${testID}-muscles`} />
        ) : null}
      </View>
      {/* A hosted image or no drawing: the muscles in words. */}
      {!drawn ? (
        <Text testID={`${testID}-muscle-groups`} style={styles.muscleGroups}>
          {[guide.muscleGroup, ...guide.secondaryMuscleGroups]
            .map((group) => MUSCLE_GROUP_LABELS[group])
            .join(' · ')}
        </Text>
      ) : null}

      {guide.illustrationUrl ? (
        <AppCard testID={`${testID}-illustration-card`}>
          <Image
            testID={`${testID}-illustration-image`}
            source={{ uri: guide.illustrationUrl }}
            style={styles.hostedImage}
            contentFit="contain"
            accessibilityLabel={`How ${guide.name} is done`}
          />
        </AppCard>
      ) : drawn ? (
        <AppCard testID={`${testID}-illustration-card`}>
          <ExercisePhases slug={guide.slug} accent={accent} testID={`${testID}-illustration`} />
        </AppCard>
      ) : null}

      <AppCard testID={`${testID}-steps`} style={styles.rowsCard}>
        {rows.map((text, i) =>
          text ? (
            <View
              key={i}
              testID={`${testID}-step-${i}`}
              style={[styles.stepRow, i > 0 && styles.stepDivider]}
            >
              <View style={[styles.stepNumber, { borderColor: accent }]}>
                <Text style={[styles.stepNumberText, { color: accent }]}>{i + 1}</Text>
              </View>
              <Text style={styles.stepLabel} numberOfLines={2}>
                {labels[i]}
              </Text>
              <View style={[styles.stepRule, { backgroundColor: withAlpha(accent, 0.45) }]} />
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ) : null,
        )}
      </AppCard>

      {tips.length > 0 || mistakes.length > 0 ? (
        <View style={styles.lists}>
          {tips.length > 0 ? (
            <CueList
              title="Key Tips"
              icon="check"
              color={accent}
              items={tips}
              testID={`${testID}-tips`}
            />
          ) : null}
          {mistakes.length > 0 ? (
            <CueList
              title="Common Mistakes"
              icon="x"
              color={colors.destructive}
              items={mistakes}
              testID={`${testID}-mistakes`}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Key Tips or Common Mistakes: a ringed icon and title over its items, each marked the same. */
function CueList({
  title,
  icon,
  color,
  items,
  testID,
}: {
  title: string;
  icon: 'check' | 'x';
  color: string;
  items: readonly string[];
  testID: string;
}) {
  return (
    <AppCard testID={testID} style={styles.listCard}>
      <View style={styles.listHeader}>
        <View
          style={[
            styles.listIcon,
            { backgroundColor: withAlpha(color, 0.14), borderColor: withAlpha(color, 0.5) },
          ]}
        >
          <Feather name={icon} size={14} color={color} />
        </View>
        <Text style={styles.listTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <View style={styles.listItems}>
        {items.map((item, i) => (
          <View key={i} style={styles.listItem}>
            <Feather name={icon} size={14} color={color} style={styles.listMark} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

/** A Technique & Setup card's picture, square. */
const TECHNIQUE_PICTURE = 112;

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textMuted,
  },
  dotActive: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dimmed: {
    opacity: 0.3,
  },
  techniqueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  techniqueText: {
    flex: 1,
    gap: spacing.xs,
  },
  techniqueTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  techniqueBody: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Centred on the page, not on what the close button leaves.
    marginLeft: 36 + spacing.md,
  },
  headerRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  headerText: {
    ...typeScale.caption,
    letterSpacing: 3,
    color: colors.textSecondaryBright,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLift,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorderStrong,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    flex: 1,
  },
  name: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
  },
  target: {
    ...typeScale.callout,
    marginTop: 2,
  },
  sections: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summary: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  muscleGroups: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  hostedImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  rowsCard: {
    paddingVertical: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  stepDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typeScale.label,
  },
  stepLabel: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    width: 72,
  },
  stepRule: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
  },
  stepText: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  lists: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  listCard: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  listIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  listItems: {
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  listMark: {
    marginTop: 2,
  },
  listText: {
    ...typeScale.secondary,
    color: colors.textPrimary,
    flex: 1,
  },
});
