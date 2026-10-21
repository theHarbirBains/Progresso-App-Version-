function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** "YYYY-MM-DD" for a local day. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local day a "YYYY-MM-DD" key names, at midnight. */
export function dayFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}
