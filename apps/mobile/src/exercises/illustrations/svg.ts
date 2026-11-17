import type { RenderedFrame, Shape, ViewBox } from './render';

// A rendered frame as standalone SVG markup -- for checking illustrations outside the app (tests and
// previews). The app draws the same shapes with react-native-svg (ExerciseIllustration).

function shapeMarkup(shape: Shape, prefix: string): string {
  const attrs = [
    `d="${shape.d}"`,
    `fill="${shape.fill}"`,
    shape.stroke
      ? `stroke="${shape.stroke}" stroke-width="${shape.strokeWidth ?? 1}" stroke-linejoin="round" stroke-linecap="round"`
      : '',
    shape.opacity !== undefined ? `opacity="${shape.opacity}"` : '',
    shape.clipId ? `clip-path="url(#${prefix}${shape.clipId})"` : '',
    shape.dash ? `stroke-dasharray="${shape.dash}"` : '',
  ];
  return `<path ${attrs.filter(Boolean).join(' ')}/>`;
}

export function frameSvg(
  frame: RenderedFrame,
  viewBox: ViewBox,
  size: { width: number; height: number },
  prefix = 'f',
): string {
  const clips = frame.clips
    .map(
      (clip) =>
        `<clipPath id="${prefix}${clip.id}">${clip.paths.map((d) => `<path d="${d}"/>`).join('')}</clipPath>`,
    )
    .join('');
  const vb = `${viewBox.x.toFixed(1)} ${viewBox.y.toFixed(1)} ${viewBox.width.toFixed(1)} ${viewBox.height.toFixed(1)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="${vb}"><defs>${clips}</defs>${frame.shapes
    .map((s) => shapeMarkup(s, prefix))
    .join('')}</svg>`;
}
