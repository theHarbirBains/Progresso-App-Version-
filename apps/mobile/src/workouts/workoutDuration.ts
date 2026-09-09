// Live-elapsed-time formula, extending the existing completedAt-performedAt
// duration definition (dashboard/recentWorkoutInfo.ts) to the "still
// running" case: now - performedAt instead of completedAt - performedAt.
// Same underlying performed_at field, no new backend concept.

export function computeElapsedSeconds(performedAt: string, now: number = Date.now()): number {
  const elapsedMs = now - new Date(performedAt).getTime();
  if (!Number.isFinite(elapsedMs)) return 0;
  return Math.max(0, Math.floor(elapsedMs / 1000));
}

export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
