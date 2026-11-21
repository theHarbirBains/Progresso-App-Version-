import { StyleSheet, View } from 'react-native';
import { Card } from '../design/Card';
import { IconButton } from '../design/IconButton';
import { StatBlock } from '../design/StatBlock';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale, widgetGap } from '../design/theme';
import { formatRecentDate } from '../workouts/workoutFormat';
import { GlyphWell } from '../design/GlyphWell';
import {
  CARDIO_INFO,
  cardioDetails,
  cardioFigures,
  cardioName,
  cardioTotals,
  formatCardioTime,
  formatKm,
  type CardioValues,
} from './cardioActivities';

/** Figures three to a row: a last short row keeps each block its third. */
const PER_ROW = 3;

function rowsOf<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * One cardio activity as its own widget -- the live workout's Cardio page and a finished
 * workout's page, yours or a friend's: its glyph in an accent well beside its name, its figures
 * as raised blocks (its time in the accent, then only what was saved, three to a row), any note,
 * and -- where given -- the last time it was done, under a hairline, as a live exercise's Last
 * Time is. With `onEdit` the whole card opens it to change or remove.
 */
export function CardioActivityCard({
  entry,
  last,
  onEdit,
  accentColor,
  testID,
}: {
  entry: CardioValues;
  /** The last time it was done before (its date and figures), when it ever was. */
  last?: (CardioValues & { performedAt: string }) | null;
  onEdit?: () => void;
  accentColor: string;
  testID: string;
}) {
  const name = cardioName(entry);
  const figures = cardioFigures(entry);
  return (
    <Card
      testID={testID}
      onPress={onEdit}
      accessibilityLabel={onEdit ? `${name}: ${cardioDetails(entry)}. Change or remove` : undefined}
    >
      <View style={styles.heading}>
        <GlyphWell icon={CARDIO_INFO[entry.activity].icon} accentColor={accentColor} />
        <Text testID={`${testID}-name`} style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {onEdit ? (
          <IconButton
            testID={`${testID}-edit`}
            icon="edit-2"
            onPress={onEdit}
            accessibilityLabel={`Change ${name}`}
            color={colors.textSecondary}
          />
        ) : null}
      </View>
      <View
        testID={`${testID}-figures`}
        style={styles.figures}
        accessible
        accessibilityLabel={figures.map((figure) => `${figure.label} ${figure.value}`).join(', ')}
      >
        {rowsOf(figures, PER_ROW).map((row) => (
          <View key={row[0].key} style={styles.figureRow}>
            {row.map((figure) => (
              <StatBlock
                key={figure.key}
                testID={`${testID}-${figure.key}`}
                value={figure.value}
                label={figure.label}
                valueColor={figure.key === 'time' ? accentColor : undefined}
              />
            ))}
            {Array.from({ length: PER_ROW - row.length }, (_, i) => (
              <View key={`gap-${i}`} style={styles.gap} />
            ))}
          </View>
        ))}
      </View>
      {entry.notes ? <Text style={styles.notes}>{entry.notes}</Text> : null}
      {last ? (
        <View testID={`${testID}-last`} style={styles.last}>
          <Text style={styles.lastLabel}>Last Time · {formatRecentDate(last.performedAt)}</Text>
          <Text style={styles.lastFigures}>{cardioDetails(last)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * A workout's cardio all together, heading its cardio: "Cardio" beside its glyph, then its time,
 * distance (when any has one) and how many activities as raised blocks.
 */
export function CardioTotalsCard({
  entries,
  accentColor,
  testID,
}: {
  entries: CardioValues[];
  accentColor: string;
  testID: string;
}) {
  const totals = cardioTotals(entries);
  return (
    <Card testID={testID}>
      <View style={styles.heading}>
        <GlyphWell icon="activity" accentColor={accentColor} />
        <Text style={styles.name}>Cardio</Text>
      </View>
      <View style={styles.figureRow}>
        <StatBlock
          testID={`${testID}-time`}
          value={formatCardioTime(totals.seconds)}
          label="Time"
          valueColor={accentColor}
        />
        {totals.distanceM !== null ? (
          <StatBlock
            testID={`${testID}-distance`}
            value={formatKm(totals.distanceM)}
            label="Distance"
          />
        ) : null}
        <StatBlock
          testID={`${testID}-count`}
          value={String(totals.count)}
          label={totals.count === 1 ? 'Activity' : 'Activities'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  name: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  figures: {
    gap: widgetGap,
  },
  figureRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  gap: {
    flex: 1,
  },
  notes: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  last: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  lastLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  lastFigures: {
    ...typeScale.callout,
    fontFamily: fonts.mono,
    color: colors.textSecondary,
  },
});
