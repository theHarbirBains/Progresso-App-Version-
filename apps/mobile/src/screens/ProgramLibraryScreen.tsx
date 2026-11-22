import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { BottomSheet } from '../design/BottomSheet';
import { EmptyState } from '../design/EmptyState';
import { FilterChips } from '../design/FilterChips';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { colors, minTouchTarget, radii, spacing, typeScale } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { WORKOUT_PROGRAMS } from '../programs/programCatalog';
import { useProgramHost } from '../programs/programHost';
import { ProgramCard } from '../programs/ProgramParts';
import {
  frequencyChoices,
  GOAL_CHOICES,
  matchesFilters,
  NO_FILTERS,
  PROGRAM_FOCUSES,
  PROGRAM_FOCUS_LABELS,
  PROGRAM_LEVELS,
  PROGRAM_LEVEL_LABELS,
  type ProgramFilters,
} from '../programs/programs';
import type { ProgramLevel } from '../programs/programTypes';
import { withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProgramLibrary'>;
type Sheet = 'goal' | 'frequency' | 'focus';

const PILL_HEIGHT = minTouchTarget - 8;

const SHEET_TITLES: Record<Sheet, string> = {
  goal: 'Goal',
  frequency: 'Days a Week',
  focus: 'Focus',
};

/** One of the filters under the level chips: what it's set to, opening its choices. */
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

/**
 * The program library: experience as chips across the top (All, Beginner, Intermediate,
 * Advanced), then goal, days a week and focus as pills that open their choices, and every
 * program that fits as a card. Opened from By Goal / By Frequency / By Focus, that filter's
 * choices show straight away.
 */
export function ProgramLibraryScreen({ navigation, route }: Props) {
  const host = useProgramHost();
  const { accent } = useAppTheme();
  const [filters, setFilters] = useState<ProgramFilters>(NO_FILTERS);
  const [sheet, setSheet] = useState<Sheet | null>(route.params?.by ?? null);

  const shown = WORKOUT_PROGRAMS.filter((program) => matchesFilters(program, filters));
  const filtered =
    filters.level !== null ||
    filters.goal !== null ||
    filters.daysPerWeek !== null ||
    filters.focus !== null;

  const goalLabel = GOAL_CHOICES.find((g) => g.value === filters.goal)?.label ?? 'Any goal';
  const daysText = filters.daysPerWeek === null ? 'Any days' : `${filters.daysPerWeek} days a week`;
  const focusText = filters.focus === null ? 'Any focus' : PROGRAM_FOCUS_LABELS[filters.focus];

  function choose(patch: Partial<ProgramFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setSheet(null);
  }

  const options: { key: string; label: string; selected: boolean; pick: () => void }[] =
    sheet === 'goal'
      ? [
          {
            key: 'any',
            label: 'Any goal',
            selected: filters.goal === null,
            pick: () => choose({ goal: null }),
          },
          ...GOAL_CHOICES.map((goal) => ({
            key: goal.value,
            label: goal.label,
            selected: filters.goal === goal.value,
            pick: () => choose({ goal: goal.value }),
          })),
        ]
      : sheet === 'frequency'
        ? [
            {
              key: 'any',
              label: 'Any days',
              selected: filters.daysPerWeek === null,
              pick: () => choose({ daysPerWeek: null }),
            },
            ...frequencyChoices(WORKOUT_PROGRAMS).map((days) => ({
              key: String(days),
              label: `${days} days a week`,
              selected: filters.daysPerWeek === days,
              pick: () => choose({ daysPerWeek: days }),
            })),
          ]
        : sheet === 'focus'
          ? [
              {
                key: 'any',
                label: 'Any focus',
                selected: filters.focus === null,
                pick: () => choose({ focus: null }),
              },
              ...PROGRAM_FOCUSES.map((focus) => ({
                key: focus,
                label: PROGRAM_FOCUS_LABELS[focus],
                selected: filters.focus === focus,
                pick: () => choose({ focus }),
              })),
            ]
          : [];

  return (
    <Screen
      testID="program-library"
      header={<AppHeader title="All Programs" onBack={() => navigation.goBack()} />}
    >
      <View style={styles.filters}>
        <FilterChips<'all' | ProgramLevel>
          testID="program-library-level"
          options={[
            { value: 'all', label: 'All' },
            ...PROGRAM_LEVELS.map((level) => ({
              value: level,
              label: PROGRAM_LEVEL_LABELS[level],
            })),
          ]}
          value={filters.level ?? 'all'}
          onChange={(value) => choose({ level: value === 'all' ? null : value })}
          accentColor={accent.accent}
          onAccentColor={accent.onAccent}
        />
        <View style={styles.pills}>
          <FilterPill
            testID="program-library-goal"
            label={goalLabel}
            active={filters.goal !== null}
            onPress={() => setSheet('goal')}
          />
          <FilterPill
            testID="program-library-frequency"
            label={daysText}
            active={filters.daysPerWeek !== null}
            onPress={() => setSheet('frequency')}
          />
          <FilterPill
            testID="program-library-focus"
            label={focusText}
            active={filters.focus !== null}
            onPress={() => setSheet('focus')}
          />
        </View>
      </View>

      {WORKOUT_PROGRAMS.length === 0 ? (
        <EmptyState
          testID="program-library-empty"
          title="Programs are on their way"
          description="Progresso's workout programs are being written. Check back soon."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          testID="program-library-none"
          title="No programs match"
          description="Try fewer filters."
          action={{
            label: 'Clear Filters',
            onPress: () => setFilters(NO_FILTERS),
            testID: 'program-library-clear',
          }}
        />
      ) : (
        <View style={styles.cards}>
          {shown.map((program) => (
            <ProgramCard
              key={program.id}
              testID={`program-card-${program.id}`}
              program={program}
              chosen={host.chosen?.programId === program.id}
              onPress={() => navigation.navigate('ProgramDetail', { programId: program.id })}
            />
          ))}
          {filtered ? (
            <Text style={styles.count}>
              {shown.length} of {WORKOUT_PROGRAMS.length} programs
            </Text>
          ) : null}
        </View>
      )}

      <BottomSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        testID="program-library-sheet"
      >
        <Text style={styles.sheetTitle}>{sheet ? SHEET_TITLES[sheet] : ''}</Text>
        {options.map((option, i) => (
          <ListRow
            key={option.key}
            testID={`program-library-option-${option.key}`}
            title={option.label}
            onPress={option.pick}
            divider={i > 0}
            chevron={false}
            trailing={
              option.selected ? <Feather name="check" size={18} color={accent.accent} /> : undefined
            }
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    gap: spacing.sm,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  cards: {
    gap: spacing.sm,
  },
  count: {
    ...typeScale.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
