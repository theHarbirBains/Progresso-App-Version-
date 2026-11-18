import { BUILTIN_CATALOG } from './builtinCatalog.generated';
import {
  EXERCISE_ART,
  frameLabels,
  hasIllustration,
  illustrationFor,
  muscleMapFor,
  thumbnailFor,
} from './exerciseArt';
import { legendNames, mapSide } from './muscleMap';
import { MUSCLE_REGIONS, REGION_GROUP, REGION_NAMES } from './muscles';
import { ART } from './palette';
import { renderScene } from './render';

const slugs = Object.keys(BUILTIN_CATALOG);

describe('the built-in exercise illustrations', () => {
  it('every built-in in the catalogue has an illustration, and none is drawn for anything else', () => {
    expect(slugs.filter((slug) => !(slug in EXERCISE_ART))).toEqual([]);
    expect(Object.keys(EXERCISE_ART).filter((slug) => !(slug in BUILTIN_CATALOG))).toEqual([]);
    expect(slugs).toHaveLength(194);
  });

  it.each(slugs)(
    '%s draws cleanly: every hand and foot reaches, no broken numbers, its muscles highlighted',
    (slug) => {
      const scene = renderScene(EXERCISE_ART[slug], BUILTIN_CATALOG[slug].highlight);
      expect(scene.warnings).toEqual([]);
      expect(scene.frames.length).toBeGreaterThan(0);
      for (const value of Object.values(scene.viewBox)) expect(Number.isFinite(value)).toBe(true);
      for (const frame of scene.frames) {
        for (const shape of frame.shapes) expect(shape.d).not.toMatch(/NaN|Infinity/);
        // The instructor is drawn plain: the muscles are on the anatomy figure beside it.
        expect(frame.shapes.some((shape) => shape.fill === ART.primary)).toBe(false);
      }
      // The anatomy figure shows every primary muscle group, in red, in at least one view.
      const map = muscleMapFor(slug);
      expect(map?.views.length).toBeGreaterThan(0);
      expect(
        map?.views.some((view) => view.frame.shapes.some((shape) => shape.fill === ART.primary)),
      ).toBe(true);
      expect(map?.primary[0]).toBe(BUILTIN_CATALOG[slug].muscle);
    },
  );

  it('no two exercises share the same illustration', () => {
    const seen = new Map<string, string>();
    for (const slug of slugs) {
      const drawn = renderScene(EXERCISE_ART[slug], BUILTIN_CATALOG[slug].highlight)
        .frames.map((frame) => frame.shapes.map((shape) => shape.d).join(''))
        .join('|');
      expect(seen.get(drawn)).toBeUndefined();
      seen.set(drawn, slug);
    }
  });

  it("highlights agree with the catalogue's muscle groups: what it also works is every highlighted group but its own", () => {
    for (const slug of slugs) {
      const entry = BUILTIN_CATALOG[slug];
      for (const region of [...entry.highlight.primary, ...entry.highlight.secondary]) {
        expect(MUSCLE_REGIONS).toContain(region);
      }
      const groups = new Set(
        [...entry.highlight.primary, ...entry.highlight.secondary].map((r) => REGION_GROUP[r]),
      );
      groups.delete(entry.muscle as never);
      expect([...groups].sort()).toEqual([...entry.secondaryGroups].sort());
    }
  });

  it('draws each illustration once, and a thumbnail as its last position alone', () => {
    const full = illustrationFor('db-bench-press');
    expect(illustrationFor('db-bench-press')).toBe(full);
    const thumb = thumbnailFor('db-bench-press');
    expect(thumb?.frames).toHaveLength(1);
    expect(illustrationFor('my-own-press')).toBeNull();
    expect(hasIllustration(null)).toBe(false);
    expect(hasIllustration('bb-deadlift')).toBe(true);
  });

  it('names each position: the start, then what the movement does', () => {
    expect(frameLabels('db-bench-press')).toEqual(['Start', 'Press']);
    expect(frameLabels('db-single-arm-row')).toEqual(['Start', 'Row']);
    expect(frameLabels('db-romanian-deadlift')).toEqual(['Start', 'Hinge']);
    expect(frameLabels('bb-deadlift')).toEqual(['Start', 'Lift']);
    expect(frameLabels('db-goblet-squat')).toEqual(['Start', 'Squat']);
    expect(frameLabels('db-skull-crusher')).toEqual(['Start', 'Lower']);
    expect(frameLabels('bb-push-press')).toEqual(['Start', 'Dip', 'Press']);
    expect(frameLabels('db-static-hold')).toEqual(['Hold']);
    expect(frameLabels('my-own-press')).toEqual([]);
    // Every exercise has one name for each of its positions, never a placeholder.
    for (const slug of slugs) {
      const labels = frameLabels(slug);
      expect(labels).toHaveLength(EXERCISE_ART[slug].frames.length);
      for (const label of labels) expect(label).not.toMatch(/^(Finish|Step \d+)$/);
    }
  });

  it('shows the anatomy figure head to toe, from the side most of the primary muscles are on', () => {
    expect(mapSide({ primary: ['chest'], secondary: ['triceps'] })).toBe('front');
    expect(mapSide({ primary: ['hamstrings', 'glutes'], secondary: [] })).toBe('back');
    expect(mapSide({ primary: ['quads', 'glutes'], secondary: ['adductors'] })).toBe('front');
    expect(mapSide({ primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lowerBack'] })).toBe(
      'back',
    );
    expect(muscleMapFor('db-romanian-deadlift')?.views.map((v) => v.side)).toEqual(['back']);
  });

  it("names the key's muscles one per line, its own muscle group first", () => {
    expect(muscleMapFor('db-incline-bench-press')?.primaryNames).toEqual(['Chest (Upper)']);
    expect(muscleMapFor('db-decline-bench-press')?.primaryNames).toEqual(['Chest (Lower)']);
    expect(muscleMapFor('db-bench-press')).toMatchObject({
      primaryNames: ['Chest'],
      secondaryNames: ['Shoulders', 'Triceps'],
    });
    // The front and side delts together are the shoulders.
    expect(
      legendNames({ primary: ['frontDelts', 'sideDelts'], secondary: [] }, 'shoulders', 'Press'),
    ).toEqual({ primary: ['Shoulders'], secondary: [] });
    // A muscle named as primary isn't named again as secondary.
    expect(
      legendNames({ primary: ['lats'], secondary: ['lats', 'biceps'] }, 'back', 'Row').secondary,
    ).toEqual(['Biceps']);
    for (const slug of slugs) {
      const map = muscleMapFor(slug);
      const entry = BUILTIN_CATALOG[slug];
      // "Chest (Upper)" is the chest, and the front and side delts together "Shoulders".
      const own = entry.highlight.primary
        .filter((r) => REGION_GROUP[r] === entry.muscle)
        .map((r) => REGION_NAMES[r].split(' (')[0]);
      expect(own.some((name) => map?.primaryNames[0].startsWith(name))).toBe(true);
    }
  });
});
