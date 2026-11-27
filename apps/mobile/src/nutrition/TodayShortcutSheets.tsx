import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { FoodImage } from './FoodImage';
import { useFoodLog } from './FoodLogProvider';
import type { FoodLogRow } from './foodLogQueries';
import { amountText, servingMeasures } from './logQuantity';
import { wholeFigure } from './wholeFigures';

/** A log's amount as it was typed, or in servings: "2 cookies", "150 g", "1 serving". */
function logAmount(log: FoodLogRow): string {
  return amountText(
    log.enteredAmount ?? log.quantity,
    log.enteredUnit ?? 'servings',
    servingMeasures(log).pieces,
  );
}

/** Logs to tick: each a row with its picture, name, amount and calories, and a tick. */
function LogChecklist({
  logs,
  selected,
  onToggle,
  accentColor,
  testIDPrefix,
}: {
  logs: FoodLogRow[];
  selected: Set<string>;
  onToggle: (logId: string) => void;
  accentColor: string;
  testIDPrefix: string;
}) {
  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      style={styles.list}
      showsVerticalScrollIndicator={false}
    >
      {logs.map((log, index) => {
        const ticked = selected.has(log.id);
        return (
          <ListRow
            key={log.id}
            testID={`${testIDPrefix}-${log.id}`}
            leading={<FoodImage uri={log.imageUrl} name={log.foodNameSnapshot} size={44} />}
            title={log.foodNameSnapshot}
            subtitle={`${logAmount(log)} · ${wholeFigure(log.calories)} cal`}
            trailing={
              <Feather
                name={ticked ? 'check-circle' : 'circle'}
                size={22}
                color={ticked ? accentColor : colors.textMuted}
              />
            }
            accessibilityLabel={`${log.foodNameSnapshot}, ${logAmount(log)}, ${ticked ? 'selected' : 'not selected'}`}
            divider={index > 0}
            onPress={() => onToggle(log.id)}
          />
        );
      })}
    </ScrollView>
  );
}

// What's unticked is kept, not what's ticked, so every food starts ticked -- each time the
// sheet opens, and one logged while it's open too.
function useTicks(logs: FoodLogRow[], visible: boolean) {
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (visible) setUnticked(new Set());
  }, [visible]);
  const selected = new Set(logs.filter((log) => !unticked.has(log.id)).map((log) => log.id));
  const toggle = (logId: string) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  return { selected, toggle };
}

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  logs: FoodLogRow[];
  accentColor: string;
  onAccentColor: string;
}

/**
 * Copy Yesterday: yesterday's foods, all ticked; untick any not eaten again. Each one ticked
 * is logged now, exactly as it was logged yesterday -- the same figures, the same amount.
 */
export function CopyYesterdaySheet({
  visible,
  onClose,
  logs,
  accentColor,
  onAccentColor,
}: SheetProps) {
  const { copyLogs } = useFoodLog();
  const { selected, toggle } = useTicks(logs, visible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  const count = selected.size;

  async function handleCopy() {
    if (count === 0) return;
    setError(null);
    setSaving(true);
    try {
      // In yesterday's order.
      await copyLogs(logs.filter((log) => selected.has(log.id)).map((log) => log.id));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy foods');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="copy-yesterday-sheet">
      <View style={styles.content}>
        <Text style={styles.title}>Copy Yesterday</Text>
        <Text style={styles.summary}>Untick anything you didn&apos;t have again.</Text>
        <LogChecklist
          logs={logs}
          selected={selected}
          onToggle={toggle}
          accentColor={accentColor}
          testIDPrefix="copy-yesterday-item"
        />
        {error ? (
          <Text testID="copy-yesterday-error" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <PrimaryButton
          testID="copy-yesterday-submit"
          label={count === 1 ? 'Log 1 Food' : `Log ${count} Foods`}
          onPress={() => void handleCopy()}
          loading={saving}
          disabled={count === 0 && !saving}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  summary: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  list: {
    maxHeight: 320,
    marginVertical: spacing.sm,
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
