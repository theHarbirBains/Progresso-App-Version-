import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { ExerciseThumbnail } from '../exercises/illustrations/ExerciseIllustration';
import { hasIllustration } from '../exercises/illustrations/exerciseArt';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { ProgramFigure } from './ProgramFigure';
import {
  daysLabel,
  defaultVariation,
  exerciseInfo,
  levelsLabel,
  prescription,
  programLevels,
  restLabel,
  styleLabel,
  variationMuscles,
} from './programs';
import { missingFor, needLabel, type HomeEquipment } from './homeEquipment';
import type { ProgramDay, ProgramVariation, WorkoutProgram } from './programTypes';

/**
 * A program in the library: its figure, badge, name, days and style, its variation's focus, and
 * who it suits -- on the variation given (a frequency section's, a recommendation's), else its
 * default. A recommendation's reasons show as pills under it.
 */
export function ProgramCard({
  program,
  variation,
  reasons,
  onPress,
  chosen = false,
  testID,
}: {
  program: WorkoutProgram;
  /** The variation it opens on; its days a week and focus are the card's. */
  variation?: ProgramVariation;
  /** Why it's recommended, a few words each. */
  reasons?: string[];
  onPress: () => void;
  /** The one chosen already (onboarding): ticked. */
  chosen?: boolean;
  testID?: string;
}) {
  const accent = useAppTheme().accent.accent;
  const shown = variation ?? defaultVariation(program);
  const days = variation
    ? `${variation.daysPerWeek} ${variation.daysPerWeek === 1 ? 'day' : 'days'} a week`
    : `${daysLabel(program)} a week`;
  const levels = levelsLabel(variation ? variation.levels : programLevels(program));
  const focus = variation?.focus;
  return (
    <AppCard
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${program.name}${focus ? `, ${focus}` : ''}. ${days}, ${styleLabel(shown)}. ${levels}.${reasons && reasons.length > 0 ? ` ${reasons.join('. ')}.` : ''}${chosen ? ' Chosen.' : ''}`}
    >
      <View style={styles.cardRow}>
        <View style={[styles.figureWell, { backgroundColor: withAlpha(accent, 0.08) }]}>
          <ProgramFigure groups={variationMuscles(shown)} height={68} sides="front" />
        </View>
        <View style={styles.cardBody}>
          {program.badge ? <Badge label={program.badge} /> : null}
          <Text style={styles.cardName}>{program.name}</Text>
          {focus ? <Text style={[styles.cardFocus, { color: accent }]}>{focus}</Text> : null}
          <Text style={styles.cardMeta}>
            {days} · {styleLabel(shown)}
          </Text>
          <Text style={styles.cardLevels}>{levels}</Text>
        </View>
        {chosen ? (
          <Feather name="check-circle" size={20} color={accent} />
        ) : (
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        )}
      </View>
      {reasons && reasons.length > 0 ? (
        <View style={styles.reasons}>
          {reasons.map((reason) => (
            <View key={reason} style={programPartStyles.tag}>
              <Text style={programPartStyles.tagText}>{reason}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

/** A small accent pill ("Popular"). */
export function Badge({ label }: { label: string }) {
  const accent = useAppTheme().accent.accent;
  return (
    <View style={[styles.badge, { backgroundColor: withAlpha(accent, 0.16) }]}>
      <Text style={[styles.badgeText, { color: accent }]}>{label}</Text>
    </View>
  );
}

/** An exercise's picture in a list row: its render's end position, in a rounded square. */
export function ExerciseThumb({ slug, size = 48 }: { slug: string; size?: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {hasIllustration(slug) ? <ExerciseThumbnail slug={slug} size={size} /> : null}
    </View>
  );
}

/**
 * A day's exercises, as planned: each its picture, name, sets and reps (and rest), and note --
 * and, in a home program, "Needs a Bench" where it needs what they haven't said they have.
 */
export function ProgramExerciseList({
  day,
  onOpen,
  owned = null,
  testID,
}: {
  day: ProgramDay;
  onOpen: (exerciseIndex: number) => void;
  /** What they have at home, in a home program; null elsewhere, or when they haven't said. */
  owned?: readonly HomeEquipment[] | null;
  testID?: string;
}) {
  return (
    <AppCard testID={testID} style={styles.listCard}>
      {day.exercises.map((exercise, i) => {
        const info = exerciseInfo(exercise.slug);
        const rest = exercise.restSeconds ? ` · ${restLabel(exercise.restSeconds)}` : '';
        const missing = owned && owned.length > 0 ? missingFor(exercise, owned) : [];
        const needs =
          missing.length > 0
            ? `Needs ${missing.map((need) => needLabel(need)).join(' and ')}`
            : null;
        return (
          <ListRow
            key={`${exercise.slug}-${i}`}
            testID={testID ? `${testID}-${i}` : undefined}
            leading={<ExerciseThumb slug={exercise.slug} />}
            title={info?.name ?? exercise.slug}
            subtitle={`${prescription(exercise)}${rest}`}
            detail={[needs, exercise.note].filter(Boolean).join(' · ') || undefined}
            onPress={() => onOpen(i)}
            divider={i > 0}
          />
        );
      })}
    </AppCard>
  );
}

/** A quiet note in its own widget, led by an `info` glyph. */
export function InfoNote({ text, testID }: { text: string; testID?: string }) {
  const accent = useAppTheme().accent.accent;
  return (
    <AppCard testID={testID}>
      <View style={styles.noteRow}>
        <Feather name="info" size={18} color={accent} />
        <Text style={styles.noteText}>{text}</Text>
      </View>
    </AppCard>
  );
}

/** A line with a tick in the accent ("Why choose this split?"). */
export function CheckLine({ text }: { text: string }) {
  const accent = useAppTheme().accent.accent;
  return (
    <View style={styles.checkLine}>
      <Feather name="check" size={16} color={accent} style={styles.checkIcon} />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

export const programPartStyles = StyleSheet.create({
  /** A pill outlined in the accent's tint ("Hypertrophy"). */
  tag: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagText: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
  },
});

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  figureWell: {
    width: 76,
    height: 84,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    ...typeScale.cardTitle,
    fontFamily: fonts.displayHeavy,
    color: colors.textPrimary,
  },
  cardFocus: {
    ...typeScale.label,
  },
  cardMeta: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  cardLevels: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    marginBottom: 2,
  },
  badgeText: {
    ...typeScale.caption,
  },
  thumb: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  listCard: {
    paddingVertical: spacing.xs,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  noteText: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  checkLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkIcon: {
    marginTop: 2,
  },
  checkText: {
    ...typeScale.callout,
    color: colors.textSecondaryBright,
    flex: 1,
  },
});
