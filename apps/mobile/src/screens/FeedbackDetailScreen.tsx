import { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { ErrorState } from '../design/ErrorState';
import { Screen } from '../design/Screen';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { sentFromText } from '../feedback/deviceInfo';
import { FeedbackStatusBadge } from '../feedback/FeedbackStatusBadge';
import { CATEGORY_LABELS } from '../feedback/feedbackLabels';
import { fetchMyFeedbackDetail, type MyFeedbackDetail } from '../feedback/feedbackQueries';
import { feedbackStyles as styles } from '../feedback/feedbackStyles';
import { StatusHistory } from '../feedback/StatusHistory';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles } from '../settings/settingsStyles';
import { formatShortDate } from '../workouts/workoutFormat';

type Props = RootStackScreenProps<'FeedbackDetail'>;

/** One piece of the person's own feedback: what they sent, its screenshot, and its status history. */
export function FeedbackDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [detail, setDetail] = useState<MyFeedbackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await fetchMyFeedbackDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this feedback');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const submission = detail?.submission;
  const device = submission
    ? sentFromText({
        appVersion: submission.appVersion ?? undefined,
        buildNumber: submission.buildNumber ?? undefined,
        platform:
          submission.platform === 'ios' || submission.platform === 'android'
            ? submission.platform
            : undefined,
        osVersion: submission.osVersion ?? undefined,
      })
    : '';

  return (
    <Screen
      testID="feedback-detail-screen"
      scrollTestID="feedback-detail-scroll"
      contentContainerStyle={settingsStyles.categoryGap}
      header={
        <AppHeader
          testID="feedback-detail-header"
          title="Your Feedback"
          onBack={() => navigation.goBack()}
        />
      }
    >
      {!detail && !error ? (
        <SkeletonRows testID="feedback-detail-loading" count={4} />
      ) : !detail || !submission ? (
        <ErrorState testID="feedback-detail-error" message={error!} onRetry={() => void load()} />
      ) : (
        <>
          <View testID="feedback-detail-summary">
            <View style={styles.headRow}>
              <View style={styles.headText}>
                <Text style={styles.title}>{submission.title}</Text>
                <Text style={styles.meta}>
                  {CATEGORY_LABELS[submission.category]} · {formatShortDate(submission.createdAt)}
                </Text>
              </View>
              <FeedbackStatusBadge testID="feedback-detail-status" status={submission.status} />
            </View>
            <Text testID="feedback-detail-description" style={styles.body}>
              {submission.description}
            </Text>
            {detail.screenshotUrl ? (
              <Image
                testID="feedback-detail-screenshot"
                source={{ uri: detail.screenshotUrl }}
                style={styles.screenshot}
                resizeMode="contain"
                accessibilityLabel="Your screenshot"
              />
            ) : null}
          </View>

          <StatusHistory history={detail.history} />

          {device ? (
            <Text testID="feedback-detail-sent-from" style={styles.caption}>
              Sent with {device}.
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}
