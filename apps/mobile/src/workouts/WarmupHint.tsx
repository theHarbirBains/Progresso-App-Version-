import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';

// Marking a set a warm-up is a tap on its number (SetNumber), which nothing on the page would
// otherwise say. So the live workout shows a one-time tip on its first exercise until it's
// dismissed, or until a warm-up is first marked -- remembered on this device.

const KEY = '@progresso/warmupHintSeen';

/** Whether the warm-up tip should show, and a way to put it away for good. */
export function useWarmupHint(): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((seen) => {
        if (!cancelled && seen !== '1') setShow(true);
      })
      .catch(() => {
        // Non-critical: without storage, the tip just doesn't show.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const dismiss = useCallback(() => {
    setShow(false);
    AsyncStorage.setItem(KEY, '1').catch(() => {
      // Non-critical.
    });
  }, []);
  return { show, dismiss };
}

/** The tip: a warm-up's "W" as it looks on a set, and what tapping a set's number does. */
export function WarmupHint({
  accentColor,
  onDismiss,
  testID,
}: {
  accentColor: string;
  onDismiss: () => void;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.hint,
        { backgroundColor: withAlpha(accentColor, 0.1), borderColor: withAlpha(accentColor, 0.35) },
      ]}
    >
      <View
        style={[
          styles.chip,
          {
            backgroundColor: withAlpha(accentColor, 0.16),
            borderColor: withAlpha(accentColor, 0.45),
          },
        ]}
      >
        <Text style={[styles.chipText, { color: accentColor }]}>W</Text>
      </View>
      <Text style={styles.text}>
        Tap a set’s number to mark it a warm-up. Warm-ups don’t count toward your records.
      </Text>
      <TouchableOpacity
        testID={testID ? `${testID}-dismiss` : undefined}
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Got it"
      >
        <Feather name="x" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  chip: {
    minWidth: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...typeScale.statSmall,
    fontSize: 13,
  },
  text: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    flex: 1,
  },
});
