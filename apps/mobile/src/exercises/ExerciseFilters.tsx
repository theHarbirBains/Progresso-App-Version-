import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet } from '../design/BottomSheet';
import { TextButton } from '../design/Button';
import { FilterPill } from '../design/FilterPill';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';
import { EQUIPMENT, EQUIPMENT_LABELS, type Equipment } from './equipment';
import {
  MOVEMENT_CATEGORIES,
  MOVEMENT_CATEGORY_LABELS,
  type MovementCategory,
} from './movementCategories';
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

export interface ExerciseFilterValues {
  muscle: MuscleGroup | null;
  equipment: Equipment | null;
  movement: MovementCategory | null;
}

export type ExerciseFilterKey = keyof ExerciseFilterValues;

/** How many exercises each choice of a filter would show, with the other filters as they are. */
export type ExerciseFilterCounts = {
  [K in ExerciseFilterKey]: Partial<Record<NonNullable<ExerciseFilterValues[K]>, number>>;
};

const FILTERS: Record<
  ExerciseFilterKey,
  { title: string; any: string; choices: readonly string[]; labels: Record<string, string> }
> = {
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
  movement: {
    title: 'Movement',
    any: 'All Movements',
    choices: MOVEMENT_CATEGORIES,
    labels: MOVEMENT_CATEGORY_LABELS,
  },
};

/**
 * The Exercise Library's (and the picker's) filters, Hevy-style: a pill for each -- All Muscles,
 * All Equipment, All Movements, or what it's set to -- each opening its choices in a sheet with
 * how many exercises each finds (a choice that finds none isn't offered, unless it's the one set),
 * and Clear once any is set. Movement is the built-ins' own movement category; a person's own
 * exercise has none, so it shows only while no movement is chosen (the sheet says so).
 */
export function ExerciseFilters({
  values,
  counts,
  onChange,
  keys,
  accentColor,
  testID = 'exercise-filters',
}: {
  values: ExerciseFilterValues;
  counts: ExerciseFilterCounts;
  onChange: <K extends ExerciseFilterKey>(key: K, value: ExerciseFilterValues[K]) => void;
  /** Which filters to offer, in order. */
  keys: readonly ExerciseFilterKey[];
  accentColor: string;
  testID?: string;
}) {
  const [open, setOpen] = useState<ExerciseFilterKey | null>(null);
  const anySet = keys.some((key) => values[key] !== null);
  const filter = open ? FILTERS[open] : null;
  const openCounts: Partial<Record<string, number>> = open ? counts[open] : {};
  const choices = filter
    ? filter.choices.filter(
        (choice) => (openCounts[choice] ?? 0) > 0 || (open && values[open] === choice),
      )
    : [];

  function choose(key: ExerciseFilterKey, value: string | null) {
    onChange(key, value as never);
    setOpen(null);
  }

  return (
    <>
      <View testID={testID} style={styles.pills}>
        {keys.map((key) => {
          const value = values[key];
          const label = value === null ? FILTERS[key].any : FILTERS[key].labels[value];
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
        {anySet ? (
          <TextButton
            testID={`${testID}-clear`}
            label="Clear"
            onPress={() => keys.forEach((key) => onChange(key, null))}
          />
        ) : null}
      </View>

      <BottomSheet visible={open !== null} onClose={() => setOpen(null)} testID={`${testID}-sheet`}>
        <Text style={styles.sheetTitle}>{filter?.title ?? ''}</Text>
        {open === 'movement' ? (
          <Text style={styles.sheetNote}>
            {"From each built-in's own movement. Your own exercises show under All Movements."}
          </Text>
        ) : null}
        <ScrollView
          keyboardDismissMode="on-drag"
          style={styles.options}
          showsVerticalScrollIndicator={false}
        >
          {open && filter
            ? [null, ...choices].map((choice, i) => {
                const chosen = values[open] === choice;
                const count = choice === null ? null : (openCounts[choice] ?? 0);
                return (
                  <ListRow
                    key={choice ?? 'any'}
                    testID={`${testID}-option-${choice ?? 'any'}`}
                    title={choice === null ? filter.any : filter.labels[choice]}
                    onPress={() => choose(open, choice)}
                    divider={i > 0}
                    chevron={false}
                    accessibilityLabel={`${choice === null ? filter.any : filter.labels[choice]}${
                      count !== null ? `, ${count} exercises` : ''
                    }${chosen ? '. Chosen' : ''}`}
                    trailing={
                      <View style={styles.trailing}>
                        {count !== null ? <Text style={styles.count}>{count}</Text> : null}
                        {chosen ? <Feather name="check" size={18} color={accentColor} /> : null}
                      </View>
                    }
                  />
                );
              })
            : null}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
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
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  options: {
    flexGrow: 0,
  },
  count: {
    ...typeScale.secondary,
    fontFamily: fonts.mono,
    color: colors.textMuted,
  },
});
