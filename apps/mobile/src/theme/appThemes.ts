// The looks Progresso can wear (Settings > Appearance). Never a photo behind a screen: a theme
// is a plain background colour (`background`), a quiet pattern drawn over its top
// (`pattern`, design/BackgroundPattern.tsx), a heading face (`font`, design/headingFont.ts) and
// one accent, chosen together. Every background is a near-black with a hint of the theme's hue,
// so the app's text colours keep their contrast on all of them (tested); surfaces, body text,
// charts, forms and the live workout stay the same in every theme. Each theme still has its
// photo -- Progresso's own, a gym open onto its scene -- for where a picture is the point: the
// launch screen, the share card and the home-screen widgets.

import type { HeadingFontId } from '../design/headingFont';

export type AppThemeId =
  | 'golden-hour-gym'
  | 'forest'
  | 'alpine'
  | 'coast'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'holiday-gym';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** The designs a background can carry (design/BackgroundPattern.tsx). */
export type BackgroundPatternId =
  'none' | 'dots' | 'grid' | 'stripes' | 'waves' | 'contours' | 'plaid' | 'diamonds' | 'sparkles';

export interface AppTheme {
  id: AppThemeId;
  name: string;
  /** The theme's one accent -- buttons, the active tab, selected states, key figures. */
  accent: string;
  /** The plain colour behind every screen. */
  background: string;
  /** The quiet design over the background's top, drawn in the accent. */
  pattern: BackgroundPatternId;
  /** The heading face (screen and card titles, buttons). */
  font: HeadingFontId;
  /** The bundled photo (a `require`): the launch screen's and the widgets'. */
  photo: number;
}

// What someone who hasn't chosen a look sees -- a new download among them.
export const DEFAULT_THEME_ID: AppThemeId = 'holiday-gym';

/** Every photo's width / height -- they're all cut to the same proportions (852 x 1300). */
export const THEME_PHOTO_ASPECT = 852 / 1300;

export const APP_THEMES: readonly AppTheme[] = [
  {
    id: 'golden-hour-gym',
    name: 'Golden Hour Gym',
    accent: '#D99A50',
    background: '#12110F',
    pattern: 'none',
    font: 'jakarta',
    photo: require('../../assets/background-gym-sunset.jpg'),
  },
  {
    id: 'forest',
    name: 'Forest',
    accent: '#9DBF7A',
    background: '#0D1410',
    pattern: 'contours',
    font: 'fraunces',
    photo: require('../../assets/themes/forest.jpg'),
  },
  {
    id: 'alpine',
    name: 'Alpine',
    accent: '#8DB8D6',
    background: '#0E1219',
    pattern: 'grid',
    font: 'oswald',
    photo: require('../../assets/themes/alpine.jpg'),
  },
  {
    id: 'coast',
    name: 'Coast',
    accent: '#6FC2B8',
    background: '#0A1517',
    pattern: 'waves',
    font: 'nunito',
    photo: require('../../assets/themes/coast.jpg'),
  },
  {
    id: 'spring',
    name: 'Spring',
    accent: '#E8A0B4',
    background: '#161016',
    pattern: 'dots',
    font: 'nunito',
    photo: require('../../assets/themes/spring.jpg'),
  },
  {
    id: 'summer',
    name: 'Summer',
    accent: '#E8B84A',
    background: '#15120B',
    pattern: 'stripes',
    font: 'oswald',
    photo: require('../../assets/themes/summer.jpg'),
  },
  {
    id: 'autumn',
    name: 'Autumn',
    accent: '#D9774A',
    background: '#170F0B',
    pattern: 'plaid',
    font: 'fraunces',
    photo: require('../../assets/themes/autumn.jpg'),
  },
  {
    id: 'winter',
    name: 'Winter',
    accent: '#A9C4E0',
    background: '#0C1118',
    pattern: 'diamonds',
    font: 'jakarta',
    photo: require('../../assets/themes/winter.jpg'),
  },
  {
    // Christmas at night: deep evergreen, gold sparkles and a festive serif; its accent is the gold
    // of string lights, red staying for delete and errors.
    id: 'holiday-gym',
    name: 'Holiday Gym',
    accent: '#EBC27C',
    background: '#0D1511',
    pattern: 'sparkles',
    font: 'fraunces',
    photo: require('../../assets/themes/holiday-gym.jpg'),
  },
];

export function themeById(id: string | null | undefined): AppTheme {
  return APP_THEMES.find((theme) => theme.id === id) ?? APP_THEMES[0];
}

export function isAppThemeId(value: unknown): value is AppThemeId {
  return typeof value === 'string' && APP_THEMES.some((theme) => theme.id === value);
}

// Countries wholly or mostly south of the equator, where the seasons run the other way. A
// country near the equator, or none given, follows the northern calendar.
const SOUTHERN = new Set([
  'AO',
  'AR',
  'AU',
  'BO',
  'BR',
  'BW',
  'CL',
  'FJ',
  'LS',
  'MG',
  'MU',
  'MW',
  'MZ',
  'NA',
  'NZ',
  'PE',
  'PY',
  'SZ',
  'TO',
  'UY',
  'WS',
  'ZA',
  'ZM',
  'ZW',
]);

/** The season it is on `date` where the person lives: by month, the other way round down south. */
export function seasonFor(date: Date, country: string | null | undefined): Season {
  const month = date.getMonth();
  const northern: Season =
    month >= 2 && month <= 4
      ? 'spring'
      : month >= 5 && month <= 7
        ? 'summer'
        : month >= 8 && month <= 10
          ? 'autumn'
          : 'winter';
  if (!country || !SOUTHERN.has(country.toUpperCase())) return northern;
  const flip: Record<Season, Season> = {
    spring: 'autumn',
    summer: 'winter',
    autumn: 'spring',
    winter: 'summer',
  };
  return flip[northern];
}
