import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PhotoLightbox } from '../design/PhotoLightbox';
import { colors, radii } from '../design/theme';
import { foodGlyph } from './foodGlyph';

interface Props {
  /** The food's photo, when one really exists (an Open Food Facts product photo, or one the user added). Null/undefined draws the category glyph instead. */
  uri?: string | null;
  /** Used to choose the fallback glyph (chicken -> a drumstick). */
  name: string;
  /** Edge length in points. Default 48: a list row. Use ~96 for a detail hero. */
  size?: number;
  /**
   * Tapping a real photo opens it full screen, to pinch and look around (PhotoLightbox). Only
   * where a tap on the picture does nothing else -- in a row that logs its food when tapped, the
   * tap stays the row's.
   */
  zoomable?: boolean;
  testID?: string;
}

// A food's picture, square with the control radius: its real photo when it has
// one, otherwise a plain category glyph in a quiet raised tile. A glyph is
// deliberately not a picture of the food -- nothing here is stock or generated
// artwork passed off as a photo -- and it is also what shows if a photo fails
// to load. Decorative: the food's name always sits beside it as text, so it is
// hidden from screen readers -- unless it's `zoomable` and has a photo, when
// it's a button ("View Oreo photo") that opens the photo full screen.
export function FoodImage({ uri, name, size = 48, zoomable, testID }: Props) {
  const [failed, setFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const frame = { width: size, height: size };
  const showPhoto = Boolean(uri) && !failed;
  const canZoom = Boolean(zoomable) && showPhoto;

  const picture = (
    <View
      testID={testID}
      style={[styles.frame, frame]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {showPhoto ? (
        <Image
          testID={testID ? `${testID}-photo` : undefined}
          source={{ uri: uri as string }}
          style={frame}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : (
        <MaterialCommunityIcons
          testID={testID ? `${testID}-glyph` : undefined}
          name={foodGlyph(name)}
          size={Math.round(size * 0.5)}
          color={colors.textSecondary}
        />
      )}
    </View>
  );

  if (!canZoom) return picture;

  return (
    <>
      <TouchableOpacity
        testID={testID ? `${testID}-zoom` : undefined}
        onPress={() => setLightboxOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`View ${name} photo`}
      >
        {picture}
      </TouchableOpacity>
      <PhotoLightbox
        testID={testID ? `${testID}-lightbox` : undefined}
        visible={lightboxOpen}
        uri={uri as string}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
  },
});
