import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import type { AppThemeId } from '../theme/appThemes';
import type { WidgetLook } from './widgetProps';

// Each theme's photo, cut for each widget size (assets/widgets): a square for the small widget, a
// wide one for the medium, each no bigger than the smallest widget it fills in pixels -- WidgetKit
// won't draw an image bigger than its widget, and shows the widget blank instead. A widget runs
// outside the app and can only read files in the App Group the two share, so the photo is copied
// there before a widget is handed it -- once, named for its contents, so a photo changed in a
// later version is copied afresh. Without the App Group, the widgets go without the photo.

const APP_GROUP = 'group.com.harbirbains.progresso';

const PHOTOS: Record<AppThemeId, { small: number; medium: number }> = {
  'golden-hour-gym': {
    small: require('../../assets/widgets/golden-hour-gym-small.jpg'),
    medium: require('../../assets/widgets/golden-hour-gym-medium.jpg'),
  },
  forest: {
    small: require('../../assets/widgets/forest-small.jpg'),
    medium: require('../../assets/widgets/forest-medium.jpg'),
  },
  alpine: {
    small: require('../../assets/widgets/alpine-small.jpg'),
    medium: require('../../assets/widgets/alpine-medium.jpg'),
  },
  coast: {
    small: require('../../assets/widgets/coast-small.jpg'),
    medium: require('../../assets/widgets/coast-medium.jpg'),
  },
  spring: {
    small: require('../../assets/widgets/spring-small.jpg'),
    medium: require('../../assets/widgets/spring-medium.jpg'),
  },
  summer: {
    small: require('../../assets/widgets/summer-small.jpg'),
    medium: require('../../assets/widgets/summer-medium.jpg'),
  },
  autumn: {
    small: require('../../assets/widgets/autumn-small.jpg'),
    medium: require('../../assets/widgets/autumn-medium.jpg'),
  },
  winter: {
    small: require('../../assets/widgets/winter-small.jpg'),
    medium: require('../../assets/widgets/winter-medium.jpg'),
  },
};

/** The theme's photos, kept in the App Group: where each one is, or nothing without the App Group. */
export async function keepWidgetPhotos(
  themeId: AppThemeId,
): Promise<Pick<WidgetLook, 'photoSmall' | 'photoMedium'>> {
  const shared = Paths.appleSharedContainers[APP_GROUP];
  if (!shared) return {};
  const folder = new Directory(shared, 'widget-photos');
  folder.create({ intermediates: true, idempotent: true });
  const [photoSmall, photoMedium] = await Promise.all([
    keep(folder, PHOTOS[themeId].small),
    keep(folder, PHOTOS[themeId].medium),
  ]);
  return { photoSmall, photoMedium };
}

async function keep(folder: Directory, photo: number): Promise<string> {
  const asset = Asset.fromModule(photo);
  const kept = new File(folder, `${asset.name}-${asset.hash ?? 'photo'}.${asset.type}`);
  if (!kept.exists) {
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error(`No copy of ${asset.name} to keep for the widgets`);
    await new File(asset.localUri).copy(kept);
  }
  return kept.uri;
}
