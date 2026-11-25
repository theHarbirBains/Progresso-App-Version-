import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { WORKOUT_PROGRAMS } from './programCatalog';
import type { ProgramChoice } from './programHost';
import { ProgramCard } from './ProgramParts';
import {
  EQUIPMENT_ACCESS_OPTIONS,
  filtersSet,
  frequencyChoices,
  frequencySections,
  GOAL_CHOICES,
  NO_FILTERS,
  PRIORITY_AREAS,
  PRIORITY_LABELS,
  PROGRAM_LEVELS,
  PROGRAM_LEVEL_LABELS,
  TRAINING_EXCLUSIONS,
  TRAINING_EXCLUSION_LABELS,
  TRAINING_STYLES,
  TRAINING_STYLE_LABELS,
  variationMatches,
  type ProgramFilters,
} from './programs';
import { recommendPrograms, type ProgramPreferences } from './recommendations';
import type { WorkoutProgram } from './programTypes';

const PILL_HEIGHT = minTouchTarget - 8;

type FilterKey = Exclude<keyof ProgramFilters, 'daysPerWeek'>;
type Days = 'all' | `${number}`;

interface Choice {
  key: string;
  label: string;
  value: string | null;
}

const FILTER_TITLES: Record<FilterKey, { title: string; any: string; pill: string }> = {
  level: { title: 'Experience', any: 'Any experience', pill: 'Experience' },
  goal: { title: 'Goal', any: 'Any goal', pill: 'Goal' },
  emphasis: { title: 'Muscle Focus', any: 'Any focus', pill: 'Muscle Focus' },
  style: { title: 'Training Style', any: 'Any style', pill: 'Style' },
  equipment: { title: 'Equipment', any: 'Any equipment', pill: 'Equipment' },
  exclusion: { title: 'Training Preferences', any: 'Everything trained', pill: 'Preferences' },
};

const FILTER_ORDER: readonly FilterKey[] = [
  'level',
  'goal',
  'emphasis',
  'style',
  'equipment',
  'exclusion',
];

/** A filter's choices, each only where some program has it -- never one that finds nothing. */
function choicesFor(key: FilterKey, programs: readonly WorkoutProgram[]): Choice[] {
  const variations = programs.flatMap((program) => program.variations);
  const finds = (patch: Partial<ProgramFilters>) =>
    variations.some((variation) => variationMatches(variation, { ...NO_FILTERS, ...patch }));
  switch (key) {
    case 'level':
      return PROGRAM_LEVELS.filter((level) => finds({ level })).map((level) => ({
        key: level,
        label: PROGRAM_LEVEL_LABELS[level],
        value: level,
      }));
    case 'goal':
      return GOAL_CHOICES.filter((goal) => finds({ goal: goal.value })).map((goal) => ({
        key: goal.value,
        label: goal.label,
        value: goal.value,
      }));
    case 'emphasis':
      return PRIORITY_AREAS.filter((emphasis) => finds({ emphasis })).map((emphasis) => ({
        key: emphasis,
        label: PRIORITY_LABELS[emphasis],
        value: emphasis,
      }));
    case 'style':
      return TRAINING_STYLES.filter((style) => finds({ style })).map((style) => ({
        key: style,
        label: TRAINING_STYLE_LABELS[style],
        value: style,
      }));
    case 'equipment':
      return EQUIPMENT_ACCESS_OPTIONS.filter((option) => finds({ equipment: option.value })).map(
        (option) => ({ key: option.value, label: option.label, value: option.value }),
      );
    case 'exclusion':
      return TRAINING_EXCLUSIONS.filter((exclusion) => finds({ exclusion })).map((exclusion) => ({
        key: exclusion,
        label: TRAINING_EXCLUSION_LABELS[exclusion],
        value: exclusion,
      }));
  }
}

/** One filter: what it's set to (or its name), opening its choices. */
function FilterPill({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { accent } = useAppTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      // Drawn 36pt tall; its touch reaches the full 44pt.
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        styles.pill,
        active && { borderColor: accent.accent, backgroundColor: withAlpha(accent.accent, 0.14) },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Change`}
    >
      <Text style={[styles.pillText, active && { color: accent.accent }]} numberOfLines={1}>
        {label}
      </Text>
      <Feather name="chevron-down" size={14} color={active ? accent.accent : colors.textMuted} />
    </TouchableOpacity>
  );
}

interface Props {
  /** Opens a program, on a variation of it. */
  onOpen: (choice: ProgramChoice) => void;
  /** What recommendations are worked out from. */
  preferences: ProgramPreferences;
  /** The one chosen already (onboarding), to tick. */
  chosen: ProgramChoice | null;
  testID?: string;
}

/**
 * Every workout program, to browse: how many days a week across the top (every frequency some
 * program has, then All -- opening on the person's own days where there are programs for them),
 * compact filters under it (experience, goal, muscle focus, style, equipment, what's left out),
 * all applying together, then Recommended for You from what they've told us and the programs
 * by days a week ("3 Days Per Week"). Until the first programs are written, it says they're on
 * their way. Workout Splits' Programs tab and onboarding's programs sheet.
 */
export function ProgramBrowser({ onOpen, preferences, chosen, testID = 'program-browser' }: Props) {
  const { accent } = useAppTheme();
  const programs = WORKOUT_PROGRAMS;
  const frequencies = useMemo(() => frequencyChoices(programs), [programs]);
  const ownDays = preferences.daysPerWeek !== null ? Math.max(2, preferences.daysPerWeek) : null;
  const [days, setDays] = useState<Days>(
    ownDays !== null && frequencies.includes(ownDays) ? `${ownDays}` : 'all',
  );
  const [filters, setFilters] = useState<ProgramFilters>(NO_FILTERS);
  const [sheet, setSheet] = useState<FilterKey | null>(null);

  const recommendations = useMemo(
    () => recommendPrograms(programs, preferences),
    [programs, preferences],
  );

  if (programs.length === 0) {
    return (
      <EmptyState
        testID={`${testID}-empty`}
        title="Programs are on their way"
        description="Progresso's workout programs are being written, every workout planned. Until then, start from a ready-made split or build your own."
      />
    );
  }

  const daysPerWeek = days === 'all' ? null : Number(days);
  const applied: ProgramFilters = { ...filters, daysPerWeek };
  const sections = frequencySections(programs, applied);
  const extra = filtersSet(filters);
  const showRecommended =
    recommendations.length > 0 && extra === 0 && (daysPerWeek === null || daysPerWeek === ownDays);
  const shownCount = new Set(
    sections.flatMap((section) => section.entries.map((entry) => entry.program.id)),
  ).size;

  function choose(key: FilterKey, value: string | null) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSheet(null);
  }

  const isChosen = (programId: string, variationId: string) =>
    chosen?.programId === programId && chosen.variationId === variationId;

  const sheetChoices = sheet ? choicesFor(sheet, programs) : [];

  return (
    <View testID={testID} style={styles.browser}>
      {/* How many days a week: the first thing to choose. */}
      <View style={styles.days}>
        <Text style={styles.kicker}>DAYS PER WEEK</Text>
        <SegmentedControl<Days>
          testID={`${testID}-days`}
          stretch
          options={[
            ...frequencies.map((count) => ({
              value: `${count}` as Days,
              label: String(count),
              accessibilityLabel: `${count} days a week`,
            })),
            { value: 'all', label: 'All', accessibilityLabel: 'Any days a week' },
          ]}
          value={days}
          onChange={setDays}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
      </View>

      <View style={styles.pills}>
        {FILTER_ORDER.map((key) => {
          const value = filters[key];
          const label =
            value === null
              ? FILTER_TITLES[key].pill
              : (choicesFor(key, programs).find((choice) => choice.value === value)?.label ??
                FILTER_TITLES[key].pill);
          return (
            <FilterPill
              key={key}
              testID={`${testID}-filter-${key}`}
              label={label}
              active={value !== null}
              onPress={() => setSheet(key)}
            />
          );
        })}
        {extra > 0 ? (
          <TextButton
            testID={`${testID}-clear`}
            label="Clear"
            onPress={() => setFilters(NO_FILTERS)}
          />
        ) : null}
      </View>

      {showRecommended ? (
        <View style={styles.section} testID={`${testID}-recommended`}>
          <SectionHeader label="Recommended for You" />
          {recommendations.map((recommendation) => (
            <ProgramCard
              key={recommendation.program.id}
              testID={`${testID}-recommended-${recommendation.program.id}`}
              program={recommendation.program}
              variation={recommendation.variation}
              reasons={recommendation.reasons}
              chosen={isChosen(recommendation.program.id, recommendation.variation.id)}
              onPress={() =>
                onOpen({
                  programId: recommendation.program.id,
                  variationId: recommendation.variation.id,
                })
              }
            />
          ))}
        </View>
      ) : null}

      {sections.length === 0 ? (
        <EmptyState
          testID={`${testID}-none`}
          title="No programs match"
          description="Try another day count or fewer filters."
          action={{
            label: 'Clear Filters',
            onPress: () => {
              setFilters(NO_FILTERS);
              setDays('all');
            },
            testID: `${testID}-clear-all`,
          }}
        />
      ) : (
        sections.map((section) => (
          <View
            key={section.daysPerWeek}
            style={styles.section}
            testID={`${testID}-section-${section.daysPerWeek}`}
          >
            <SectionHeader
              label={`${section.daysPerWeek} ${section.daysPerWeek === 1 ? 'Day' : 'Days'} Per Week`}
            />
            {section.entries.map(({ program, variation }) => (
              <ProgramCard
                key={program.id}
                testID={`${testID}-card-${section.daysPerWeek}-${program.id}`}
                program={program}
                variation={variation}
                chosen={isChosen(program.id, variation.id)}
                onPress={() => onOpen({ programId: program.id, variationId: variation.id })}
              />
            ))}
          </View>
        ))
      )}

      {extra > 0 || daysPerWeek !== null ? (
        <Text testID={`${testID}-count`} style={styles.count}>
          {shownCount} of {programs.length} {programs.length === 1 ? 'program' : 'programs'}
        </Text>
      ) : null}

      <BottomSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        testID={`${testID}-sheet`}
      >
        <Text style={styles.sheetTitle}>{sheet ? FILTER_TITLES[sheet].title : ''}</Text>
        {sheet
          ? [{ key: 'any', label: FILTER_TITLES[sheet].any, value: null }, ...sheetChoices].map(
              (choice, i) => (
                <ListRow
                  key={choice.key}
                  testID={`${testID}-option-${choice.key}`}
                  title={choice.label}
                  onPress={() => choose(sheet, choice.value)}
                  divider={i > 0}
                  chevron={false}
                  trailing={
                    filters[sheet] === choice.value ? (
                      <Feather name="check" size={18} color={accent.accent} />
                    ) : undefined
                  }
                />
              ),
            )
          : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  browser: {
    gap: spacing.lg,
  },
  days: {
    gap: spacing.sm,
  },
  kicker: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: PILL_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  pillText: {
    ...typeScale.label,
    color: colors.textSecondaryBright,
  },
  section: {
    gap: spacing.sm,
  },
  count: {
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
