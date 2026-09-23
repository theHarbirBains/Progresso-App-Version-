// Progresso design tokens. Pitch-black/monochrome ("black and white") is
// the current direction, replacing the earlier "Dark + Electric" teal
// accent -- see DESIGN.md. Every screen's styling should derive from these
// values rather than hand-picking colors/sizes, so the visual system stays
// coherent as it's propagated screen by screen.

export const colors = {
  // Pitch black -- the app-wide black-and-white redesign's own explicit
  // call, over the earlier near-black #0B0D0F. Surfaces (below) stay
  // distinct so cards still read as raised against it.
  background: '#000000',
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
  // A brighter step between textSecondary and textPrimary -- for secondary
  // text sitting directly over a busy photographic background (no card
  // behind it, or a card whose own tint isn't enough on its own), where
  // textSecondary's normal contrast reads as too dim against the photo.
  // Introduced for the Workout Mode dashboard readability pass; reach for
  // this instead of a one-off hex wherever textSecondary tests too dim in
  // the same way.
  textSecondaryBright: '#B4C4C6',
  textMuted: '#5E7072',

  // The single Progresso brand accent. Used for: primary CTA, active states,
  // key performance numbers, chart line, and PR indicators. Neutral
  // (matches textPrimary) rather than a hue -- the app-wide black-and-white
  // redesign's own explicit call, replacing the earlier teal. `onAccent`
  // below is computed per-accent by buildAccentTheme for the two mode
  // accents (accentColor.ts); this literal only backs direct `colors.accent`
  // consumers (Button, Toggle, SegmentedControl, Badge, etc.), so it stays
  // hand-picked for the same near-black-on-near-white contrast.
  accent: '#FFFFFF',
  onAccent: '#000000',

  destructive: '#F0555C',
  destructiveBorder: '#3A2226',

  chartAccent: '#FFFFFF',
  chartMuted: '#212B2D',

  // Glass-surface hairline borders (see GlassBackground.tsx) -- a neutral
  // light-alpha edge that reads as "catching light" against any of the
  // Background Theme environments, rather than each theme's own (much
  // darker) `border` token. `glassBorder` is the default weight (cards,
  // controls); `glassBorderStrong` is for the few persistent chrome
  // surfaces (bottom nav, side menu, bottom sheet) that want a slightly
  // more defined edge against constantly-changing content behind them.
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.14)',
} as const;

// Three working radii plus the pill, each with one role so nested surfaces
// stay optically concentric (outer radius >= inner radius + padding gap):
//   sm   -- small inset elements (a wheel-picker highlight, a bar track)
//   md   -- controls: buttons, inputs, chips, icon wells
//   lg   -- surfaces that contain controls: cards, sheets
//   pill -- fully rounded: segmented controls, tabs, badges, avatars
// (Controls previously sat *above* their card in radius -- buttons 14 vs
// cards 10 -- which reads as inverted once a button sits inside a card.)
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
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

// The maximum gap between two adjacent Dashboard widgets (cards, stat tiles,
// the rows of tiles that hold them). A deliberate one-off rather than a step
// on the spacing scale above -- 6 sits between xs (4) and sm (8), and
// widget-to-widget separation is its own concept, distinct from a card's
// internal padding. Applied once, as `gap` on each widget stack, so no
// individual widget carries its own outer margin.
export const widgetGap = 6;

// Loaded via useFonts() in App.tsx before anything renders -- see
// FontGate in App.tsx. Manrope carries ALL text (headings, body, labels);
// JetBrains Mono is reserved for numeric readouts only (the "readout" feel),
// never for prose. There is deliberately no system-font text anywhere: body
// copy uses Manrope Regular, so the app has one typeface, not two competing
// sans-serifs. The weights below are the only ones loaded -- see `Text` for
// how a `fontWeight` written in a style resolves to one of them.
export const fonts = {
  body: 'Manrope_400Regular',
  displayMedium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  display: 'Manrope_700Bold',
  displayHeavy: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

// The complete type scale. Use these; do not hand-pick a `fontSize`. Eight
// text tokens plus three numeric readouts replace the 16 distinct literal
// sizes the app had drifted into (10-30px) -- in particular `callout` (14)
// exists because 14 was already the single most-used size, just without a
// token.
export const typeScale = {
  // Largest tier, above screenTitle -- for the rare hero/large-heading
  // moment the reference design language calls for (e.g. a completion
  // screen), not a general replacement for screenTitle.
  display: { fontFamily: fonts.displayHeavy, fontSize: 32 },
  screenTitle: { fontFamily: fonts.displayHeavy, fontSize: 24 },
  sectionHeading: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 16 },
  // Numeric readouts -- JetBrains Mono, the only place it is used.
  statLarge: { fontFamily: fonts.monoBold, fontSize: 30 },
  statMedium: { fontFamily: fonts.mono, fontSize: 19 },
  statSmall: { fontFamily: fonts.monoBold, fontSize: 15 },
  body: { fontFamily: fonts.body, fontSize: 15 },
  // Dense list/row text: titles inside a row, button labels, compact meta.
  callout: { fontFamily: fonts.body, fontSize: 14 },
  // `secondary` already covers the "bodySmall" role (fontSize 13, muted
  // supporting text) -- intentionally not duplicated under a second name.
  secondary: { fontFamily: fonts.body, fontSize: 13 },
  // Form-field label above an input -- distinct from sectionHeading, which
  // is uppercase/letter-spaced for section dividers, not per-field labels.
  label: { fontFamily: fonts.displayMedium, fontSize: 13 },
  caption: { fontFamily: fonts.displayMedium, fontSize: 11 },
} as const;

// Minimum comfortable touch target (Apple HIG / WCAG 2.2 native guidance).
// Interactive controls are at least this tall/wide -- either visibly, or via
// `hitSlop` when the visible glyph is smaller (icon buttons).
export const minTouchTarget = 44;
