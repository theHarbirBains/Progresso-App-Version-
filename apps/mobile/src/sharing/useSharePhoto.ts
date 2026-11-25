import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchOwnMontage, type OwnMontageItem } from '../profile/montage/montageQueries';
import {
  dropPickedPhoto,
  keepPickedPhoto,
  montagePhoto,
  NO_SHARE_PHOTO,
  readSharePhotoSetting,
  resolveSharePhoto,
  writeSharePhotoSetting,
  type SharePhoto,
  type SharePhotoChoice,
  type SharePhotoSetting,
} from './sharePhoto';

/**
 * The share card's photo, for Share Workout: the person's last choice read from the phone as the
 * page opens (sharePhoto.ts), their profile picture and montage photos to choose from (the montage
 * read straight from Supabase, as the Montage page reads it -- once as the page opens if a montage
 * photo is the one chosen, else when the chooser opens), and a photo picked from the phone, cropped
 * square as it's picked. Every change is kept on the phone at once.
 */
export function useSharePhoto(userId: string, avatarUrl: string | null) {
  const [setting, setSetting] = useState<SharePhotoSetting | null>(null);
  const [montage, setMontage] = useState<OwnMontageItem[] | null>(null);
  const [montageStatus, setMontageStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const montageRead = useRef<Promise<void> | null>(null);

  const loadMontage = useCallback(() => {
    if (!userId || montageRead.current) return;
    setMontageStatus('loading');
    montageRead.current = fetchOwnMontage(userId)
      .then((items) => {
        setMontage(items);
        setMontageStatus('idle');
      })
      .catch(() => {
        setMontageStatus('failed');
        // Let the next chooser try again.
        montageRead.current = null;
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void readSharePhotoSetting(userId).then((read) => {
      if (!live) return;
      setSetting(read);
      if (read.choice?.kind === 'montage') loadMontage();
    });
    return () => {
      live = false;
    };
  }, [userId, loadMontage]);

  const update = useCallback(
    (next: SharePhotoSetting) => {
      setSetting(next);
      void writeSharePhotoSetting(userId, next).catch(() => undefined);
    },
    [userId],
  );

  const choice = setting?.choice ?? null;
  const photo = useMemo(
    () => resolveSharePhoto(choice, avatarUrl, montage),
    [choice, avatarUrl, montage],
  );
  // The montage photo chosen, before the montage is read: it may well still be there.
  const resolving =
    setting === null ||
    (choice?.kind === 'montage' && montage === null && montageStatus !== 'failed');

  /** The profile's own photos to choose from: the profile picture, then the montage's photos. */
  const profilePhotos = useMemo<SharePhoto[]>(() => {
    const photos: SharePhoto[] = [];
    const avatar = resolveSharePhoto({ kind: 'avatar' }, avatarUrl, null);
    if (avatar) photos.push(avatar);
    (montage ?? []).forEach((item, index) => {
      if (item.kind === 'photo' && item.url) photos.push(montagePhoto(item, index));
    });
    return photos;
  }, [avatarUrl, montage]);

  function choose(next: SharePhotoChoice) {
    setError(null);
    const previous = setting?.choice;
    if (previous?.kind === 'library' && !(next.kind === 'library' && next.uri === previous.uri)) {
      dropPickedPhoto(previous.uri);
    }
    update({ include: true, choice: next });
  }

  return {
    /** Null until the phone's been read. */
    setting,
    /** The photo chosen, as it can be drawn now -- null when none is, or it's gone. */
    photo,
    /** On the card: chosen, still there, and switched on. */
    onCard: Boolean(setting?.include && photo),
    resolving,
    profilePhotos,
    montageLoading: montageStatus === 'loading',
    montageFailed: montageStatus === 'failed',
    picking,
    error,
    loadMontage,
    /** A profile photo by its key ("avatar:...", "montage:<id>"). */
    chooseProfilePhoto(key: string) {
      if (key.startsWith('avatar:')) choose({ kind: 'avatar' });
      else if (key.startsWith('montage:')) choose({ kind: 'montage', id: key.slice(8) });
    },
    /** One from the phone's photos, cropped square as it's picked, kept on the phone. */
    async chooseFromLibrary() {
      setError(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Allow Progresso to use Photos in iPhone Settings to add a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      const picked = result.canceled ? undefined : result.assets?.[0];
      if (!picked) return;
      setPicking(true);
      try {
        choose({ kind: 'library', uri: await keepPickedPhoto(userId, picked.uri) });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add the photo');
      } finally {
        setPicking(false);
      }
    },
    /** Shows or hides the chosen photo; it's kept either way. */
    setIncluded(include: boolean) {
      if (!setting?.choice) return;
      update({ ...setting, include });
    },
    /** Forgets the photo: off the card, and a photo picked from the phone deleted. */
    remove() {
      setError(null);
      if (setting?.choice?.kind === 'library') dropPickedPhoto(setting.choice.uri);
      update(NO_SHARE_PHOTO);
    },
  };
}

export type SharePhotoState = ReturnType<typeof useSharePhoto>;
