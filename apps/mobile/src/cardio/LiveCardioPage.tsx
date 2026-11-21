import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { SecondaryButton } from '../design/Button';
import { Card } from '../design/Card';
import { EmptyState } from '../design/EmptyState';
import { ListRow } from '../design/ListRow';
import { RiseInStack } from '../design/RiseIn';
import { SectionHeader } from '../design/SectionHeader';
import { spacing } from '../design/theme';
import { formatRecentDate } from '../workouts/workoutFormat';
import { GlyphWell } from '../design/GlyphWell';
import { CardioActivityCard, CardioTotalsCard } from './CardioCards';
import { CARDIO_INFO, cardioDetails, cardioKey, cardioName, lastTimeFor } from './cardioActivities';
import type { CardioEntry, CardioHistoryEntry } from './cardioQueries';

/** How many recent activities Do It Again offers. */
const RECENT_SHOWN = 4;

interface Props {
  /** The workout's cardio so far, in the order it was added. */
  entries: CardioEntry[];
  /** The last time each activity was done, most recent first (useRecentCardio). */
  recent: CardioHistoryEntry[];
  onAdd: () => void;
  onEdit: (entry: CardioEntry) => void;
  /** Starts a new activity from a recent one's figures. */
  onRepeat: (done: CardioHistoryEntry) => void;
  accentColor: string;
  testID?: string;
}

/**
 * The live workout's Cardio page, a swipe from the lifting (ActiveWorkoutScreen): the workout's
 * cardio all together, then each activity as its own widget -- its figures, and what it was the
 * last time, as an exercise shows its Last Time -- then + Add Cardio, and Do It Again: the
 * activities done lately that aren't in this workout yet, each a tap from being added again with
 * the same figures. Before, between or after the lifting, as many as the person likes; never
 * required.
 */
export function LiveCardioPage({
  entries,
  recent,
  onAdd,
  onEdit,
  onRepeat,
  accentColor,
  testID = 'live-cardio',
}: Props) {
  const inWorkout = new Set(entries.map(cardioKey));
  const again = recent.filter((done) => !inWorkout.has(cardioKey(done))).slice(0, RECENT_SHOWN);
  return (
    <RiseInStack>
      {entries.length === 0 ? (
        <Card testID={`${testID}-empty`}>
          <EmptyState
            icon={<GlyphWell icon="activity" accentColor={accentColor} size={44} />}
            title="No cardio yet"
            description="Before, between or after your lifts — add it here."
            action={{ label: '+ Add Cardio', onPress: onAdd, testID: `${testID}-add` }}
          />
        </Card>
      ) : (
        <>
          <CardioTotalsCard
            testID={`${testID}-totals`}
            entries={entries}
            accentColor={accentColor}
          />
          {entries.map((entry) => (
            <CardioActivityCard
              key={entry.id}
              testID={`${testID}-entry-${entry.id}`}
              entry={entry}
              last={lastTimeFor(recent, entry)}
              onEdit={() => onEdit(entry)}
              accentColor={accentColor}
            />
          ))}
          <View style={styles.add}>
            <SecondaryButton
              testID={`${testID}-add`}
              label="+ Add Cardio"
              accessibilityLabel="Add Cardio"
              onPress={onAdd}
            />
          </View>
        </>
      )}

      {again.length > 0 ? (
        <Card testID={`${testID}-again`}>
          <SectionHeader label="Do It Again" />
          {again.map((done, index) => (
            <ListRow
              key={done.id}
              testID={`${testID}-again-${cardioKey(done)}`}
              leading={
                <GlyphWell icon={CARDIO_INFO[done.activity].icon} accentColor={accentColor} />
              }
              title={cardioName(done)}
              subtitle={cardioDetails(done)}
              detail={`Last done ${formatRecentDate(done.performedAt)}`}
              divider={index > 0}
              chevron={false}
              trailing={<Feather name="plus-circle" size={20} color={accentColor} />}
              onPress={() => onRepeat(done)}
              accessibilityLabel={`Add ${cardioName(done)} again: ${cardioDetails(done)}, last done ${formatRecentDate(done.performedAt)}`}
            />
          ))}
        </Card>
      ) : null}
    </RiseInStack>
  );
}

const styles = StyleSheet.create({
  add: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
});
