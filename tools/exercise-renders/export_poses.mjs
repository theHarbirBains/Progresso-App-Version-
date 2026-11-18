// node --import ./tools/exercise-renders/hooks.mjs tools/exercise-renders/export_poses.mjs <out.json> <slug...>
// Each exercise's solved skeleton per frame (the app's own poses), in the rig's units (cm, y up),
// for the Blender pipeline to drive a rigged avatar with.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'mobile', 'src', 'exercises', 'illustrations') + '/';
const art = await import(pathToFileURL(APP + 'exerciseArt.ts').href);
const { solvePose } = await import(pathToFileURL(APP + 'rig.ts').href);
const { DEFAULT_VIEW } = await import(pathToFileURL(APP + 'render.ts').href);
const [, , out, ...slugs] = process.argv;
const frameOf = (f) => ({ up: f.up, forward: f.forward, right: f.right });
const limb = (l) => ({ root: l.root, joint: l.joint, end: l.end, front: l.front });
const result = {};
for (const slug of slugs) {
  const spec = art.EXERCISE_ART[slug];
  const view = { ...DEFAULT_VIEW, ...spec.view };
  result[slug] = {
    view,
    labels: art.guidePhases(slug).map((p) => [p.label, p.frame]),
    frames: spec.frames.map((frame) => {
      const s = solvePose(frame.pose);
      return {
        pelvis: s.pelvis,
        hips: s.hips,
        shoulderCenter: s.shoulderCenter,
        shoulders: s.shoulders,
        neckBase: s.neckBase,
        head: s.head,
        headFrame: frameOf(s.headFrame),
        pelvisFrame: frameOf(s.pelvisFrame),
        chestFrame: frameOf(s.frameAt(0.85)),
        arms: { r: limb(s.arms.r), l: limb(s.arms.l) },
        legs: { r: limb(s.legs.r), l: limb(s.legs.l) },
        feet: s.feet,
      };
    }),
  };
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log('wrote', out, Object.keys(result).join(', '));
