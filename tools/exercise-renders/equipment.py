"""Gym equipment, modelled in Blender: bevelled steel tubing, upholstered pads with a leather grain,
knurled chrome handles, hex rubber dumbbells, bumper plates on chrome horns, a ridged foot plate.
Laid out from the app's own equipment positions (art/*.ts) so it fits the poses."""
import math
import bmesh
import bpy
from mathutils import Matrix, Vector

from avatar import bl, bl_dir

_MATS = {}


def material(name):
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    b = nodes['Principled BSDF']
    spec = {
        'frame': dict(base=(0.018, 0.019, 0.021), metal=0.55, rough=0.36, coat=0.35),
        'chrome': dict(base=(0.82, 0.83, 0.85), metal=1.0, rough=0.13),
        'knurl': dict(base=(0.62, 0.63, 0.65), metal=1.0, rough=0.42, bump=('noise', 900.0, 0.35)),
        'pad': dict(base=(0.016, 0.016, 0.018), rough=0.5, coat=0.08, bump=('noise', 260.0, 0.12)),
        'rubber': dict(base=(0.022, 0.022, 0.024), rough=0.86),
        'plate': dict(base=(0.03, 0.03, 0.032), rough=0.72),
        'tread': dict(base=(0.03, 0.03, 0.033), metal=0.3, rough=0.6, bump=('wave', 60.0, 0.5)),
        'accent': dict(base=(0.75, 0.42, 0.12), metal=0.2, rough=0.35),
        # The rest of the gym (generic.py): cast iron, braided rope, nylon strap, a wooden box, a
        # rubber floor mat, steel cable.
        'iron': dict(base=(0.035, 0.035, 0.038), metal=0.6, rough=0.45),
        'rope': dict(base=(0.025, 0.025, 0.027), rough=0.9, bump=('wave', 140.0, 0.6)),
        'strap': dict(base=(0.03, 0.03, 0.034), rough=0.75, bump=('wave', 300.0, 0.3)),
        'wood': dict(base=(0.32, 0.2, 0.11), rough=0.6, bump=('noise', 40.0, 0.15)),
        'mat': dict(base=(0.045, 0.046, 0.05), rough=0.92, bump=('noise', 180.0, 0.25)),
        'cable': dict(base=(0.25, 0.26, 0.28), metal=1.0, rough=0.35),
    }[name]
    b.inputs['Base Color'].default_value = (*spec['base'], 1)
    b.inputs['Metallic'].default_value = spec.get('metal', 0.0)
    b.inputs['Roughness'].default_value = spec['rough']
    b.inputs['Coat Weight'].default_value = spec.get('coat', 0.0)
    if 'bump' in spec:
        kind, scale, strength = spec['bump']
        tex = nodes.new('ShaderNodeTexNoise' if kind == 'noise' else 'ShaderNodeTexWave')
        tex.inputs['Scale'].default_value = scale
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = strength
        bump.inputs['Distance'].default_value = 0.001
        links.new(tex.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], b.inputs['Normal'])
    _MATS[name] = m
    return m


def _finish(name, bm, mat, bevel=0.0, segments=3, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material(mat))
    if bevel > 0:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.harden_normals = False
    for poly in obj.data.polygons:
        poly.use_smooth = smooth
    return obj


def box(name, centre, axes, half, mat='frame', bevel=0.006, segments=3):
    """A box at `centre` (m) with its three axes (unit vectors) and half sizes along them."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    m = Matrix((axes[0] * half[0], axes[1] * half[1], axes[2] * half[2])).transposed().to_4x4()
    m.translation = centre
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _finish(name, bm, mat, bevel, segments)


def cylinder(name, a, b, r, mat='chrome', segments=40, bevel=0.0015, sides=None):
    """A cylinder (or, with `sides`, a prism -- a hex dumbbell head) from `a` to `b`."""
    a, b = Vector(a), Vector(b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides or segments, radius1=r, radius2=r, depth=(b - a).length)
    rot = (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    rot.translation = (a + b) / 2
    bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    return _finish(name, bm, mat, bevel, 2, smooth=sides is None)


def tube(name, a, b, half=0.025, mat='frame'):
    """Square steel tubing from `a` to `b`, edges rounded."""
    a, b = Vector(a), Vector(b)
    u = (b - a).normalized()
    v = u.orthogonal().normalized()
    if abs(u.z) < 0.9:
        v = u.cross(Vector((0, 0, 1))).normalized()
    w = u.cross(v)
    return box(name, (a + b) / 2, (u, v, w), ((b - a).length / 2 + half, half, half), mat, bevel=half * 0.35)


def pad(name, centre, axes, half):
    """An upholstered pad: generously rounded edges, a stitched-leather grain."""
    return box(name, centre, axes, half, 'pad', bevel=min(half) * 0.9, segments=6)


def rig_axes(tilt_deg):
    """A pad's axes in the app (tipped `tilt` degrees about its left-right axis), in Blender."""
    t = math.radians(tilt_deg)
    return (bl_dir((math.cos(t), math.sin(t), 0)), bl_dir((-math.sin(t), math.cos(t), 0)), bl_dir((0, 0, 1)))


def plate(name, centre, axis, r=0.225, thick=0.045):
    """A bumper plate on a horn: rubber disc, raised rim, chrome hub."""
    axis = Vector(axis).normalized()
    c = Vector(centre)
    cylinder(name, c - axis * thick / 2, c + axis * thick / 2, r, 'plate', segments=64, bevel=0.006)
    cylinder(name + '_rim', c - axis * (thick / 2 + 0.004), c + axis * (thick / 2 + 0.004), r * 0.42, 'plate', 48, 0.004)
    cylinder(name + '_hub', c - axis * (thick / 2 + 0.008), c + axis * (thick / 2 + 0.008), 0.045, 'chrome', 32, 0.003)


# ------------------------------------------------------------------------------- The equipment

def dumbbell(name, centre, axis, head_r=0.072):
    """A hex dumbbell: knurled chrome handle, rubber hex heads with chrome end caps."""
    axis = Vector(axis).normalized()
    c = Vector(centre)
    cylinder(name + '_handle', c - axis * 0.075, c + axis * 0.075, 0.0165, 'knurl', 32)
    for sign in (-1, 1):
        inner = c + axis * sign * 0.072
        outer = c + axis * sign * 0.145
        cylinder(name + f'_head{sign}', inner, outer, head_r, 'rubber', bevel=0.008, sides=6)
        cylinder(name + f'_cap{sign}', outer, outer + axis * sign * 0.006, head_r * 0.55, 'chrome', 6, 0.002)


def flat_bench(top_z, x_head, x_foot):
    """A flat bench: a long upholstered pad on a steel spine, two legs on wide rubber-capped feet."""
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    mid = (x_head + x_foot) / 2
    half_len = abs(x_foot - x_head) / 2
    pad('bench_pad', Vector((mid, 0, top_z - 0.045)), (X, Y, Z), (half_len, 0.145, 0.045))
    tube('bench_spine', (x_head + 0.12, 0, top_z - 0.13), (x_foot - 0.12, 0, top_z - 0.13), 0.035)
    for x in (x_head + 0.16, x_foot - 0.16):
        tube(f'bench_leg_{x:.2f}', (x, 0, top_z - 0.13), (x, 0, 0.035), 0.032)
        tube(f'bench_foot_{x:.2f}', (x, -0.25, 0.03), (x, 0.25, 0.03), 0.03)
        for y in (-0.27, 0.27):
            box(f'bench_cap_{x:.2f}_{y}', Vector((x, y, 0.03)), (X, Y, Z), (0.035, 0.022, 0.035), 'rubber', 0.008)


def leg_press_static():
    """The 45-degree leg press's fixed parts: the reclined seat and back pad, the base frame, the
    rails up to the rear post, the side handles."""
    pad('lp_back', bl((-36, 44, 0)), rig_axes(152), (0.30, 0.045, 0.21))
    pad('lp_seat', bl((-2, 30, 0)), rig_axes(-14), (0.18, 0.045, 0.21))
    tube('lp_seat_post', bl((-4, 24, 0)), bl((-4, 2, 0)), 0.04)
    for z in (22, -22):
        tube(f'lp_base_{z}', bl((-64, 2.5, z)), bl((142, 2.5, z)), 0.035)
    tube('lp_base_x1', bl((-52, 2.5, 22)), bl((-52, 2.5, -22)), 0.035)
    tube('lp_base_x2', bl((140, 2.5, 22)), bl((140, 2.5, -22)), 0.035)
    lo, hi = (6, 26), (128, 148)
    for z in (16, -16):
        tube(f'lp_rail_{z}', bl((lo[0], lo[1], z)), bl((hi[0], hi[1], z)), 0.03, 'chrome')
        tube(f'lp_rear_post_{z}', bl((hi[0], 0, z)), bl((hi[0], hi[1] + 4, z)), 0.04)
        tube(f'lp_front_post_{z}', bl((lo[0], 0, z)), bl((lo[0], lo[1], z)), 0.04)
    tube('lp_rear_brace', bl((hi[0], hi[1] + 4, 16)), bl((hi[0], hi[1] + 4, -16)), 0.04)
    for z in (30, -30):
        tube(f'lp_handle_post_{z}', bl((0, 2.5, z)), bl((0, 36, z)), 0.025)
        cylinder(f'lp_handle_{z}', bl((-8, 38, z)), bl((10, 38, z)), 0.017, 'rubber', 24)


def leg_press_sled(feet_mid):
    """The sled at the feet: the foot plate square to the rails, its carriage, a plate horn either side."""
    d = bl_dir((0.7071, 0.7071, 0))
    n = -d
    across = bl_dir((0, 0, 1))
    up = d.cross(across).normalized()
    c = feet_mid - n * 0.012
    box('lp_footplate', c, (n, up, across), (0.012, 0.36, 0.38), 'tread', 0.006)
    car = c + d * 0.09 + up * -0.02
    # The plates ride up the rails behind the plate, clear of the feet.
    horns = car + d * 0.26 + up * -0.12
    box('lp_carriage', car, (d, up, across), (0.07, 0.30, 0.26), 'frame', 0.012)
    for sign in (1, -1):
        tube(f'lp_horn_arm_{sign}', car + across * sign * 0.2, horns + across * sign * 0.2, 0.03)
        horn_a = horns + across * sign * 0.2
        horn_b = horns + across * sign * 0.44
        cylinder(f'lp_horn_{sign}', horn_a, horn_b, 0.025, 'chrome', 32)
        plate(f'lp_plate_{sign}', horns + across * sign * 0.29, across, 0.20)
        plate(f'lp_plate2_{sign}', horns + across * sign * 0.345, across, 0.17)


def tbar_pad(chest, along, facing):
    """The chest pad, lying along the torso against the chest, on its post down to the base."""
    across = along.cross(facing).normalized()
    centre = chest + facing * 0.055
    pad('tb_chest', centre, (along, facing, across), (0.27, 0.05, 0.18))
    foot = Vector((centre.x - 0.12, 0, 0.04))
    tube('tb_pad_post', centre + facing * 0.06 - along * 0.05, foot, 0.04)


def tbar_static():
    """The chest-supported T-bar row's fixed parts: the foot platform, the base beam, the pivot post."""
    box('tb_platform', bl((-44, 9, 0)), (bl_dir((1, 0, 0)), bl_dir((0, 0, 1)), bl_dir((0, 1, 0))), (0.34, 0.36, 0.035), 'tread', 0.01)
    tube('tb_base', bl((-118, 3, 0)), bl((34, 3, 0)), 0.04)
    tube('tb_pivot_post', bl((-110, 2, 0)), bl((-110, 16, 0)), 0.045)


def tbar_lever(grip_r, grip_l):
    """The lever from its pivot behind the feet, running under the hands to its plates; the neutral
    handles stand up from it on short posts, so the lever and its plates stay below the chest pad."""
    pivot = bl((-110, 16, 0))
    grip_mid = (grip_r + grip_l) / 2
    under = grip_mid - Vector((0, 0, 0.17))
    d = (under - pivot).normalized()
    tip = under + d * 0.2
    tube('tb_lever', pivot, tip, 0.034)
    cylinder('tb_pivot', pivot + Vector((0, -0.07, 0)), pivot + Vector((0, 0.07, 0)), 0.05, 'chrome', 32)
    for name, g in (('R', grip_r), ('L', grip_l)):
        base = under + (g - grip_mid) * 0.35
        tube(f'tb_handle_post_{name}', base, g - Vector((0, 0, 0.07)), 0.016, 'chrome')
        cylinder(f'tb_handle_{name}', g - Vector((0, 0, 0.07)), g + Vector((0, 0, 0.07)), 0.018, 'rubber', 24)
    cylinder('tb_horn', tip, tip + d * 0.24, 0.025, 'chrome', 32)
    plate('tb_plate1', tip + d * 0.08, d, 0.19)
    plate('tb_plate2', tip + d * 0.13, d, 0.165)
