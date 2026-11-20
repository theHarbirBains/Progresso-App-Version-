import { useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type NativeTouchEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, TextButton } from '../design/Button';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type { MontageFrame } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import {
  automaticFrame,
  framedRect,
  leanFor,
  movedFrame,
  photoSize,
  PICTURE_BOX_ASPECT,
  type Size,
} from '../profile/montage/montageFrame';
import { photoSource } from '../profile/montage/montageMedia';
import { saveMontageFrame } from '../profile/montage/montageQueries';
import { MontagePanel } from '../profile/montage/ProfileMontage';
import { Screen } from '../design/Screen';
import { useAppTheme } from '../theme/appThemeContext';

type Props = RootStackScreenProps<'ProfileMontageFrame'>;

/** How much of the page's width the panel's picture box takes. */
const BOX_SHARE = 0.72;
/** How tall the stage is for the box: room to see the rest of the photo around it. */
const STAGE_FOR_BOX = 1.7;
/** How far one accessibility action moves a photo (pt) or zooms it. */
const MOVE_STEP = 24;
const ZOOM_STEP = 1.25;

type Touches = readonly NativeTouchEvent[];

function midpoint(touches: Touches): { x: number; y: number } {
  const x = touches.reduce((sum, touch) => sum + touch.pageX, 0) / touches.length;
  const y = touches.reduce((sum, touch) => sum + touch.pageY, 0) / touches.length;
  return { x, y };
}

function spread(touches: Touches): number {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(a!.pageX - b!.pageX, a!.pageY - b!.pageY);
}

/**
 * Adjust Photo (from Montage, a photo's row): one of your montage's photos in its panel, drawn
 * large, the rest of the photo faint around it. Drag to move it, pinch to zoom; what's inside the
 * frame is what your profile shows. Save keeps it (montageFrame.ts); Use Automatic goes back to
 * the photo centred. VoiceOver: swipe up or down to zoom, and actions to move it.
 */
export function ProfileMontageFrameScreen({ navigation, route }: Props) {
  const { item } = route.params;
  const { accent } = useAppTheme();
  const photo = photoSize(item);
  const [stageWidth, setStageWidth] = useState(0);
  const [frame, setFrame] = useState<MontageFrame | null>(item.frame ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const box: Size = {
    width: stageWidth * BOX_SHARE,
    height: (stageWidth * BOX_SHARE) / PICTURE_BOX_ASPECT,
  };
  const stageHeight = box.height * STAGE_FOR_BOX;
  const boxLeft = (stageWidth - box.width) / 2;
  const boxTop = (stageHeight - box.height) / 2;
  const lean = leanFor(box.height);
  const rect = photo && stageWidth > 0 ? framedRect(box, photo, frame) : null;

  // The gesture under way: where it started, and its fingers then.
  const latest = useRef({ box, photo, frame });
  latest.current = { box, photo, frame };
  const gesture = useRef<{
    start: MontageFrame;
    fingers: number;
    from: { x: number; y: number };
    spread: number;
  } | null>(null);

  function begin(touches: Touches) {
    const { box: now, photo: size, frame: current } = latest.current;
    if (!size || touches.length === 0) return;
    gesture.current = {
      start: current ?? automaticFrame(now, size),
      fingers: touches.length,
      from: midpoint(touches),
      spread: spread(touches),
    };
  }

  function move(touches: Touches) {
    const { box: now, photo: size } = latest.current;
    const started = gesture.current;
    if (!size || !started || touches.length === 0) return;
    // A finger more or less starts again from where the photo is.
    if (touches.length !== started.fingers) {
      begin(touches);
      return;
    }
    const at = midpoint(touches);
    const scale = started.spread > 0 ? spread(touches) / started.spread : 1;
    setFrame(
      movedFrame(now, size, started.start, at.x - started.from.x, at.y - started.from.y, scale),
    );
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => begin(event.nativeEvent.touches),
      onPanResponderMove: (event) => move(event.nativeEvent.touches),
      onPanResponderRelease: () => {
        gesture.current = null;
      },
      onPanResponderTerminate: () => {
        gesture.current = null;
      },
    }),
  ).current;

  function step(dx: number, dy: number, scale = 1) {
    if (!photo) return;
    setFrame((current) =>
      movedFrame(box, photo, current ?? automaticFrame(box, photo), dx, dy, scale),
    );
  }

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    switch (event.nativeEvent.actionName) {
      case 'increment':
        return step(0, 0, ZOOM_STEP);
      case 'decrement':
        return step(0, 0, 1 / ZOOM_STEP);
      case 'moveLeft':
        return step(-MOVE_STEP, 0);
      case 'moveRight':
        return step(MOVE_STEP, 0);
      case 'moveUp':
        return step(0, -MOVE_STEP);
      case 'moveDown':
        return step(0, MOVE_STEP);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveMontageFrame(item.id, frame);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save. Please try again.');
      setSaving(false);
    }
  }

  const panel = {
    left: boxLeft + lean / 2,
    top: boxTop,
    width: box.width - lean,
    height: box.height,
  };

  return (
    <Screen
      testID="profile-montage-frame-screen"
      scroll={false}
      contentContainerStyle={styles.content}
      header={
        <AppHeader
          testID="profile-montage-frame-header"
          title="Adjust Photo"
          onBack={() => navigation.goBack()}
        />
      }
    >
      {photo ? (
        <>
          <Text style={styles.hint}>
            Drag to move it, pinch to zoom. What&apos;s inside the frame is what your profile shows.
          </Text>
          <View
            testID="profile-montage-frame-stage"
            style={[styles.stage, { height: stageHeight || undefined }]}
            onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Your photo in its frame"
            accessibilityValue={{ text: `Zoom ${(frame?.zoom ?? 1).toFixed(1)} times` }}
            accessibilityActions={[
              { name: 'increment', label: 'Zoom in' },
              { name: 'decrement', label: 'Zoom out' },
              { name: 'moveLeft', label: 'Move left' },
              { name: 'moveRight', label: 'Move right' },
              { name: 'moveUp', label: 'Move up' },
              { name: 'moveDown', label: 'Move down' },
            ]}
            onAccessibilityAction={onAccessibilityAction}
            {...responder.panHandlers}
          >
            {rect ? (
              <>
                {/* The whole photo, faint, so you can see what's outside the frame. */}
                <Image
                  source={photoSource(item)}
                  style={[
                    styles.around,
                    {
                      left: boxLeft + rect.left,
                      top: boxTop + rect.top,
                      width: rect.width,
                      height: rect.height,
                    },
                  ]}
                  contentFit="cover"
                />
                <MontagePanel {...panel} seam="transparent" style={styles.shownPanel}>
                  <Image
                    testID="profile-montage-frame-photo"
                    source={photoSource(item)}
                    style={{ position: 'absolute', ...rect }}
                    contentFit="cover"
                  />
                </MontagePanel>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <MontagePanel
                    {...panel}
                    seam={accent.accent}
                    style={[styles.outline, { borderColor: accent.accent }]}
                  />
                </View>
              </>
            ) : null}
          </View>

          {error ? (
            <Text testID="profile-montage-frame-error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <PrimaryButton
            testID="profile-montage-frame-save"
            label="Save"
            onPress={() => void save()}
            loading={saving}
            disabled={saving}
            accentColor={accent.accent}
            onAccentColor={accent.onAccent}
          />
          {frame ? (
            <TextButton
              testID="profile-montage-frame-reset"
              label="Use Automatic"
              onPress={() => setFrame(null)}
              disabled={saving}
            />
          ) : null}
        </>
      ) : (
        <Text testID="profile-montage-frame-unknown" style={styles.hint}>
          This photo can&apos;t be adjusted. Remove it and add it again to adjust it.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  hint: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  stage: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  around: {
    position: 'absolute',
    opacity: 0.3,
  },
  // The panel showing the photo, with no seam: its picture lines up with the faint one exactly.
  shownPanel: {
    borderLeftWidth: 0,
  },
  outline: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
