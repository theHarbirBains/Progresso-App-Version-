import { supabase } from './supabase';

const FOOD_PHOTO_BUCKET = 'food-photos';

function foodPhotoPath(userId: string): string {
  // A user can have many custom foods, so each upload gets its own unique file
  // name (random, so the URL is unguessable) rather than a fixed path.
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${userId}/${unique}.jpg`;
}

/**
 * Uploads a locally-picked photo of a custom food (a file:// URI from
 * expo-image-picker) to this user's own folder in the food-photos bucket.
 * Storage RLS only lets a user write under their own "{userId}/..." folder
 * (see the food_photos migration), so this can never write into another
 * user's folder. Returns the URL to store on the food row.
 */
export async function uploadFoodPhoto(userId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const path = foodPhotoPath(userId);
  const { error: uploadError } = await supabase.storage
    .from(FOOD_PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(FOOD_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
