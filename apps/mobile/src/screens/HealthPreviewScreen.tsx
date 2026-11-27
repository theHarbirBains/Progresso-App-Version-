import { StyleSheet } from 'react-native';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import { spacing } from '../design/theme';
import {
  ActivityPage,
  DevicesPage,
  HeartPage,
  InsightsPage,
  MetricPage,
  RecoveryPage,
  SetupPage,
  SleepPage,
  TrainingPage,
} from '../health/preview/HealthPages';
import {
  HEALTH_PAGE_TITLES,
  usePreviewSetup,
  type HealthPage,
} from '../health/preview/healthPreview';
import { METRICS, type MetricKey } from '../health/preview/sampleHealthData';
import type { RootStackScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'HealthPreview'>;

/**
 * One of Health's deeper pages -- Recovery, Sleep, Activity, Heart, Training & Recovery, Devices,
 * Insights, a metric's own page, or Set Up Health (as onboarding would show it, too) -- opened
 * from Health on Progress, each made for the devices the preview has. PHASE 1 PROTOTYPE: sample
 * data only, development builds only (health/preview/healthPreview.ts).
 */
export function HealthPreviewScreen({ navigation, route }: Props) {
  const accent = useAppTheme().accent.accent;
  const setup = usePreviewSetup();
  const { page, metric, onboarding } = route.params;
  const open = (next: HealthPage, nextMetric?: MetricKey, nextOnboarding?: boolean) =>
    navigation.push('HealthPreview', {
      page: next,
      metric: nextMetric,
      onboarding: nextOnboarding,
    });
  const title =
    page === 'metric' && metric
      ? METRICS[metric].name
      : page === 'setup' && onboarding
        ? 'Welcome to Progresso'
        : HEALTH_PAGE_TITLES[page];
  const pageProps = { setup, accent, open };
  return (
    <Screen
      scrollTestID="health-preview-scroll"
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          title={title}
          onBack={() => navigation.goBack()}
          testID="health-preview-header"
        />
      }
    >
      {page === 'recovery' ? <RecoveryPage {...pageProps} /> : null}
      {page === 'sleep' ? <SleepPage {...pageProps} /> : null}
      {page === 'activity' ? <ActivityPage {...pageProps} /> : null}
      {page === 'heart' ? <HeartPage {...pageProps} /> : null}
      {page === 'training' ? <TrainingPage {...pageProps} /> : null}
      {page === 'devices' ? <DevicesPage {...pageProps} /> : null}
      {page === 'insights' ? <InsightsPage {...pageProps} /> : null}
      {page === 'metric' && metric ? <MetricPage {...pageProps} metric={metric} /> : null}
      {page === 'setup' ? (
        <SetupPage {...pageProps} onboarding={onboarding} onDone={() => navigation.goBack()} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
});
