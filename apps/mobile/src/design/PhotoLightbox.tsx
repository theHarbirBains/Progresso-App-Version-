import { Image, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from './IconButton';
import { colors } from './theme';

interface Props {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  testID?: string;
}

// A full-screen view of a single photo -- the machine photo on an exercise,
// a food photo, anything shown small elsewhere that's worth seeing at real
// size. Opaque black backdrop (never transparent/dimmed-backdrop, since
// there's nothing behind it worth seeing), the image letterboxed to fit
// (`resizeMode: 'contain'`, never cropped), and one close button over the
// safe area. Deliberately minimal -- no pinch-to-zoom/pan, just "see it
// bigger," which is all any current caller needs.
export function PhotoLightbox({ visible, uri, onClose, testID }: Props) {
  const insets = useSafeAreaInsets();

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View testID={testID} style={styles.root}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
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
  image: {
    flex: 1,
  },
  closeWrap: {
    position: 'absolute',
    right: 8,
  },
});
