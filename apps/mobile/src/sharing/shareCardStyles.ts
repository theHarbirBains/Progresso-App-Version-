import { StyleSheet } from 'react-native';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { atCardScale } from './storyLayout';

// The shareable workout image (ShareCard) and the screen around it. Token-only.
//
// The card is a PNG that leaves the app, so it paints everything itself --
// the warm gym photo at its top and the warm surface below -- rather than
// relying on the screen's background behind it. One accent (amber) marks
// personal records and nothing else.
export const shareCardStyles = StyleSheet.create({
  // ---- The screen ----------------------------------------------------------
  content: {
    flex: 1,
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  // Takes whatever height is left above the button; the card is scaled to fit it.
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

  // ---- The story image ----------------------------------------------------
  story: {
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  // What's left of the canvas once the social app's own controls are taken
  // out; the card is centred in it.
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

// ---- The card --------------------------------------------------------------
// Written in the card's design units (a 360pt-wide card) and drawn at
// CARD_SCALE: every length is scaled once here, so the card is laid out at the
// size it's shown and its text is drawn sharp, never shrunk by a transform.
export const shareCardBodyStyles = StyleSheet.create(
  atCardScale({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.glassBorderStrong,
      overflow: 'hidden',
    },

    // The photo block: brand mark and date along the top, the workout at its
    // foot. A fixed height, so the photo -- and its sun -- always sits the same
    // way behind the text it was measured against.
    hero: {
      height: 171,
      justifyContent: 'space-between',
      padding: spacing.xl,
      overflow: 'hidden',
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    date: {
      ...typeScale.caption,
      color: colors.textSecondaryBright,
    },
    workoutName: {
      ...typeScale.display,
      color: colors.textPrimary,
    },

    // Four stats in a row, hairlines between them.
    stats: {
      flexDirection: 'row',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    stat: {
      flex: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    statDivided: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    statValue: {
      ...typeScale.statMedium,
      color: colors.textPrimary,
      marginTop: 2,
    },
    statLabel: {
      ...typeScale.caption,
      color: colors.textSecondary,
    },

    body: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      gap: 6,
    },
    sectionLabel: {
      ...typeScale.caption,
      letterSpacing: 2,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    rows: {
      gap: 5,
    },

    // A quiet raised row: a lift over the card's fill, no border.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceLift,
      borderRadius: radii.md,
    },
    thumb: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: colors.surfaceRaised,
    },
    thumbInitial: {
      fontFamily: fonts.display,
      color: colors.textSecondary,
    },
    liftName: {
      ...typeScale.callout,
      color: colors.textPrimary,
      flex: 1,
    },
    // A personal record's small tag, beside its value (colour set per accent).
    prTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.pill,
    },
    prTagText: {
      ...typeScale.caption,
      fontFamily: fonts.display,
      letterSpacing: 0.5,
    },
    moreRow: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    more: {
      ...typeScale.callout,
      color: colors.textSecondary,
    },
    liftValue: {
      fontFamily: fonts.mono,
      fontSize: typeScale.callout.fontSize,
      color: colors.textPrimary,
    },
  }),
);
