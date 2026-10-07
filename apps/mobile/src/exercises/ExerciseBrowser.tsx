import { useCallback, useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  SectionList,
  TouchableOpacity,
  View,
  type SectionListData,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors } from '../design/theme';
import { exerciseLibraryStyles as styles } from '../screens/exerciseLibraryStyles';
import { groupExercisesByLetter } from './exerciseLibraryGrouping';
import { ExercisePhoto } from './ExercisePhoto';
import type { ExerciseRow, ExerciseSource, ExerciseSourceCounts } from './exerciseQueries';
import { MuscleGroupChips } from './MuscleGroupChips';
import { MOVEMENT_TYPE_LABELS } from './movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

const SOURCE_OPTIONS: { value: ExerciseSource; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builtin', label: 'Built-in' },
  { value: 'mine', label: 'Mine' },
];

interface Props {
  searchInput: string;
  onSearchChange: (text: string) => void;
  muscleGroup: MuscleGroup | null;
  onMuscleGroupChange: (group: MuscleGroup | null) => void;
  source: ExerciseSource;
  onSourceChange: (source: ExerciseSource) => void;
  sourceCounts: ExerciseSourceCounts | null;
  rows: ExerciseRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** The Workout accent, and its soft fill for the selected source tab. */
  accent: { color: string; background: string; onColor: string };
  /** A tap on any exercise (the picker). Its own exercises still get the Mine label. */
  onSelectRow?: (exercise: ExerciseRow) => void;
  /** Greys out a row, e.g. one already in the workout. */
  isRowDisabled?: (exercise: ExerciseRow) => boolean;
  /** Text added after the name, e.g. " (added)". */
  rowSuffix?: (exercise: ExerciseRow) => string;
  /** The library's way into a person's own exercise: the row, and its photo, open the editor. */
  onOpenMine?: (exercise: ExerciseRow) => void;
  /** When given, a photo tap calls this instead of opening the photo itself (the picker shows it). */
  onPhotoPress?: (exercise: ExerciseRow) => void;
  /** A row shown first in the list, above the exercises (the picker's Create Custom). */
  listHeader?: ReactNode;
  testID?: string;
}

/**
 * The Exercise Library's browse layout, shared so every exercise picker looks the same:
 * a browse card (search, muscle filter, and All / Built-in / Mine with real counts), then
 * a list card with the count and the exercises A-Z under letter headings, each with its
 * photo, name, muscle and movement, and a Built-in or Mine marker.
 */
export function ExerciseBrowser({
  searchInput,
  onSearchChange,
  muscleGroup,
  onMuscleGroupChange,
  source,
  onSourceChange,
  sourceCounts,
  rows,
  loading,
  error,
  onRetry,
  accent,
  onSelectRow,
  isRowDisabled,
  rowSuffix,
  onOpenMine,
  onPhotoPress,
  listHeader,
  testID = 'exercise-browser',
}: Props) {
  const sections = useMemo(() => groupExercisesByLetter(rows), [rows]);
  const listSections = useMemo(
    () => sections.map((section) => ({ title: section.letter, data: section.data })),
    [sections],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<ExerciseRow, { title: string }> }) => (
      <View testID={`exercise-library-section-${section.title}`}>
        <SectionHeader label={section.title} />
      </View>
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ExerciseRow; index: number }) => {
      const isMine = item.createdBy != null;
      const disabled = isRowDisabled?.(item) ?? false;
      const onRowPress = onSelectRow
        ? () => onSelectRow(item)
        : isMine && onOpenMine
          ? () => onOpenMine(item)
          : undefined;
      const photo =
        onPhotoPress !== undefined ? (
          <TouchableOpacity
            testID={`exercise-item-${item.id}-photo`}
            onPress={() => item.photoUrl && onPhotoPress(item)}
            disabled={!item.photoUrl}
            accessibilityRole={item.photoUrl ? 'imagebutton' : undefined}
            accessibilityLabel={item.photoUrl ? `View ${item.name} photo` : undefined}
          >
            <ExercisePhoto uri={item.photoUrl} name={item.name} />
          </TouchableOpacity>
        ) : (
          <ExercisePhoto
            testID={`exercise-item-${item.id}-photo`}
            uri={item.photoUrl}
            name={item.name}
            onEdit={isMine && onOpenMine ? () => onOpenMine(item) : undefined}
          />
        );
      return (
        <View style={[styles.row, index > 0 && styles.rowDivider]}>
          <ListRow
            testID={`exercise-item-${item.id}`}
            leading={photo}
            title={`${item.name}${rowSuffix?.(item) ?? ''}`}
            subtitle={`${MUSCLE_GROUP_LABELS[item.muscleGroup]} · ${MOVEMENT_TYPE_LABELS[item.movementType]}`}
            onPress={disabled ? undefined : onRowPress}
            disabled={disabled}
            trailing={
              <>
                <Text
                  style={[styles.sourceLabel, { color: isMine ? accent.color : colors.textMuted }]}
                >
                  {isMine ? 'Mine' : 'Built-in'}
                </Text>
                {isMine && onOpenMine && !onSelectRow ? (
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                ) : null}
              </>
            }
          />
        </View>
      );
    },
    [accent.color, isRowDisabled, onOpenMine, onPhotoPress, onSelectRow, rowSuffix],
  );

  return (
    <>
      <AppCard testID={`${testID}-browse`}>
        <View style={styles.searchWrap}>
          <TextInput
            testID="exercise-search"
            placeholder="Search exercises..."
            accessibilityLabel="Search exercises"
            value={searchInput}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            leftAccessory={<Feather name="search" size={16} color={colors.textMuted} />}
          />
        </View>

        <View testID="exercise-library-muscle-group-wrap" style={styles.chipsWrap}>
          <MuscleGroupChips
            value={muscleGroup}
            onChange={onMuscleGroupChange}
            includeAll
            accentColor={accent.color}
            onAccentColor={accent.onColor}
          />
        </View>

        <View style={styles.sourceTabs}>
          {SOURCE_OPTIONS.map((option) => {
            const selected = option.value === source;
            const count = sourceCounts?.[option.value] ?? null;
            return (
              <TouchableOpacity
                key={option.value}
                testID={`exercise-source-${option.value}`}
                style={[
                  styles.sourceTab,
                  selected
                    ? { backgroundColor: accent.background, borderColor: accent.color }
                    : null,
                ]}
                onPress={() => onSourceChange(option.value)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  count !== null ? `${option.label}, ${count} exercises` : option.label
                }
                accessibilityState={{ selected }}
              >
                <Text style={[styles.sourceTabLabel, selected ? { color: accent.color } : null]}>
                  {option.label}
                </Text>
                <Text
                  testID={`exercise-source-${option.value}-count`}
                  style={styles.sourceTabCount}
                >
                  {count !== null ? String(count) : ' '}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </AppCard>

      <AppCard testID="exercise-library-list" style={styles.listCard}>
        <View style={styles.countSortRow}>
          <Text testID="exercise-library-count" style={styles.countText}>
            {rows.length} {rows.length === 1 ? 'exercise' : 'exercises'}
          </Text>
        </View>

        {error ? (
          <ErrorState testID="exercise-library-error" message={error} onRetry={onRetry} />
        ) : loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              testID="exercise-library-loading"
              size="large"
              color={colors.textPrimary}
            />
          </View>
        ) : (
          <View style={styles.flex}>
            <SectionList
              testID="exercise-library-list-section"
              sections={listSections}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={listHeader ? <>{listHeader}</> : undefined}
              ListEmptyComponent={
                <EmptyState testID="exercise-library-empty" title="No exercises found" />
              }
              renderSectionHeader={renderSectionHeader}
              renderItem={renderItem}
            />
          </View>
        )}
      </AppCard>
    </>
  );
}
