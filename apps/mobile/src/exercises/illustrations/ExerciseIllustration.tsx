import { memo, useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { ClipPath, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Text } from '../../design/Text';
import { colors, radii, spacing, typeScale } from '../../design/theme';
import { Image } from 'expo-image';
import { BUILTIN_CATALOG } from './builtinCatalog.generated';
import { EXERCISE_RENDERS } from './renders.generated';
import {
  guidePhases,
  illustrationFor,
  muscleMapFor,
  thumbnailFor,
  type PhaseDirection,
} from './exerciseArt';
import { ART } from './palette';
import type { RenderedFrame, ViewBox } from './render';
import type { Gradient } from './shading';

// The illustrated instructor on screen: How to Do It's three phases (ExercisePhases), the grey
// anatomy figure with the worked muscles in red (primary) and yellow (secondary) and a key naming
// them (MuscleFigures), and the small thumbnail a list row shows. Every frame is react-native-svg, drawn from the
// shapes render.ts works out, except an exercise's 3D renders (renders.generated.ts) where it has them.

function GradientDef({ gradient, id }: { gradient: Gradient; id: string }) {
  const stops = gradient.stops.map(([offset, color], i) => (
    <Stop key={i} offset={offset} stopColor={color} />
  ));
  return gradient.kind === 'linear' ? (
    <LinearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={gradient.x1}
      y1={gradient.y1}
      x2={gradient.x2 ?? gradient.x1}
      y2={gradient.y2 ?? gradient.y1}
    >
      {stops}
    </LinearGradient>
  ) : (
    <RadialGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      cx={gradient.x1}
      cy={gradient.y1}
      fx={gradient.x1}
      fy={gradient.y1}
      r={gradient.r ?? 1}
    >
      {stops}
    </RadialGradient>
  );
}

export function Frame({
  frame,
  viewBox,
  width,
  height,
  prefix,
}: {
  frame: RenderedFrame;
  viewBox: ViewBox;
  width: number;
  height: number;
  prefix: string;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
    >
      <Defs>
        {frame.clips.map((clip) => (
          <ClipPath key={clip.id} id={`${prefix}${clip.id}`}>
            {clip.paths.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </ClipPath>
        ))}
        {frame.shapes.map((shape, i) =>
          shape.gradient ? (
            <GradientDef key={`g${i}`} gradient={shape.gradient} id={`${prefix}g${i}`} />
          ) : null,
        )}
      </Defs>
      {frame.shapes.map((shape, i) => (
        <Path
          key={i}
          d={shape.d}
          fill={shape.gradient ? `url(#${prefix}g${i})` : shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeLinejoin={shape.stroke ? 'round' : undefined}
          strokeLinecap={shape.stroke ? 'round' : undefined}
          strokeDasharray={shape.dash}
          opacity={shape.opacity}
          clipPath={shape.clipId ? `url(#${prefix}${shape.clipId})` : undefined}
        />
      ))}
    </Svg>
  );
}

/** A unique, SVG-safe prefix for one drawing's clip paths and gradients. */
export function usePrefix(): string {
  return `ill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** The tallest a phase draws, so a standing figure never fills the screen. */
const MAX_PHASE_HEIGHT = 190;
/** The arrow between two phases side by side. */
const ARROW_WIDTH = 16;
/** Side by side, a phase drawn shorter than this is too small: the phases stack instead. */
const MIN_SIDE_BY_SIDE_HEIGHT = 96;

const DIRECTION_ICONS = {
  up: 'arrow-up',
  down: 'arrow-down',
  left: 'arrow-left',
  right: 'arrow-right',
} as const;

/**
 * How to Do It's demonstration: the exercise's three phases (guidePhases -- the setup, the
 * movement and the way back) drawn at one scale, each named in a numbered pill, with an arrow in
 * the accent showing which way the movement goes. Side by side with an arrow between them, or --
 * for a wide drawing (anything lying down or seated long) -- one under the other, each beside its
 * pill. A rendered exercise shows its 3D frames instead, still and always side by side: each is
 * square and framed for the whole movement, so it reads at a third of the card. Null for an
 * exercise without an illustration.
 */
export function ExercisePhases({
  slug,
  accent,
  testID,
}: {
  slug: string | null | undefined;
  accent: string;
  testID?: string;
}) {
  const prefix = usePrefix();
  const [width, setWidth] = useState(0);
  const scene = illustrationFor(slug);
  if (!scene || !slug) return null;
  const phases = guidePhases(slug);
  const entry = BUILTIN_CATALOG[slug];
  const rendered = EXERCISE_RENDERS[slug]?.frames;
  const aspect = rendered ? 1 : scene.viewBox.height / scene.viewBox.width;
  const sideWidth = width > 0 ? Math.floor((width - 2 * (ARROW_WIDTH + spacing.xs * 2)) / 3) : 0;
  const stacked = !rendered && width > 0 && sideWidth * aspect < MIN_SIDE_BY_SIDE_HEIGHT;
  const artWidth = stacked ? Math.floor(width * 0.62) : sideWidth;
  const artHeight = Math.min(MAX_PHASE_HEIGHT, Math.round(artWidth * aspect));
  const drawWidth = Math.round(artHeight / aspect);
  const art = (frame: number, i: number) => (
    <View style={[styles.phaseArt, { width: artWidth, height: artHeight }]}>
      {rendered ? (
        <Image
          testID={testID ? `${testID}-render-${i}` : undefined}
          source={rendered[Math.min(frame, rendered.length - 1)]}
          style={{ width: artWidth, height: artHeight }}
          contentFit="contain"
        />
      ) : (
        <Frame
          frame={scene.frames[frame]}
          viewBox={scene.viewBox}
          width={drawWidth}
          height={artHeight}
          prefix={`${prefix}p${i}`}
        />
      )}
    </View>
  );
  const pill = (label: string, i: number) => (
    <View style={styles.phasePill}>
      <View style={[styles.phaseNumber, { borderColor: accent }]}>
        <Text style={[styles.phaseNumberText, { color: accent }]}>{i + 1}</Text>
      </View>
      <Text
        testID={testID ? `${testID}-label-${i}` : undefined}
        style={styles.phaseLabel}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
  const arrow = (direction: PhaseDirection | undefined) => (
    <View style={styles.direction}>
      {direction ? <Feather name={DIRECTION_ICONS[direction]} size={18} color={accent} /> : null}
    </View>
  );
  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`How ${entry.name} is done: ${phases.map((p) => p.label).join(', then ')}`}
    >
      {width === 0 ? null : stacked ? (
        <View testID={testID ? `${testID}-stacked` : undefined} style={styles.stack}>
          {phases.map((phase, i) => (
            <View key={i} style={[styles.stackRow, i > 0 && styles.stackDivider]}>
              {art(phase.frame, i)}
              <View style={styles.stackSide}>
                {pill(phase.label, i)}
                {arrow(phase.direction)}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.side}>
          {phases.map((phase, i) => (
            <View key={i} style={styles.sideRow}>
              {i > 0 ? (
                <View style={[styles.between, { height: artHeight }]}>
                  <Feather name="arrow-right" size={18} color={colors.textSecondary} />
                </View>
              ) : null}
              <View style={[styles.sidePhase, { width: sideWidth }]}>
                {arrow(phase.direction)}
                {art(phase.frame, i)}
                {pill(phase.label, i)}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** How tall the anatomy figures stand beside their key. */
const FIGURE_HEIGHT = 118;

/**
 * The grey anatomy figure from the front and behind, its worked muscles in red (primary) and
 * yellow (secondary), with the key naming them beside it. Null for an exercise without one.
 */
export function MuscleFigures({
  slug,
  height = FIGURE_HEIGHT,
  testID,
}: {
  slug: string | null | undefined;
  height?: number;
  testID?: string;
}) {
  const prefix = usePrefix();
  const map = muscleMapFor(slug);
  if (!map) return null;
  return (
    <View testID={testID} style={styles.muscles}>
      <View
        style={styles.map}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Muscles worked: ${map.primaryNames.join(', ')}${map.secondaryNames.length ? `, and ${map.secondaryNames.join(', ')}` : ''}`}
      >
        {map.views.map((view, i) => (
          <Frame
            key={view.side}
            frame={view.frame}
            viewBox={view.viewBox}
            width={Math.round((height * view.viewBox.width) / view.viewBox.height)}
            height={height}
            prefix={`${prefix}m${i}`}
          />
        ))}
      </View>
      <View style={styles.key}>
        <KeyGroup
          label="Primary"
          color={ART.primary}
          names={map.primaryNames}
          testID={testID ? `${testID}-primary` : undefined}
        />
        {map.secondaryNames.length > 0 ? (
          <KeyGroup
            label="Secondary"
            color={ART.secondary}
            names={map.secondaryNames}
            testID={testID ? `${testID}-secondary` : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

/** One colour's muscles in the key: a dot and its label, then each muscle on a line of its own. */
function KeyGroup({
  label,
  color,
  names,
  testID,
}: {
  label: string;
  color: string;
  names: readonly string[];
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.keyGroup}>
      <View style={styles.keyRow}>
        <View style={[styles.keyDot, { backgroundColor: color }]} />
        <Text style={styles.keyLabel}>{label}</Text>
      </View>
      {names.map((name) => (
        <Text key={name} style={styles.keyName}>
          {name}
        </Text>
      ))}
    </View>
  );
}

/**
 * The end position alone, fitted into a circle `size` across -- a list row's picture: the render's
 * thumbnail where there is one, else drawn flat (thumbnailFor), and only drawn again when its
 * exercise or size changes, never because the list around it did.
 */
export const ExerciseThumbnail = memo(function ExerciseThumbnail({
  slug,
  size,
  testID,
}: {
  slug: string;
  size: number;
  testID?: string;
}) {
  const prefix = usePrefix();
  const rendered = EXERCISE_RENDERS[slug];
  const scene = rendered ? null : thumbnailFor(slug);
  if (rendered) {
    // A rendered exercise shows its movement's end position, cropped to the body.
    return (
      <View testID={testID} style={{ width: size, height: size }}>
        <Image source={rendered.thumb} style={{ width: size, height: size }} contentFit="cover" />
      </View>
    );
  }
  if (!scene) return null;
  // Square the view box around the drawing so it sits centred in the circle.
  const vb = scene.viewBox;
  const side = Math.max(vb.width, vb.height);
  const square: ViewBox = {
    x: vb.x - (side - vb.width) / 2,
    y: vb.y - (side - vb.height) / 2,
    width: side,
    height: side,
  };
  return (
    <View testID={testID} style={{ width: size, height: size }}>
      <Frame frame={scene.frames[0]} viewBox={square} width={size} height={size} prefix={prefix} />
    </View>
  );
});

const styles = StyleSheet.create({
  side: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  between: {
    width: ARROW_WIDTH,
    marginHorizontal: spacing.xs,
    // Level with the drawings, past the direction arrows over them.
    marginTop: 18 + spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidePhase: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  stack: {
    gap: spacing.md,
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stackDivider: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  stackSide: {
    flex: 1,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  phaseArt: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  direction: {
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingLeft: 3,
    paddingRight: spacing.md,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  phaseNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseNumberText: {
    ...typeScale.caption,
  },
  phaseLabel: {
    ...typeScale.label,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  muscles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  map: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  key: {
    gap: spacing.md,
  },
  keyGroup: {
    gap: 1,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  keyDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  keyLabel: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  keyName: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
    // In line with the label, past its dot.
    paddingLeft: 9 + spacing.xs,
  },
});
