// node --import ./tools/exercise-renders/hooks.mjs tools/exercise-renders/export_poses.mjs <out.json> [slug...]
// Every active built-in (or just the slugs given): each frame's solved skeleton (the app's own
// poses, cm, y up), the equipment the app builds around it as 3D solids (boxes, cylinders, balls
// with their material), its view, its phases and how its hands hold on -- for the Blender pipeline.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = join(ROOT, 'apps', 'mobile', 'src', 'exercises', 'illustrations') + '/';
const CATALOG = join(ROOT, 'supabase', 'catalog') + '/';
const imp = (p) => import(pathToFileURL(p).href);
const art = await imp(APP + 'exerciseArt.ts');
const { solvePose } = await imp(APP + 'rig.ts');
const { DEFAULT_VIEW, renderScene } = await imp(APP + 'render.ts');
const { recordSolids } = await imp(APP + 'props.ts');
const { MATERIALS } = await imp(APP + 'palette.ts');
const { BUILTIN_GUIDES } = await imp(APP + 'builtinGuides.generated.ts');
const { BUILTIN_CATALOG } = await imp(APP + 'builtinCatalog.generated.ts');
const { gripOf } = await imp(CATALOG + 'technique.mjs');
let catalogue = [];
for (const f of [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'smith',
  'kettlebell',
  'bodyweight',
  'accessories',
]) {
  catalogue = catalogue.concat((await imp(CATALOG + f + '.mjs')).default);
}

const [, , out, ...asked] = process.argv;
const slugs = asked.length ? asked : Object.keys(BUILTIN_GUIDES);
const materialName = new Map(Object.entries(MATERIALS).map(([k, v]) => [v, k]));
const frameOf = (f) => ({ up: f.up, forward: f.forward, right: f.right });
const limb = (l) => ({ root: l.root, joint: l.joint, end: l.end, front: l.front });

/** How the hands hold on: the catalogue's grip, its name's, else the movement's usual one. */
function handGrip(ex) {
  const [g] = gripOf(ex);
  if (g) return g === 'angled' ? 'overhand' : g;
  if (ex.pattern === 'curl') return 'underhand';
  if (
    ['dumbbell', 'kettlebell'].includes(ex.equipment) &&
    ['horizontal_pull', 'shrug', 'carry', 'lunge', 'squat', 'hinge', 'calf_raise'].includes(
      ex.pattern,
    )
  )
    return 'neutral';
  return 'overhand';
}

const result = {};
for (const slug of slugs) {
  const spec = art.EXERCISE_ART[slug];
  const ex = catalogue.find((e) => e.slug === slug);
  if (!spec || !ex) continue;
  const view = { ...DEFAULT_VIEW, ...spec.view };
  const frames = spec.frames.map((frame) => {
    const solids = [];
    recordSolids((s) => {
      if (s.kind === 'box')
        solids.push({
          kind: 'box',
          center: s.center,
          axes: s.axes,
          top: s.colors.top,
          front: s.colors.front,
        });
      else solids.push({ ...s, side: materialName.get(s.side) ?? 'other' });
    });
    renderScene({ ...spec, frames: [frame] }, BUILTIN_CATALOG[slug].highlight, { flat: true });
    recordSolids(null);
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
      solids,
    };
  });
  result[slug] = {
    name: ex.name,
    equipment: ex.equipment,
    pattern: ex.pattern,
    grip: handGrip(ex),
    view,
    labels: art.guidePhases(slug).map((p) => [p.label, p.frame]),
    frames,
  };
}
writeFileSync(out, JSON.stringify(result));
console.log('wrote', out, Object.keys(result).length, 'exercises');
