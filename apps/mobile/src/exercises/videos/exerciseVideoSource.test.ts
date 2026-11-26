import { BUILTIN_CATALOG } from '../illustrations/builtinCatalog.generated';
import {
  EXERCISE_VIDEO_PROVIDER,
  exerciseVideoFor,
  repositoryLayoutProvider,
} from './exerciseVideoSource';
import { EXERCISE_VIDEOS } from './exerciseVideos.generated';

describe('exercise videos', () => {
  it('has no provider on until the videos are cleared for use -- so no exercise shows one', () => {
    expect(EXERCISE_VIDEO_PROVIDER).toBeNull();
    expect(exerciseVideoFor('bb-bench-press')).toBeNull();
  });

  it('maps only built-ins, each once, to one take -- the male one where the repository had both', () => {
    const slugs = Object.keys(EXERCISE_VIDEOS);
    expect(slugs.length).toBe(28);
    for (const slug of slugs) expect(BUILTIN_CATALOG[slug]).toBeDefined();
    // Glute Bridge has only a female demonstration; Sit-Up was listed twice, kept once.
    expect(EXERCISE_VIDEOS['bw-glute-bridge']!.take).toBe('female');
    expect(EXERCISE_VIDEOS['bw-sit-up']!.take).toBe('male');
    expect(Object.values(EXERCISE_VIDEOS).filter((v) => v.take === 'female')).toHaveLength(1);
  });

  it("matches by exact name only: a near name or another of Progresso's names gets nothing", () => {
    // "Front Squat" is the repository's "Barbell Front Squat" by an alias only; Plank its "Front Plank".
    expect(BUILTIN_CATALOG['bb-front-squat']).toBeDefined();
    expect(BUILTIN_CATALOG['bw-plank']).toBeDefined();
    expect(EXERCISE_VIDEOS['bb-front-squat']).toBeUndefined();
    expect(EXERCISE_VIDEOS['bw-plank']).toBeUndefined();
    // Every cable attachment stays without one: the repository has none of Progresso's by name.
    expect(Object.keys(EXERCISE_VIDEOS).some((slug) => slug.startsWith('cb-'))).toBe(false);
  });

  it('builds the addresses from where a provider serves them, the take never shown elsewhere', () => {
    const provider = repositoryLayoutProvider('Progresso Storage', 'https://cdn.example.com/x/');
    expect(exerciseVideoFor('bb-bench-press', provider)).toEqual({
      video: 'https://cdn.example.com/x/exercise-videos/male/barbell-bench-press.mp4',
      poster: 'https://cdn.example.com/x/exercise-posters/male/barbell-bench-press.jpg',
    });
    expect(exerciseVideoFor('cb-lat-pulldown-v-handle', provider)).toBeNull();
    expect(exerciseVideoFor(null, provider)).toBeNull();
  });
});
