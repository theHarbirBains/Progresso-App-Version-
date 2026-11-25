import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { ImageSource } from 'expo-image';
import type { MontageFrame, MontageItem } from '../lib/api';
import { resizeForUpload } from '../lib/imageResize';
import { framedRect, photoSize, type Rect, type Size } from '../profile/montage/montageFrame';
import { photoSource } from '../profile/montage/montageMedia';

// The person's own photo on their share card, if they want one: their profile picture, a photo
// from their profile montage, or one picked from their phone's photos. Which -- and whether it's
// on the card at all -- is kept on the phone, per person, and a picked photo is kept in the app's
// own folder on the phone: none of it is ever uploaded. It's drawn only into the image made on
// the phone, which leaves only through the share sheet or into their own Photos.

/** Which photo the card shows. */
export type SharePhotoChoice =
  { kind: 'avatar' } | { kind: 'montage'; id: string } | { kind: 'library'; uri: string };

export interface SharePhotoSetting {
  /** Whether the card shows it -- off keeps the choice for next time. */
  include: boolean;
  choice: SharePhotoChoice | null;
}

export const NO_SHARE_PHOTO: SharePhotoSetting = { include: false, choice: null };

/** A photo as the card draws it. */
export interface SharePhoto {
  /** What it is, for telling one photo from another ("avatar:<url>", "montage:<id>", ...). */
  key: string;
  source: ImageSource;
  /** Its size where it's known -- a montage photo's -- to frame it; else it's centred. */
  size: Size | null;
  /** A montage photo's framing, its owner's: the point at its middle and its zoom. */
  frame: MontageFrame | null;
  /** What the choosing sheet calls it. */
  label: string;
}

const storageKey = (userId: string) => `@progresso/sharePhoto/${userId}`;

function isChoice(value: unknown): value is SharePhotoChoice {
  if (!value || typeof value !== 'object') return false;
  const choice = value as Record<string, unknown>;
  if (choice.kind === 'avatar') return true;
  if (choice.kind === 'montage') return typeof choice.id === 'string' && choice.id.length > 0;
  if (choice.kind === 'library') return typeof choice.uri === 'string' && choice.uri.length > 0;
  return false;
}

/** What this person chose last, from the phone -- none when nothing's kept, or it can't be read. */
export async function readSharePhotoSetting(userId: string): Promise<SharePhotoSetting> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return NO_SHARE_PHOTO;
    const parsed = JSON.parse(raw) as { include?: unknown; choice?: unknown };
    const choice = isChoice(parsed.choice) ? parsed.choice : null;
    return { include: choice !== null && parsed.include === true, choice };
  } catch {
    return NO_SHARE_PHOTO;
  }
}

export async function writeSharePhotoSetting(
  userId: string,
  setting: SharePhotoSetting,
): Promise<void> {
  if (setting.choice === null) await AsyncStorage.removeItem(storageKey(userId));
  else await AsyncStorage.setItem(storageKey(userId), JSON.stringify(setting));
}

/** Where a person's picked photos are kept: the app's own documents, their own folder. */
function keptFolder(userId: string): Directory {
  return new Directory(Paths.document, 'share-photo', userId);
}

/**
 * Keeps a photo picked from the phone's photos for the card: scaled down as every photo the app
 * keeps is (resizeForUpload), then copied into the person's own folder in the app's documents --
 * a new file each time, so the card never shows an old one under a new name.
 */
export async function keepPickedPhoto(userId: string, pickedUri: string): Promise<string> {
  const scaled = await resizeForUpload(pickedUri);
  const folder = keptFolder(userId);
  folder.create({ intermediates: true, idempotent: true });
  const kept = new File(folder, `${Date.now()}.jpg`);
  new File(scaled).copy(kept);
  return kept.uri;
}

/** Deletes a kept photo once it's no longer the one chosen; nothing happens if it's gone. */
export function dropPickedPhoto(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or no file system: nothing to delete.
  }
}

function pickedPhotoExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/**
 * The photo a choice stands for now, or null where it's gone: a profile picture taken off, a
 * montage photo removed (or the montage not read yet), a kept photo deleted. Only photos -- never
 * a montage's video.
 */
export function resolveSharePhoto(
  choice: SharePhotoChoice | null,
  avatarUrl: string | null,
  montage: readonly MontageItem[] | null,
): SharePhoto | null {
  if (!choice) return null;
  switch (choice.kind) {
    case 'avatar':
      return avatarUrl
        ? {
            key: `avatar:${avatarUrl}`,
            source: { uri: avatarUrl },
            size: null,
            frame: null,
            label: 'Profile Picture',
          }
        : null;
    case 'montage': {
      const index = (montage ?? []).findIndex(
        (item) => item.id === choice.id && item.kind === 'photo' && item.url,
      );
      return index >= 0 ? montagePhoto(montage![index]!, index) : null;
    }
    case 'library':
      return pickedPhotoExists(choice.uri)
        ? {
            key: `library:${choice.uri}`,
            source: { uri: choice.uri },
            size: null,
            frame: null,
            label: 'From Your Photos',
          }
        : null;
  }
}

/** A montage photo as the card draws it: kept by expo-image under its item, framed as its owner
 * framed it. */
export function montagePhoto(item: MontageItem, index: number): SharePhoto {
  return {
    key: `montage:${item.id}`,
    source: photoSource(item),
    size: photoSize(item),
    frame: item.frame ?? null,
    label: `Montage Photo ${index + 1}`,
  };
}

/**
 * Where a photo sits in a circle `diameter` across, never stretched: a photo whose size is known
 * covers it, centred on its framing's point and zoomed as framed -- or, with none, centred (a tall
 * photo toward its top, where a face usually is), as the montage frames it. Null when its size
 * isn't known: it's drawn covering the circle from the middle.
 */
export function photoRect(
  diameter: number,
  photo: Pick<SharePhoto, 'size' | 'frame'>,
): Rect | null {
  if (!photo.size || photo.size.width <= 0 || photo.size.height <= 0) return null;
  return framedRect({ width: diameter, height: diameter }, photo.size, photo.frame);
}
