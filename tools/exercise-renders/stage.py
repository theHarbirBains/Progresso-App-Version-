"""The studio every exercise is rendered in: Cycles on the GPU, soft key/fill/rim area lights, a
shadow-catching floor under a transparent background, AgX colour, and a camera placed from the
exercise's own view (the app's yaw and tilt) framed to fit everything in every phase."""
import math
import bpy
from mathutils import Vector


def gpu(scene):
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = 'GPU'
                return kind
        except TypeError:
            continue
    scene.cycles.device = 'CPU'
    return 'CPU'


def view_direction(view):
    """From the subject toward the camera, in Blender axes (the app's yaw: 0 side-on, -90 face-on)."""
    yaw, tilt = math.radians(view['yaw']), math.radians(view['tilt'])
    rig = (math.sin(-yaw) * math.cos(tilt), math.sin(tilt), math.cos(yaw) * math.cos(tilt))
    return Vector((rig[0], -rig[2], rig[1])).normalized()


def area(name, location, target, size, energy, colour=(1, 1, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.shape = 'DISK'
    data.size = size
    data.energy = energy
    data.color = colour
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    return obj


def world_coords(objects):
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objects:
        ev = o.evaluated_get(deps)
        mesh = ev.to_mesh()
        mw = ev.matrix_world
        step = max(1, len(mesh.vertices) // 4000)
        pts.extend(mw @ mesh.vertices[i].co for i in range(0, len(mesh.vertices), step))
        ev.to_mesh_clear()
    return pts


def setup(view, coords, preview=False, size=1000):
    """The studio, its lights and camera placed around `coords` (every point to be framed)."""
    scene = bpy.context.scene
    device = gpu(scene)
    scene.cycles.samples = 48 if preview else 256
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass

    world = bpy.data.worlds.new('studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.06, 0.06, 0.065, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    scene.world = world

    lo = Vector((min(p.x for p in coords), min(p.y for p in coords), min(p.z for p in coords)))
    hi = Vector((max(p.x for p in coords), max(p.y for p in coords), max(p.z for p in coords)))
    centre = (lo + hi) / 2
    span = (hi - lo).length

    # The floor: catches shadows only, so the picture stays transparent with its contact shadows.
    bpy.ops.mesh.primitive_plane_add(size=span * 6, location=(centre.x, centre.y, lo.z - 0.001))
    floor = bpy.context.active_object
    floor.is_shadow_catcher = True

    d = view_direction(view)
    side = d.cross(Vector((0, 0, 1))).normalized()
    key = centre + (d * 1.0 + side * 1.1 + Vector((0, 0, 1.4))).normalized() * span * 1.6
    fill = centre + (d * 1.0 - side * 1.3 + Vector((0, 0, 0.4))).normalized() * span * 1.7
    rim = centre + (-d * 1.2 + side * 0.4 + Vector((0, 0, 1.0))).normalized() * span * 1.5
    area('key', key, centre, span * 0.9, 110 * span * span, (1.0, 0.97, 0.93))
    area('fill', fill, centre, span * 1.2, 35 * span * span, (0.92, 0.95, 1.0))
    area('rim', rim, centre, span * 0.6, 90 * span * span, (1.0, 0.96, 0.9))

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    loc, _ = cam.camera_fit_coords(bpy.context.evaluated_depsgraph_get(), [c for p in coords for c in p])
    cam.location = centre + (Vector(loc) - centre) * 1.1
    return device
