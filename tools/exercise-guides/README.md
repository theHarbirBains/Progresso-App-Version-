# Exercise guides: 3D demonstration videos

The pipeline behind the exercise guides' looping 3D demonstrations (Harbir's brief, 2026-11-26):
one consistent faceless anatomical character, reusable rig, equipment and movement templates,
one studio, rendered to an MP4 per exercise that the guide plays muted, inline and on a loop.

**Pilot: one exercise only** -- `pl-t-bar-row-upper`, Chest-Supported T-Bar Row — Upper Handles
(Pronated Grip). The rest of the library waits until the pilot is approved.

## How it fits together

1. **Metadata from the catalogue.** Each exercise's identity -- its slug, name, muscle groups,
   movement pattern, grip and attachment -- is read from `supabase/catalog` (the source of truth),
   never typed here. Different grips and handle sets are different exercises there already
   (`pl-t-bar-row` diagonal handles, `pl-t-bar-row-upper` upper handles).
2. **A movement template per pattern** picks the machine, where the person stands or lies, which
   handles the hands take and how the lever moves through a rep. An exercise with no template is
   **flagged for custom animation**, never rendered with the wrong one.
3. **Equipment** is modelled once and parameterised (`machines/`), built from the render
   pipeline's own parts (`tools/exercise-renders/equipment.py`) in the general look of gym
   equipment, no brand's. Every point a movement needs -- where each handle is, its direction --
   is a function of the machine's state, so the hands always meet the handles.
4. **The character** is posed to the template frame by frame: the torso on the pad, the feet on
   the plates, the arms solved to the handles with natural elbow paths.
5. **One studio** (`studio.py`): the render pipeline's lights and colour, on the app's charcoal.
6. **Render and publish**: the frames to an H.264 MP4 that loops seamlessly (the last frame leads
   into the first), its poster frame, and the asset reference the app reads.
7. **Quality checks** before publishing: the handles' orientation (the upper handles level with
   the floor), the grip (overhand on the upper handles), joint angles within natural limits, no
   part of the body through the machine, the loop's first and last frames matching.

## Status

| Part | State |
| --- | --- |
| The exercise split (`pl-t-bar-row` / `pl-t-bar-row-upper`) | Done: catalogue, guide, tips, drawing; migration `20261222100000` applied. |
| Chest-supported T-bar row machine (`machines/chest_supported_t_bar.py`) | First pass: frame, chest pad on two posts, split foot plates, rear-pivot lever between the feet, yoke with the upper bar (level with the floor at every angle) and the diagonal handles, plate horn, rubber stop. `preview_machine.py` renders it at rest and at the top. |
| Equipment picture (`equipment_still.py`) | Done for the pilot: the machine alone, transparent, the upper handles' grips in amber -- Equipment & Details' picture. |
| Publishing (`publish.py`, `demos.json`) | Done: writes the app's `exerciseDemos.generated.ts` from what's in `apps/mobile/assets/exercise-guides/<slug>/`; a video whose `qc.json` didn't pass is left out and flagged. |
| Guide screen (How To / Muscles / Tips) | Done, from Harbir's screenshots: `apps/mobile/src/exercises/guide/ExerciseDemoGuide.tsx`. Shows the drawing where the video goes until it's rendered. |
| Character | **Waiting on Harbir's faceless anatomical model** (to be rigged here). |
| Movement template, animation, MP4, step stills, QC | Next, once the character is in. The render writes `demo.mp4`, `demo.json`, `poster.webp`, `step-1..4.webp` and `qc.json` into the exercise's assets folder, then `publish.py`. |

## Running it

```bash
"<blender>" -b -P tools/exercise-guides/preview_machine.py -- tools/exercise-guides/work/machine [preview]
"<blender>" -b -P tools/exercise-guides/equipment_still.py -- pl-t-bar-row-upper
python tools/exercise-guides/publish.py
```

Blender 4.5 LTS, as the render pipeline uses (see its README for where it lives on this machine).
`work/` is never committed.
