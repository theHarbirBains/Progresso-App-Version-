import { StyleSheet } from 'react-native';
import { HEADING_FONTS } from '../design/headingFont';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { themeById } from '../theme/appThemes';
import { STORY_CANVAS, STORY_GUTTER } from './storyLayout';

// The shareable workout image (ShareCard) and the screen around it. Token-only.
//
// The image is a picture that leaves the app, so it paints everything itself, in one palette of
// its own whatever the app's theme: Holiday Gym's deep forest green and string-light gold (Harbir's
// reference design), the app's warm off-white for words, Fraunces -- the serif Holiday Gym heads
// with -- for headings, names and figures, and Plus Jakarta Sans for the rest.

const LOOK = themeById('holiday-gym');
/** The image's own colours. */
export const STORY_PALETTE = {
  background: LOOK.background,
  gold: LOOK.accent,
  text: colors.textPrimary,
  textSoft: colors.textSecondaryBright,
  textQuiet: colors.textSecondary,
  panel: withAlpha(colors.surfaceRaised, 0.7),
  panelBorder: withAlpha(LOOK.accent, 0.3),
  rowDivider: withAlpha(colors.textPrimary, 0.07),
  well: withAlpha(LOOK.accent, 0.09),
} as const;

const SERIF = HEADING_FONTS.fraunces.display;
const SERIF_HEAVY = HEADING_FONTS.fraunces.displayHeavy;

/** How roomy the card is: it starts as roomy as its workout allows and tightens to fit. */
export type StoryDensity = 'roomy' | 'snug' | 'tight';
export const DENSITIES: readonly StoryDensity[] = ['roomy', 'snug', 'tight'];

interface DensitySpec {
  /** Where the words start, under the lights. */
  top: number;
  brand: number;
  title: number;
  date: number;
  headerGap: number;
  panelGap: number;
  statPad: number;
  statValue: number;
  rowPad: number;
  /** A list panel's own top and bottom padding. */
  panelPad: number;
  /** A top set's pill, above and below its figure. */
  pillPad: number;
  icon: number;
  /** An activity's square, a little bigger than a lift's round well (as in the reference). */
  cardioIcon: number;
  name: number;
  label: number;
  value: number;
  /** The landscape's height, at the foot of the image. */
  landscape: number;
  /** The person's own photo, when they add one: its circle's diameter. */
  photo: number;
}

/** Each density's sizes, in canvas points. Even tight keeps names at 10.5pt -- 31px in the image. */
export const DENSITY: Readonly<Record<StoryDensity, DensitySpec>> = {
  roomy: {
    top: 40,
    brand: 20,
    title: 26,
    date: 11.5,
    headerGap: 14,
    panelGap: 10,
    statPad: 12,
    statValue: 15,
    rowPad: 5,
    panelPad: 6,
    pillPad: 5,
    icon: 32,
    cardioIcon: 42,
    name: 12.5,
    label: 9.5,
    value: 14.5,
    landscape: 112,
    photo: 76,
  },
  snug: {
    top: 36,
    brand: 17,
    title: 22,
    date: 10.5,
    headerGap: 10,
    panelGap: 8,
    statPad: 9,
    statValue: 13.5,
    rowPad: 4,
    panelPad: 4,
    pillPad: 4,
    icon: 26,
    cardioIcon: 34,
    name: 11.5,
    label: 8.5,
    value: 12.5,
    landscape: 84,
    photo: 62,
  },
  tight: {
    top: 32,
    brand: 15,
    title: 19,
    date: 9.5,
    headerGap: 7,
    panelGap: 6,
    statPad: 7,
    statValue: 12.5,
    rowPad: 3,
    panelPad: 3,
    pillPad: 3,
    icon: 21,
    cardioIcon: 27,
    name: 10.5,
    label: 8,
    value: 11,
    landscape: 60,
    photo: 50,
  },
};

/** The lowest the words may reach on the image at a density: the landscape keeps its sky. */
export function wordsBottom(density: StoryDensity): number {
  return STORY_CANVAS.height - DENSITY[density].landscape * 0.72;
}

function densityStyles(d: DensitySpec) {
  return StyleSheet.create({
    words: {
      position: 'absolute',
      top: d.top,
      left: STORY_GUTTER,
      right: STORY_GUTTER,
      gap: d.panelGap,
    },
    // The heading: the brand with its hat, WORKOUT COMPLETE between two gold rules, the
    // workout's name and its date.
    header: {
      alignItems: 'center',
      gap: 3,
      marginBottom: d.headerGap - d.panelGap,
    },
    brandWrap: {
      alignSelf: 'center',
    },
    brand: {
      fontFamily: SERIF_HEAVY,
      fontSize: d.brand,
      color: STORY_PALETTE.text,
    },
    hat: {
      position: 'absolute',
      left: -d.brand * 0.32,
      top: -d.brand * 0.48,
      transform: [{ rotate: '-16deg' }],
    },
    kickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 2,
    },
    kickerRule: {
      width: 44,
      height: StyleSheet.hairlineWidth * 2,
      backgroundColor: withAlpha(STORY_PALETTE.gold, 0.55),
    },
    kicker: {
      fontFamily: fonts.displayMedium,
      fontSize: d.date * 0.72,
      letterSpacing: 3,
      color: STORY_PALETTE.textSoft,
    },
    // The person's own photo, when they add one, between the brand and WORKOUT COMPLETE: a
    // circle in a fine gold ring, a sliver of the green between -- like the card's other wells.
    photoRing: {
      padding: 3,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: withAlpha(STORY_PALETTE.gold, 0.85),
      marginTop: 6,
      marginBottom: 3,
    },
    photoCircle: {
      width: d.photo,
      height: d.photo,
      borderRadius: d.photo / 2,
      overflow: 'hidden',
      backgroundColor: STORY_PALETTE.well,
    },
    title: {
      fontFamily: SERIF_HEAVY,
      fontSize: d.title,
      lineHeight: d.title * 1.18,
      color: STORY_PALETTE.text,
      textAlign: 'center',
      marginTop: 4,
    },
    date: {
      fontFamily: fonts.body,
      fontSize: d.date,
      color: STORY_PALETTE.textSoft,
    },
    // A panel: the dark warm surface, a fine gold edge, rounded as the reference's.
    panel: {
      backgroundColor: STORY_PALETTE.panel,
      borderWidth: 1,
      borderColor: STORY_PALETTE.panelBorder,
      borderRadius: radii.md,
    },
    // The four figures, side by side, a fine rule between each.
    stats: {
      flexDirection: 'row',
      paddingVertical: d.statPad,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 4,
    },
    statDivided: {
      borderLeftWidth: StyleSheet.hairlineWidth * 2,
      borderLeftColor: withAlpha(STORY_PALETTE.gold, 0.18),
    },
    statValue: {
      fontFamily: SERIF,
      fontSize: d.statValue,
      color: STORY_PALETTE.text,
      marginTop: 2,
    },
    statLabel: {
      fontFamily: fonts.body,
      fontSize: d.label,
      color: STORY_PALETTE.textQuiet,
    },
    // A section's quiet heading inside its panel (tight only: its rows carry no label).
    sectionLabel: {
      fontFamily: fonts.displayMedium,
      fontSize: d.label,
      letterSpacing: 2,
      color: STORY_PALETTE.textQuiet,
      paddingTop: d.rowPad + 2,
    },
    rows: {
      paddingHorizontal: spacing.md,
      paddingVertical: d.panelPad,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: d.rowPad,
      gap: spacing.md,
    },
    rowDivided: {
      borderTopWidth: StyleSheet.hairlineWidth * 2,
      borderTopColor: STORY_PALETTE.rowDivider,
    },
    // An exercise's glyph in a round well; an activity's in a rounded square.
    iconRound: {
      width: d.icon,
      height: d.icon,
      borderRadius: d.icon / 2,
      backgroundColor: STORY_PALETTE.well,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconSquare: {
      width: d.cardioIcon,
      height: d.cardioIcon,
      borderRadius: radii.sm,
      backgroundColor: STORY_PALETTE.well,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconDivider: {
      alignSelf: 'stretch',
      width: StyleSheet.hairlineWidth * 2,
      marginVertical: 4,
      backgroundColor: withAlpha(STORY_PALETTE.gold, 0.18),
    },
    // The name's column: as wide as the row leaves, wrapping onto more lines rather than shrinking.
    rowText: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    name: {
      fontFamily: SERIF,
      fontSize: d.name,
      lineHeight: d.name * 1.25,
      color: STORY_PALETTE.text,
    },
    label: {
      fontFamily: fonts.body,
      fontSize: d.label,
      color: STORY_PALETTE.textQuiet,
    },
    figures: {
      fontFamily: fonts.body,
      fontSize: d.label + 1,
      lineHeight: (d.label + 1) * 1.3,
      color: STORY_PALETTE.textSoft,
    },
    // The top set, in its own right-hand column: a dark pill, the figure in gold.
    pill: {
      flexShrink: 0,
      paddingHorizontal: spacing.md,
      paddingVertical: d.pillPad,
      borderRadius: radii.pill,
      backgroundColor: STORY_PALETTE.well,
    },
    value: {
      fontFamily: SERIF,
      fontSize: d.value,
      color: STORY_PALETTE.gold,
    },
    more: {
      fontFamily: fonts.body,
      fontSize: d.label + 0.5,
      color: STORY_PALETTE.textQuiet,
      textAlign: 'center',
      paddingVertical: d.rowPad,
    },
    // The one line under the panels: "5 Exercises | 15 min Cardio".
    summary: {
      fontFamily: fonts.displayMedium,
      fontSize: d.label + 0.5,
      letterSpacing: 0.5,
      color: STORY_PALETTE.textSoft,
      textAlign: 'center',
      marginTop: 2,
    },
    summaryBar: {
      color: withAlpha(STORY_PALETTE.gold, 0.7),
    },
    landscape: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: d.landscape,
    },
  });
}

/** The card's styles at each density. */
export const storyStyles: Readonly<Record<StoryDensity, ReturnType<typeof densityStyles>>> = {
  roomy: densityStyles(DENSITY.roomy),
  snug: densityStyles(DENSITY.snug),
  tight: densityStyles(DENSITY.tight),
};

export const shareCardStyles = StyleSheet.create({
  // ---- The screen ----------------------------------------------------------
  content: {
    flex: 1,
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  // Takes whatever height is left above the buttons; the story is scaled to fit it.
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typeScale.callout,
    color: colors.destructive,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.md,
  },
  actionError: {
    ...typeScale.callout,
    color: colors.destructive,
    textAlign: 'center',
  },
  actionNote: {
    ...typeScale.callout,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ---- The story image ----------------------------------------------------
  story: {
    width: STORY_CANVAS.width,
    height: STORY_CANVAS.height,
    backgroundColor: STORY_PALETTE.background,
    overflow: 'hidden',
  },
});
