import type { MontageItem } from '../../lib/api';
import { UPLOAD_MAX_EDGE_PX } from '../../lib/imageResize';
import { localFileBytes, uniquePhotoPath, uploadPhoto } from '../../lib/photoUpload';
import { supabase } from '../../lib/supabase';

// Your own montage, straight from Supabase under its own-row policies
// (20261205100000_profile_montage.sql): read, added to, put in order and taken from. Everyone
// else's -- and yours on your profile -- comes with the profile from the API.

/** How many photos and videos a montage holds, in all. */
export const MONTAGE_LIMIT = 4;
/** The longest video a montage takes, seconds. */
export const MONTAGE_VIDEO_SECONDS = 60;
/** The bucket's own limit on a file (50 MB). */
export const MONTAGE_FILE_BYTES = 50 * 1024 * 1024;
const BUCKET = 'profile-montage';
const LINK_SECONDS = 60 * 60;

/** One of your own: what the profile shows, and where its file is, to remove it. */
export interface OwnMontageItem extends MontageItem {
  path: string;
}

/** A photo or video picked to add (from expo-image-picker). */
export interface PickedMedia {
  uri: string;
  type?: string | null;
  width: number;
  height: number;
  /** A video's length, milliseconds. */
  duration?: number | null;
  fileSize?: number;
  mimeType?: string;
}

/** Why a picked photo or video can't go in, said to the person -- or null when it can. */
export function montageProblem(media: PickedMedia): string | null {
  if (media.type === 'video') {
    if ((media.duration ?? 0) / 1000 > MONTAGE_VIDEO_SECONDS + 0.5) {
      return 'Videos can be up to a minute long.';
    }
    if (media.fileSize !== undefined && media.fileSize > MONTAGE_FILE_BYTES) {
      return 'That video is too big: up to 50 MB.';
    }
  }
  return null;
}

/** Your montage, in your order, each with a link to show it by. */
export async function fetchOwnMontage(userId: string): Promise<OwnMontageItem[]> {
  const { data, error } = await supabase
    .from('profile_montage_items')
    .select('id, kind, storage_path, width, height, duration_seconds')
    .eq('user_id', userId)
    .order('position');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    kind: 'photo' | 'video';
    storage_path: string;
    width: number | null;
    height: number | null;
    duration_seconds: string | number | null;
  }[];
  if (rows.length === 0) return [];
  const signed = await supabase.storage.from(BUCKET).createSignedUrls(
    rows.map((row) => row.storage_path),
    LINK_SECONDS,
  );
  if (signed.error) throw new Error(signed.error.message);
  const links = new Map((signed.data ?? []).map((link) => [link.path, link.signedUrl]));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    url: links.get(row.storage_path) ?? '',
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    path: row.storage_path,
  }));
}

/**
 * Adds a picked photo or video at the end of your montage: its file into your own folder (a photo
 * scaled down and saved as JPEG, as every photo upload is), then its row. The database refuses a
 * fifth; a file whose row can't be added is taken back.
 */
export async function addToMontage(userId: string, media: PickedMedia): Promise<void> {
  const problem = montageProblem(media);
  if (problem) throw new Error(problem);
  const video = media.type === 'video';
  let path: string;
  let size = { width: media.width, height: media.height };
  if (video) {
    const quickTime = media.mimeType === 'video/quicktime' || /\.mov$/i.test(media.uri);
    path = uniquePhotoPath(userId, quickTime ? 'mov' : 'mp4');
    const bytes = await localFileBytes(media.uri);
    if (bytes.byteLength > MONTAGE_FILE_BYTES) {
      throw new Error('That video is too big: up to 50 MB.');
    }
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: quickTime ? 'video/quicktime' : 'video/mp4',
    });
    if (error) throw new Error(error.message);
  } else {
    path = uniquePhotoPath(userId);
    await uploadPhoto(BUCKET, path, media.uri, { asJpeg: true });
    // Its size as uploaded: scaled down to the upload's longest edge.
    const scale = Math.min(1, UPLOAD_MAX_EDGE_PX / Math.max(media.width, media.height, 1));
    size = { width: Math.round(media.width * scale), height: Math.round(media.height * scale) };
  }
  const { error } = await supabase.from('profile_montage_items').insert({
    user_id: userId,
    kind: video ? 'video' : 'photo',
    storage_path: path,
    width: size.width > 0 ? size.width : null,
    height: size.height > 0 ? size.height : null,
    duration_seconds: video && media.duration ? Math.min(media.duration / 1000, 60) : null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(
      /at most/.test(error.message)
        ? 'Your montage already has four. Remove one to add another.'
        : error.message,
    );
  }
}

/** Puts your montage in this order (every one of yours, each once). */
export async function reorderMontage(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_profile_montage', { p_ids: ids });
  if (error) throw new Error(error.message);
}

/**
 * Takes one out of your montage: its row, then its file -- in that order, so a montage never
 * points at a missing file. A file a failure leaves behind goes with the account.
 */
export async function removeFromMontage(item: OwnMontageItem): Promise<void> {
  const { error } = await supabase.from('profile_montage_items').delete().eq('id', item.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BUCKET).remove([item.path]);
}
