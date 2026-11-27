import type { HealthScenario, MetricKey } from './sampleHealthData';

/**
 * The Health prototype (Phase 1 of Harbir's Health & Wearables brief, 2026-11-27) shows only in
 * development builds -- Expo Go and dev clients -- so its sample data never reaches anyone on
 * TestFlight or the App Store. Nothing in it reads Apple Health, Oura, the API or the database.
 */
export const HEALTH_PREVIEW_ENABLED: boolean = __DEV__;

/** The prototype's pages beyond the overview. */
export type HealthPage =
  'recovery' | 'sleep' | 'activity' | 'heart' | 'training' | 'devices' | 'insights' | 'metric';

export const HEALTH_PAGE_TITLES: Record<HealthPage, string> = {
  recovery: 'Recovery',
  sleep: 'Sleep',
  activity: 'Activity',
  heart: 'Heart',
  training: 'Training & Recovery',
  devices: 'Devices',
  insights: 'Insights',
  metric: 'Metric',
};

export interface HealthPreviewParams {
  page: HealthPage;
  scenario: HealthScenario;
  metric?: MetricKey;
}
