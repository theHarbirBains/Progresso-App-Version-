import { useSyncExternalStore } from 'react';
import type { DeviceSetup, MetricKey } from './sampleHealthData';

/**
 * The Health prototype (Phase 1 of Harbir's Health & Wearables brief, 2026-11-27) shows only in
 * development builds -- Expo Go and dev clients -- so its sample data never reaches anyone on
 * TestFlight or the App Store. Nothing in it reads Apple Health, Oura, the API or the database.
 */
export const HEALTH_PREVIEW_ENABLED: boolean = __DEV__;

/** The prototype's pages beyond the overview. */
export type HealthPage =
  | 'recovery'
  | 'sleep'
  | 'activity'
  | 'heart'
  | 'training'
  | 'devices'
  | 'insights'
  | 'metric'
  | 'setup'
  /** iPhone-only Health: what an iPhone measures by itself (a prototype of its own). */
  | 'iphone';

export const HEALTH_PAGE_TITLES: Record<HealthPage, string> = {
  recovery: 'Recovery',
  sleep: 'Sleep',
  activity: 'Activity',
  heart: 'Heart',
  training: 'Training & Recovery',
  devices: 'Devices',
  insights: 'Insights',
  metric: 'Metric',
  setup: 'Set Up Health',
  iphone: 'iPhone Health',
};

export interface HealthPreviewParams {
  page: HealthPage;
  metric?: MetricKey;
  /** The setup page as onboarding would show it. */
  onboarding?: boolean;
}

/**
 * Which devices the preview pretends someone has -- shared by every page of it, so choosing them
 * in Set Up Health tailors the whole of Health, as a real setup would. In memory only, for the
 * prototype; nothing is saved.
 */
let previewSetup: DeviceSetup = { iphone: true, appleWatch: true, oura: false, otherWatch: false };
const listeners = new Set<() => void>();

export function setPreviewSetup(next: DeviceSetup): void {
  previewSetup = next;
  listeners.forEach((listener) => listener());
}

export function usePreviewSetup(): DeviceSetup {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => previewSetup,
  );
}
