import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { keepWidgetPhotos } from './widgetPhotos';

// A stand-in App Group: a folder of file names, the files copied into it, and assets that each
// have a bundled copy.
const kept = new Set<string>();
const copy = jest.fn(async function (this: { uri: string }, to: { uri: string }) {
  kept.add(to.uri);
});
const create = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { appleSharedContainers: {} },
  Directory: jest.fn(),
  File: jest.fn(),
}));
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));

const shared = { uri: 'file:///group/' };

beforeEach(() => {
  jest.clearAllMocks();
  kept.clear();
  (Paths as unknown as { appleSharedContainers: Record<string, unknown> }).appleSharedContainers = {
    'group.com.harbirbains.progresso': shared,
  };
  jest
    .mocked(Directory)
    .mockImplementation(
      (parent: unknown, name: unknown) =>
        ({ uri: `${(parent as { uri: string }).uri}${name as string}/`, create }) as never,
    );
  jest.mocked(File).mockImplementation((...parts: unknown[]) => {
    const uri =
      parts.length === 1
        ? (parts[0] as string)
        : `${(parts[0] as { uri: string }).uri}${parts[1] as string}`;
    return {
      uri,
      get exists() {
        return kept.has(uri);
      },
      copy,
    } as never;
  });
  let n = 0;
  jest.mocked(Asset.fromModule).mockImplementation(() => {
    n += 1;
    const size = n % 2 === 1 ? 'small' : 'medium';
    const asset: { name: string; hash: string; type: string; localUri: string | null } & {
      downloadAsync: () => Promise<unknown>;
    } = {
      name: `forest-${size}`,
      hash: `h${size}`,
      type: 'jpg',
      localUri: null,
      downloadAsync: jest.fn(async () => {
        asset.localUri = `file:///bundle/forest-${size}.jpg`;
        return asset;
      }),
    };
    return asset as never;
  });
});

it("keeps the theme's photos in the App Group, for each size, and says where", async () => {
  await expect(keepWidgetPhotos('forest')).resolves.toEqual({
    photoSmall: 'file:///group/widget-photos/forest-small-hsmall.jpg',
    photoMedium: 'file:///group/widget-photos/forest-medium-hmedium.jpg',
  });
  expect(create).toHaveBeenCalledWith({ intermediates: true, idempotent: true });
  expect(copy).toHaveBeenCalledTimes(2);
});

it('copies a photo only once', async () => {
  await keepWidgetPhotos('forest');
  copy.mockClear();
  await keepWidgetPhotos('forest');
  expect(copy).not.toHaveBeenCalled();
});

it('goes without the photos where there is no App Group', async () => {
  (Paths as unknown as { appleSharedContainers: Record<string, unknown> }).appleSharedContainers =
    {};
  await expect(keepWidgetPhotos('forest')).resolves.toEqual({});
  expect(copy).not.toHaveBeenCalled();
});
