// The illustration palette (DESIGN.md, "Exercise illustrations") -- the "clean 3D" look: one
// instructor in a black tee and shorts, softly lit from the upper left, on the card's own surface.
// Each material is a pair: its lit and its shadowed tone, shaded between across every limb. The
// worked muscles are shown on a grey anatomy figure beside the drawing -- primary red, secondary
// yellow -- fixed, so a highlight means the same thing whatever the app's theme.

export interface Material {
  light: string;
  shadow: string;
}

export const MATERIALS = {
  skin: { light: '#F1BE98', shadow: '#9C5F3F' },
  skinFar: { light: '#C99472', shadow: '#7A472F' },
  shirt: { light: '#6A6D75', shadow: '#18191C' },
  shirtFar: { light: '#4C4E55', shadow: '#111214' },
  shoe: { light: '#FFFFFF', shadow: '#A9ABB0' },
  shoeFar: { light: '#DADBDE', shadow: '#86888D' },
  hair: { light: '#4A3528', shadow: '#1E140E' },
  anatomy: { light: '#C9C7C4', shadow: '#5E5C59' },
  anatomyFar: { light: '#A9A7A4', shadow: '#4D4B48' },
  metal: { light: '#ECEEF1', shadow: '#7D828A' },
  iron: { light: '#4F5258', shadow: '#121315' },
} as const;

export const ART = {
  /** A thin rim that keeps overlapping parts apart; dark and soft, never a cartoon outline. */
  rim: 'rgba(8,6,5,0.55)',
  ear: '#C98B66',
  primary: '#EE5A4B',
  secondary: '#F3C24A',
  plate: '#1E1F22',
  plateFace: '#2E3035',
  plateHub: '#B9BDC4',
  pad: '#1F2023',
  padTop: '#3A3C42',
  padSide: '#141518',
  frame: '#6C7179',
  frameDark: '#4A4E55',
  wood: '#5A4A3C',
  woodTop: '#7A6553',
  shadow: 'rgba(0,0,0,0.5)',
  motion: 'rgba(240,232,222,0.6)',
} as const;

/** The rim's width, in centimetres of the figure's space. */
export const OUTLINE_WIDTH = 0.45;
