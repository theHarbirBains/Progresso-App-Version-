import { StyleSheet, View } from 'react-native';
import { SecondaryButton } from '../design/Button';
import { Card } from '../design/Card';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { GlyphWell } from '../design/GlyphWell';
import { CardioActivityCard } from './CardioCards';
import { cardioDetails, cardioName, type CardioValues } from './cardioActivities';
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
 * A finished workout's cardio -- yours or a friend's -- and its time, told apart: each activity as
 * its own widget (CardioActivityCard: its glyph, name and figures), then a Time widget --
 * Strength Training, each activity's time and Total Active Training, rests and breaks in none of
 * them -- and the session's own time, start to finish, under them.
 */
export function WorkoutCardio<T extends CardioValues>({
  entries,
  times,
  keyOf,
  accentColor,
  testID,
}: {
  entries: T[];
  times: WorkoutTimes;
  keyOf: (entry: T) => string;
  accentColor: string;
  testID: string;
}) {
  return (
    <View testID={testID} style={styles.stack}>
      {entries.map((entry) => (
        <CardioActivityCard
          key={keyOf(entry)}
          testID={`${testID}-entry-${keyOf(entry)}`}
          entry={entry}
          accentColor={accentColor}
        />
      ))}
      <Card testID={`${testID}-times`}>
        <View style={styles.timeHeading}>
          <GlyphWell icon="clock" accentColor={accentColor} />
          <Text style={styles.timeTitle}>Time</Text>
        </View>
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
      </Card>
    </View>
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
  // A finished workout's cardio widgets, as far apart as every page's.
  stack: {
    gap: widgetGap,
  },
  timeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  timeTitle: {
    ...typeScale.cardTitle,
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
