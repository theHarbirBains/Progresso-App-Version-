// Progresso design tokens. "Warm Minimal" is the current direction: warm
// charcoal and near-black surfaces, warm off-white text and one soft amber
// accent, replacing the earlier pitch-black/monochrome look -- see DESIGN.md.
// Every screen's styling should derive from these values rather than
// hand-picking colors/sizes, so the visual system stays coherent.

export const colors = {
  // Warm near-black. Surfaces (below) stay distinct so cards still read as
  // raised against it.
  background: '#12110F',
  surface: '#1C1916',
  surfaceRaised: '#26211C',
  // Used only for the single "hero" card per screen -- a thin amber-tinted
  // border over a warm dark tint instead of a fill, so elevation reads as
  // "this is the important one" without another color block.
  surfaceHero: '#211A13',
  borderHero: '#4F3A24',
  border: '#393129',
  divider: '#2C2620',

  textPrimary: '#F5F0E8',
  textSecondary: '#B6ADA1',
  // A brighter step between textSecondary and textPrimary -- for secondary
  // text sitting where textSecondary's normal contrast reads as too dim
  // (no card behind it, or a card whose own tint isn't enough on its own).
  // Reach for this instead of a one-off hex wherever textSecondary tests
  // too dim in the same way.
  textSecondaryBright: '#D3CBBF',
  textMuted: '#7E7569',

  // The single Progresso brand accent: soft amber. Used for: primary CTA,
  // active states, key performance numbers, chart line, and PR indicators.
  // `onAccent` below is computed per-accent by buildAccentTheme for the two
  // mode accents (accentColor.ts); this literal only backs direct
  // `colors.accent` consumers (Button, Toggle, SegmentedControl, Badge,
  // etc.), so it stays hand-picked for the same dark-ink-on-amber contrast.
  accent: '#D99A50',
  onAccent: '#12110F',

  // The warm cream fill of the one action on a photo hero (Card's `hero`),
  // read against the photo the way Option 4's Start Workout button does --
  // a light pill with dark text, never the amber accent itself.
  heroAction: '#F2E3CD',

  destructive: '#F0555C',
  destructiveBorder: '#3A2226',

  chartAccent: '#D99A50',
  chartMuted: '#393129',

  // Glass-surface hairline borders (see GlassBackground.tsx) -- a warm
  // light-alpha edge that reads as "catching light" against any of the
  // Background Theme environments, rather than each theme's own (much
  // darker) `border` token. `glassBorder` is the default weight (cards,
  // controls); `glassBorderStrong` is for the few persistent chrome
  // surfaces (bottom nav, side menu, bottom sheet) that want a slightly
  // more defined edge against constantly-changing content behind them.
  glassBorder: 'rgba(245, 230, 210, 0.08)',
  glassBorderStrong: 'rgba(245, 230, 210, 0.14)',
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
  // Softer, more pronounced corner for the new flat Card redesign (see
  // design/Card.tsx) -- bigger than `lg`, still well short of `pill`.
  xl: 24,
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

// Loaded via useFonts() in App.tsx before anything renders. Plus Jakarta
// Sans carries ALL text (headings, body, labels) -- warmer and closer to
// SF Pro's character than Inter, part of the app's visual redesign (see
// FeedScreen, the first screen on the new system); JetBrains Mono is
// reserved for numeric readouts only (the "readout" feel), never for prose.
// There is deliberately no system-font text anywhere: body copy uses Plus
// Jakarta Sans Regular, so the app has one typeface, not two competing
// sans-serifs. The weights below are the only ones loaded -- see `Text` for
// how a `fontWeight` written in a style resolves to one of them.
export const fonts = {
  body: 'PlusJakartaSans_400Regular',
  displayMedium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  display: 'PlusJakartaSans_700Bold',
  displayHeavy: 'PlusJakartaSans_800ExtraBold',
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
