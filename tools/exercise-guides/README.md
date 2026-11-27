# Exercise guides: demonstration videos

The Exercise Guide (`apps/mobile/src/exercises/guide/ExerciseDemoGuide.tsx`, Harbir's design,
November 2026) plays an exercise's demonstration video at its top, muted, inline and on a loop.
**The videos are Harbir's licensed videos, to be added later** -- nothing is rendered or generated
here (a 3D character pipeline was started and dropped at his call, 2026-11-27). Only add a video
whose licence covers showing it in the app.

**Pilot: one exercise** -- `pl-t-bar-row-upper`, Chest-Supported T-Bar Row — Upper Handles
(Pronated Grip). The rest of the library waits until the pilot is approved. Until it has a video,
the guide shows the exercise's own picture where the video goes.

## Adding a video

1. Put the files in `apps/mobile/assets/exercise-guides/<slug>/`:
   - `demo.mp4` -- the video (H.264); and `demo.json` -- `{"seconds": 18.0, "width": 1080, "height": 720, "audio": false}`
   - optionally `poster.webp` (its first frame), `step-1.webp`... (a still for each Step-by-Step
     step) and `equipment.webp` (the machine, for Equipment & Details)
2. List the slug in `demos.json` (it must be an active built-in).
3. Run `python tools/exercise-guides/publish.py`, which writes the app's
   `exerciseDemos.generated.ts` (never edit that by hand).

Sound is offered only for a video with `"audio": true`.
