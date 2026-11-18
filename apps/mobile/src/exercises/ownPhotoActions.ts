import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { removeOwnPhoto, saveOwnPhoto } from './ownPhotos';

/** Opens the camera or the library for a machine photo; the picked file, or null. */
async function pickFrom(source: 'camera' | 'library'): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      source === 'camera'
        ? 'Camera permission is required to take a photo.'
        : 'Photo library permission is required to choose a photo.',
    );
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

async function pickAndSave(exerciseId: string, source: 'camera' | 'library') {
  const picked = await pickFrom(source);
  if (!picked) return;
  try {
    await saveOwnPhoto(exerciseId, picked);
  } catch (err) {
    Alert.alert("Couldn't save the photo", err instanceof Error ? err.message : undefined);
  }
}

/**
 * Add (or change, or remove) a photo of the machine you use for a built-in exercise: Take Photo,
 * Choose from Library, and Remove Photo once there is one. It shows in place of the drawing.
 */
export function changeOwnPhoto({
  exerciseId,
  hasPhoto,
}: {
  exerciseId: string;
  hasPhoto: boolean;
}): void {
  Alert.alert(
    hasPhoto ? 'Machine Photo' : 'Add Your Machine Photo',
    'It shows in place of the drawing, only to you.',
    [
      { text: 'Take Photo', onPress: () => void pickAndSave(exerciseId, 'camera') },
      { text: 'Choose from Library', onPress: () => void pickAndSave(exerciseId, 'library') },
      ...(hasPhoto
        ? [
            {
              text: 'Remove Photo',
              style: 'destructive' as const,
              onPress: () => {
                removeOwnPhoto(exerciseId).catch((err: unknown) =>
                  Alert.alert(
                    "Couldn't remove the photo",
                    err instanceof Error ? err.message : undefined,
                  ),
                );
              },
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ],
  );
}
