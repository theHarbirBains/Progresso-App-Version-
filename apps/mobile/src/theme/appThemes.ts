// The looks Progresso can wear (Settings > Appearance). Each is one accent, and a photo that's
// the picture on the launch screen, the share card and the home-screen widgets -- never behind
// a screen: every screen is the plain warm fill (design/AppBackgroundLayer.tsx). Everything
// else -- surfaces, text, charts, forms, the live workout -- stays the same warm dark in every
// theme, so a theme never costs readability. Every photo is Progresso's own: a gym open onto its
// scene (a mountain lake at sunset, a waterfall, snowy peaks, the sea, blossom, palms, autumn
// woods, snow -- and a gym dressed for Christmas at night, its tree and garlands lit, Holiday
// Gym), cut to the same proportions.

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

export interface AppTheme {
  id: AppThemeId;
  name: string;
  /** The theme's one accent -- buttons, the active tab, selected states, key figures. */
  accent: string;
  /** The bundled photo (a `require`): the launch screen's, the share card's and the widgets'. */
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
    photo: require('../../assets/background-gym-sunset.jpg'),
  },
  {
    id: 'forest',
    name: 'Forest',
    accent: '#9DBF7A',
    photo: require('../../assets/themes/forest.jpg'),
  },
  {
    id: 'alpine',
    name: 'Alpine',
    accent: '#8DB8D6',
    photo: require('../../assets/themes/alpine.jpg'),
  },
  {
    id: 'coast',
    name: 'Coast',
    accent: '#6FC2B8',
    photo: require('../../assets/themes/coast.jpg'),
  },
  {
    id: 'spring',
    name: 'Spring',
    accent: '#E8A0B4',
    photo: require('../../assets/themes/spring.jpg'),
  },
  {
    id: 'summer',
    name: 'Summer',
    accent: '#E8B84A',
    photo: require('../../assets/themes/summer.jpg'),
  },
  {
    id: 'autumn',
    name: 'Autumn',
    accent: '#D9774A',
    photo: require('../../assets/themes/autumn.jpg'),
  },
  {
    id: 'winter',
    name: 'Winter',
    accent: '#A9C4E0',
    photo: require('../../assets/themes/winter.jpg'),
  },
  {
    // A gym dressed for Christmas at night. The darkest photo of all, its brightest specks (the
    // string lights) no brighter than Forest's or Winter's, so the lightest darkening keeps hero
    // text as readable; its accent is the gold of the lights, red staying for delete and errors.
    id: 'holiday-gym',
    name: 'Holiday Gym',
    accent: '#EBC27C',
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
