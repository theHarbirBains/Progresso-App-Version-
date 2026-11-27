"""Renders an exercise's Equipment & Details picture: its machine alone, set up as the exercise uses
it, the handles it takes picked out in the accent, on a transparent background (it sits on a card).

    "<blender>" -b -P tools/exercise-guides/equipment_still.py -- SLUG [preview]

Writes apps/mobile/assets/exercise-guides/<SLUG>/equipment.webp; then run publish.py.
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, 'machines'), os.path.join(HERE, '..', 'exercise-renders')]

import chest_supported_t_bar  # noqa: E402
import studio  # noqa: E402
from mathutils import Vector  # noqa: E402

ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'apps', 'mobile', 'assets', 'exercise-guides'))
SIZE = 600

# Each exercise's machine and the handles it takes. An exercise not here has no picture yet.
EQUIPMENT = {
    'pl-t-bar-row-upper': (chest_supported_t_bar, ('upper',)),
}

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not args or args[0] not in EQUIPMENT:
    sys.exit(f'Which exercise? One of: {", ".join(sorted(EQUIPMENT))}')
slug = args[0]
preview = 'preview' in args
machine, marked = EQUIPMENT[slug]

bpy.ops.wm.read_factory_settings(use_empty=True)
machine.eq._MATS.clear()
objs = machine.build_static() + machine.build_lever(machine.REST_DEG, marked=marked)
pts = studio.world_coords(objs)
# Three-quarter view from the person's right, a little above, as the guide's demonstration.
studio.setup(Vector((0.55, -1.0, 0.42)), pts, preview=preview, size=(SIZE, SIZE), transparent=True)
scene = bpy.context.scene
# On a dark card a black machine is lost: brighter overall, and its edges caught by the rim light.
scene.view_settings.exposure = 1.3
bpy.data.objects['rim'].data.energy *= 2.5
scene.render.image_settings.file_format = 'WEBP'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.quality = 88
out = os.path.join(ASSETS, slug)
os.makedirs(out, exist_ok=True)
scene.render.filepath = os.path.join(out, 'equipment.webp')
bpy.ops.render.render(write_still=True)
print('wrote', scene.render.filepath)
