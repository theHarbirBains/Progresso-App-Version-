import { createContext, useContext } from 'react';
import { fonts } from './theme';

// The theme's heading face (theme/appThemes.ts, `font`). Only the two heading weights change --
// `fonts.display` (700: card titles, buttons) and `fonts.displayHeavy` (800: screen titles, the
// display size) -- so a theme can have a voice of its own, while body text, labels, captions and
// the mono readouts stay in Plus Jakarta Sans and JetBrains Mono, readable in every theme. The
// shared `Text` swaps the families as it resolves a style (design/Text.tsx).

export type HeadingFontId = 'jakarta' | 'fraunces' | 'oswald' | 'nunito';

export interface HeadingFont {
  id: HeadingFontId;
  /** How it's named in Settings > Appearance. */
  name: string;
  /** The face for fonts.display (700). */
  display: string;
  /** The face for fonts.displayHeavy (800). */
  displayHeavy: string;
}

export const HEADING_FONTS: Readonly<Record<HeadingFontId, HeadingFont>> = {
  // The app's own face: the classic look.
  jakarta: {
    id: 'jakarta',
    name: 'Plus Jakarta Sans',
    display: fonts.display,
    displayHeavy: fonts.displayHeavy,
  },
  // A soft, warm serif -- classic and a little festive.
  fraunces: {
    id: 'fraunces',
    name: 'Fraunces',
    display: 'Fraunces_700Bold',
    displayHeavy: 'Fraunces_800ExtraBold',
  },
  // Tall and condensed, like a gym's signage. Oswald's heaviest is 700, so a step lighter each.
  oswald: {
    id: 'oswald',
    name: 'Oswald',
    display: 'Oswald_600SemiBold',
    displayHeavy: 'Oswald_700Bold',
  },
  // Rounded and friendly.
  nunito: {
    id: 'nunito',
    name: 'Nunito',
    display: 'Nunito_700Bold',
    displayHeavy: 'Nunito_800ExtraBold',
  },
};

/** The app's heading families mapped to a heading face's, or null for the app's own. */
export function headingFamilyMap(id: HeadingFontId): Readonly<Record<string, string>> | null {
  if (id === 'jakarta') return null;
  const face = HEADING_FONTS[id];
  return { [fonts.display]: face.display, [fonts.displayHeavy]: face.displayHeavy };
}

/** The heading families in use (AppThemeProvider provides it); null keeps the app's own. */
export const HeadingFontContext = createContext<Readonly<Record<string, string>> | null>(null);

export function useHeadingFamilies(): Readonly<Record<string, string>> | null {
  return useContext(HeadingFontContext);
}
