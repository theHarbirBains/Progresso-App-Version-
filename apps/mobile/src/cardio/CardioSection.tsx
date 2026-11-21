import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SecondaryButton, TextButton } from '../design/Button';
import { Card } from '../design/Card';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { cardioDetails, cardioName, formatCardioTime, type CardioValues } from './cardioActivities';
import { formatMinutes, type WorkoutTimes } from './workoutTime';

/** The cardio rows a page shows: one per activity, its name over its figures (and any note). */
export function CardioRows<T extends CardioValues>({
  entries,
  onPress,
  keyOf,
  testID,
}: {
  entries: T[];
  /** Opens one to change or remove; without it the rows are read-only. */
  onPress?: (entry: T) => void;
  keyOf: (entry: T) => string;
  testID: string;
}) {
  return (
    <View>
      {entries.map((entry, index) => (
        <ListRow
          key={keyOf(entry)}
          testID={`${testID}-${keyOf(entry)}`}
          title={cardioName(entry)}
          subtitle={cardioDetails(entry)}
          detail={entry.notes ?? undefined}
          onPress={onPress ? () => onPress(entry) : undefined}
          chevron={onPress !== undefined}
          divider={index < entries.length - 1}
          accessibilityLabel={`${cardioName(entry)}: ${cardioDetails(entry)}${entry.notes ? `. ${entry.notes}` : ''}`}
        />
      ))}
    </View>
  );
}

/**
 * Log/Edit Past Workout's Cardio section: its activities -- each opens to change or remove -- and
 * Add Cardio. Never required.
 */
export function CardioSection<T extends CardioValues>({
  entries,
  onAdd,
  onEdit,
  keyOf,
  testID,
}: {
  entries: T[];
  onAdd: () => void;
  onEdit: (entry: T) => void;
  keyOf: (entry: T) => string;
  testID: string;
}) {
  return (
    <Card testID={testID}>
      <SectionHeader label="Cardio" />
      {entries.length === 0 ? (
        <Text style={styles.note}>
          A run, a ride or the treadmill — before, between or after your lifts.
        </Text>
      ) : (
        <CardioRows testID={`${testID}-entry`} entries={entries} onPress={onEdit} keyOf={keyOf} />
      )}
      <View style={styles.add}>
        <SecondaryButton
          testID={`${testID}-add`}
          size="md"
          label="+ Add Cardio"
          accessibilityLabel="Add Cardio"
          onPress={onAdd}
        />
      </View>
    </Card>
  );
}

/**
 * The live workout's cardio: one slim line at the foot of its pinned widget, under the rep range,
 * so it's always a tap away without pushing the lifting down -- its activities as small pills
 * (each opens to change or remove), sideways when there are many, and + Add. Before, between or
 * after the lifting, as many as the person likes; never required.
 */
export function CardioStrip<T extends CardioValues>({
  entries,
  onAdd,
  onEdit,
  keyOf,
  accentColor,
  testID,
}: {
  entries: T[];
  onAdd: () => void;
  onEdit: (entry: T) => void;
  keyOf: (entry: T) => string;
  accentColor: string;
  testID: string;
}) {
  return (
    <View testID={testID} style={styles.strip}>
      <Feather name="activity" size={16} color={accentColor} />
      <Text style={styles.stripLabel}>Cardio</Text>
      {entries.length === 0 ? (
        <Text style={styles.stripEmpty} numberOfLines={1}>
          None yet
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pills}
          contentContainerStyle={styles.pillsContent}
          keyboardShouldPersistTaps="handled"
        >
          {entries.map((entry) => (
            <Pressable
              key={keyOf(entry)}
              testID={`${testID}-entry-${keyOf(entry)}`}
              onPress={() => onEdit(entry)}
              hitSlop={4}
              style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${cardioName(entry)}: ${cardioDetails(entry)}. Change or remove`}
            >
              <Text style={styles.pillText} numberOfLines={1}>
                {cardioName(entry)} · {formatCardioTime(entry.durationSeconds)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <TextButton
        testID={`${testID}-add`}
        label="+ Add"
        accessibilityLabel="Add Cardio"
        onPress={onAdd}
      />
    </View>
  );
}

/**
 * A finished workout's cardio and its time, told apart: each activity with its figures, then
 * Strength Training, each activity's time and Total Active Training -- rests and breaks in none of
 * them -- and the session's own time, start to finish, under them.
 */
export function WorkoutCardioCard<T extends CardioValues>({
  entries,
  times,
  keyOf,
  testID,
}: {
  entries: T[];
  times: WorkoutTimes;
  keyOf: (entry: T) => string;
  testID: string;
}) {
  return (
    <Card testID={testID}>
      <SectionHeader label="Cardio" />
      <CardioRows testID={`${testID}-entry`} entries={entries} keyOf={keyOf} />
      <View style={styles.table}>
        <SectionHeader label="Time" />
        {times.strengthSeconds !== null ? (
          <TimeRow
            testID={`${testID}-strength`}
            label="Strength Training"
            value={formatMinutes(times.strengthSeconds)}
          />
        ) : null}
        {entries.map((entry) => (
          <TimeRow
            key={keyOf(entry)}
            testID={`${testID}-time-${keyOf(entry)}`}
            label={cardioName(entry)}
            value={formatMinutes(entry.durationSeconds)}
          />
        ))}
        {times.activeSeconds !== null ? (
          <TimeRow
            testID={`${testID}-active`}
            label="Total Active Training"
            value={formatMinutes(times.activeSeconds)}
            total
          />
        ) : null}
        {times.sessionSeconds !== null ? (
          <TimeRow
            testID={`${testID}-session`}
            label="Session, start to finish"
            value={formatMinutes(times.sessionSeconds)}
            quiet
          />
        ) : null}
      </View>
    </Card>
  );
}

function TimeRow({
  label,
  value,
  total = false,
  quiet = false,
  testID,
}: {
  label: string;
  value: string;
  total?: boolean;
  quiet?: boolean;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      style={[styles.timeRow, total && styles.totalRow]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.timeLabel, total && styles.totalText, quiet && styles.quiet]}>
        {label}
      </Text>
      <Text style={[styles.timeValue, total && styles.totalText, quiet && styles.quiet]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // As the rep range's row above it: a hairline, a glyph, the words and a quiet action.
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  stripLabel: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  stripEmpty: {
    ...typeScale.caption,
    color: colors.textMuted,
    flex: 1,
  },
  pills: {
    flex: 1,
  },
  pillsContent: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceLift,
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillText: {
    ...typeScale.caption,
    color: colors.textPrimary,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  add: {
    marginTop: spacing.sm,
  },
  table: {
    marginTop: spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  totalRow: {
    borderTopColor: colors.border,
  },
  timeLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    flex: 1,
  },
  timeValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  totalText: {
    color: colors.textPrimary,
    fontFamily: typeScale.label.fontFamily,
  },
  quiet: {
    color: colors.textMuted,
  },
});
