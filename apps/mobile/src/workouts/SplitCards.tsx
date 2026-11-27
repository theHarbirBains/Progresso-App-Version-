import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { Toggle } from '../design/Toggle';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { MuscleFigure } from '../exercises/MuscleFigure';
import type { MuscleGroup } from '../exercises/muscleGroups';
import { withAlpha } from '../theme/accentColor';
import { PRESET_DESCRIPTIONS, PRESET_ICONS } from './workoutSplitPresetDisplay';
import type { WorkoutSplitPreset } from './workoutSplitPresets';
import type { WorkoutSplitSummary } from './workoutSplitQueries';

// Workout Splits' cards, after Harbir's reference (November 2026): a split of the person's own, a
// ready-made split to start from, and the way to Workout Programs -- each an icon well in the
// accent and words in the heading face -- a ready-made split's and Programs' with one of Harbir's
// figures beside them.

const WELL = 52;

/** A square well with a glyph in the accent: what the card is, at a glance. */
function IconWell({ children, accentColor }: { children: ReactNode; accentColor: string }) {
  return (
    <View style={[styles.well, { backgroundColor: withAlpha(accentColor, 0.1) }]}>{children}</View>
  );
}

/** A section's heading, with a quiet link on its right ("View All"). */
export function SplitsHeading({
  label,
  action,
  accentColor,
  testID,
}: {
  label: string;
  action?: { label: string; onPress: () => void; testID?: string };
  accentColor: string;
  testID?: string;
}) {
  return (
    <View style={styles.heading}>
      <SectionHeader testID={testID} label={label} />
      {action ? (
        <TouchableOpacity
          testID={action.testID}
          onPress={action.onPress}
          hitSlop={12}
          style={styles.headingAction}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={[styles.headingActionText, { color: accentColor }]}>{action.label}</Text>
          <Feather name="chevron-right" size={16} color={accentColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * One of the person's splits: a dumbbell in its well, the name in capitals and how many days it
 * has, Active and its switch on the right -- the active one outlined in the accent; then Edit,
 * Duplicate and Delete along its foot. A tap on the name opens it.
 */
export function SplitCard({
  split,
  active,
  busy,
  accentColor,
  onAccentColor,
  onOpen,
  onActivate,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  split: WorkoutSplitSummary;
  active: boolean;
  busy: boolean;
  accentColor: string;
  onAccentColor: string;
  onOpen: () => void;
  onActivate: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const days =
    split.dayCount !== undefined
      ? `${split.dayCount} ${split.dayCount === 1 ? 'day' : 'days'} / week`
      : null;
  return (
    <AppCard
      testID={`workout-split-${split.id}`}
      hero={active}
      style={active ? [styles.activeCard, { borderColor: accentColor }] : undefined}
    >
      <View style={styles.splitTop}>
        <Pressable
          testID={`workout-split-view-${split.id}`}
          onPress={onOpen}
          disabled={busy}
          style={({ pressed }) => [styles.splitOpen, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${split.name}${days ? `, ${days}` : ''}${active ? ', active' : ''}`}
          accessibilityHint="Opens the split"
        >
          <IconWell accentColor={accentColor}>
            <MaterialCommunityIcons name="dumbbell" size={24} color={accentColor} />
          </IconWell>
          <View style={styles.rule} />
          <View style={styles.splitWords}>
            <Text style={styles.splitName} numberOfLines={2}>
              {split.name.toUpperCase()}
            </Text>
            {days ? (
              <View style={styles.daysRow}>
                <Feather name="calendar" size={14} color={colors.textSecondary} />
                <Text testID={`workout-split-days-${split.id}`} style={styles.days}>
                  {days}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.activeWrap}>
          {active ? <Text style={[styles.activeLabel, { color: accentColor }]}>Active</Text> : null}
          <Toggle
            testID={`workout-split-activate-${split.id}`}
            value={active}
            // Turning an inactive split's switch on makes it the active one (asked first); the
            // active split's own is disabled -- there's no "no split" state, only another taking
            // its place.
            onValueChange={(next) => {
              if (next) onActivate();
            }}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
            accessibilityLabel={active ? 'Active workout split' : 'Set as active split'}
            disabled={busy || active}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          testID={`workout-split-edit-${split.id}`}
          style={styles.action}
          onPress={onEdit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Edit split"
        >
          <Feather name="edit-2" size={18} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`workout-split-duplicate-${split.id}`}
          style={styles.action}
          onPress={onDuplicate}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Duplicate split"
        >
          <Feather name="copy" size={18} color={colors.textSecondary} />
          <Text style={styles.actionLabel}>Duplicate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`workout-split-delete-${split.id}`}
          style={styles.action}
          onPress={onDelete}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Delete split"
        >
          <Feather name="trash-2" size={18} color={colors.destructive} />
          <Text style={[styles.actionLabel, styles.destructive]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </AppCard>
  );
}

/** Each ready-made split's figure: the muscles it's best known for. */
const PRESET_FIGURES: Record<string, MuscleGroup> = {
  ppl: 'shoulders',
  'upper-lower': 'back',
  'full-body': 'quadriceps',
  'bro-split': 'biceps',
  arnold: 'chest',
  'ppl-upper-lower': 'glutes',
};

/**
 * A ready-made split to start from: its glyph in a well, its name in the heading face, what it's
 * for, its days as chips, and a chevron -- one of Harbir's figures, its muscles in the accent,
 * faint behind the chevron. A tap makes it a split of their own and the active one.
 */
export function PresetCard({
  preset,
  busy,
  disabled,
  accentColor,
  onPress,
  testID,
}: {
  preset: WorkoutSplitPreset;
  busy: boolean;
  disabled: boolean;
  accentColor: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <AppCard
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`${preset.name}. ${PRESET_DESCRIPTIONS[preset.id] ?? ''} Days: ${preset.days
        .map((day) => day.name)
        .join(', ')}`}
      style={[busy && [styles.activeCard, { borderColor: accentColor }], disabled && styles.faded]}
    >
      <MuscleFigure
        group={PRESET_FIGURES[preset.id] ?? 'chest'}
        accentColor={accentColor}
        width={130}
        height={150}
        style={styles.presetFigure}
      />
      <View style={styles.presetRow}>
        <IconWell accentColor={accentColor}>
          <Feather name={PRESET_ICONS[preset.id] ?? 'layers'} size={22} color={accentColor} />
        </IconWell>
        <View style={styles.presetWords}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {preset.name}
          </Text>
          {PRESET_DESCRIPTIONS[preset.id] ? (
            <Text style={styles.description}>{PRESET_DESCRIPTIONS[preset.id]}</Text>
          ) : null}
          <View style={styles.chips}>
            {preset.days.map((day) => (
              <View key={day.name} style={styles.chip}>
                <Text style={styles.chipText}>{day.name}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.chevron}>
          <Feather
            name={busy ? 'check' : 'chevron-right'}
            size={18}
            color={busy ? accentColor : colors.textPrimary}
          />
        </View>
      </View>
    </AppCard>
  );
}

/**
 * The way to Workout Programs: one of Harbir's figures in the accent in a well of its own, "Workout
 * Programs" and what they are, and a chevron -- or, while they're Coming Soon, a badge saying so,
 * and nothing to tap.
 */
export function WorkoutProgramsCard({
  open,
  accentColor,
  onPress,
  testID,
}: {
  open: boolean;
  accentColor: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <AppCard
      testID={testID}
      onPress={open ? onPress : undefined}
      accessibilityLabel={
        open
          ? 'Workout Programs. Ready-made, structured programs for your goals.'
          : 'Workout Programs. Coming soon.'
      }
    >
      <View style={styles.programsRow}>
        <View style={styles.programsArt}>
          <MuscleFigure group="back" accentColor={accentColor} width={104} height={118} />
        </View>
        <View style={styles.programsWords}>
          <Text style={styles.cardTitle}>Workout Programs</Text>
          <Text style={styles.description}>Ready-made, structured programs for your goals.</Text>
          {open ? null : (
            <View style={styles.badgeRow}>
              <Badge
                testID={`${testID}-coming-soon`}
                label="Coming Soon"
                color={colors.textMuted}
                backgroundColor={colors.surfaceRaised}
              />
            </View>
          )}
        </View>
        {open ? (
          <View style={styles.chevron}>
            <Feather name="chevron-right" size={18} color={colors.textPrimary} />
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  headingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headingActionText: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
  },
  well: {
    width: WELL,
    height: WELL,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCard: {
    borderWidth: 1.5,
  },
  faded: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  splitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  splitOpen: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
  splitWords: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  splitName: {
    fontFamily: fonts.displayHeavy,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: 0.4,
    color: colors.textPrimary,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  days: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  activeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeLabel: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget,
  },
  actionLabel: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  destructive: {
    color: colors.destructive,
  },
  presetFigure: {
    position: 'absolute',
    right: -spacing.sm,
    top: -spacing.md,
    opacity: 0.45,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  presetWords: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  cardTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 19,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  description: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  chipText: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  chevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  programsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  programsArt: {
    width: 104,
    height: 104,
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  programsWords: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
});
