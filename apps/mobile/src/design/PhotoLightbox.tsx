import { Modal, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from './IconButton';
import { colors } from './theme';

interface Props {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  testID?: string;
}

/** How far a photo can be pinched in. */
export const LIGHTBOX_MAX_ZOOM = 4;

// A full-screen view of a single photo -- the machine photo on an exercise,
// a food photo, anything shown small elsewhere that's worth seeing at real
// size. Opaque black backdrop (never transparent/dimmed-backdrop, since
// there's nothing behind it worth seeing), the image letterboxed to fit
// (`contentFit: 'contain'`, never cropped), and one close button over the
// safe area. Pinch to zoom in (up to 4x) and drag to look around a zoomed
// photo -- the native zooming of an iOS scroll view, with no gesture library;
// it settles back to fit when pinched out. Each opening starts at fit. On
// Android, where a scroll view can't zoom, the photo is shown at fit.
export function PhotoLightbox({ visible, uri, onClose, testID }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View testID={testID} style={styles.root}>
        <ScrollView
          testID={testID ? `${testID}-zoom` : undefined}
          style={styles.root}
          contentContainerStyle={styles.centre}
          minimumZoomScale={1}
          maximumZoomScale={LIGHTBOX_MAX_ZOOM}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </ScrollView>
        <View style={[styles.closeWrap, { top: insets.top + 8 }]}>
          <IconButton
            testID={testID ? `${testID}-close` : undefined}
            icon="x"
            onPress={onClose}
            accessibilityLabel="Close photo"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centre: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeWrap: {
    position: 'absolute',
    right: 8,
  },
});
