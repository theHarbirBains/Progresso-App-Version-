import { publicPhotoUrl, uploadPhoto, uniquePhotoPath } from './photoUpload';

const EQUIPMENT_PHOTO_BUCKET = 'equipment-photos';

/**
 * Uploads a locally-picked machine/equipment photo (a file:// URI from
 * expo-image-picker) to this user's own folder in the equipment-photos
 * bucket. Storage RLS only allows a user to write under their own
 * "{userId}/..." folder (see the equipment_profiles migration's
 * equipment_photo_insert_own policy), so this can never write into another
 * user's folder.
 */
export async function uploadEquipmentPhoto(userId: string, localUri: string): Promise<string> {
  // Many to a person -- one per machine -- so each upload gets its own unguessable file.
  const path = uniquePhotoPath(userId);
  await uploadPhoto(EQUIPMENT_PHOTO_BUCKET, path, localUri);
  return publicPhotoUrl(EQUIPMENT_PHOTO_BUCKET, path);
}
