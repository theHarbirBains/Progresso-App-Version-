// The illustration palette (DESIGN.md, "Exercise illustrations") -- the "clean 3D" look: one
// instructor in a black tank top and shorts, softly lit from the upper left, on the card itself.
// Each material is a pair: its lit and its shadowed tone, shaded between across every limb. The
// worked muscles are shown on a grey anatomy figure beside the drawing -- primary red, secondary
// yellow -- fixed, so a highlight means the same thing whatever the app's theme.

export interface Material {
  light: string;
  shadow: string;
}

export const MATERIALS = {
  skin: { light: '#EDB487', shadow: '#7C4529' },
  skinFar: { light: '#C48D65', shadow: '#5E331E' },
  shirt: { light: '#6A6D75', shadow: '#18191C' },
  shirtFar: { light: '#4C4E55', shadow: '#111214' },
  shoe: { light: '#FFFFFF', shadow: '#A9ABB0' },
  shoeFar: { light: '#DADBDE', shadow: '#86888D' },
  hair: { light: '#4A3426', shadow: '#150D08' },
  anatomy: { light: '#B9B7B4', shadow: '#4E4C49' },
  anatomyFar: { light: '#9E9C99', shadow: '#43413E' },
  /** The anatomy figure's muscles that aren't worked: a lighter grey, so every muscle reads. */
  definition: { light: '#D6D4D0', shadow: '#686662' },
  metal: { light: '#ECEEF1', shadow: '#7D828A' },
  iron: { light: '#4F5258', shadow: '#121315' },
  /** A cable's rope attachment and battle ropes: black braided nylon. */
  rope: { light: '#5E6168', shadow: '#141518' },
  /** Resistance bands: a muted slate blue, never near the muscles' red or yellow. */
  band: { light: '#8197A8', shadow: '#2B3843' },
  /** Suspension trainer straps and sled harnesses. */
  strap: { light: '#4A4C52', shadow: '#0E0F11' },
  /** A medicine ball's rubber. */
  medicineBall: { light: '#6E625A', shadow: '#1C1714' },
} as const;

export const ART = {
  /** A thin rim that keeps overlapping parts apart; dark and soft, never a cartoon outline. */
  rim: 'rgba(8,6,5,0.55)',
  ear: '#B9774F',
  /** The face's eyes and brows, and its mouth. */
  feature: '#2B1A11',
  lips: '#8E4B33',
  /** A muscle's edge on the anatomy figure. */
  muscleEdge: 'rgba(30,26,22,0.45)',
  primary: '#EE5A4B',
  secondary: '#F3C24A',
  plate: '#1E1F22',
  plateFace: '#2E3035',
  plateHub: '#B9BDC4',
  pad: '#1F2023',
  padTop: '#3A3C42',
  padSide: '#141518',
  frame: '#3E4045',
  frameDark: '#2A2C30',
  wood: '#5A4A3C',
  woodTop: '#7A6553',
  shadow: 'rgba(0,0,0,0.5)',
  motion: 'rgba(240,232,222,0.6)',
} as const;

/** The rim's width, in centimetres of the figure's space. */
export const OUTLINE_WIDTH = 0.45;
