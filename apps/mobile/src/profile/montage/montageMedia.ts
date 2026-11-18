import { Directory, File, Paths } from 'expo-file-system';
import type { ImageSource } from 'expo-image';
import type { MontageItem } from '../../lib/api';

// What a montage's photos and videos are shown from. Their links are signed afresh each time a
// profile is read, so neither can be cached by its link: a photo is kept by expo-image under its
// item's id, and a video, once fetched, is kept on the phone named for its item -- a profile opened
// again plays it at once. An item never changes (a new photo or video is a new item), so nothing
// kept goes stale; the cache folder is the system's to clear when space runs short.

const downloads = new Map<string, Promise<void>>();

/** A photo, kept by expo-image under its item. */
export function photoSource(item: MontageItem): ImageSource {
  return { uri: item.url, cacheKey: `profile-montage-${item.id}` };
}

/** What a video plays from: its copy on the phone once there is one, else its link. */
export function videoSource(item: MontageItem): string {
  try {
    const folder = new Directory(Paths.cache, 'profile-montage');
    const kept = new File(folder, `${item.id}.${/\.mov(\?|$)/i.test(item.url) ? 'mov' : 'mp4'}`);
    if (kept.exists) return kept.uri;
    keepForNextTime(item, folder, kept);
  } catch {
    // No file system to keep it in: it just plays from its link.
  }
  return item.url;
}

/** Fetches a video's copy in the background, whole or not at all, once at a time. */
function keepForNextTime(item: MontageItem, folder: Directory, kept: File): void {
  if (downloads.has(item.id)) return;
  const job = (async () => {
    folder.create({ intermediates: true, idempotent: true });
    const partial = new File(folder, `${item.id}.download`);
    await File.downloadFileAsync(item.url, partial, { idempotent: true });
    await partial.move(kept);
  })()
    .catch(() => undefined)
    .finally(() => downloads.delete(item.id));
  downloads.set(item.id, job);
}
