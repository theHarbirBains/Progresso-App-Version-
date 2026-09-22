// Background Theme definitions -- the "environment" layer behind Progresso's
// existing dark UI (Appearance settings > Background Theme). Deliberately
// separate from theme.ts's `colors` (kept as the static Obsidian default for
// anything not yet wired to the reactive layer) and from the Workout/
// Nutrition accent system (theme/accentColor.ts) -- three independent
// configuration layers, per the approved design direction.
//
// Every theme here only varies the five "environment" tokens (background,
// surface, surfaceRaised, border, divider). Text (textPrimary/Secondary/
// Muted), the accent system, destructive, and the Dashboard "hero" card
// treatment (surfaceHero/borderHero) are intentionally NOT part of this --
// they stay constant across every theme, which is what keeps every existing
// component readable without a per-screen contrast pass. Dark variants only
// for now: light themes are a separate, larger piece of work (see DESIGN.md's
// current dark-mode-only rule) and are not implemented here.
export type BackgroundThemeId =
  | 'obsidian'
  | 'midnight'
  | 'forest'
  | 'plum'
  | 'starlight'
  | 'aurora'
  | 'topographic'
  | 'carbon'
  | 'particles';

export interface BackgroundThemeEnvironment {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  divider: string;
}

// What (if anything) AppBackgroundLayer draws on top of the flat
// environment fill. Kept to a small, named set rather than open-ended
// config, since every treatment is a deliberately restrained, hand-tuned
// effect -- not a generic "texture engine".
export type BackgroundTreatment =
  'flat' | 'starlight' | 'aurora' | 'topographic' | 'carbon' | 'particles';

export interface BackgroundThemeDefinition {
  id: BackgroundThemeId;
  name: string;
  /** Shown under the theme name in the picker. */
  description: string;
  colors: BackgroundThemeEnvironment;
  treatment: BackgroundTreatment;
  /** True only for treatments with a (Reduce-Motion-respecting) animated variant. */
  animated: boolean;
}

export const DEFAULT_BACKGROUND_THEME: BackgroundThemeId = 'obsidian';

// Obsidian's environment colors are exactly theme.ts's existing colors.
export const BACKGROUND_THEMES: Record<BackgroundThemeId, BackgroundThemeDefinition> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Clean, neutral near-black',
    colors: {
      background: '#0B0D0F',
      surface: '#131719',
      surfaceRaised: '#1A2023',
      border: '#212B2D',
      divider: '#1B2123',
    },
    treatment: 'flat',
    animated: false,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Subtle deep-blue atmosphere',
    colors: {
      background: '#0A0D14',
      surface: '#12161F',
      surfaceRaised: '#1A202B',
      border: '#212A38',
      divider: '#1A212B',
    },
    treatment: 'flat',
    animated: false,
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Subtle deep-green atmosphere',
    colors: {
      background: '#0A0E0C',
      surface: '#121913',
      surfaceRaised: '#1A231A',
      border: '#212D22',
      divider: '#1B241C',
    },
    treatment: 'flat',
    animated: false,
  },
  plum: {
    id: 'plum',
    name: 'Plum',
    description: 'Subtle deep-purple atmosphere',
    colors: {
      background: '#0E0A12',
      surface: '#17121C',
      surfaceRaised: '#201A28',
      border: '#2B2135',
      divider: '#221A2A',
    },
    treatment: 'flat',
    animated: false,
  },
  starlight: {
    id: 'starlight',
    name: 'Starlight',
    description: 'Dark space-inspired, extremely subtle stars',
    colors: {
      background: '#08090E',
      surface: '#111420',
      surfaceRaised: '#191D2C',
      border: '#202638',
      divider: '#191E2A',
    },
    treatment: 'starlight',
    animated: true,
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: 'Subtle atmospheric colour movement',
    colors: {
      background: '#0A0D0E',
      surface: '#121718',
      surfaceRaised: '#1A2122',
      border: '#212B2C',
      divider: '#1B2223',
    },
    treatment: 'aurora',
    animated: true,
  },
  topographic: {
    id: 'topographic',
    name: 'Topographic',
    description: 'Subtle contour-line texture',
    colors: {
      background: '#0B0D0F',
      surface: '#131719',
      surfaceRaised: '#1A2023',
      border: '#212B2D',
      divider: '#1B2123',
    },
    treatment: 'topographic',
    animated: false,
  },
  carbon: {
    id: 'carbon',
    name: 'Carbon',
    description: 'Subtle geometric fibre texture',
    colors: {
      background: '#0C0C0D',
      surface: '#141516',
      surfaceRaised: '#1C1D1F',
      border: '#242628',
      divider: '#1D1E20',
    },
    treatment: 'carbon',
    animated: false,
  },
  particles: {
    id: 'particles',
    name: 'Particles',
    description: 'Extremely sparse ambient particles',
    colors: {
      background: '#0B0D0F',
      surface: '#131719',
      surfaceRaised: '#1A2023',
      border: '#212B2D',
      divider: '#1B2123',
    },
    treatment: 'particles',
    animated: true,
  },
};

export const BACKGROUND_THEME_ORDER: BackgroundThemeId[] = [
  'obsidian',
  'midnight',
  'forest',
  'plum',
  'starlight',
  'aurora',
  'topographic',
  'carbon',
  'particles',
];

export function isBackgroundThemeId(value: string | null | undefined): value is BackgroundThemeId {
  return !!value && value in BACKGROUND_THEMES;
}

export function resolveBackgroundTheme(id: string | null | undefined): BackgroundThemeDefinition {
  return isBackgroundThemeId(id)
    ? BACKGROUND_THEMES[id]
    : BACKGROUND_THEMES[DEFAULT_BACKGROUND_THEME];
}
