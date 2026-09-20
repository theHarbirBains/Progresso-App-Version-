import { supabase } from './supabase';

const EQUIPMENT_PHOTO_BUCKET = 'equipment-photos';

function equipmentPhotoPath(userId: string): string {
  // Unlike the one-file-per-user avatar path, a user can have many machine
  // photos (one per equipment profile they create), so each upload gets its
  // own unique filename rather than upserting a fixed path.
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${unique}.jpg`;
}

/**
 * Uploads a locally-picked machine/equipment photo (a file:// URI from
 * expo-image-picker) to this user's own folder in the equipment-photos
 * bucket. Storage RLS only allows a user to write under their own
 * "{userId}/..." folder (see the equipment_profiles migration's
 * equipment_photo_insert_own policy), so this can never write into another
 * user's folder.
 */
export async function uploadEquipmentPhoto(userId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const path = equipmentPhotoPath(userId);
  const { error: uploadError } = await supabase.storage
    .from(EQUIPMENT_PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(EQUIPMENT_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
