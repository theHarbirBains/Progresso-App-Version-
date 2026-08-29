// Progresso "Dark + Electric" design tokens -- approved direction for the
// Design & Product Polish phase. Every screen's styling should derive from
// these values rather than hand-picking colors/sizes, so the visual system
// stays coherent as it's propagated screen by screen.

export const colors = {
  background: '#0B0D0F',
  surface: '#131719',
  surfaceRaised: '#1A2023',
  // Used only for the single "hero" card per screen (Dashboard's Recent
  // Workout) -- a thin accent-tinted border instead of a fill, so elevation
  // reads as "this is the important one" without another color block.
  surfaceHero: '#0F1D1C',
  borderHero: '#1E4A45',
  border: '#212B2D',
  divider: '#1B2123',

  textPrimary: '#F1F6F6',
  textSecondary: '#8FA0A2',
  textMuted: '#5E7072',

  // The single Progresso brand accent. Used for: primary CTA, active states,
  // key performance numbers, chart line, and PR indicators -- per the
  // approved Concept B direction, PR reuses this accent rather than a
  // separate success color.
  accent: '#29E3C7',
  onAccent: '#06201C',

  destructive: '#F0555C',
  destructiveBorder: '#3A2226',

  chartAccent: '#29E3C7',
  chartMuted: '#212B2D',
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Loaded via useFonts() in App.tsx before anything renders -- see
// FontGate in App.tsx. Manrope carries headings/UI text; JetBrains Mono is
// reserved for numeric stat values only (the "readout" feel), never for
// prose, matching the approved Concept B typography direction.
export const fonts = {
  displayMedium: 'Manrope_500Medium',
  display: 'Manrope_700Bold',
  displayHeavy: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const typeScale = {
  screenTitle: { fontFamily: fonts.displayHeavy, fontSize: 24 },
  sectionHeading: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 16 },
  statLarge: { fontFamily: fonts.monoBold, fontSize: 30 },
  statMedium: { fontFamily: fonts.mono, fontSize: 19 },
  body: { fontSize: 15 },
  secondary: { fontSize: 13 },
  caption: { fontFamily: fonts.displayMedium, fontSize: 11 },
} as const;
