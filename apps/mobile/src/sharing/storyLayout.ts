// The shared story image's geometry. Pure numbers, shared by the card (ShareCard.tsx), its styles
// (shareCardStyles.ts) and the screen.

/**
 * The whole story image, in points. It is always laid out at exactly this size (the screen scales
 * its preview to fit), so what is saved never depends on the phone: 3x this is 1080x1920, a 9:16
 * story -- the full frame Instagram Stories shows, uncropped.
 */
export const STORY_CANVAS = { width: 360, height: 640 } as const;
export const STORY_CAPTURE = { width: 1080, height: 1920 } as const;

/**
 * Where a story app's own controls sit over the image, in canvas points: the account row and
 * progress bars along the top (about 150px of the 1080x1920 image) and the reply bar along the
 * bottom (about 240px). Only decoration -- the string of lights, the landscape -- sits in them;
 * every word and figure on the card stays between them.
 */
export const STORY_CLEAR = { top: 50, bottom: 80 } as const;

/** How far the card's panels sit in from the image's edges. */
export const STORY_GUTTER = 12;
