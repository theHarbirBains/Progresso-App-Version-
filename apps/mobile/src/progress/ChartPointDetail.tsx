import { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { colors } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { progressStyles as styles } from './progressStyles';

export interface ChartPointDetailData {
  exerciseName: string;
  weightDisplay: number;
  reps: number;
  performedAt: string;
  unit: 'kg' | 'lb';
  /** This point's own single-set volume (weight x reps) -- not a session total. */
  volumeDisplay: number;
  previous: { weightDisplay: number; reps: number } | null;
  /** Only present when this point is itself a real 1-rep set -- never an estimate. */
  trueOneRepMaxDisplay: number | null;
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  data: ChartPointDetailData;
  accentColor: string;
  onDismiss: () => void;
  testID?: string;
}

/**
 * The accessible, always-readable alternative to tapping the chart itself --
 * the graph is an enhancement for finding a point, this panel is the actual
 * source of truth for its data, readable by any screen reader without ever
 * touching the SVG. Fades in on selection (subtly, and only when motion
 * hasn't been reduced) rather than a hard cut, per the "animate the
 * detail state subtly" requirement.
 */
export function ChartPointDetail({ data, accentColor, onDismiss, testID }: Props) {
  const reduceMotion = useReduceMotionPreference();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    // Re-trigger whenever the underlying point changes, not just on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.performedAt, data.weightDisplay, data.reps]);

  const change =
    data.previous !== null
      ? Math.round((data.weightDisplay - data.previous.weightDisplay) * 100) / 100
      : null;

  return (
    <Animated.View testID={testID} style={[styles.pointDetail, { opacity }]}>
      <View style={styles.pointDetailHeaderRow}>
        <View>
          <Text style={[styles.pointDetailHeadline, { color: accentColor }]}>
            {formatWeight(data.weightDisplay)}
            {data.unit} × {data.reps}
          </Text>
          <Text style={styles.pointDetailMeta}>
            {formatDate(data.performedAt)} · {data.exerciseName}
          </Text>
        </View>
        <TouchableOpacity
          testID={testID ? `${testID}-dismiss` : undefined}
          onPress={onDismiss}
          accessibilityLabel="Dismiss point detail"
          accessibilityRole="button"
          style={styles.pointDetailDismiss}
        >
          <Feather name="x" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.pointDetailStatsRow}>
        <View style={styles.pointDetailStat}>
          <Text style={styles.pointDetailStatLabel}>Volume</Text>
          <Text style={styles.pointDetailStatValue}>
            {formatWeight(data.volumeDisplay)}
            {data.unit}
          </Text>
        </View>
        {data.trueOneRepMaxDisplay !== null ? (
          <View style={styles.pointDetailStat}>
            <Text style={styles.pointDetailStatLabel}>1RM</Text>
            <Text style={styles.pointDetailStatValue}>
              {formatWeight(data.trueOneRepMaxDisplay)}
              {data.unit}
            </Text>
          </View>
        ) : null}
        {data.previous ? (
          <View style={styles.pointDetailStat}>
            <Text style={styles.pointDetailStatLabel}>Previous</Text>
            <Text style={styles.pointDetailStatValue}>
              {formatWeight(data.previous.weightDisplay)}
              {data.unit} × {data.previous.reps}
            </Text>
          </View>
        ) : null}
        {change !== null ? (
          <View style={styles.pointDetailStat}>
            <Text style={styles.pointDetailStatLabel}>Change</Text>
            <Text
              style={[
                styles.pointDetailStatValue,
                { color: change >= 0 ? accentColor : colors.destructive },
              ]}
            >
              {change >= 0 ? '+' : ''}
              {formatWeight(change)}
              {data.unit}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}
