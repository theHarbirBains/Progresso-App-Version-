import { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Text } from '../design/Text';
import { colors, radii, spacing } from '../design/theme';
import { hexToRgb, normalizeHex, rgbToHex } from '../theme/accentColor';

interface ChannelSliderProps {
  label: string;
  value: number;
  trackColor: string;
  onChange: (value: number) => void;
}

// A hand-rolled draggable slider track built only on core React Native
// (PanResponder/View) -- no gesture/slider library is installed in this
// project, and this avoids adding one just for three sliders. Reports the
// live 0-255 channel value as the thumb moves.
function ChannelSlider({ label, value, trackColor, onChange }: ChannelSliderProps) {
  const trackWidthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const updateFromLocationX = useCallback(
    (locationX: number) => {
      const width = trackWidthRef.current;
      if (width <= 0) return;
      const clamped = Math.max(0, Math.min(width, locationX));
      onChange(Math.round((clamped / width) * 255));
    },
    [onChange],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event: GestureResponderEvent) =>
        updateFromLocationX(event.nativeEvent.locationX),
      onPanResponderMove: (event: GestureResponderEvent) =>
        updateFromLocationX(event.nativeEvent.locationX),
    }),
  ).current;

  const thumbLeft = trackWidth > 0 ? (value / 255) * trackWidth : 0;

  return (
    <View style={styles.channelRow}>
      <Text style={styles.channelLabel}>{label}</Text>
      <View
        testID={`channel-track-${label}`}
        style={styles.channelTrack}
        onLayout={(event) => {
          trackWidthRef.current = event.nativeEvent.layout.width;
          setTrackWidth(event.nativeEvent.layout.width);
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.channelTrackLine} />
        <View
          style={[
            styles.channelFill,
            { width: `${(value / 255) * 100}%`, backgroundColor: trackColor },
          ]}
        />
        <View
          testID={`channel-thumb-${label}`}
          style={[styles.channelThumb, { left: thumbLeft, borderColor: trackColor }]}
        />
      </View>
      <Text testID={`channel-value-${label}`} style={styles.channelValue}>
        {value}
      </Text>
    </View>
  );
}

interface Props {
  /** Current color, as a normalized "#RRGGBB" hex string. */
  value: string;
  onChange: (hex: string) => void;
}

// Custom Color: three R/G/B sliders (built above, no new dependency) plus a
// hex text field for exact entry -- either path is a full "any color"
// picker, not just the preset palette.
export function RgbSliderPicker({ value, onChange }: Props) {
  const { r, g, b } = hexToRgb(value);
  const [hexText, setHexText] = useState(value);

  function handleChannel(channel: 'r' | 'g' | 'b', next: number) {
    const rgb = { r, g, b, [channel]: next };
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setHexText(hex);
    onChange(hex);
  }

  function handleHexChange(text: string) {
    setHexText(text);
    const normalized = normalizeHex(text);
    if (normalized) onChange(normalized);
  }

  return (
    <View>
      <View style={styles.previewRow}>
        <View testID="custom-color-swatch" style={[styles.swatch, { backgroundColor: value }]} />
        <TextInput
          testID="custom-color-hex-input"
          style={styles.hexInput}
          value={hexText}
          onChangeText={handleHexChange}
          onBlur={() => setHexText(value)}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          placeholder="#RRGGBB"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Custom color hex code"
        />
      </View>

      <ChannelSlider
        label="R"
        value={r}
        trackColor={rgbToHex(255, 0, 0)}
        onChange={(next) => handleChannel('r', next)}
      />
      <ChannelSlider
        label="G"
        value={g}
        trackColor={rgbToHex(0, 255, 0)}
        onChange={(next) => handleChannel('g', next)}
      />
      <ChannelSlider
        label="B"
        value={b}
        trackColor={rgbToHex(0, 0, 255)}
        onChange={(next) => handleChannel('b', next)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hexInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    letterSpacing: 1,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  channelLabel: {
    width: 14,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  channelTrack: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  channelTrackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
  },
  channelFill: {
    position: 'absolute',
    left: 0,
    top: 12,
    height: 4,
    borderRadius: 2,
    opacity: 0.9,
  },
  channelThumb: {
    position: 'absolute',
    top: 4,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.textPrimary,
    borderWidth: 3,
    marginLeft: -10,
  },
  channelValue: {
    width: 32,
    textAlign: 'right',
    color: colors.textSecondary,
    fontSize: 13,
  },
});
