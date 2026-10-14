// The shared story image's geometry: the canvas, the safe area social apps
// leave clear, and the one scale the card is drawn at. Pure numbers, shared by
// the card (ShareCard.tsx), its styles (shareCardStyles.ts) and the screen.

/**
 * The whole story image, in points. It is always laid out at exactly this size
 * (the screen scales its preview to fit), so what is saved never depends on
 * the phone: 3x this is 1080x1920, a 9:16 story.
 */
export const STORY_CANVAS = { width: 360, height: 640 } as const;
export const STORY_CAPTURE = { width: 1080, height: 1920 } as const;
/**
 * Where Instagram's and TikTok's own controls sit over a story -- the account
 * row and progress bars along the top, the reply or caption bar along the
 * bottom, buttons down the sides -- in canvas points (about 250px top, 290px
 * bottom and 110px each side of the 1080x1920 image). The card stays inside
 * what's left, so nothing of it is ever covered.
 */
export const STORY_SAFE_AREA = { top: 84, bottom: 96, side: 36 } as const;
/** The card's design width, and its design height at its tallest (two records, three exercises). */
export const CARD_WIDTH = 360;
export const CARD_MAX_HEIGHT = 600;
/**
 * One scale for every workout, so the card's type is always the same size:
 * the tallest card just fits the safe area. It is applied to every length in
 * the card's layout (atCardScale) -- never as a transform -- so the card's
 * text is drawn sharp at the size it's shown, not drawn bigger and shrunk.
 */
export const CARD_SCALE = Math.min(
  (STORY_CANVAS.width - 2 * STORY_SAFE_AREA.side) / CARD_WIDTH,
  (STORY_CANVAS.height - STORY_SAFE_AREA.top - STORY_SAFE_AREA.bottom) / CARD_MAX_HEIGHT,
);

/** A length in the card's design units, at the size it's drawn. */
export function cardPt(value: number): number {
  return value * CARD_SCALE;
}

// Every length a card style can carry. Border widths are left alone, so
// hairlines and the card's edge stay crisp single lines.
const LENGTH_KEYS = new Set([
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'padding',
  'paddingVertical',
  'paddingHorizontal',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginVertical',
  'marginHorizontal',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'gap',
  'rowGap',
  'columnGap',
  'width',
  'height',
  'minHeight',
  'borderRadius',
  'top',
  'right',
  'bottom',
  'left',
]);

/** The card's styles, written in design units, with every length at the card's drawn size. */
export function atCardScale<T extends Record<string, object>>(styles: T): T {
  const scaled: Record<string, object> = {};
  for (const [name, style] of Object.entries(styles)) {
    scaled[name] = Object.fromEntries(
      Object.entries(style).map(([key, value]) => [
        key,
        LENGTH_KEYS.has(key) && typeof value === 'number' ? cardPt(value) : value,
      ]),
    );
  }
  return scaled as T;
}
