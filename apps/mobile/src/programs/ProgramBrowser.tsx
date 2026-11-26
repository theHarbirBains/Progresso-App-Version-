import { Feather } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { BottomSheet } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { GlyphWell } from '../design/GlyphWell';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { SegmentedControl } from '../design/SegmentedControl';
import { Text } from '../design/Text';
import { colors, fonts, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { WORKOUT_PROGRAMS } from './programCatalog';
import type { ProgramChoice } from './programHost';
import {
  daysText,
  entryChoice,
  entryDays,
  entryVariations,
  HOME_LIBRARY,
  LIBRARY_FREQUENCIES,
  librarySections,
  PROGRAM_LIBRARY,
  readySplitCount,
  splitCountOf,
  splitTitle,
  type LibraryEntry,
  type LibrarySection,
} from './programLibrary';
import { ProgramCard } from './ProgramParts';
import {
  EQUIPMENT_ACCESS_OPTIONS,
  filtersSet,
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
import { HOME_EQUIPMENT_LABELS } from './homeEquipment';
import type { ProgramSetting, ResolvedVariation } from './programTypes';
import { recommendPrograms, type ProgramPreferences } from './recommendations';

const PILL_HEIGHT = minTouchTarget - 8;
/** A section shows this many titles until Show All; one with a title more shows them all. */
const COLLAPSED_ROWS = 4;

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

/** Every variation a library lists, each once, with its whole profile -- what the filters read. */
function libraryVariations(library: readonly LibrarySection[]): ResolvedVariation[] {
  const seen = new Map<string, ResolvedVariation>();
  for (const section of library) {
    for (const entry of section.entries) {
      for (const variation of entryVariations(entry)) {
        seen.set(`${entry.program}/${variation.id}`, variation);
      }
    }
  }
  return [...seen.values()];
}

const GYM_VARIATIONS = libraryVariations(PROGRAM_LIBRARY);
const HOME_VARIATIONS = libraryVariations(HOME_LIBRARY);

/** A filter's choices, each only where some split has it -- never one that finds nothing. */
function choicesFor(key: FilterKey, variations: readonly ResolvedVariation[]): Choice[] {
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

/** A title's days a week as small rings ("3", "6"), the one chosen above filled in the accent. */
function DayMarks({ days, chosen }: { days: readonly number[]; chosen: number | null }) {
  const { accent } = useAppTheme();
  return (
    <View
      style={styles.dayMarks}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {days.map((count) => {
        const on = count === chosen;
        return (
          <View
            key={count}
            style={[
              styles.dayMark,
              on && { backgroundColor: accent.accent, borderColor: accent.accent },
            ]}
          >
            <Text style={[styles.dayMarkText, on && { color: accent.onAccent }]}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** One title: its name, the words in brackets after it in the accent, its days a week -- and a
 * chevron once it can be opened. */
function SplitRow({
  entry,
  daysPerWeek,
  choice,
  chosen,
  divider,
  onOpen,
  testID,
}: {
  entry: LibraryEntry;
  daysPerWeek: number | null;
  choice: ProgramChoice | null;
  chosen: boolean;
  divider: boolean;
  onOpen: (choice: ProgramChoice) => void;
  testID: string;
}) {
  const { accent } = useAppTheme();
  const { name, detail } = splitTitle(entry.title);
  const days = entryDays(entry);
  const label = `${entry.title}. ${daysText(days)} a week. ${
    choice ? (chosen ? 'Chosen.' : 'Opens it.') : 'Workouts coming soon.'
  }`;
  const body = (
    <>
      <View style={styles.rowWords}>
        <Text style={styles.rowName}>{name}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: accent.accent }]}>{detail}</Text> : null}
      </View>
      <DayMarks days={days} chosen={daysPerWeek} />
      {choice ? (
        <Feather
          name={chosen ? 'check-circle' : 'chevron-right'}
          size={chosen ? 20 : 18}
          color={chosen ? accent.accent : colors.textMuted}
        />
      ) : null}
    </>
  );
  const style = [styles.row, divider && styles.rowDivider];
  return choice ? (
    <TouchableOpacity
      testID={testID}
      style={style}
      onPress={() => onOpen(choice)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {body}
    </TouchableOpacity>
  ) : (
    <View testID={testID} style={style} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
}

/** One of the library's sections: its glyph, title and line, then its titles in one widget --
 * the first few, and the rest behind Show All. */
function LibrarySectionBlock({
  section,
  entries,
  daysPerWeek,
  expanded,
  onToggle,
  isChosen,
  onOpen,
  testID,
}: {
  section: LibrarySection;
  entries: LibraryEntry[];
  daysPerWeek: number | null;
  expanded: boolean;
  onToggle: () => void;
  isChosen: (choice: ProgramChoice | null) => boolean;
  onOpen: (choice: ProgramChoice) => void;
  testID: string;
}) {
  const { accent } = useAppTheme();
  const folds = entries.length > COLLAPSED_ROWS + 1;
  const shown = folds && !expanded ? entries.slice(0, COLLAPSED_ROWS) : entries;
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.sectionHead} accessibilityRole="header">
        <GlyphWell icon={section.icon} accentColor={accent.accent} />
        <View style={styles.sectionWords}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBlurb}>{section.blurb}</Text>
        </View>
        <Text style={styles.sectionCount} accessibilityLabel={`${entries.length} splits`}>
          {entries.length}
        </Text>
      </View>
      <AppCard style={styles.listCard}>
        {shown.map((entry, i) => {
          const choice = entryChoice(entry, WORKOUT_PROGRAMS, daysPerWeek);
          return (
            <SplitRow
              key={entry.title}
              testID={`${testID}-${i}`}
              entry={entry}
              daysPerWeek={daysPerWeek}
              choice={choice}
              chosen={isChosen(choice)}
              divider={i > 0}
              onOpen={onOpen}
            />
          );
        })}
        {folds ? (
          <TouchableOpacity
            testID={`${testID}-more`}
            style={[styles.row, styles.rowDivider, styles.moreRow]}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={
              expanded
                ? `Show fewer ${section.title}`
                : `Show all ${entries.length} ${section.title}`
            }
          >
            <Text style={[styles.moreText, { color: accent.accent }]}>
              {expanded ? 'Show Less' : `Show All ${entries.length}`}
            </Text>
            <Feather
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={accent.accent}
            />
          </TouchableOpacity>
        ) : null}
      </AppCard>
    </View>
  );
}

interface Props {
  /** Opens a program, on a variation of it. */
  onOpen: (choice: ProgramChoice) => void;
  /** What recommendations are worked out from. */
  preferences: ProgramPreferences;
  /** The one chosen already (onboarding), to tick. */
  chosen: ProgramChoice | null;
  /** Where Recommended for You goes while there's nothing to recommend (Workout Splits' way to
   * Workout Preferences). */
  recommendationsPrompt?: ReactNode;
  /** Opens where their home equipment is set (Settings > Workout Preferences); none in
   * onboarding, which asks it as a question of its own. */
  onEditHomeEquipment?: () => void;
  testID?: string;
}

/**
 * The Workout Split Library (programs/programLibrary.ts), to browse: a line on what's in it, how
 * many days a week across the top (2 to 7, then All -- opening on the person's own days), compact
 * filters under it (experience, goal, muscle focus, style, equipment, what's left out), all
 * applying together, then Recommended for You from what they've told us, then the library's
 * sections in Harbir's order -- each its titles in one widget, a few at a time, each title's days
 * a week beside it. A title opens its program once its workouts are in. Workout Splits' Programs
 * tab and onboarding's programs sheet.
 */
export function ProgramBrowser({
  onOpen,
  preferences,
  chosen,
  recommendationsPrompt,
  onEditHomeEquipment,
  testID = 'program-browser',
}: Props) {
  const { accent } = useAppTheme();
  const programs = WORKOUT_PROGRAMS;
  // Gym or home programs: home first for someone who trains with dumbbells or nothing.
  const [setting, setSetting] = useState<ProgramSetting>(() =>
    preferences.equipment === 'dumbbells' || preferences.equipment === 'bodyweight'
      ? 'home'
      : 'gym',
  );
  const library = setting === 'home' ? HOME_LIBRARY : PROGRAM_LIBRARY;
  const variations = setting === 'home' ? HOME_VARIATIONS : GYM_VARIATIONS;
  const splitCount = splitCountOf(library);
  const ownDays = preferences.daysPerWeek !== null ? Math.max(2, preferences.daysPerWeek) : null;
  const [days, setDays] = useState<Days>(() =>
    ownDays !== null &&
    LIBRARY_FREQUENCIES.includes(ownDays) &&
    librarySections({ ...NO_FILTERS, daysPerWeek: ownDays }).length > 0
      ? `${ownDays}`
      : 'all',
  );
  const [filters, setFilters] = useState<ProgramFilters>(NO_FILTERS);
  const [sheet, setSheet] = useState<FilterKey | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const recommendations = useMemo(
    () => recommendPrograms(programs, preferences, 3, setting),
    [programs, preferences, setting],
  );

  const daysPerWeek = days === 'all' ? null : Number(days);
  const applied: ProgramFilters = { ...filters, daysPerWeek };
  const sections = librarySections(applied, library);
  const extra = filtersSet(filters);
  const showRecommended =
    recommendations.length > 0 && extra === 0 && (daysPerWeek === null || daysPerWeek === ownDays);
  const shownCount = new Set(sections.flatMap((shown) => shown.entries.map((entry) => entry.title)))
    .size;
  const allReady = readySplitCount(programs, library) === splitCount;

  function choose(key: FilterKey, value: string | null) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSheet(null);
  }

  function toggle(sectionId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const isChosen = (choice: ProgramChoice | null) =>
    choice !== null &&
    chosen?.programId === choice.programId &&
    chosen.variationId === choice.variationId;

  const sheetChoices = sheet ? choicesFor(sheet, variations) : [];

  // Gym or home, before anything else.
  const settingSwitch = (
    <SegmentedControl<ProgramSetting>
      testID={`${testID}-setting`}
      stretch
      options={[
        { value: 'gym', label: 'Gym', accessibilityLabel: 'Gym workouts' },
        { value: 'home', label: 'Home', accessibilityLabel: 'Home workouts' },
      ]}
      value={setting}
      onChange={(next) => {
        setSetting(next);
        setFilters(NO_FILTERS);
        setDays('all');
      }}
      accentColor={accent.accent}
      onAccentColor={accent.onAccent}
    />
  );
  // At home: what they have, which decides what's recommended -- changed where it's set.
  const owned = preferences.homeEquipment;
  const homeEquipment =
    setting === 'home' && onEditHomeEquipment ? (
      <AppCard>
        <ListRow
          testID={`${testID}-home-equipment`}
          icon="tool"
          title="Your Home Equipment"
          subtitle={
            owned.length > 0
              ? owned.map((item) => HOME_EQUIPMENT_LABELS[item]).join(', ')
              : 'Tell us what you have, for home workouts that use it.'
          }
          onPress={onEditHomeEquipment}
        />
      </AppCard>
    ) : null;

  // No home programs yet: say so, honestly -- nothing is made up to fill it.
  if (setting === 'home' && splitCount === 0) {
    return (
      <View testID={testID} style={styles.browser}>
        {settingSwitch}
        {homeEquipment}
        <EmptyState
          testID={`${testID}-home-empty`}
          title="Home workouts are on their way"
          description="Home programs are being written, each with the equipment it needs. Every one will be here to browse, with the ones that fit what you have recommended."
        />
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.browser}>
      {settingSwitch}
      <Text testID={`${testID}-intro`} style={styles.intro}>
        {`${splitCount} ${setting === 'home' ? 'home ' : ''}splits in ${library.length} ${
          library.length === 1 ? 'category' : 'categories'
        }.`}
        {allReady ? '' : ' Each one opens here once its workouts are in.'}
      </Text>
      {homeEquipment}

      {/* How many days a week: the first thing to choose. */}
      <View style={styles.days}>
        <Text style={styles.kicker}>DAYS PER WEEK</Text>
        <SegmentedControl<Days>
          testID={`${testID}-days`}
          stretch
          options={[
            ...LIBRARY_FREQUENCIES.map((count) => ({
              value: `${count}` as Days,
              label: String(count),
              accessibilityLabel: `${count} days a week`,
            })),
            { value: 'all', label: 'All', accessibilityLabel: 'All frequencies' },
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
              : (choicesFor(key, variations).find((choice) => choice.value === value)?.label ??
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
        <View style={styles.recommended} testID={`${testID}-recommended`}>
          <SectionHeader label="Recommended for You" />
          {recommendations.map((recommendation) => (
            <ProgramCard
              key={recommendation.program.id}
              testID={`${testID}-recommended-${recommendation.program.id}`}
              program={recommendation.program}
              variation={recommendation.variation}
              reasons={recommendation.reasons}
              chosen={isChosen({
                programId: recommendation.program.id,
                variationId: recommendation.variation.id,
              })}
              onPress={() =>
                onOpen({
                  programId: recommendation.program.id,
                  variationId: recommendation.variation.id,
                })
              }
            />
          ))}
        </View>
      ) : (
        (recommendationsPrompt ?? null)
      )}

      {sections.length === 0 ? (
        <EmptyState
          testID={`${testID}-none`}
          title={
            daysPerWeek !== null && extra === 0
              ? `No ${daysPerWeek}-day splits yet`
              : 'No splits match'
          }
          description={
            extra === 0 ? 'Try another day count.' : 'Try another day count or fewer filters.'
          }
          action={{
            label: extra === 0 ? 'Show All' : 'Clear Filters',
            onPress: () => {
              setFilters(NO_FILTERS);
              setDays('all');
            },
            testID: `${testID}-clear-all`,
          }}
        />
      ) : (
        sections.map(({ section, entries }) => (
          <LibrarySectionBlock
            key={section.id}
            testID={`${testID}-section-${section.id}`}
            section={section}
            entries={entries}
            daysPerWeek={daysPerWeek}
            expanded={expanded.has(section.id)}
            onToggle={() => toggle(section.id)}
            isChosen={isChosen}
            onOpen={onOpen}
          />
        ))
      )}

      {sections.length > 0 && (extra > 0 || daysPerWeek !== null) ? (
        <Text testID={`${testID}-count`} style={styles.count}>
          {shownCount} of {splitCount} splits
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
  intro: {
    ...typeScale.callout,
    color: colors.textSecondary,
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
  recommended: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  sectionWords: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sectionTitle: {
    ...typeScale.cardTitle,
    fontFamily: fonts.displayHeavy,
    color: colors.textPrimary,
  },
  sectionBlurb: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  sectionCount: {
    ...typeScale.statSmall,
    color: colors.textMuted,
  },
  listCard: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 8,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowWords: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  rowDetail: {
    ...typeScale.label,
  },
  dayMarks: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayMark: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayMarkText: {
    ...typeScale.caption,
    fontFamily: fonts.monoBold,
    color: colors.textSecondaryBright,
  },
  moreRow: {
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
  },
  moreText: {
    ...typeScale.label,
    fontFamily: fonts.semibold,
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
