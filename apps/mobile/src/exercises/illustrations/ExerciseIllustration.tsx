import { useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, Path } from 'react-native-svg';
import { Text } from '../../design/Text';
import { colors, radii, spacing, typeScale } from '../../design/theme';
import { BUILTIN_CATALOG } from './builtinCatalog.generated';
import { frameLabels, illustrationFor, thumbnailFor } from './exerciseArt';
import { ART } from './palette';
import type { RenderedFrame, ViewBox } from './render';

// The illustrated instructor on screen: one frame (react-native-svg), the full start-to-finish
// illustration with its labels and muscle key, and the small thumbnail a list row shows.

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
      </Defs>
      {frame.shapes.map((shape, i) => (
        <Path
          key={i}
          d={shape.d}
          fill={shape.fill}
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

/** A unique, SVG-safe prefix for one drawing's clip paths. */
function usePrefix(): string {
  return `ill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** The tallest the full illustration draws, so a standing figure never fills the screen. */
const MAX_FRAME_HEIGHT = 230;

/**
 * The full illustration: every position side by side at one scale, each named under it (Start,
 * Finish), the movement arrowed between them, and a key to the highlighted muscles. Null for an
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
  if (!scene || !slug) return null;
  const entry = BUILTIN_CATALOG[slug];
  const count = scene.frames.length;
  const gap = spacing.sm;
  const aspect = scene.viewBox.height / scene.viewBox.width;
  const frameWidth = width > 0 ? Math.floor((width - gap * (count - 1)) / count) : 0;
  const frameHeight = Math.min(MAX_FRAME_HEIGHT, Math.round(frameWidth * aspect));
  const drawWidth = Math.round(frameHeight / aspect);
  const labels = frameLabels(count);
  const hasSecondary = entry.highlight.secondary.length > 0;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`How ${entry.name} is done: ${labels.join(', then ').toLowerCase()} position${count > 1 ? 's' : ''}`}
    >
      <View
        testID={testID ? `${testID}-frames` : undefined}
        style={[styles.frames, { gap }]}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        {frameWidth > 0
          ? scene.frames.map((frame, i) => (
              <View key={i} style={[styles.frame, { width: frameWidth }]}>
                <View style={[styles.frameArt, { height: frameHeight }]}>
                  <Frame
                    frame={frame}
                    viewBox={scene.viewBox}
                    width={drawWidth}
                    height={frameHeight}
                    prefix={`${prefix}f${i}`}
                  />
                </View>
                <Text
                  testID={testID ? `${testID}-label-${i}` : undefined}
                  style={styles.frameLabel}
                >
                  {labels[i]}
                </Text>
              </View>
            ))
          : null}
      </View>
      <View
        style={styles.key}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <View style={styles.keyItem}>
          <View style={[styles.keyDot, { backgroundColor: ART.primary }]} />
          <Text style={styles.keyText}>Primary</Text>
        </View>
        {hasSecondary ? (
          <View style={styles.keyItem}>
            <View style={[styles.keyDot, { backgroundColor: ART.secondary }]} />
            <Text style={styles.keyText}>Secondary</Text>
          </View>
        ) : null}
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
  frames: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  frame: {
    alignItems: 'center',
  },
  frameArt: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  frameLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  key: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  keyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  keyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  keyText: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
});
