import { EXERCISE_VIDEOS, type ExerciseVideoEntry } from './exerciseVideos.generated';

// Where an exercise's demonstration video comes from -- one place, so the provider can be replaced
// without touching the exercise library or its pages. A provider turns a mapped exercise
// (exerciseVideos.generated.ts: its file and take) into a video's address and a poster frame's.
//
// No provider is switched on (Harbir's call pending, 2026-11-26): the Free Exercise DB with Videos
// repository licenses its code and exercise text under MIT, but says of its videos only that they
// are "from an animated exercise video set, redistributed here with the maintainer's rights" --
// no licence for them, and its hosted copy is "for testing and evaluation". Until commercial use
// is confirmed and the videos are served from somewhere Progresso may use in production, every
// exercise page shows its picture as it always has (docs/EXERCISE_VIDEOS.md).

export interface ExerciseVideoUrls {
  video: string;
  poster: string | null;
}

export interface ExerciseVideoProvider {
  /** A name for the provider, for support and logs. */
  name: string;
  urlsFor(entry: ExerciseVideoEntry): ExerciseVideoUrls;
}

/**
 * The videos served from a base address laid out as the repository lays them out:
 * `<base>/exercise-videos/<take>/<file>.mp4` and `<base>/exercise-posters/<take>/<file>.jpg` --
 * for copies Progresso hosts itself (Supabase Storage, say) once their use is cleared.
 */
export function repositoryLayoutProvider(name: string, baseUrl: string): ExerciseVideoProvider {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    name,
    urlsFor: ({ file, take }) => ({
      video: `${base}/exercise-videos/${take}/${file}.mp4`,
      poster: `${base}/exercise-posters/${take}/${file}.jpg`,
    }),
  };
}

/** The provider in use: none until the videos' licence is cleared. */
export const EXERCISE_VIDEO_PROVIDER: ExerciseVideoProvider | null = null;

/**
 * A built-in's demonstration video, by its slug, from the provider given (the one in use by
 * default) -- null where it has none, or no provider is on.
 */
export function exerciseVideoFor(
  slug: string | null | undefined,
  provider: ExerciseVideoProvider | null = EXERCISE_VIDEO_PROVIDER,
): ExerciseVideoUrls | null {
  if (!slug || !provider) return null;
  const entry = EXERCISE_VIDEOS[slug];
  return entry ? provider.urlsFor(entry) : null;
}
