import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, radii } from '../../design/theme';
import { withAlpha } from '../../theme/accentColor';
import type { TechniqueVisual as Visual } from './builtinGuides.generated';
import { illustrationFor } from './exerciseArt';
import { Frame, usePrefix } from './ExerciseIllustration';
import { MATERIALS } from './palette';
import type { SceneAnchors, ViewBox } from './render';

// Technique & Setup's pictures (How to Do It's second page), each in a square `size` across: a close
// look at the exercise's own drawing -- with a line, an angle or a plumb line in the accent where
// that's the point -- or a simple diagram: the hands on the grip, the feet on a plate or from above,
// the bench's angle. Kept plain, so one thing reads at a glance.

const SKIN = MATERIALS.skin.light;
const SKIN_SHADE = MATERIALS.skin.shadow;
const SHOE = '#ECEDEF';
const SHOE_EDGE = '#9EA1A7';
const PLATE = '#2B2D32';
const PLATE_EDGE = '#45474D';

/** How far around each part a close look takes in, cm. */
const CROP: Record<Extract<Visual, { kind: 'closeup' }>['focus'], number> = {
  hands: 48,
  feet: 56,
  knee: 70,
  hips: 80,
  torso: 104,
  head: 62,
};

const FOCUS_ANCHOR: Record<Extract<Visual, { kind: 'closeup' }>['focus'], keyof SceneAnchors> = {
  hands: 'hands',
  feet: 'feet',
  knee: 'knee',
  hips: 'hips',
  torso: 'torso',
  head: 'head',
};

export function TechniqueVisual({
  slug,
  visual,
  accent,
  size,
  testID,
}: {
  slug: string;
  visual: Visual;
  accent: string;
  size: number;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderColor: withAlpha(accent, visual.kind === 'closeup' ? 0.75 : 0.3),
        },
      ]}
    >
      {visual.kind === 'closeup' ? (
        <Closeup slug={slug} visual={visual} accent={accent} size={size} />
      ) : visual.kind === 'grip' ? (
        <GripDiagram visual={visual} accent={accent} size={size} />
      ) : visual.kind === 'platform' ? (
        <PlatformDiagram visual={visual} accent={accent} size={size} />
      ) : visual.kind === 'stance' ? (
        <StanceDiagram visual={visual} accent={accent} size={size} />
      ) : (
        <BenchDiagram angle={visual.angle} accent={accent} size={size} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------- Close looks

function Closeup({
  slug,
  visual,
  accent,
  size,
}: {
  slug: string;
  visual: Extract<Visual, { kind: 'closeup' }>;
  accent: string;
  size: number;
}) {
  const prefix = usePrefix();
  const scene = illustrationFor(slug);
  if (!scene) return null;
  const frame = Math.min(visual.frame, scene.frames.length - 1);
  const anchors = scene.anchors[frame];
  const c = anchors[FOCUS_ANCHOR[visual.focus]];
  const span = CROP[visual.focus];
  const box: ViewBox = { x: c[0] - span / 2, y: c[1] - span / 2, width: span, height: span };
  const stroke = span / 90;
  const vb = `${box.x} ${box.y} ${box.width} ${box.height}`;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Frame frame={scene.frames[frame]} viewBox={box} width={size} height={size} prefix={prefix} />
      {visual.mark ? (
        <Svg style={StyleSheet.absoluteFill} width={size} height={size} viewBox={vb}>
          {visual.mark === 'line' ? (
            <BackLine from={anchors.shoulders} to={anchors.hips} accent={accent} stroke={stroke} />
          ) : visual.mark === 'angle' ? (
            <KneeAngle anchors={anchors} accent={accent} stroke={stroke} />
          ) : (
            <Line
              x1={c[0]}
              y1={box.y}
              x2={c[0]}
              y2={box.y + box.height}
              stroke={accent}
              strokeWidth={stroke * 1.4}
              strokeDasharray={`${stroke * 4} ${stroke * 3}`}
            />
          )}
        </Svg>
      ) : null}
    </View>
  );
}

/** A straight line along the back, past the shoulders and the hips: "keep it flat". */
function BackLine({
  from,
  to,
  accent,
  stroke,
}: {
  from: readonly [number, number];
  to: readonly [number, number];
  accent: string;
  stroke: number;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const a: [number, number] = [from[0] - dx * 0.25, from[1] - dy * 0.25];
  const b: [number, number] = [to[0] + dx * 0.25, to[1] + dy * 0.25];
  return (
    <G>
      <Line
        x1={a[0]}
        y1={a[1]}
        x2={b[0]}
        y2={b[1]}
        stroke={accent}
        strokeWidth={stroke * 1.6}
        strokeLinecap="round"
      />
      <Circle cx={from[0]} cy={from[1]} r={stroke * 2} fill={accent} />
      <Circle cx={to[0]} cy={to[1]} r={stroke * 2} fill={accent} />
    </G>
  );
}

/** The knee's angle: the thigh and shin as two lines in the accent, with an arc between them. */
function KneeAngle({
  anchors,
  accent,
  stroke,
}: {
  anchors: SceneAnchors;
  accent: string;
  stroke: number;
}) {
  const { hip, knee, ankle } = anchors;
  const unit = (p: readonly [number, number]) => {
    const dx = p[0] - knee[0];
    const dy = p[1] - knee[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l] as const;
  };
  const u = unit(hip);
  const v = unit(ankle);
  const r = stroke * 9;
  const p1 = [knee[0] + u[0] * r, knee[1] + u[1] * r];
  const p2 = [knee[0] + v[0] * r, knee[1] + v[1] * r];
  const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
  return (
    <G>
      <Path
        d={`M${hip[0]} ${hip[1]} L${knee[0]} ${knee[1]} L${ankle[0]} ${ankle[1]}`}
        stroke={accent}
        strokeWidth={stroke * 1.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={`M${p1[0]} ${p1[1]} A${r} ${r} 0 0 ${sweep} ${p2[0]} ${p2[1]}`}
        stroke={accent}
        strokeWidth={stroke * 1.4}
        fill="none"
      />
      <Circle cx={knee[0]} cy={knee[1]} r={stroke * 2} fill={accent} />
    </G>
  );
}

// ------------------------------------------------------------------------------------- The hands

// One open right hand, fingers up, in a 60 x 84 box: its palm toward the viewer, or its back
// (`back`: the nails and knuckles show, the thumb on the other side).
function Hand({
  back,
  x,
  y,
  mirror,
  scale,
}: {
  back: boolean;
  x: number;
  y: number;
  mirror: boolean;
  scale: number;
}) {
  // Drawn as a right hand seen from its palm side (thumb on the right); mirrored, a left hand.
  const flip = back !== mirror;
  const t = `translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale}) translate(${flip ? -60 : 0} 0)`;
  const fingers = [
    { x: 8, top: 14, w: 9 },
    { x: 18, top: 6, w: 9.5 },
    { x: 28.5, top: 9, w: 9 },
    { x: 38.5, top: 18, w: 8 },
  ];
  return (
    <G transform={t}>
      <Path
        d="M44 54 C52 50 58 42 60 34 C61 30 57 28 54 31 C50 36 47 40 42 44 Z"
        fill={SKIN}
        stroke={SKIN_SHADE}
        strokeWidth={1.2}
      />
      {fingers.map((f, i) => (
        <Rect
          key={i}
          x={f.x}
          y={f.top}
          width={f.w}
          height={52 - f.top}
          rx={f.w / 2}
          fill={SKIN}
          stroke={SKIN_SHADE}
          strokeWidth={1.2}
        />
      ))}
      <Path
        d="M7 40 C7 34 47 34 47 40 L47 70 C47 80 40 84 27 84 C14 84 7 80 7 70 Z"
        fill={SKIN}
        stroke={SKIN_SHADE}
        strokeWidth={1.2}
      />
      {back
        ? fingers.map((f, i) => (
            <Rect
              key={`n${i}`}
              x={f.x + 2}
              y={f.top + 2}
              width={f.w - 4}
              height={6}
              rx={2.4}
              fill="#F6D3B8"
              stroke={SKIN_SHADE}
              strokeWidth={0.6}
            />
          ))
        : null}
      {back ? (
        <Path
          d="M11 44 C17 41 23 41 29 43 M30 43 C36 41 41 41 45 44"
          stroke={SKIN_SHADE}
          strokeWidth={1}
          fill="none"
          opacity={0.6}
        />
      ) : (
        <Path
          d="M12 52 C22 56 34 55 44 50 M14 62 C22 60 30 62 36 70"
          stroke={SKIN_SHADE}
          strokeWidth={1.1}
          fill="none"
          opacity={0.7}
        />
      )}
    </G>
  );
}

// The same hand edge-on, palm facing to the right, thumb on top: a neutral grip's hand.
function SideHand({
  x,
  y,
  mirror,
  scale,
}: {
  x: number;
  y: number;
  mirror: boolean;
  scale: number;
}) {
  const t = `translate(${x} ${y}) scale(${mirror ? -scale : scale} ${scale}) translate(${mirror ? -40 : 0} 0)`;
  return (
    <G transform={t}>
      <Path
        d="M8 84 C6 66 6 40 10 22 C12 12 16 6 21 6 C26 6 28 12 28 22 L28 52 C30 46 34 40 38 38 C41 37 42 41 40 45 C36 52 33 60 32 70 C31 78 30 84 28 84 Z"
        fill={SKIN}
        stroke={SKIN_SHADE}
        strokeWidth={1.2}
      />
      <Path d="M12 26 L26 26 M11 38 L27 38" stroke={SKIN_SHADE} strokeWidth={0.9} opacity={0.5} />
    </G>
  );
}

function GripDiagram({
  visual,
  accent,
  size,
}: {
  visual: Extract<Visual, { kind: 'grip' }>;
  accent: string;
  size: number;
}) {
  const gap = visual.width === 'wide' ? 34 : visual.width === 'close' ? 6 : 18;
  const handScale = 0.62;
  const handW = 60 * handScale;
  const total = handW * 2 + gap;
  const left = (120 - total) / 2;
  const top = 28;
  const neutral = visual.grip === 'neutral';
  const tilt = visual.grip === 'angled' ? 14 : 0;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* The bar the hands hold (or, for a neutral grip, the two handles). */}
      {neutral ? (
        <>
          <Rect x={left + 12} y={top - 6} width={3} height={70} rx={1.5} fill="#B9BDC4" />
          <Rect x={120 - left - 15} y={top - 6} width={3} height={70} rx={1.5} fill="#B9BDC4" />
        </>
      ) : visual.grip === 'angled' ? (
        <Path
          d={`M6 ${top + 36} L${left + handW / 2} ${top + 36} L${60 - 6} ${top + 30} L${60 + 6} ${top + 30} L${120 - left - handW / 2} ${top + 36} L114 ${top + 36}`}
          stroke="#B9BDC4"
          strokeWidth={3}
          fill="none"
          strokeLinejoin="round"
        />
      ) : (
        <Rect x={4} y={top + 34} width={112} height={3.4} rx={1.7} fill="#B9BDC4" />
      )}
      {neutral ? (
        <>
          <SideHand x={left - 2} y={top - 4} mirror={false} scale={handScale} />
          <SideHand x={120 - left - 40 * handScale + 2} y={top - 4} mirror scale={handScale} />
        </>
      ) : (
        <>
          <G transform={`rotate(${tilt} ${left + handW / 2} ${top + 50})`}>
            {/* The left hand: mirrored. Overhand shows its back, underhand its palm. */}
            <Hand
              back={visual.grip !== 'underhand'}
              x={left}
              y={top - 4}
              mirror
              scale={handScale}
            />
          </G>
          <G transform={`rotate(${-tilt} ${120 - left - handW / 2} ${top + 50})`}>
            <Hand
              back={visual.grip !== 'underhand'}
              x={120 - left - handW}
              y={top - 4}
              mirror={false}
              scale={handScale}
            />
          </G>
        </>
      )}
      {/* Shoulder width, for the spacing. */}
      <Line x1={30} y1={110} x2={30} y2={102} stroke={withAlpha(accent, 0.8)} strokeWidth={1.4} />
      <Line x1={90} y1={110} x2={90} y2={102} stroke={withAlpha(accent, 0.8)} strokeWidth={1.4} />
      <Line
        x1={30}
        y1={106}
        x2={90}
        y2={106}
        stroke={withAlpha(accent, 0.8)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------------- Feet and bench

/** A shoe's sole from above, toe up, in a 20 x 48 box. */
function Sole({
  x,
  y,
  angle = 0,
  scale = 1,
}: {
  x: number;
  y: number;
  angle?: number;
  scale?: number;
}) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale}) translate(-10 -24)`}>
      <Path
        d="M10 0 C16 0 20 6 20 14 C20 22 17 26 16 30 C15 36 16 42 13 46 C11 48 9 48 7 46 C4 42 5 36 4 30 C3 26 0 22 0 14 C0 6 4 0 10 0 Z"
        fill={SHOE}
        stroke={SHOE_EDGE}
        strokeWidth={1}
      />
      <Path d="M6 10 L14 10 M5.5 15 L14.5 15" stroke={SHOE_EDGE} strokeWidth={0.8} />
    </G>
  );
}

function PlatformDiagram({
  visual,
  accent,
  size,
}: {
  visual: Extract<Visual, { kind: 'platform' }>;
  accent: string;
  size: number;
}) {
  const y = { high: 36, middle: 60, low: 82, edge: 92 }[visual.placement];
  const half = visual.width === 'shoulder' ? 22 : 16;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect
        x={14}
        y={10}
        width={92}
        height={100}
        rx={6}
        fill={PLATE}
        stroke={PLATE_EDGE}
        strokeWidth={1.4}
      />
      {[24, 38, 52, 66, 80, 94].map((ry) => (
        <Line
          key={ry}
          x1={20}
          y1={ry}
          x2={100}
          y2={ry}
          stroke={PLATE_EDGE}
          strokeWidth={0.8}
          opacity={0.6}
        />
      ))}
      <Line
        x1={60}
        y1={14}
        x2={60}
        y2={106}
        stroke={withAlpha(accent, 0.55)}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <Sole x={60 - half} y={y} angle={-6} scale={0.82} />
      <Sole x={60 + half} y={y} angle={6} scale={0.82} />
      {visual.placement === 'edge' ? (
        <Line x1={14} y1={110} x2={106} y2={110} stroke={accent} strokeWidth={2.4} />
      ) : null}
    </Svg>
  );
}

function StanceDiagram({
  visual,
  accent,
  size,
}: {
  visual: Extract<Visual, { kind: 'stance' }>;
  accent: string;
  size: number;
}) {
  const s = visual.stance;
  const feet =
    s === 'split'
      ? [
          { x: 50, y: 36, a: 0 },
          { x: 70, y: 86, a: 0 },
        ]
      : s === 'wide'
        ? [
            { x: 22, y: 62, a: -35 },
            { x: 98, y: 62, a: 35 },
          ]
        : s === 'shoulder'
          ? [
              { x: 36, y: 62, a: -15 },
              { x: 84, y: 62, a: 15 },
            ]
          : [
              { x: 46, y: 62, a: -4 },
              { x: 74, y: 62, a: 4 },
            ];
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Shoulder width, as a guide. */}
      <Line
        x1={36}
        y1={14}
        x2={36}
        y2={106}
        stroke={withAlpha(accent, 0.35)}
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      <Line
        x1={84}
        y1={14}
        x2={84}
        y2={106}
        stroke={withAlpha(accent, 0.35)}
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      {feet.map((f, i) => (
        <Sole key={i} x={f.x} y={f.y} angle={f.a} scale={1.05} />
      ))}
    </Svg>
  );
}

function BenchDiagram({ angle, accent, size }: { angle: number; accent: string; size: number }) {
  // The seat level at the hinge; the back pad raised `angle` degrees (dropped, for a decline).
  const hinge = { x: 62, y: 76 };
  const len = 52;
  const rad = (angle * Math.PI) / 180;
  const end = { x: hinge.x - Math.cos(rad) * len, y: hinge.y - Math.sin(rad) * len };
  const r = 22;
  const label =
    angle === 0
      ? 'Flat'
      : angle === 35
        ? '30–45°'
        : angle === -20
          ? '15–30°'
          : `${Math.abs(angle)}°`;
  const arcEnd = { x: hinge.x - Math.cos(rad) * r, y: hinge.y - Math.sin(rad) * r };
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Legs and seat. */}
      <Line
        x1={hinge.x + 4}
        y1={hinge.y + 4}
        x2={hinge.x + 4}
        y2={104}
        stroke={PLATE_EDGE}
        strokeWidth={3}
      />
      <Line
        x1={hinge.x - 30}
        y1={hinge.y + 4}
        x2={hinge.x - 30}
        y2={104}
        stroke={PLATE_EDGE}
        strokeWidth={3}
      />
      <Line
        x1={hinge.x - 40}
        y1={104}
        x2={hinge.x + 34}
        y2={104}
        stroke={PLATE_EDGE}
        strokeWidth={3}
      />
      <Rect
        x={hinge.x}
        y={hinge.y - 3}
        width={36}
        height={8}
        rx={3}
        fill={PLATE}
        stroke={PLATE_EDGE}
        strokeWidth={1}
      />
      <Line
        x1={hinge.x}
        y1={hinge.y}
        x2={end.x}
        y2={end.y}
        stroke={PLATE}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <Line x1={hinge.x} y1={hinge.y} x2={end.x} y2={end.y} stroke={PLATE_EDGE} strokeWidth={1} />
      {angle !== 0 ? (
        <>
          <Line
            x1={hinge.x}
            y1={hinge.y}
            x2={hinge.x - r - 6}
            y2={hinge.y}
            stroke={withAlpha(accent, 0.6)}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Path
            d={`M${hinge.x - r} ${hinge.y} A${r} ${r} 0 0 ${angle > 0 ? 1 : 0} ${arcEnd.x} ${arcEnd.y}`}
            stroke={accent}
            strokeWidth={2}
            fill="none"
          />
        </>
      ) : null}
      <G>
        <Rect
          x={8}
          y={8}
          width={label.length * 6.4 + 10}
          height={18}
          rx={9}
          fill={withAlpha(accent, 0.16)}
          stroke={withAlpha(accent, 0.6)}
          strokeWidth={0.8}
        />
        <SvgLabel x={13} y={21} text={label} color={accent} />
      </G>
    </Svg>
  );
}

// SVG text, kept to one helper.
function SvgLabel({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <SvgText x={x} y={y} fill={color} fontSize={11} fontWeight="700">
      {text}
    </SvgText>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
});
