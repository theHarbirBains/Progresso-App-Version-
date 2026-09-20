# Progresso — Design System (DESIGN.md)

This document is the **visual source of truth** for Progresso's mobile app. It describes the design system as it actually exists in code today — tokens, components, and conventions — not an aspirational redesign. Read this before making any UI change; do not invent colors, typography, spacing, radii, or component patterns that conflict with what's documented here. If a screen needs something not covered here, extend the existing token/component system rather than hand-rolling a one-off value, and flag the gap rather than silently improvising.

Source files this document is derived from: `apps/mobile/src/design/theme.ts`, `apps/mobile/src/theme/accentColor.ts`, `apps/mobile/src/theme/accentPalette.ts`, every component in `apps/mobile/src/design/` (in particular `GlassBackground.tsx`, `AppBackgroundLayer.tsx`, `backgroundThemeStore.ts`/`BackgroundThemeContext.tsx`, `backgroundThemes.ts`), `apps/mobile/src/settings/CategoryTabs.tsx` + `settingsStyles.ts`, `apps/mobile/src/navigation/navigationTransitions.ts`, `apps/mobile/src/charts/LineChart.tsx`, and `apps/mobile/src/workouts/MuscleVisualization.tsx`.

## 1. Visual Philosophy

Progresso's internal design direction is **"Dark Glass"** — a premium-fitness evolution of the original "Dark + Electric" direction, not a replacement of it. The app is dark-mode-first and dark-mode-only (see §2), still built on one bright accent color doing all the visual "work" (primary actions, key numbers, active states, PR highlights) against a near-black backdrop — but that backdrop now has real depth: a cinematic background layer (§3a) with a soft vignette, and most structural surfaces (cards, navigation, modals, controls) are **translucent glass** sitting on top of it (§3b) rather than flat opaque fills. The feel is still closer to a fitness-tracking instrument panel than a consumer social app: numeric values keep their distinct monospace "readout" treatment (§5) to feel measured and precise, while everything else uses a single humanist sans-serif.

A deliberate simplicity rule still threads through the whole system: one accent color per context (not a rainbow of semantic colors), one card treatment (plus a rare "hero" variant), one radius scale, one spacing scale, and now one glass-surface treatment (§3b) reused everywhere rather than each screen inventing its own translucency. New UI should extend that consistency, not introduce a parallel one.

The relationship that gives every screen its depth, and that any new UI should preserve:

```
BACKGROUND (AppBackgroundLayer: flat fill → optional image → treatment → depth vignette)
  ↓
TRANSLUCENT GLASS (GlassBackground: tint + optional blur + hairline border)
  ↓
CONTENT (strong primary text, muted secondary text — §5)
  ↓
ACCENT (restrained — selected states, primary actions, key numbers — §4)
```

## 2. Dark/Light Appearance

**There is no light mode.** Progresso ships a single, fixed dark palette (`apps/mobile/src/design/theme.ts`). There is no `useColorScheme`, no `prefers-color-scheme` handling, and no light-mode token set anywhere in the app. Do not add light-mode-conditional styling unless a future task explicitly introduces light mode as a scoped feature — until then, `colors.background` (`#0B0D0F`) etc. are the only values in play.

## 3a. Background System (`AppBackgroundLayer.tsx`, `backgroundThemes.ts`)

Mounted **once**, behind the whole app (`App.tsx`'s `AppShell`) — no screen paints its own background; every screen's root `View`/`ScreenContainer`-equivalent is `backgroundColor: 'transparent'` so this shows through. Never hardcode a background color on a screen; if a screen needs to look different, that's a Background Theme concern (below), not a per-screen style.

Layered bottom-to-top, for every theme, every screen:

1. **Flat fill** — the active Background Theme's `colors.background` (one of 9 themes: Obsidian/Midnight/Forest/Plum/Starlight/Aurora/Topographic/Carbon/Particles, user-selected in Appearance settings, persisted via `BackgroundThemeContext`/`backgroundThemeStore`).
2. **Static image, mode-aware** (`BackgroundThemeDefinition.workoutImageSource` / `nutritionImageSource`) — every theme shares the same photo pair (`apps/mobile/assets/WorkoutBackground.png`, `NutritionBackground.png`), so the "Dark Glass" look stays consistent no matter which of the 9 Background Themes a user has picked — a theme's own `colors`/`treatment` (starlight dots, aurora wash, etc.) still layer on top of it, which is what keeps the themes visually distinguishable from each other. `AppBackgroundLayer` mounts **both** photos at all times and toggles which one is visible via `opacity` based on its `mode` prop (`'workout' | 'nutrition'`, default `'workout'`) rather than swapping a single `<Image>`'s `source` — swapping `source` would force the incoming photo to decode from scratch on every mode change, a real, visible delay on a multi-megabyte full-screen PNG; keeping both permanently mounted makes the Workout/Nutrition toggle an instant opacity flip instead, with the mode switch feeling immediate the moment the user taps it. `mode` itself is threaded down from `App.tsx`'s `Root`: on Dashboard it follows Dashboard's own local Workout/Nutrition toggle (reported up via `AppMenuContext`'s `reportMode`, which also calls the background-mode callback directly rather than waiting on an extra render+effect hop, for the same instant-switch reason — since Dashboard never navigates, the route alone can't tell you its mode); everywhere else it's inferred from the current route (`isNutritionRoute`). Screens rendered before a mode exists at all (sign-in, sign-up, password reset — outside the Stack.Navigator entirely) get the `'workout'` default. Each photo renders at full sharpness, with no blur and no scrim over it — it's meant to read clearly, not veiled or softened. Text/card contrast comes entirely from the depth overlay below (edges only) and each glass surface's own tint (§3b), never from softening or darkening the photo globally. A future theme could use a different pair (or opt out) by setting `workoutImageSource`/`nutritionImageSource` differently, independent of any other change to `AppBackgroundLayer`.
3. **Treatment** — each theme's own restrained procedural effect (sparse stars, slow aurora wash, contour lines, carbon fiber, ambient particles, or nothing/`flat`). Unchanged by this direction; still respects Reduce Motion (`useReduceMotionPreference`).
4. **Depth overlay** — new, universal, and the same for every theme: a static (never-animated) vertical vignette (`LinearGradient`, darker at the very top and bottom, clear through the middle) that gives every screen its sense of cinematic depth and doubles as the readability scrim behind edge-anchored chrome (headers, bottom nav). This is what makes the whole app read as "dark glass + depth", not a per-theme option.

Glass surfaces (§3b) sit **above** all four of these layers — they are a foreground concern, never part of this background stack.

**Reading the current theme**: components that only need to _read_ the active theme (any glass surface) call `useBackgroundTheme()` from `apps/mobile/src/design/backgroundThemeStore.ts` directly — it falls back to the Obsidian default with no Provider needed, which is what keeps every existing component-level test working unmodified. Only `BackgroundThemeProvider` (mounted once at the app root) and anything that needs to _change_ the theme (Appearance settings) imports from `BackgroundThemeContext.tsx`, which re-exports the same hook for convenience. Don't introduce a second background/theme system — extend `backgroundThemes.ts` (a new `BackgroundTreatment` variant, or a theme's `workoutImageSource`/`nutritionImageSource`) if a new environment is needed.

**Swipe up to reveal the background (Workout mode only)**: Dashboard's Workout-mode widget stack (the Animated.View wrapping its ScrollView, `testID="dashboard-reveal-content"`) responds to an upward drag by translating itself down and off-screen, fully revealing this background stack underneath — a plain `PanResponder`/`Animated.Value` gesture (no gesture library; see `RgbSliderPicker`'s own precedent for the same choice), gated to a clear, mostly-vertical drag via `onMoveShouldSetPanResponderCapture` so ordinary taps on cards/buttons are never intercepted. On release, `shouldRevealBackground` (`apps/mobile/src/dashboard/revealGesture.ts`) decides whether to commit to fully hidden or spring back to visible, based on drag distance/velocity. Once hidden, a screen-covering, otherwise-invisible/pass-through overlay (`testID="dashboard-reveal-restore-overlay"`, `pointerEvents: 'none'` until revealed) shows a small "Swipe down to return" glass pill and restores the content on any tap or swipe. The fixed header and bottom bar are separate, always-on-top views (zIndex 10) untouched by this transform, so navigation stays reachable throughout. Nutrition mode has no equivalent gesture.

## 3b. Glass Surface System (`GlassBackground.tsx`)

The one glass-surface treatment, reused everywhere rather than each screen inventing its own translucency. `GlassBackground` is a purely decorative, absolutely-positioned layer — components render it as their **first child**, keep their own existing outer border-radius/`overflow: 'hidden'`, and let it show through. It never wraps content itself (so it never changes hit-testing, layout, or how a consuming component handles `onPress`).

A glass surface is always three things, layered together:

- **Tint** — the active Background Theme's `surface` (or `surfaceRaised` for the `chrome` variant) color, at partial opacity (`withAlpha`) — so the surface still reads as "this theme's material," just translucent, never a fixed hardcoded color.
- **Border** — a neutral light-alpha hairline (`colors.glassBorder` / `colors.glassBorderStrong`, §4) that reads as "catching light," rather than each theme's own (much darker) `border`/`divider` tokens.
- **Blur** _(only the `chrome` variant — see below)_ — a real native blur (`expo-blur`'s `BlurView`) behind the tint, giving actual depth-of-field against whatever's scrolling underneath.

**Two variants — this is a performance boundary, not a style choice:**

- **`surface`** _(default)_ — tint + border, **no blur**, at a strong 86% fill opacity — a very dark, mostly-opaque foundation (raised from an earlier 60% once the app's photographic backgrounds proved busier than that could reliably separate content from) while still reading as translucent glass, never a flat opaque fill. Used for repeatable, potentially-many-per-screen elements: `AppCard` (including `hero`, which keeps its own accent-adjacent `surfaceHero`/`borderHero` tint rather than following the per-theme environment), `SegmentedControl`'s track, `CategoryTabs`' unselected pills, `IconButton`'s default (non-accent-filled) state. A `BlurView` per instance would be wasted cost at this repetition level — the tint+border alone already reads as glass.
- **`chrome`** — tint + border + real blur, at 80% fill opacity, letting the blur itself (rather than a higher tint alpha) carry most of the grounding against constantly-changing content behind it. Reserved for the handful of **structural, one-instance-at-a-time** surfaces: `BottomNavBar`, `AppSideMenu`, `BottomSheet`. These are exactly the surfaces §11/§15 call for blur on, and bounding real blur to "at most one on screen" is what keeps this affordable on real devices.

**What never gets glass:** `PrimaryButton`/`SecondaryButton`/`DestructiveButton`/`TextButton` (a primary action should read as solid, not diluted — see §8), `TextInput` (an input's fill staying fully opaque is a deliberate readability/accessibility choice — text typed over a blurred, theme-shifting background would be harder to track), `Badge` (already a deliberately light accent-tinted pill, not a "surface"), chart components, small icons/labels on their own. Don't make every element glass — see §20.

**Accessibility**: a glass surface's tint opacity is tuned so `textPrimary`/`textSecondary` sitting on top keep their existing contrast ratios against the darkest theme (Obsidian) _and_ the depth overlay's darkened edges — see §19.

## 3. Workout & Nutrition Accent-Color Systems

Beyond the single static brand accent (§4), two parts of the app carry their **own user-customizable accent color**, stored per-user in the backend and applied at runtime:

- **Workout Mode** accent — default `#2F80FF` (Electric Blue)
- **Nutrition Mode** accent — default `#10B981` (Emerald)

A user picks any color from a shared preset palette (`apps/mobile/src/theme/accentPalette.ts`, `ACCENT_PRESET_GROUPS` — 10 named groups: Blues, Purple, Green, Red, Orange, Yellow/Gold, Pink, Cyan/Teal, Earth/Luxury, Monochrome) or a custom hex via an RGB slider. Whatever the source, every consumption site derives from **one base hex** via `buildAccentTheme(hex)` in `apps/mobile/src/theme/accentColor.ts`, which returns:

| Field          | Meaning                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accent`       | The base color itself                                                                                                                                                                                                                                                                                                                                                                                          |
| `onAccent`     | Text/icon color for content on top of a filled `accent` surface — computed per-color via WCAG relative-luminance contrast against both `colors.background` and `colors.textPrimary`, so a light accent (e.g. Pure White) correctly gets dark text and a dark accent gets light text. **Never hardcode which ink color goes on an accent — always derive it, or use the value this function already computed.** |
| `accentBg`     | The accent at 14% alpha — tinted backgrounds (e.g. selected tab fill)                                                                                                                                                                                                                                                                                                                                          |
| `accentBorder` | The accent at 35% alpha — tinted borders                                                                                                                                                                                                                                                                                                                                                                       |
| `accentMuted`  | The accent blended 50% toward `colors.surfaceRaised` — subtle icon backgrounds                                                                                                                                                                                                                                                                                                                                 |
| `progress`     | Progress-fill color, currently identical to `accent`                                                                                                                                                                                                                                                                                                                                                           |

Components that need to _follow_ whichever mode is active (Button's `PrimaryButton`, `SegmentedControl`, `Toggle`, `Badge`, `BottomNavBar`, `MuscleVisualization`) accept `accentColor`/`onAccentColor` props defaulting to the static brand accent — **never a second, competing color system.** A screen with its own mode theme passes the resolved `AccentTheme` fields down; a screen without one gets the brand default for free.

Settings itself (being app-level/global, not per-mode) has no independent theme concept — its one dynamic color (category tabs' selected state, primary buttons) is always the user's **Workout** accent.

## 4. Colors & Semantic Usage

All values live in `apps/mobile/src/design/theme.ts`. Never hardcode a hex that duplicates one of these — reference the token.

```
background:      #0B0D0F   // app background
surface:         #131719   // standard card/row background
surfaceRaised:   #1A2023   // icon-wrap backgrounds, selected-pill fills, raised chips
surfaceHero:     #0F1D1C   // the ONE hero card per screen only (see below)
borderHero:      #1E4A45
border:          #212B2D   // standard card/input border
divider:         #1B2123   // row dividers within a card

textPrimary:       #F1F6F6   // headings, primary content, values
textSecondaryBright: #B4C4C6 // a brighter step between textSecondary and textPrimary, for secondary text sitting directly over a busy photographic background where textSecondary reads too dim
textSecondary:     #8FA0A2   // supporting text, unselected labels
textMuted:         #5E7072   // placeholders, disabled/empty-state text, icons at rest

accent:          #29E3C7   // the single static brand accent
onAccent:        #06201C

destructive:     #F0555C   // errors, delete actions only
destructiveBorder: #3A2226

chartAccent:     #29E3C7
chartMuted:      #212B2D

glassBorder:       rgba(255, 255, 255, 0.08)   // glass-surface hairline, default weight
glassBorderStrong: rgba(255, 255, 255, 0.14)   // glass-surface hairline, chrome surfaces (§3b)
```

**Semantic rules:**

- **One brand accent, no separate "success" color.** Personal records reuse `colors.accent` rather than a green/success hue (an explicit, approved direction — see `Badge.tsx`'s own comment).
- **`hero` is reserved for the single most important card on a screen** (e.g. Dashboard's Recent/Next Workout card) — a thin accent-tinted border (`surfaceHero`/`borderHero`) instead of a fill, so elevation reads as "this is the important one" without introducing a second color block. Do not apply `hero` to more than one card per screen.
- **Destructive red is for errors and destructive actions only** — never repurposed as a generic "warning" or "attention" color.
- Numeric "readout" values (`StatValue`, chart lines) default to the brand accent color, distinct from body text.

## 5. Typography

Two font families, loaded via `useFonts()` before anything renders (`App.tsx`'s `FontGate`):

- **Manrope** (`displayMedium` 500, `display` 700, `displayHeavy` 800) — every heading, label, and UI string.
- **JetBrains Mono** (`mono` 500, `monoBold` 700) — **numeric "readout" values only** (stat values, PRs, calorie counts, wheel-picker numbers). Never used for prose, labels, or headings. This mono/sans split is a deliberate, approved direction — don't blur it.

Type scale (`typeScale` in `theme.ts`) — use these, don't hand-pick `fontSize`:

| Token            | Font          | Size                         | Use                                                                                                 |
| ---------------- | ------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `display`        | displayHeavy  | 32                           | Rare hero/large-heading moment (e.g. a completion screen) — not a general `screenTitle` replacement |
| `screenTitle`    | displayHeavy  | 24                           | Standard screen title (`AppHeader`'s `title`)                                                       |
| `sectionHeading` | display       | 12, uppercase, letter-spaced | `SectionHeader` labels                                                                              |
| `cardTitle`      | display       | 16                           | Card/row titles, `ErrorState` title                                                                 |
| `statLarge`      | monoBold      | 30                           | `StatValue` default size                                                                            |
| `statMedium`     | mono          | 19                           | `StatValue` compact size                                                                            |
| `body`           | (system)      | 15                           | Standard body text, input text                                                                      |
| `secondary`      | (system)      | 13                           | Supporting/muted text (also covers "bodySmall" — not duplicated under a second name)                |
| `label`          | displayMedium | 13                           | Form-field label above an input — distinct from `sectionHeading`                                    |
| `caption`        | displayMedium | 11                           | Smallest supporting text, error/helper text under inputs                                            |

## 6. Spacing

```
xs: 4   sm: 8   md: 12   lg: 16   xl: 20   xxl: 24   xxxl: 32
```

`spacing.xxl` is the standard screen horizontal padding (`ScreenContainer`, `AppHeader`, `BottomSheet`). Always reference `spacing.*` — no raw pixel margins/padding for values this scale already covers.

## 7. Border Radii

```
sm: 8   md: 10   lg: 14   pill: 999
```

- `sm` — small elements (wheel-picker highlight)
- `md` — the default for cards, inputs, icon-wrap boxes
- `lg` — buttons, bottom-sheet top corners
- `pill` — fully-rounded: segmented controls, badges, tab pills, the bottom-nav's center "+" button, avatar circles

## 8. Buttons (`apps/mobile/src/design/Button.tsx`)

Four variants, one file, no others:

- **`PrimaryButton`** — filled, `radii.lg`, accepts `accentColor`/`onAccentColor` (default `colors.accent`/`colors.onAccent`) so it can follow a screen's mode theme (mirrors `SegmentedControl`/`Toggle`'s override pattern). Background/text color are always supplied inline from these props — never hardcoded in the stylesheet, so there's no stale default to fall out of sync.
- **`SecondaryButton`** — outlined (`colors.border`), `textPrimary` label, `radii.lg`.
- **`DestructiveButton`** — outlined in `destructiveBorder`, `destructive`-colored label. For destructive actions only.
- **`TextButton`** — plain text link, `textSecondary`, no container.

All four: `disabled` → `opacity: 0.5` (the app-wide disabled convention, §14). No fifth button variant should be introduced without updating this file.

## 9. Inputs (`apps/mobile/src/design/TextInput.tsx`)

One bordered row: optional `label` above, the input itself (with optional left/right accessory slots), optional `error`/`helperText` below. Border color is a single computed value from three states — `error` → `destructive`, `focused` → `textSecondary`, default → `border` — never separate style objects per state to keep in sync. `error` presence always wins over `helperText`. Placeholder text uses `colors.textMuted`.

## 10. Cards (`apps/mobile/src/design/AppCard.tsx`)

One card component, two visual states, both now a glass surface (§3b — `GlassBackground`'s `surface` variant, tint + hairline border, no blur):

- **Default** — translucent tint of the active Background Theme's `surface`, `glassBorder` hairline, `radii.md`, `spacing.lg` padding.
- **`hero`** — same treatment, tinted toward `surfaceHero`/bordered in `borderHero` (§4) instead of following the per-theme environment, so it still reads as "the important one." Reserved for one card per screen.

`AppCard` renders as a `TouchableOpacity` when given `onPress`, otherwise a plain `View` — never wrap it in an extra pressable yourself.

An earlier readability pass gave Dashboard's Workout/Nutrition cards their own extra `darkCardTint` layer merged into `AppCard`'s outer `style`, on top of `GlassBackground`'s own tint — a scoped, per-screen darkening because `surface`'s tint alone (60% at the time) wasn't separating content from those photo backgrounds clearly enough. That default has since been raised app-wide instead (see §3b), which fully supersedes the one-off: `darkCardTint` has been removed, and every `AppCard` everywhere (not just Dashboard) now gets that same strong foundation from the one shared token, per the "modify the shared component, not each screen" rule this system is built on.

Nutrition mode additionally layers a `NutritionForegroundLayer` (`apps/mobile/src/dashboard/NutritionForegroundLayer.tsx`) above its widgets: two small clipped windows (a left-edge strip, a bottom strip) each showing a second, full-size, undimmed copy of the same Nutrition background photo, sized/positioned identically to the real `AppBackgroundLayer` beneath so they line up pixel-for-pixel. This re-reveals the photo's own foreground objects (the plant on the left, the table/bowl/bottle at the bottom) at full brightness on top of the now-darker widgets, giving Nutrition mode a background → widgets → foreground-sliver depth rather than flattening those objects into the same dim wash as the rest of the scene. The underlying image asset is never cropped or modified — only which part of a second copy of it is allowed to show through differs. Always mounted (not conditionally, per the mode-switch performance note in §3a) with a `visible` prop toggling its own opacity, so it never pays its own image-decode cost when Dashboard switches into Nutrition mode.

## 11. Navigation

Three distinct, non-overlapping navigation surfaces — don't conflate them:

1. **`BottomNavBar`** — the persistent 5-item bar (Home / Workouts / center "+" / Progress / Social) shown on Workouts and Social (Dashboard keeps its own copy since it additionally crossfades between the Workout/Nutrition accent — a static bar doesn't need that animation). A glass `chrome` surface (§3b — real blur + `glassBorderStrong` top edge only, no side/bottom border since it's flush with the screen edges). Active item uses the mode accent; inactive uses `textSecondary`. The center "+" is a filled, raised pill button opening `QuickActionMenu`. **Dashboard's own copy of this bar** is likewise a `chrome` glass surface, for the same reason, and uses the same `textSecondary` inactive color. Dashboard's fixed top header (brand row + hamburger/bell + the Workout/Nutrition mode toggle) keeps a glass `surface` tint of its own (§3b — tint + hairline border, deliberately **no** blur, so the forest/gym photo behind it stays sharp) — an earlier version removed the header's fill entirely to maximize background visibility, but the Workout Mode readability pass reintroduced it: with no fill at all, the header's brand row and icons blended into a busy photo behind them. The hamburger `IconButton`, bell icon, and wordmark use `textSecondaryBright` (not the darker default `textSecondary`) for the same reason, and the mode toggle keeps its own small `surface` glass treatment underneath the header's.
2. **`AppSideMenu`** — the app-level global drawer (hamburger → full destination list, grouped under `SectionHeader`s), animated via `Animated`/`Pressable` (no drawer-navigator dependency), 280px wide, slides from the left, dismissible via backdrop tap or Android back button. Also a glass `chrome` surface (blur + `glassBorderStrong` right edge only) — the backdrop behind it stays the existing opaque `rgba(0,0,0,0.6)` scrim. Its two section lists (`APP_MENU_SECTIONS`, `apps/mobile/src/navigation/appMenuSections.ts`, and `NUTRITION_MENU_SECTIONS`, `nutritionMenuSections.ts`) are strictly mode-scoped — Workout mode's menu never lists a Nutrition destination and vice versa; Profile isn't in either (it's already one tap away via the bottom nav). The hamburger itself is reachable the same way from every main Workout-mode screen, not just Dashboard: Workout History, Progress, Workout Splits, and Exercise Library all open it from their own header (replacing what would otherwise be a back button, since these are bottom-nav/side-menu-reachable screens, not deep task screens) — mirroring how Nutrition mode already does this on Food Library/Nutrition Goals. Screens reached by pushing forward from one of those (a workout's detail, an active session, starting a new workout, etc.) keep a plain back arrow instead, same as Nutrition mode's own Food Search/Nutrition Goals sub-screens.
3. **`CategoryTabs`** (`apps/mobile/src/settings/CategoryTabs.tsx`) — a screen-local horizontal pill-tab row for a screen's own internal sections (Settings' categories, Progress's sections). Generic over its key type so it's reused verbatim rather than re-implemented per screen — reach for this, don't build a new tab bar. Unselected pills are a glass `surface` (§3b, no blur — there can be several per row); the selected pill keeps its existing accent-tinted fill (`withAlpha(accentColor, 0.14)`) rather than glass, since a selected state should read as accent-forward, not translucent-neutral.
4. **`ModeToggle`** (`apps/mobile/src/design/ModeToggle.tsx`) — the single Workout/Nutrition segmented switch, extracted from Dashboard's original implementation (identical visuals, identical 260ms crossfade). Shown **only** on the app's primary/root screens — Dashboard (Home), Workouts/Food, Progress, and Profile — never on a screen reached by pushing forward from one of those (Active Workout, Add Exercise, Workout/Exercise/PR/1RM detail, Log Food, Calorie Estimation, etc.): the principle is that a deep task screen already makes the current mode obvious, so a mode switch there would only be clutter, not a real choice. Settings is a further exception on its own terms — a global app-level area, independent of mode, so it never shows this toggle either. On every non-Dashboard root screen, tapping the _other_ mode's segment always navigates to `Dashboard` (each mode's one true landing page/Home) — never to that screen's own "mirror" in the other mode (e.g. Workouts' toggle does not go straight to Food, nor Food's to Workouts) — and reports the change via `reportMode` first so Dashboard opens already in the right mode; tapping the _already-selected_ segment is a no-op (no navigation, no report). Dashboard's own toggle never navigates (it already **is** Home for both modes) and instead flips its local `mode` state, exactly as before. The app's `sharedMode` flag (`App.tsx`'s `Root`, reported via `AppMenuContext`'s `reportMode`, read via `currentMode`) is what Progress/Profile fall back to for which segment shows selected, since neither screen's own route carries a mode identity (see `isNutritionRoute`/`MODE_AGNOSTIC_ROUTES`) — this matters for the case where the user reaches Progress or Profile via the bottom nav/side menu while already in Nutrition mode (not via this toggle): Progress has no Nutrition-side content yet, so it shows a single `ProgressEmptyState` ("Nutrition progress is coming soon") instead of its Workout-only tabs/sections in that case; Profile's own content doesn't depend on mode at all yet, so it looks the same either way.

**Screen transitions**: the platform's own native push/pop animation (`animation: 'default'`) applied once at the navigator level in `App.tsx` — never a custom per-screen transition. `animationMatchesGesture` + `fullScreenGestureEnabled` let an in-progress iOS swipe-back drive the same transition and start from anywhere on screen. Respects Reduce Motion (`useReduceMotionPreference`) by swapping to `animation: 'none'` — any new animated component should check this same hook rather than adding a second reduced-motion mechanism (see `AppSideMenu`, `BottomSheet`).

## 12. Tabs / Segmented Controls

- **`SegmentedControl`** (`apps/mobile/src/design/SegmentedControl.tsx`) — a pill-shaped row of equal-weight segments (e.g. kg/lb, cm/ft-in) on a glass `surface` track (§3b — tint + hairline border, no blur). Selected segment gets an `accentColor` fill (default brand accent, solid — not glass, same reasoning as CategoryTabs' selected pill above); selection changes **color only** — never size, weight, padding, or border, so a selected segment never grows relative to its unselected size.
- **`CategoryTabs`** — see §11. Same "selection changes color only" rule applies (`tabLabelSelected` only changes `color`).
- **Known layout trap, already fixed once, do not reintroduce it:** a horizontal tabs `ScrollView` sitting above a vertical content `ScrollView` will fight it for leftover space unless the tabs' `ScrollView` has explicit `flexGrow: 0` and its row has `alignItems: 'center'` (a flex row's cross-axis defaults to `stretch`, which stretches pills to whatever height the row ends up with). See `settingsStyles.ts`'s `tabsScroll`/`tabsRow` comments for the full explanation if this pattern is reused elsewhere.

## 13. Badges (`apps/mobile/src/design/Badge.tsx`)

One badge style. Default: brand-accent text on a 14%-alpha accent-tinted pill background. Accepts optional `color`/`backgroundColor` overrides for a screen with its own accent theme (e.g. Dashboard's modes) — every other caller is unaffected. Used for: PR/achievement labels, and the "Coming Soon" state (`ComingSoonRow`, muted gray variant: `textMuted` on `surfaceRaised`). There is no separate "success" badge color (§4).

## 14. Icons

**Feather (`@expo/vector-icons`) exclusively.** No other icon set is used anywhere in the app. Standard sizes: 16 (inline row icons), 18 (header/menu actions), 20 (bottom-nav items), 22 (center "+" button). Icon color follows context: `textMuted` at rest, `textSecondary`/`textPrimary` for emphasis, the active accent when representing an active/selected state.

`IconButton`'s default (bordered-circle) state is a glass `surface` (§3b, no blur) — this is what carries the new visual language into every header's back/settings/action buttons without touching `AppHeader` itself. Its accent-filled state (`backgroundColor` prop passed — an accent-driven action) stays a solid, opaque fill, same reasoning as buttons in §8.

## 15. Modals / Bottom Sheets

- **`BottomSheet`** (`apps/mobile/src/design/BottomSheet.tsx`) — the generic primitive: `Modal` + semi-transparent (`rgba(0,0,0,0.5)`) backdrop `Pressable` + a glass `chrome` sheet (§3b — blur + `glassBorderStrong` top edge) with only the top corners rounded (`radii.lg`), sliding up from the bottom. Respects Reduce Motion (`animationType: 'none'` vs `'slide'`). Backdrop-tap-to-dismiss is on by default (`dismissOnBackdropPress`).
- **`QuickActionMenu`** — the center "+" button's action sheet, built on the same Modal+backdrop+sheet shape (predates `BottomSheet`'s generalization) and likewise now a glass `chrome` sheet. Only ever offers actions with real functionality behind them — no placeholder actions that appear to work but don't.
- Any new bottom-sheet-style UI should use `BottomSheet` directly rather than hand-rolling the Modal/backdrop/sheet structure again.

## 16. States

- **Loading**: `LoadingState` — full-bleed centered `ActivityIndicator` (`size="large"`, `colors.accent`) on `colors.background`. Inline/header-level loading (e.g. a save in progress) uses a small `ActivityIndicator` in place of the action icon (see `AppHeader`'s `loading` prop, `IconButton`'s `loading` prop).
- **Empty**: `EmptyState` — optional icon slot + centered muted title (`textMuted`), nothing more. Replaces ad hoc "no data" gray text.
- **Error**: `ErrorState` — icon slot + `cardTitle`-styled heading ("Something went wrong" by default) + muted message + optional plain-text "Retry" action (not a filled button — retrying isn't a destructive action, so it stays visually calm).
- **Disabled**: `opacity: 0.5`, uniformly, across every interactive component (`Button`, `TextInput`'s row, `SegmentedControl`, `Toggle` via native `Switch`, `IconButton`). Don't invent a second disabled treatment.
- **"Coming Soon" (visible-but-not-yet-functional)**: `ComingSoonRow` — a real row with a muted "Coming Soon" `Badge`, never a toggle or button that silently does nothing when pressed. Use this pattern whenever UI is intentionally ahead of its backend.

## 17. Layout Principles

- Screens compose from the shared primitives (`ScreenContainer` or `AppHeader` for the frame, `AppCard` for content blocks, `SectionHeader` above each section) rather than each screen hand-rolling padding/scroll/safe-area handling.
- `ScreenContainer` handles the device's real safe-area top inset (`useSafeAreaInsets`) + `spacing.lg`, plus `spacing.xxl` horizontal content padding — never hardcode a `paddingTop` guess.
- List rows within a card follow the `settingsStyles` row convention: `rowIconWrap` (36×36 `surfaceRaised` circle/box) + `rowBody` (title + optional subtitle) + trailing chevron/badge/control, separated by `rowDivider` between rows in the same card.
- One `SectionHeader` per logical group; don't nest section headers.

## 18. Responsive Behavior

The app is phone-only (no tablet-specific layout exists). Within that: `CategoryTabs`/`BottomNavBar` scroll horizontally rather than wrapping; `WheelPicker` and similar fixed-height components use device-independent point values, not percentage-of-screen math, since none of today's screens need to adapt beyond standard phone widths. When a layout must respond to content length rather than screen size (e.g. tabs vs. content competing for space), see the flex trap documented in §12.

## 19. Accessibility & Contrast

- Every interactive element sets `accessibilityRole` (`"button"`, `"switch"`) and a meaningful `accessibilityLabel` — icon-only controls (`IconButton`, `AppHeader` actions) always require an explicit label since there's no visible text to fall back on.
- `accessibilityState` reflects real state: `{ selected }` for tabs/segments/menu items, `{ disabled }` for anything that can be disabled, `{ checked }` for `Toggle`.
- Custom accent colors are contrast-checked, not assumed: `buildAccentTheme` computes WCAG relative luminance/contrast against both ink colors and picks whichever wins (§3) — this is the one place in the app doing real contrast math, and any new accent-driven text-on-fill combination should reuse it rather than guessing.
- Reduce Motion is respected everywhere an animation exists (`AppSideMenu`, `BottomSheet`, screen transitions) — a new animated component must check `useReduceMotionPreference()` too. `AppBackgroundLayer`'s depth overlay (§3a) is a static gradient, never animated, so it needs no such check.
- Glass surfaces (§3b) are translucent, not indistinct: `GlassBackground`'s tint opacity (`surface` 86%, `chrome` 80%) was chosen so `textPrimary`/`textSecondary` keep their existing contrast against the darkest theme — raising `surface`'s alpha only ever improves this (a darker foundation behind light text), never regresses it. Never reduce a glass surface's fill opacity below what `AppCard`/`BottomNavBar` already use without re-checking text contrast on top of it — the background must never overpower foreground content.

## 20. UI Do's and Don'ts

**Do:**

- Reference `colors`/`spacing`/`radii`/`typeScale`/`fonts` from `theme.ts` for every value those scales cover.
- Reuse an existing component (`AppCard`, `Badge`, `SegmentedControl`, etc.) before writing a new one; if a genuinely new pattern is needed, add it to `apps/mobile/src/design/` so it's shared, not screen-local.
- Let mode-aware components (`PrimaryButton`, `SegmentedControl`, `Toggle`, `Badge`, `BottomNavBar`, `MuscleVisualization`) receive `accentColor`/`onAccentColor` from the caller rather than hardcoding a color inside them.
- Reuse `GlassBackground` (§3b) for any new "major surface" (a card, a persistent chrome bar, a modal) instead of hand-rolling translucency/blur — render it as the surface's first child and keep the consumer's own border-radius/`overflow: 'hidden'`.
- Use `ComingSoonRow` for real-but-not-yet-functional UI instead of a control that does nothing.
- Check `useReduceMotionPreference()` before adding any new animation.

**Don't:**

- Don't hardcode a hex color, font size, spacing value, or radius that duplicates an existing token.
- Don't introduce a second "success" or generic "warning" color — the brand accent and destructive red are the only two semantic colors in the system.
- Don't add a second icon library alongside Feather.
- Don't use JetBrains Mono for anything other than numeric readout values.
- Don't apply the `hero` card treatment to more than one card per screen.
- Don't build a new tabs/segmented UI from scratch — reuse `SegmentedControl` or `CategoryTabs`.
- Don't let a selected tab/segment change size, weight, or padding — only color (§12).
- Don't add light-mode-conditional styling (§2).
- Don't invent a new disabled-state visual treatment beyond `opacity: 0.5`.
- Don't give every element a glass treatment — buttons, inputs, badges, and chart components stay as documented in their own sections (§3b). Glass is for major/structural surfaces, not small or simple content.
- Don't use the `chrome` (blurred) glass variant for anything that can appear more than once on screen at a time — reserve real blur for the single persistent nav/drawer/sheet instance; everything else uses the unblurred `surface` variant (§3b).
- Don't introduce a second background/theme system — extend `backgroundThemes.ts` (§3a) if a new environment is needed.
