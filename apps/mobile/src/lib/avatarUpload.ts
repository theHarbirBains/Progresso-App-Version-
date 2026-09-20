import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

function avatarPath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

/**
 * Uploads a locally-picked image (a file:// URI from expo-image-picker) to
 * this user's own folder in the avatars bucket. Always the same path per
 * user (upsert: true) so changing a picture overwrites the previous file
 * instead of leaving orphaned uploads behind -- storage RLS only allows a
 * user to write under their own "{userId}/..." folder (see the
 * profile_picture migration's avatar_insert_own/avatar_update_own
 * policies), so this can never overwrite another user's avatar.
 *
 * Returns the bucket's public URL with a cache-busting query param
 * appended: the storage path itself never changes across uploads, so
 * without this an <Image> (or any HTTP cache) that already loaded the old
 * picture would keep showing it after a change.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const path = avatarPath(userId);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Deletes this user's uploaded avatar file from storage. */
export async function removeAvatarFile(userId: string): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(userId)]);
  if (error) throw new Error(error.message);
}
