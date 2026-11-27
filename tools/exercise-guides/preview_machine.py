"""Renders a machine on its own, for checking it before any character stands on it: the lever at
rest and at the top of a row, from the guides' camera.

    "<blender>" -b -P tools/exercise-guides/preview_machine.py -- OUT_DIR [preview]
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, 'machines'), os.path.join(HERE, '..', 'exercise-renders')]

import chest_supported_t_bar as machine  # noqa: E402
import studio  # noqa: E402
from mathutils import Vector  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = os.path.abspath(args[0] if args else os.path.join(HERE, 'work', 'machine'))
preview = 'preview' in args
os.makedirs(out, exist_ok=True)

for name, deg in (('rest', machine.REST_DEG), ('top', machine.TOP_DEG)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # The materials went with the scene: make them afresh.
    machine.eq._MATS.clear()
    static = machine.build_static()
    lever = machine.build_lever(deg)
    pts = studio.world_coords(static + lever)
    # Three-quarter view from the person's right, a little above.
    studio.setup(Vector((0.55, -1.0, 0.42)), pts, preview=preview, size=(1080, 1080))
    bpy.context.scene.render.filepath = os.path.join(out, f'machine_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('wrote', bpy.context.scene.render.filepath)
