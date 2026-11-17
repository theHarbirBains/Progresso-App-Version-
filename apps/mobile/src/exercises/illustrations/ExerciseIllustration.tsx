import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { ClipPath, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Text } from '../../design/Text';
import { colors, radii, spacing, typeScale } from '../../design/theme';
import { MUSCLE_GROUP_LABELS } from '../muscleGroups';
import { BUILTIN_CATALOG } from './builtinCatalog.generated';
import { frameLabels, illustrationFor, muscleMapFor, thumbnailFor } from './exerciseArt';
import { ART } from './palette';
import type { RenderedFrame, ViewBox } from './render';
import type { Gradient } from './shading';

// The illustrated instructor on screen: the positions side by side with an arrow between them,
// each named in a pill underneath; beside them, the grey anatomy figure with the worked muscles in
// red (primary) and yellow (secondary) and a key naming them; and the small thumbnail a list row
// shows. Every frame is react-native-svg, drawn from the shapes render.ts works out.

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

function Frame({
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
function usePrefix(): string {
  return `ill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** The tallest the positions draw, so a standing figure never fills the screen. */
const MAX_FRAME_HEIGHT = 220;
/** The arrow between two positions. */
const ARROW_WIDTH = 22;
/** How tall the anatomy figure stands beside its key. */
const MAP_HEIGHT = 128;

/**
 * The full illustration: the positions side by side at one scale with an arrow between them, each
 * named in a pill under it (Start, Finish), then the anatomy figure and its key. Null for an
 * exercise without one.
 */
export function ExerciseIllustration({
  slug,
  testID,
}: {
  slug: string | null | undefined;
  testID?: string;
}) {
  const prefix = usePrefix();
  const [width, setWidth] = useState(0);
  const scene = illustrationFor(slug);
  const map = muscleMapFor(slug);
  if (!scene || !map || !slug) return null;
  const entry = BUILTIN_CATALOG[slug];
  const count = scene.frames.length;
  const arrows = count - 1;
  const aspect = scene.viewBox.height / scene.viewBox.width;
  const frameWidth =
    width > 0 ? Math.floor((width - arrows * (ARROW_WIDTH + spacing.xs * 2)) / count) : 0;
  const frameHeight = Math.min(MAX_FRAME_HEIGHT, Math.round(frameWidth * aspect));
  const drawWidth = Math.round(frameHeight / aspect);
  const labels = frameLabels(count);
  const names = (groups: readonly string[]) =>
    groups.map((g) => MUSCLE_GROUP_LABELS[g as keyof typeof MUSCLE_GROUP_LABELS]).join(', ');
  return (
    <View testID={testID} style={styles.wrap}>
      <View
        testID={testID ? `${testID}-frames` : undefined}
        style={styles.frames}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`How ${entry.name} is done: ${labels.join(', then ').toLowerCase()} position${count > 1 ? 's' : ''}`}
      >
        {frameWidth > 0
          ? scene.frames.map((frame, i) => (
              <View key={i} style={styles.frameRow}>
                {i > 0 ? (
                  <View style={[styles.arrow, { height: frameHeight }]}>
                    <Feather name="arrow-right" size={18} color={colors.textMuted} />
                  </View>
                ) : null}
                <View style={[styles.frame, { width: frameWidth }]}>
                  <View style={[styles.frameArt, { height: frameHeight }]}>
                    <Frame
                      frame={frame}
                      viewBox={scene.viewBox}
                      width={drawWidth}
                      height={frameHeight}
                      prefix={`${prefix}f${i}`}
                    />
                  </View>
                  <View style={styles.pill}>
                    <Text
                      testID={testID ? `${testID}-label-${i}` : undefined}
                      style={styles.pillText}
                    >
                      {labels[i]}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          : null}
      </View>

      <View style={styles.muscles}>
        <View
          style={styles.map}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Muscles worked: ${names(map.primary)}${map.secondary.length ? `, and ${names(map.secondary)}` : ''}`}
        >
          {map.views.map((view, i) => (
            <Frame
              key={view.side}
              frame={view.frame}
              viewBox={view.viewBox}
              width={Math.round((MAP_HEIGHT * view.viewBox.width) / view.viewBox.height)}
              height={MAP_HEIGHT}
              prefix={`${prefix}m${i}`}
            />
          ))}
        </View>
        <View style={styles.key}>
          <View testID={testID ? `${testID}-primary` : undefined} style={styles.keyRow}>
            <View style={[styles.keyDot, { backgroundColor: ART.primary }]} />
            <Text style={styles.keyText}>
              <Text style={styles.keyLabel}>Primary: </Text>
              {names(map.primary)}
            </Text>
          </View>
          {map.secondary.length > 0 ? (
            <View testID={testID ? `${testID}-secondary` : undefined} style={styles.keyRow}>
              <View style={[styles.keyDot, { backgroundColor: ART.secondary }]} />
              <Text style={styles.keyText}>
                <Text style={styles.keyLabel}>Secondary: </Text>
                {names(map.secondary)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** The end position alone, fitted into a circle `size` across -- a list row's picture. */
export function ExerciseThumbnail({
  slug,
  size,
  testID,
}: {
  slug: string;
  size: number;
  testID?: string;
}) {
  const prefix = usePrefix();
  const scene = thumbnailFor(slug);
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
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  frames: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  frameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  arrow: {
    width: ARROW_WIDTH,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  frameArt: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  pill: {
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  pillText: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  muscles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  map: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  key: {
    flex: 1,
    gap: spacing.sm,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  keyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  keyText: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  keyLabel: {
    ...typeScale.secondary,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
