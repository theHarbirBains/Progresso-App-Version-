import { publicPhotoUrl, uniquePhotoPath, uploadPhoto } from './photoUpload';
import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

/**
 * Uploads a locally-picked image (a file:// URI from expo-image-picker) to a new file in this
 * user's own folder of the avatars bucket -- storage RLS only allows a user to write under their
 * own "{userId}/..." folder (see the profile_picture migration's avatar_insert_own policy), so
 * this can never touch another user's avatar -- and returns its public URL.
 *
 * A new file every time, never the old one overwritten: the bucket is public and served through
 * Supabase's CDN, which can go on handing out what it has cached at an address after the file
 * there is replaced, so everyone else could see the old picture for a while. A new address is
 * fetched fresh by everyone, on every phone. The old file is deleted once the new one is the
 * profile's (removeAvatarFile).
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const path = uniquePhotoPath(userId);
  await uploadPhoto(AVATAR_BUCKET, path, localUri);
  return publicPhotoUrl(AVATAR_BUCKET, path);
}

/**
 * The file a profile picture's link points at in the avatars bucket -- only ever one in this
 * user's own folder -- or null for a link that isn't one (pictures from before new files were
 * all "<userId>/avatar.jpg", with "?v=" after them).
 */
export function avatarFileOf(userId: string, url: string): string | null {
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0] ?? '');
  return path.startsWith(`${userId}/`) && !path.includes('..') ? path : null;
}

/** Deletes a profile picture's file -- one that's no longer the profile's -- from storage. */
export async function removeAvatarFile(userId: string, url: string): Promise<void> {
  const path = avatarFileOf(userId, url);
  if (!path) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}
