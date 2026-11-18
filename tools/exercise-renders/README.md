# Exercise renders: the 3D illustration pipeline

Renders a built-in exercise's How to Do It phases as photoreal 3D images in Blender and
publishes them to the app. Proof of concept: **Dumbbell Bench Press**, **Leg Press** and
**Chest-Supported T-Bar Row** (`proof-of-concept.png`). Every other built-in still shows its drawing
until it's rendered.

## How it works

1. **Poses come from the app.** `export_poses.mjs` solves each exercise's own poses
   (`apps/mobile/src/exercises/illustrations/art/*.ts`, the same ones the drawings use) into
   joint positions per frame: pelvis, spine and head frames, shoulders, elbows, wrists, hips,
   knees, ankles and soles.
2. **A rigged human is posed to them** (`avatar.py`). The avatar is Microsoft Rocketbox
   `Sports_Male_04` (MIT). It's scaled to the app's proportions, the torso is set bone by bone
   from the pose's frames, the arms and legs are solved by a two-bone IK written here (the
   rig's bone tails don't point at their joints, so Blender's own IK aims at the wrong point),
   bending toward the pose's own elbows and knees. The wrists are straight, the palms face the
   way the grip needs, the feet lie along the soles and the fingers close into a fist. Free weights use the avatar's
   own arm length (so a press locks out); a machine's handles are reached exactly.
3. **The equipment is modelled around it** (`equipment.py`): bevelled steel tubing, upholstered
   pads with a leather grain, knurled chrome handles, hex rubber dumbbells, bumper plates on
   chrome horns, a ridged foot plate. It's laid out from the app's own equipment positions. Parts
   that move with the body (dumbbells, the leg press sled, the T-bar lever) are rebuilt for each
   phase.
4. **One studio for everything** (`stage.py`): Cycles on the GPU (OptiX), soft key / fill / rim area
   lights, a shadow-catching floor under a transparent background, AgX colour, a 70 mm camera from
   the exercise's own view (the app's yaw and tilt), framed to fit every phase identically.
5. **Publish** (`publish.py`): each 1000 px PNG becomes a 720 px WebP (55-75 KB) in
   `apps/mobile/assets/exercise-renders/`, and `renders.generated.ts` maps the slug to its frames.
   The app (`RenderedPhases.tsx`) shows them in How to Do It, stepping through the three phases.
   The list thumbnails use them too.

## Running it

```bash
# once: Blender 4.5 LTS (portable zip from download.blender.org) in a SHORT path -- Windows'
# 260-character limit breaks Blender's bundled numpy in a deep one.
bash tools/exercise-renders/fetch_assets.sh              # the avatar, into work/ (git-ignored)
node --import ./tools/exercise-renders/hooks.mjs tools/exercise-renders/export_poses.mjs \
  tools/exercise-renders/work/poses.json db-bench-press pl-leg-press pl-t-bar-row
"<blender>" -b -P tools/exercise-renders/render_exercise.py -- db-bench-press tools/exercise-renders/work/out
python tools/exercise-renders/publish.py tools/exercise-renders/work/out
```

Add `preview` after the output folder for a quick 48-sample render. On an RTX 2060 Super a final
render (384 samples, denoised) takes about 27 s per exercise for both frames, so the whole library
would take about 2.5 hours.

## What's still needed for the whole library

- **Equipment per exercise.** `equipment.py` models three setups. The library needs about 60
  distinct machines and every cable attachment (`EXERCISES` in `render_exercise.py` and a builder
  each). Accurate machines are the long pole: model them here from reference photos, or license them (below).
- **Hosting.** At around 130 KB per exercise, the library is about 40 MB: too much to bundle. Host
  the WebPs (Supabase Storage or a CDN) and point `renders.generated.ts` (or `exercises.illustration_url`)
  at URLs; `expo-image` caches them on disk.
- **The anatomy figure** is still the app's own drawing (front and back, primary and secondary).
  Z-Anatomy (below) could replace it with rendered anatomy.

## Sources and licences

| Source | What | Licence | Use here |
| --- | --- | --- | --- |
| [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) | 115 rigged, realistic humans, incl. sportswear | MIT (since 2020) | **Used.** Keep its copyright notice with the app's credits. |
| [Blender](https://www.blender.org) | Modelling, posing, rendering | GPL (renders aren't covered) | **Used.** |
| [Adobe Mixamo](https://www.mixamo.com) | Rigged characters + animations | Free, royalty-free in projects; no redistributing the raw files | Needs an Adobe login; its characters are less realistic than Rocketbox. |
| [MPFB2 / MakeHuman](https://extensions.blender.org/add-ons/mpfb/) | Procedural realistic humans in Blender | Code GPL; assets and exports CC0 | Good alternative or companion (custom body types). |
| [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) | Full muscle anatomy in Blender | CC BY-SA 4.0 (some parts CC BY-NC) | Possible for the anatomy figure. Attribution, share-alike on adapted renders, and the NC parts must be left out. |
| [CGTrader](https://www.cgtrader.com) / [TurboSquid](https://www.turbosquid.com/licensing) | Paid gym machine models | Royalty-free: renders OK, never the files; "Editorial" or branded models restricted | Best route to accurate machines. Paid; needs approval. |
| [Reallusion Character Creator](https://www.reallusion.com/license/content.html) / Daz 3D | Premium realistic humans | Paid; renders under the standard licence | Highest realism; paid. |
| [CADdetails](https://www.caddetails.com/Content/PDF/TermsOfUse.pdf), Life Fitness / Technogym BIM ([BIMobject](https://www.bimobject.com/en/life-fitness)) | Manufacturer CAD/BIM | Personal or design use; redistribution needs written permission | Reference for dimensions only. Real brands' machines would also raise trademark questions. |
