// A timed set's duration, as typed and as shown. It's typed into one field as seconds
// ("45") or minutes:seconds ("1:30"), hours too for a long hold ("1:02:30"), and always
// shown back as minutes:seconds ("0:45", "1:30", "1:02:30").

/** The most a set may last: a day, as the database and API allow. */
const MAX_SECONDS = 86_400;

/**
 * The seconds a typed duration stands for, or null when it isn't one: "45" is 45, "1:30" is
 * 90, "1:02:30" is 3750. Every part after the first is 0-59. Zero isn't a duration.
 */
export function parseDuration(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(':').map(Number);
  if (parts.slice(1).some((part) => part > 59)) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 && seconds <= MAX_SECONDS ? seconds : null;
}

/** "0:45", "1:30", "1:02:30". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

/** For assistive tech: "1 minute 30 seconds", "45 seconds". */
export function describeDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} ${secs === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}
