/** 42800 -> "42.8K", 1250000 -> "1.25M", 950 -> "950" -- never rounding up past what's there. */
export function compactNumber(value: number): string {
  const whole = Math.floor(value);
  const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));
  if (whole >= 1_000_000) return `${trim(whole / 1_000_000, 2)}M`;
  if (whole >= 1_000) return `${trim(whole / 1_000, 1)}K`;
  return String(whole);
}
