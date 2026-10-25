// Calories and macros are shown as whole numbers, rounded down: 62.8 g of protein shows as "62 g",
// 1,849.6 cal as "1,849". An amount over or under is its size rounded down -- 350.6 cal over shows
// as "350 over". Only what's shown: what's stored and worked out with keeps its decimals, and a
// form's field keeps a figure exactly, so saving it never changes it.

/** A calorie or macro figure as it's shown: its whole part, toward zero. */
export function wholeFigure(value: number): number {
  // A hair's nudge, so arithmetic's 2.9999999999 still shows as 3.
  const whole = Math.trunc(value + (value >= 0 ? 1e-9 : -1e-9));
  return whole === 0 ? 0 : whole;
}

/** The same, with its thousands separated: "1,849". */
export function wholeFigureText(value: number): string {
  return wholeFigure(value).toLocaleString();
}
