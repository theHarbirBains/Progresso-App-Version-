# Exercise renders: the 3D illustration pipeline

Renders every active built-in exercise's How to Do It phases as photoreal 3D images in Blender and
publishes them to the app (`proof-of-concept.png` is the first three). An exercise without a render
keeps its drawing.

## How it works

1. **Poses and equipment come from the app.** `export_poses.mjs` solves each exercise's own poses
   (`apps/mobile/src/exercises/illustrations/art/*.ts`, the same ones the drawings use) into joint
   positions per frame -- pelvis, spine and head frames, shoulders, elbows, wrists, hips, knees,
   ankles and soles -- and records the equipment the app lays out around them as 3D solids (every
   box, cylinder and ball, with its material: `recordSolids` in `props.ts`), with the exercise's
   view, phases and grip, into `work/library.json`.
2. **A rigged human is posed to them** (`avatar.py`). The avatar is Microsoft Rocketbox
   `Sports_Male_04` (MIT). It's scaled to the app's hip height, the torso is set bone by bone
   from the pose's frames, the arms and legs are solved by a two-bone IK written here (the
   rig's bone tails don't point at their joints, so Blender's own IK aims at the wrong point),
   bending toward the pose's own elbows and knees. The wrists are straight; a hand on a handle
   closes around it with its knuckles along the handle (overhand, underhand or neutral, from the
   catalogue's grip), a hand on the floor lies flat, and the feet lie along the soles.
3. **The equipment is built around it.** The three proof-of-concept exercises have hand-modelled
   setups (`equipment.py`); every other exercise's equipment is rebuilt from the app's solids
   (`generic.py`): black powder-coated steel frames, upholstered pads, chrome bars and handles,
   iron plates, steel cable, rope, strap, a rubber mat, a wooden box -- the general look of gym
   equipment, no brand's.
4. **The hands, and what they hold, are kept clear of the body** (`clearance.py`). The avatar is
   fuller in the chest, back and thighs than the app's slim figure, so a bar the app rests on the
   upper back or against the thighs would sit inside it. A grip nearer the body than a hand around
   a handle allows is moved straight out, with everything it holds (a bar's plates, a dumbbell's
   heads); a cable, band or strap stretches from its anchor; a machine's levers never move.
5. **One studio for everything** (`stage.py`): Cycles on the GPU (OptiX), soft key / fill / rim area
   lights, a shadow-catching floor under a transparent background, AgX colour, a 70 mm camera from
   the exercise's own view (the app's yaw and tilt), framed to fit every phase identically.
   `render_exercise.py` also writes where the body is in each image (`<slug>.json`).
6. **Publish** (`publish.py`): each 1000 px PNG becomes a 720 px WebP, plus a 160 px thumbnail
   cropped to the body, in `apps/mobile/assets/exercise-renders/` (about 33 MB for the library,
   bundled with the app so it works offline); `renders.generated.ts` maps each slug to its frames,
   its thumbnail and where the hands, feet, knee, hips, torso and head are in each frame. The app
   shows them in How to Do It (its three phases, still, side by side -- `ExercisePhases`), the list
   thumbnails, and Technique & Setup's
   close-ups (cropped from the render around the part, `TechniqueVisuals.tsx`).

## Running it

```bash
# once: Blender 4.5 LTS (portable zip from download.blender.org) in a SHORT path -- Windows'
# 260-character limit breaks Blender's bundled numpy in a deep one.
bash tools/exercise-renders/fetch_assets.sh              # the avatar, into work/ (git-ignored)
node --import ./tools/exercise-renders/hooks.mjs tools/exercise-renders/export_poses.mjs   tools/exercise-renders/work/library.json                # every active built-in (or name slugs)
"<blender>" -b -P tools/exercise-renders/render_exercise.py -- tools/exercise-renders/work/final
python tools/exercise-renders/publish.py tools/exercise-renders/work/final
```

Name slugs after the output folder to render just those, and add `preview` for a quick 48-sample
render. An exercise already rendered is skipped, so a stopped run picks up where it left off;
delete an exercise's PNGs and JSON to render it again (after a pose or equipment change). On an
RTX 2060 Super a final render (256 samples, denoised) takes about 20 s per exercise, so the whole
library takes about two hours.

## Sources and licences

| Source                                                                                                                                                     | What                                           | Licence                                                                             | Use here                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox)                                                                                    | 115 rigged, realistic humans, incl. sportswear | MIT (since 2020)                                                                    | **Used.** Keep its copyright notice with the app's credits.                                                      |
| [Blender](https://www.blender.org)                                                                                                                         | Modelling, posing, rendering                   | GPL (renders aren't covered)                                                        | **Used.**                                                                                                        |
| [Adobe Mixamo](https://www.mixamo.com)                                                                                                                     | Rigged characters + animations                 | Free, royalty-free in projects; no redistributing the raw files                     | Needs an Adobe login; its characters are less realistic than Rocketbox.                                          |
| [MPFB2 / MakeHuman](https://extensions.blender.org/add-ons/mpfb/)                                                                                          | Procedural realistic humans in Blender         | Code GPL; assets and exports CC0                                                    | Good alternative or companion (custom body types).                                                               |
| [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)                                                                                          | Full muscle anatomy in Blender                 | CC BY-SA 4.0 (some parts CC BY-NC)                                                  | Possible for the anatomy figure. Attribution, share-alike on adapted renders, and the NC parts must be left out. |
| [CGTrader](https://www.cgtrader.com) / [TurboSquid](https://www.turbosquid.com/licensing)                                                                  | Paid gym machine models                        | Royalty-free: renders OK, never the files; "Editorial" or branded models restricted | Best route to accurate machines. Paid; needs approval.                                                           |
| [Reallusion Character Creator](https://www.reallusion.com/license/content.html) / Daz 3D                                                                   | Premium realistic humans                       | Paid; renders under the standard licence                                            | Highest realism; paid.                                                                                           |
| [CADdetails](https://www.caddetails.com/Content/PDF/TermsOfUse.pdf), Life Fitness / Technogym BIM ([BIMobject](https://www.bimobject.com/en/life-fitness)) | Manufacturer CAD/BIM                           | Personal or design use; redistribution needs written permission                     | Reference for dimensions only. Real brands' machines would also raise trademark questions.                       |
