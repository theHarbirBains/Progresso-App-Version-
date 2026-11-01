import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';

interface Options {
  /** The Take Photo / Choose from Library sheet's title ("Food Photo"). */
  title: string;
  /** The crop the picker offers. */
  aspect: [number, number];
  /** The photo the record already has, if any. */
  existingUrl: string | null;
}

/**
 * A form's photo field (a custom food's, a machine's): a freshly picked photo -- a local file,
 * uploaded on Save -- or the photo the record already has, which Remove Photo clears on Save.
 */
export function usePhotoField({ title, aspect, existingUrl }: Options) {
  const [picked, setPicked] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFrom(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        source === 'camera'
          ? 'Camera permission is required to take a photo.'
          : 'Photo library permission is required to choose a photo.',
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect,
      quality: 0.7,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;

    setPicked(result.assets[0].uri);
    setRemoved(false);
  }

  return {
    /** What to show: the photo just picked, else the saved one unless it was removed. */
    shown: picked ?? (removed ? null : existingUrl),
    /** The local file to upload on Save, when a photo was picked. */
    picked,
    /** Whether Save should clear the saved photo. */
    removed,
    error,
    pick() {
      setError(null);
      Alert.alert(title, undefined, [
        { text: 'Take Photo', onPress: () => void pickFrom('camera') },
        { text: 'Choose from Library', onPress: () => void pickFrom('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    remove() {
      setPicked(null);
      setRemoved(true);
    },
  };
}
