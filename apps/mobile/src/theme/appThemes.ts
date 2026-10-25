// The looks Progresso can wear (Settings > Appearance). Each is a photo behind the top of every
// screen and one accent; everything else -- surfaces, text, charts, forms, the live workout --
// stays the same warm dark in every theme, so a theme never costs readability. Golden Hour Gym
// is the original look and the default. The photos are graded to sit together and drawn under
// the same darkening layers (design/AppBackgroundLayer.tsx); each theme's `heroDarkness` is how
// dark its photo stays behind Feed's Next Workout, measured so hero text keeps at least the
// contrast it has over the gym photo.

export type AppThemeId =
  'golden-hour-gym' | 'forest' | 'alpine' | 'coast' | 'spring' | 'summer' | 'autumn' | 'winter';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface AppTheme {
  id: AppThemeId;
  name: string;
  /** The theme's one accent -- buttons, the active tab, selected states, key figures. */
  accent: string;
  /** The bundled photo (a `require`). */
  photo: number;
  /** How dark the photo stays through its upper part behind Feed's hero (0-1). */
  heroDarkness: number;
  /** Who took the photo (Unsplash), for the credit on Appearance. Null for Progresso's own. */
  photographer: string | null;
}

export const DEFAULT_THEME_ID: AppThemeId = 'golden-hour-gym';

/** Every photo's width / height -- they're all cut to the gym photo's proportions. */
export const THEME_PHOTO_ASPECT = 852 / 1300;

export const APP_THEMES: readonly AppTheme[] = [
  {
    id: 'golden-hour-gym',
    name: 'Golden Hour Gym',
    accent: '#D99A50',
    photo: require('../../assets/background-gym-sunset.jpg'),
    heroDarkness: 0.1,
    photographer: null,
  },
  {
    id: 'forest',
    name: 'Forest',
    accent: '#9DBF7A',
    photo: require('../../assets/themes/forest.jpg'),
    heroDarkness: 0.35,
    photographer: 'Sergei A',
  },
  {
    id: 'alpine',
    name: 'Alpine',
    accent: '#8DB8D6',
    photo: require('../../assets/themes/alpine.jpg'),
    heroDarkness: 0.35,
    photographer: 'Nick Da Fonseca',
  },
  {
    id: 'coast',
    name: 'Coast',
    accent: '#6FC2B8',
    photo: require('../../assets/themes/coast.jpg'),
    heroDarkness: 0.35,
    photographer: 'Lina Bob',
  },
  {
    id: 'spring',
    name: 'Spring',
    accent: '#E8A0B4',
    photo: require('../../assets/themes/spring.jpg'),
    heroDarkness: 0.2,
    photographer: 'Lynn Danielson',
  },
  {
    id: 'summer',
    name: 'Summer',
    accent: '#E8B84A',
    photo: require('../../assets/themes/summer.jpg'),
    heroDarkness: 0.1,
    photographer: 'David Dür',
  },
  {
    id: 'autumn',
    name: 'Autumn',
    accent: '#D9774A',
    photo: require('../../assets/themes/autumn.jpg'),
    heroDarkness: 0.1,
    photographer: 'James Wainscoat',
  },
  {
    id: 'winter',
    name: 'Winter',
    accent: '#A9C4E0',
    photo: require('../../assets/themes/winter.jpg'),
    heroDarkness: 0.2,
    photographer: 'Barnabas Davoti',
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
