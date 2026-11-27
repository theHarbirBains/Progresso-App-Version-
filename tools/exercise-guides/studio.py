"""The exercise guides' studio: the render pipeline's (tools/exercise-renders/stage.py) -- Cycles on
the GPU, soft key / fill / rim area lights, AgX colour, a shadow-catching floor -- with the camera
placed from a direction in Blender's own axes, and a dark backdrop to match the app's charcoal
instead of a transparent one (a video can't be transparent)."""
import bpy
from mathutils import Vector

from stage import area, gpu, world_coords  # noqa: F401  (re-exported for the scripts)

# The app's charcoal (colors.surface, #1C1916), as a linear colour for the backdrop.
CHARCOAL = (0.0116, 0.0103, 0.0080)


def setup(direction, coords, preview=False, size=(1080, 1080), lens=60, samples=None,
          transparent=False):
    """The studio, its lights and camera, framing every point in `coords` from `direction`
    (subject toward camera, Blender axes). `transparent`: a still for a card (the equipment
    picture) -- no backdrop, the floor only catching shadows."""
    scene = bpy.context.scene
    device = gpu(scene)
    scene.cycles.samples = samples or (48 if preview else 192)
    scene.cycles.use_denoising = True
    scene.render.film_transparent = transparent
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass

    world = bpy.data.worlds.new('studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (*CHARCOAL, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    scene.world = world

    lo = Vector((min(p.x for p in coords), min(p.y for p in coords), min(p.z for p in coords)))
    hi = Vector((max(p.x for p in coords), max(p.y for p in coords), max(p.z for p in coords)))
    centre = (lo + hi) / 2
    span = (hi - lo).length

    # A matte floor in the backdrop's colour, so the machine stands on something with its shadows.
    bpy.ops.mesh.primitive_plane_add(size=span * 8, location=(centre.x, centre.y, 0.0))
    floor = bpy.context.active_object
    mat = bpy.data.materials.new('floor')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.016, 0.0145, 0.012, 1)
    bsdf.inputs['Roughness'].default_value = 0.85
    floor.data.materials.append(mat)
    floor.is_shadow_catcher = transparent

    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1))).normalized()
    key = centre + (d * 1.0 + side * 1.1 + Vector((0, 0, 1.4))).normalized() * span * 1.6
    fill = centre + (d * 1.0 - side * 1.3 + Vector((0, 0, 0.4))).normalized() * span * 1.7
    rim = centre + (-d * 1.2 + side * 0.4 + Vector((0, 0, 1.0))).normalized() * span * 1.5
    area('key', key, centre, span * 0.9, 110 * span * span, (1.0, 0.97, 0.93))
    area('fill', fill, centre, span * 1.2, 35 * span * span, (0.92, 0.95, 1.0))
    area('rim', rim, centre, span * 0.6, 90 * span * span, (1.0, 0.96, 0.9))

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = lens
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    loc, _ = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), [c for p in coords for c in p])
    cam.location = centre + (Vector(loc) - centre) * 1.12
    return device
