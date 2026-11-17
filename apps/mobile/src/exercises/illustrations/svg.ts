import type { RenderedFrame, Shape, ViewBox } from './render';
import type { Gradient } from './shading';

// A rendered frame as standalone SVG markup -- for checking illustrations outside the app (tests and
// previews). The app draws the same shapes with react-native-svg (ExerciseIllustration).

const n = (v: number) => (Math.round(v * 10) / 10).toString();

function gradientMarkup(gradient: Gradient, id: string): string {
  const stops = gradient.stops
    .map(([offset, color]) => `<stop offset="${n(offset * 100)}%" stop-color="${color}"/>`)
    .join('');
  return gradient.kind === 'linear'
    ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(gradient.x1)}" y1="${n(gradient.y1)}" x2="${n(gradient.x2 ?? gradient.x1)}" y2="${n(gradient.y2 ?? gradient.y1)}">${stops}</linearGradient>`
    : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(gradient.x1)}" cy="${n(gradient.y1)}" r="${n(gradient.r ?? 1)}">${stops}</radialGradient>`;
}

function shapeMarkup(shape: Shape, prefix: string, gradientId: string | null): string {
  const attrs = [
    `d="${shape.d}"`,
    `fill="${gradientId ? `url(#${gradientId})` : shape.fill}"`,
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
  const gradients = frame.shapes
    .map((shape, i) => (shape.gradient ? gradientMarkup(shape.gradient, `${prefix}g${i}`) : ''))
    .join('');
  const vb = `${viewBox.x.toFixed(1)} ${viewBox.y.toFixed(1)} ${viewBox.width.toFixed(1)} ${viewBox.height.toFixed(1)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="${vb}"><defs>${clips}${gradients}</defs>${frame.shapes
    .map((s, i) => shapeMarkup(s, prefix, s.gradient ? `${prefix}g${i}` : null))
    .join('')}</svg>`;
}
