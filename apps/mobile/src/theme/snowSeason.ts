/**
 * The holidays, when snow falls over the app (design/Snowfall.tsx): from the start of November
 * through Epiphany, January 6 -- local dates. Outside them there's no snow, and no Snowfall
 * switch in Settings > Appearance, so it never snows in July.
 */
export function isSnowSeason(date: Date): boolean {
  const month = date.getMonth();
  return month === 10 || month === 11 || (month === 0 && date.getDate() <= 6);
}
