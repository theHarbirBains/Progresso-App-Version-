import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { removeAvatarFile, uploadAvatar } from '../lib/avatarUpload';
import { useProfile } from './ProfileProvider';

/**
 * The profile picture's sheet (Choose Photo, Remove Photo) for Profile and Settings > Personal
 * Info: whether it's open, the change being saved, and why the last one failed. A photo chosen is
 * uploaded and set on the profile; a removed one is deleted and cleared.
 */
export function useAvatarPhoto(userId: string | undefined) {
  const { updateProfile } = useProfile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(change: () => Promise<string | null>, failure: string) {
    setSaving(true);
    try {
      await updateProfile({ avatarUrl: await change() });
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setSaving(false);
    }
  }

  return {
    sheetOpen,
    openSheet: () => setSheetOpen(true),
    closeSheet: () => setSheetOpen(false),
    saving,
    error,
    async choosePhoto() {
      setSheetOpen(false);
      if (!userId) return;
      setError(null);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library permission is required to choose a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      const picked = result.canceled ? undefined : result.assets[0];
      if (!picked) return;

      await save(() => uploadAvatar(userId, picked.uri), 'Failed to update profile picture');
    },
    async removePhoto() {
      setSheetOpen(false);
      if (!userId) return;
      setError(null);
      await save(async () => {
        await removeAvatarFile(userId);
        return null;
      }, 'Failed to remove profile picture');
    },
  };
}
