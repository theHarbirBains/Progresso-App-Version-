import { HealthOverview } from '../health/preview/HealthOverview';
import { HEALTH_PREVIEW_ENABLED, type HealthPage } from '../health/preview/healthPreview';
import type { MetricKey } from '../health/preview/sampleHealthData';
import { StepsSection } from './StepsSection';

/**
 * Progress's Health tab. Steps are its real part -- Apple Health's, on this phone (what was the
 * Steps tab: Harbir's call, 2026-11-27) -- so a release build's Health tab is the steps alone. A
 * development build shows the Health prototype (Phase 1: sample data, its steps the real ones),
 * which never reaches TestFlight or the App Store.
 */
export function HealthSection({
  accent,
  onOpen,
  preview = HEALTH_PREVIEW_ENABLED,
}: {
  accent: string;
  onOpen: (page: HealthPage, metric?: MetricKey, onboarding?: boolean) => void;
  /** Whether the prototype shows -- development builds only. */
  preview?: boolean;
}) {
  return preview ? (
    <HealthOverview accent={accent} onOpen={onOpen} />
  ) : (
    <StepsSection accentColor={accent} />
  );
}
