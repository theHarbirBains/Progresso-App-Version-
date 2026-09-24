// What the shareable workout image contains and how big it is. Pure data: the
// card (ShareCard.tsx) draws from it, the screen (ShareWorkoutScreen.tsx) edits
// it. Nothing here is persisted or uploaded -- every share starts from these
// defaults.

export type ShareFormat = 'story' | 'feed';

export interface ShareFormatSpec {
  label: string;
  /** Final PNG size. react-native-view-shot resizes the capture to this whatever the on-screen size. */
  captureWidth: number;
  captureHeight: number;
  /** width / height of the card, in the preview and in the capture. */
  aspectRatio: number;
  /** How many personal records it headlines and lifts it lists -- fewer on the shorter feed card so nothing is ever clipped. */
  maxRecords: number;
  maxLifts: number;
}

export const SHARE_FORMATS: Record<ShareFormat, ShareFormatSpec> = {
  // 9:16 -- Instagram / TikTok stories.
  story: {
    label: 'Story',
    captureWidth: 1080,
    captureHeight: 1920,
    aspectRatio: 1080 / 1920,
    maxRecords: 2,
    maxLifts: 3,
  },
  // 4:5 -- the tallest a feed post shows uncropped.
  feed: {
    label: 'Feed',
    captureWidth: 1080,
    captureHeight: 1350,
    aspectRatio: 1080 / 1350,
    maxRecords: 1,
    maxLifts: 2,
  },
};

/** Each block of the card the user can hide. */
export interface ShareOptions {
  date: boolean;
  duration: boolean;
  sets: boolean;
  volume: boolean;
  lifts: boolean;
  records: boolean;
}

// Private by default: total volume (the weight lifted) is off until the user
// turns it on. The date is shown without the year.
export const DEFAULT_SHARE_OPTIONS: ShareOptions = {
  date: true,
  duration: true,
  sets: true,
  volume: false,
  lifts: true,
  records: true,
};
