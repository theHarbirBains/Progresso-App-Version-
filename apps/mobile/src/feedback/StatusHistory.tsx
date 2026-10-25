import { View } from 'react-native';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { STATUS_LABELS, type FeedbackStatus } from './feedbackLabels';
import { feedbackStyles as styles } from './feedbackStyles';

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A submission's statuses as it went through them, newest first; its first is when it was sent. */
export function StatusHistory({
  history,
  testID = 'feedback-history',
}: {
  history: { status: FeedbackStatus; at: string }[];
  testID?: string;
}) {
  const newestFirst = [...history].reverse();
  return (
    <Section title="Status">
      <View testID={testID}>
        {newestFirst.map((event, index) => (
          <View
            key={`${event.status}-${event.at}`}
            testID={`${testID}-${index}`}
            style={[styles.historyRow, index > 0 && styles.historyDivider]}
          >
            <Text style={styles.historyStatus}>
              {index === newestFirst.length - 1 && event.status === 'new'
                ? 'Sent'
                : STATUS_LABELS[event.status]}
            </Text>
            <Text style={styles.historyDate}>{when(event.at)}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}
