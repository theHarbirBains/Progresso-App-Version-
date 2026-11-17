// The illustration palette (DESIGN.md, "Exercise illustrations"): one instructor, drawn the same in
// every exercise, on the card's own surface. Primary muscles are the warm red-orange, secondary the
// amber -- fixed, so a highlight means the same thing whatever the app's theme.

export const ART = {
  outline: '#1A120D',
  skin: '#E2A47C',
  skinFar: '#B98161',
  skinShade: '#C88A66',
  hair: '#3A271C',
  hairFar: '#2C1E16',
  shorts: '#3C4658',
  shortsFar: '#2C3442',
  shoe: '#EEE9E2',
  shoeFar: '#BDB7AF',
  primary: '#FF5A36',
  secondary: '#FFB23E',
  metal: '#C6CACF',
  metalDark: '#8E949B',
  plate: '#40454D',
  plateFace: '#545A63',
  plateHub: '#9AA0A7',
  pad: '#3A3D44',
  padTop: '#4A4E56',
  padSide: '#2E3137',
  frame: '#7F858C',
  frameDark: '#5F656C',
  wood: '#8A6447',
  woodTop: '#A27A5A',
  shadow: 'rgba(0,0,0,0.32)',
  motion: 'rgba(240,232,222,0.6)',
} as const;

/** Outline width, in centimetres of the figure's space. */
export const OUTLINE_WIDTH = 1.25;
