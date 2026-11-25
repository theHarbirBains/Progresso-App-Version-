import AsyncStorage from '@react-native-async-storage/async-storage';
import { resizeForUpload } from '../lib/imageResize';
import type { MontageItem } from '../lib/api';
import {
  dropPickedPhoto,
  keepPickedPhoto,
  NO_SHARE_PHOTO,
  photoRect,
  readSharePhotoSetting,
  resolveSharePhoto,
  writeSharePhotoSetting,
} from './sharePhoto';

// The phone's files, as far as these tests need them: which exist, what's copied where and what's
// deleted.
const mockFiles = new Set<string>();
const mockCopies: [string, string][] = [];
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
      .join('/');
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    copy(to: File) {
      mockCopies.push([this.uri, to.uri]);
      mockFiles.add(to.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: 'file:///docs' } };
});

jest.mock('../lib/imageResize', () => ({
  resizeForUpload: jest.fn(async (uri: string) => `${uri}.scaled.jpg`),
}));

beforeEach(async () => {
  mockFiles.clear();
  mockCopies.length = 0;
  await AsyncStorage.clear();
});

const covers = (d: number, r: { left: number; top: number; width: number; height: number }) =>
  r.left <= 0.001 &&
  r.top <= 0.001 &&
  r.left + r.width >= d - 0.001 &&
  r.top + r.height >= d - 0.001;

describe('placing a photo in its circle', () => {
  const d = 76;

  it('covers the circle at its own shape, whatever its dimensions -- never stretched', () => {
    for (const size of [
      { width: 1000, height: 1000 },
      { width: 1080, height: 1920 },
      { width: 1920, height: 1080 },
      { width: 400, height: 3000 },
      { width: 3000, height: 400 },
      { width: 12, height: 9 },
    ]) {
      const rect = photoRect(d, { size, frame: null })!;
      expect(covers(d, rect)).toBe(true);
      expect(rect.width / rect.height).toBeCloseTo(size.width / size.height, 5);
    }
  });

  it('centres a wide photo, and puts a tall one toward its top, where a face usually is', () => {
    const wide = photoRect(d, { size: { width: 1920, height: 1080 }, frame: null })!;
    expect(wide.height).toBeCloseTo(d);
    expect(wide.left).toBeCloseTo((d - wide.width) / 2);
    const tall = photoRect(d, { size: { width: 1080, height: 1920 }, frame: null })!;
    expect(tall.width).toBeCloseTo(d);
    expect(tall.top).toBeCloseTo((d - tall.height) * 0.25);
  });

  it("follows a montage photo's own framing: its point at the middle, zoomed as framed", () => {
    const rect = photoRect(d, {
      size: { width: 1080, height: 1920 },
      frame: { x: 0.5, y: 0.3, zoom: 2 },
    })!;
    expect(rect.width).toBeCloseTo(d * 2);
    expect(rect.left + rect.width * 0.5).toBeCloseTo(d / 2);
    expect(rect.top + rect.height * 0.3).toBeCloseTo(d / 2);
    // Framed past its edge: held at the edge, never leaving a gap.
    const edge = photoRect(d, {
      size: { width: 1000, height: 1000 },
      frame: { x: 0, y: 1, zoom: 1 },
    })!;
    expect(edge).toEqual({ left: 0, top: 0, width: d, height: d });
  });

  it('leaves a photo of unknown size to be drawn covering the circle from its middle', () => {
    expect(photoRect(d, { size: null, frame: null })).toBeNull();
    expect(photoRect(d, { size: { width: 0, height: 100 }, frame: null })).toBeNull();
  });
});

describe('what the card shows', () => {
  const montage: MontageItem[] = [
    {
      id: 'clip',
      kind: 'video',
      url: 'https://x/clip.mp4',
      width: 720,
      height: 1280,
      durationSeconds: 8,
      frame: null,
    },
    {
      id: 'gym',
      kind: 'photo',
      url: 'https://x/gym.jpg',
      width: 1080,
      height: 1350,
      durationSeconds: null,
      frame: { x: 0.4, y: 0.2, zoom: 1.5 },
    },
  ];

  it('is the profile picture while there is one', () => {
    expect(resolveSharePhoto({ kind: 'avatar' }, 'https://x/me.jpg', null)).toMatchObject({
      key: 'avatar:https://x/me.jpg',
      source: { uri: 'https://x/me.jpg' },
      size: null,
      label: 'Profile Picture',
    });
    expect(resolveSharePhoto({ kind: 'avatar' }, null, null)).toBeNull();
  });

  it('is a montage photo with its size and framing, kept by its item -- never a video', () => {
    expect(resolveSharePhoto({ kind: 'montage', id: 'gym' }, null, montage)).toMatchObject({
      key: 'montage:gym',
      source: { uri: 'https://x/gym.jpg', cacheKey: 'profile-montage-gym' },
      size: { width: 1080, height: 1350 },
      frame: { x: 0.4, y: 0.2, zoom: 1.5 },
      label: 'Montage Photo 2',
    });
    expect(resolveSharePhoto({ kind: 'montage', id: 'clip' }, null, montage)).toBeNull();
    // Removed from the montage since, or the montage not read yet.
    expect(resolveSharePhoto({ kind: 'montage', id: 'gone' }, null, montage)).toBeNull();
    expect(resolveSharePhoto({ kind: 'montage', id: 'gym' }, null, null)).toBeNull();
  });

  it('is a photo kept from the phone while its file is there', () => {
    const uri = 'file:///docs/share-photo/user-1/1.jpg';
    expect(resolveSharePhoto({ kind: 'library', uri }, null, null)).toBeNull();
    mockFiles.add(uri);
    expect(resolveSharePhoto({ kind: 'library', uri }, null, null)).toMatchObject({
      key: `library:${uri}`,
      source: { uri },
    });
  });
});

describe('keeping the choice on the phone', () => {
  it('reads nothing kept as no photo, and keeps a choice per person', async () => {
    expect(await readSharePhotoSetting('user-1')).toEqual(NO_SHARE_PHOTO);
    await writeSharePhotoSetting('user-1', { include: true, choice: { kind: 'avatar' } });
    expect(await readSharePhotoSetting('user-1')).toEqual({
      include: true,
      choice: { kind: 'avatar' },
    });
    expect(await readSharePhotoSetting('user-2')).toEqual(NO_SHARE_PHOTO);
    // Removing it forgets it.
    await writeSharePhotoSetting('user-1', NO_SHARE_PHOTO);
    expect(await AsyncStorage.getItem('@progresso/sharePhoto/user-1')).toBeNull();
  });

  it('treats anything it can’t read as no photo', async () => {
    for (const raw of [
      'not json',
      JSON.stringify({ include: true }),
      JSON.stringify({ include: true, choice: { kind: 'video', id: 'x' } }),
      JSON.stringify({ include: true, choice: { kind: 'montage' } }),
      JSON.stringify({ include: true, choice: { kind: 'library', uri: '' } }),
    ]) {
      await AsyncStorage.setItem('@progresso/sharePhoto/user-1', raw);
      expect(await readSharePhotoSetting('user-1')).toEqual(NO_SHARE_PHOTO);
    }
    await AsyncStorage.setItem(
      '@progresso/sharePhoto/user-1',
      JSON.stringify({ include: 'yes', choice: { kind: 'montage', id: 'gym' } }),
    );
    expect(await readSharePhotoSetting('user-1')).toEqual({
      include: false,
      choice: { kind: 'montage', id: 'gym' },
    });
  });

  it("keeps a picked photo, scaled down, in the person's own folder -- a new file each time -- and deletes it", async () => {
    const first = await keepPickedPhoto('user-1', 'file:///cache/picked.jpg');
    expect(resizeForUpload).toHaveBeenCalledWith('file:///cache/picked.jpg');
    expect(first).toMatch(/^file:\/\/\/docs\/share-photo\/user-1\/\d+\.jpg$/);
    expect(mockCopies).toEqual([['file:///cache/picked.jpg.scaled.jpg', first]]);
    expect(mockFiles.has(first)).toBe(true);

    dropPickedPhoto(first);
    expect(mockFiles.has(first)).toBe(false);
    // Already gone: nothing happens.
    expect(() => dropPickedPhoto(first)).not.toThrow();
  });
});
