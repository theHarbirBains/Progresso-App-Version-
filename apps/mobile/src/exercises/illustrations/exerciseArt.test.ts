import { BUILTIN_CATALOG } from './builtinCatalog.generated';
import {
  EXERCISE_ART,
  frameLabels,
  hasIllustration,
  illustrationFor,
  thumbnailFor,
} from './exerciseArt';
import { MUSCLE_REGIONS, REGION_GROUP } from './muscles';
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
        // The primary muscles show in every frame.
        expect(frame.shapes.some((shape) => shape.fill === ART.primary)).toBe(true);
      }
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

  it('names the positions under each frame', () => {
    expect(frameLabels(1)).toEqual(['Hold']);
    expect(frameLabels(2)).toEqual(['Start', 'Finish']);
    expect(frameLabels(3)).toEqual(['Start', 'Step 2', 'Finish']);
  });
});
