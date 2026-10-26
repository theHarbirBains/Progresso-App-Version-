import { publicPhotoUrl, uploadPhoto, uniquePhotoPath } from './photoUpload';

const FOOD_PHOTO_BUCKET = 'food-photos';

/**
 * Uploads a locally-picked photo of a custom food (a file:// URI from
 * expo-image-picker) to this user's own folder in the food-photos bucket.
 * Storage RLS only lets a user write under their own "{userId}/..." folder
 * (see the food_photos migration), so this can never write into another
 * user's folder. Returns the URL to store on the food row.
 */
export async function uploadFoodPhoto(userId: string, localUri: string): Promise<string> {
  // Many to a person -- one per food -- so each upload gets its own unguessable file.
  const path = uniquePhotoPath(userId);
  await uploadPhoto(FOOD_PHOTO_BUCKET, path, localUri);
  return publicPhotoUrl(FOOD_PHOTO_BUCKET, path);
}
