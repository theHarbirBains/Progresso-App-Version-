import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet, useSheetScrollHandler } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { FilterPill } from '../design/FilterPill';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';
import { EQUIPMENT, EQUIPMENT_LABELS, type Equipment } from './equipment';
import {
  GRIP_KINDS,
  GRIP_KIND_LABELS,
  HANDLE_TYPES,
  HANDLE_TYPE_LABELS,
  type GripKind,
  type HandleType,
} from './gripAndHandle';
import {
  MOVEMENT_CATEGORIES,
  MOVEMENT_CATEGORY_LABELS,
  type MovementCategory,
} from './movementCategories';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

export interface ExerciseFilterValues {
  muscle: MuscleGroup | null;
  equipment: Equipment | null;
  grip: GripKind | null;
  handle: HandleType | null;
  movement: MovementCategory | null;
}

export type ExerciseFilterKey = keyof ExerciseFilterValues;

/** How many exercises each choice of a filter would show, with the other filters as they are. */
export type ExerciseFilterCounts = {
  [K in ExerciseFilterKey]: Partial<Record<NonNullable<ExerciseFilterValues[K]>, number>>;
};

interface FilterInfo {
  title: string;
  any: string;
  choices: readonly string[];
  labels: Record<string, string>;
  /** A line under the sheet's title, where what it lists needs saying. */
  note?: string;
}

const FILTERS: Record<ExerciseFilterKey, FilterInfo> = {
  muscle: {
    title: 'Muscle',
    any: 'All Muscles',
    choices: MUSCLE_GROUPS,
    labels: MUSCLE_GROUP_LABELS,
  },
  equipment: {
    title: 'Equipment',
    any: 'All Equipment',
    choices: EQUIPMENT,
    labels: EQUIPMENT_LABELS,
  },
  grip: {
    title: 'Grip',
    any: 'All Grips',
    choices: GRIP_KINDS,
    labels: GRIP_KIND_LABELS,
    note: 'Neutral: palms facing each other. Pronated: palms down. Supinated: palms up. From the grip each exercise records.',
  },
  handle: {
    title: 'Handle',
    any: 'All Handles',
    choices: HANDLE_TYPES,
    labels: HANDLE_TYPE_LABELS,
    note: 'The bar or handle each exercise is done with.',
  },
  movement: {
    title: 'Movement',
    any: 'All Movements',
    choices: MOVEMENT_CATEGORIES,
    labels: MOVEMENT_CATEGORY_LABELS,
    note: "From each built-in's own movement. Your own exercises show under All Movements.",
  },
};

/** The open filter's choices, in a list that scrolls -- the sheet only moves from its top. */
function FilterOptions({
  filterKey,
  values,
  counts,
  accentColor,
  onChoose,
  testID,
}: {
  filterKey: ExerciseFilterKey;
  values: ExerciseFilterValues;
  counts: ExerciseFilterCounts;
  accentColor: string;
  onChoose: (value: string | null) => void;
  testID: string;
}) {
  const onScroll = useSheetScrollHandler();
  const filter = FILTERS[filterKey];
  const shown: Partial<Record<string, number>> = counts[filterKey];
  // Only choices some exercise has -- never one that finds nothing -- and the one set, always.
  const choices = filter.choices.filter(
    (choice) => (shown[choice] ?? 0) > 0 || values[filterKey] === choice,
  );
  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      style={styles.options}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {[null, ...choices].map((choice, i) => {
        const chosen = values[filterKey] === choice;
        const count = choice === null ? null : (shown[choice] ?? 0);
        const label = choice === null ? filter.any : filter.labels[choice]!;
        return (
          <ListRow
            key={choice ?? 'any'}
            testID={`${testID}-option-${choice ?? 'any'}`}
            title={label}
            onPress={() => onChoose(choice)}
            divider={i > 0}
            chevron={false}
            accessibilityLabel={`${label}${count !== null ? `, ${count} exercises` : ''}${
              chosen ? '. Chosen' : ''
            }`}
            trailing={
              <View style={styles.trailing}>
                {count !== null ? <Text style={styles.count}>{count}</Text> : null}
                {chosen ? <Feather name="check" size={18} color={accentColor} /> : null}
              </View>
            }
          />
        );
      })}
    </ScrollView>
  );
}

/**
 * The Exercise Library's (and the picker's) filters, Hevy-style: a pill for each -- All Equipment,
 * All Grips, All Handles, All Movements (and All Muscles where there's no Browse by Muscle), or
 * what it's set to -- in one row that scrolls sideways, each opening its choices in a sheet swiped
 * down to tuck away, with how many exercises each finds (a choice that finds none isn't offered,
 * unless it's the one set); and Clear once anything is set.
 */
export function ExerciseFilters({
  values,
  counts,
  onChange,
  keys,
  accentColor,
  active,
  onClear,
  testID = 'exercise-filters',
}: {
  values: ExerciseFilterValues;
  counts: ExerciseFilterCounts;
  onChange: <K extends ExerciseFilterKey>(key: K, value: ExerciseFilterValues[K]) => void;
  /** Which filters to offer as pills, in order. */
  keys: readonly ExerciseFilterKey[];
  accentColor: string;
  /** Whether anything at all is filtered (a muscle chosen from Browse by Muscle too). */
  active: boolean;
  /** Clears every filter. */
  onClear: () => void;
  testID?: string;
}) {
  const [open, setOpen] = useState<ExerciseFilterKey | null>(null);
  const filter = open ? FILTERS[open] : null;

  return (
    <>
      <ScrollView
        keyboardDismissMode="on-drag"
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.pills}
        testID={testID}
      >
        {keys.map((key) => {
          const value = values[key];
          const label = value === null ? FILTERS[key].any : FILTERS[key].labels[value]!;
          return (
            <FilterPill
              key={key}
              testID={`${testID}-${key}`}
              label={label}
              active={value !== null}
              onPress={() => setOpen(key)}
              accentColor={accentColor}
              accessibilityLabel={`${FILTERS[key].title}: ${label}. Change`}
            />
          );
        })}
        {active ? <TextButton testID={`${testID}-clear`} label="Clear" onPress={onClear} /> : null}
      </ScrollView>

      <BottomSheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        swipeToDismiss
        testID={`${testID}-sheet`}
      >
        <Text style={styles.sheetTitle}>{filter?.title ?? ''}</Text>
        {filter?.note ? <Text style={styles.sheetNote}>{filter.note}</Text> : null}
        {open ? (
          <FilterOptions
            filterKey={open}
            values={values}
            counts={counts}
            accentColor={accentColor}
            onChoose={(choice) => {
              onChange(open, choice as never);
              setOpen(null);
            }}
            testID={testID}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Room for a pill's 44pt touch above and below.
    paddingVertical: 4,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  sheetNote: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  options: {
    flexGrow: 0,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  count: {
    ...typeScale.secondary,
    fontFamily: fonts.mono,
    color: colors.textMuted,
  },
});
