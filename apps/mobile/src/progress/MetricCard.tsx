import { Text, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { progressStyles as styles } from './progressStyles';

interface Props {
  label: string;
  value: number | null;
  unit?: string;
  emptyLabel?: string;
  testID?: string;
}

/** One of the "Progress Metrics" row cards (Top Set / 1RM / Volume / PRs) on Overview. */
export function MetricCard({ label, value, unit, emptyLabel = 'No data yet', testID }: Props) {
  return (
    <AppCard testID={testID} style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      {value !== null ? (
        <View>
          <Text style={styles.metricValue}>
            {value}
            {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
          </Text>
        </View>
      ) : (
        <Text style={styles.metricEmpty}>{emptyLabel}</Text>
      )}
    </AppCard>
  );
}
