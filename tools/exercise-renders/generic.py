"""Any built-in's equipment, rebuilt from the solids the app lays out for it (export_poses.mjs): every
box, cylinder and ball turned into a real part with rounded edges and the material it stands for --
the frame's black powder-coated steel, upholstery, rubber and iron plates, chrome bars and handles,
steel cable, braided rope and nylon strap, a wooden box."""
import bpy
from mathutils import Vector

import equipment as eq
from avatar import bl

# The app's box colours and cylinder/ball materials, to what they're made of.
BOX = {
    '#3E4045': 'frame',
    '#2E3035': 'plate',
    '#3A3C42': 'pad',
    '#4E3B33': 'mat',
    '#7A6553': 'wood',
}
ROUND = {
    'metal': 'chrome',
    'iron': 'iron',
    'rope': 'rope',
    'strap': 'strap',
    'band': 'strap',
    'medicineBall': 'rubber',
}


def _axis(v):
    return Vector((v[0], -v[2], v[1])) / 100.0


def build(solids, prefix):
    """Every solid of one frame, as parts. Returns the objects made."""
    before = set(bpy.data.objects)
    for i, s in enumerate(solids):
        name = f'{prefix}_{i}'
        if s['kind'] == 'box':
            mat = BOX.get(s['top'], 'frame')
            axes = [_axis(a) for a in s['axes']]
            half = [a.length for a in axes]
            if min(half) < 1e-5:
                continue
            units = [a.normalized() for a in axes]
            if mat == 'pad':
                eq.box(name, bl(s['center']), units, half, 'pad', bevel=min(half) * 0.85, segments=6)
            else:
                eq.box(name, bl(s['center']), units, half, mat, bevel=min(min(half) * 0.3, 0.012), segments=3)
        elif s['kind'] == 'cylinder':
            r = s['r'] / 100.0
            mat = ROUND.get(s['side'], 'chrome')
            # The thinnest chrome is a cable or a guide rod: brushed steel.
            if mat == 'chrome' and r < 0.009:
                mat = 'cable'
            a, b = bl(s['a']), bl(s['b'])
            if (b - a).length < 1e-5:
                continue
            eq.cylinder(name, a, b, r, mat, segments=48 if r > 0.05 else 24, bevel=min(r * 0.18, 0.006))
        else:
            r = s['r'] / 100.0
            mat = ROUND.get(s['side'], 'iron')
            bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=bl(s['center']), segments=32, ring_count=16)
            o = bpy.context.active_object
            o.name = name
            o.data.materials.append(eq.material(mat))
            bpy.ops.object.shade_smooth()
    return [o for o in bpy.data.objects if o not in before]


def handle_index(solids, grip_rig, reach=4.5):
    """The bar or handle the hand holds: the index of the thin cylinder whose axis passes nearest
    the grip (app coordinates), or None."""
    g = Vector(grip_rig)
    best = None
    for i, s in enumerate(solids):
        if s['kind'] != 'cylinder' or s['r'] > 3.6:
            continue
        a, b = Vector(s['a']), Vector(s['b'])
        ab = b - a
        if ab.length < 1e-6:
            continue
        t = max(0.0, min(1.0, (g - a).dot(ab) / ab.length_squared))
        d = (a + ab * t - g).length
        if d < reach and (best is None or d < best[0]):
            best = (d, i)
    return None if best is None else best[1]


def handle_near(solids, grip_rig, reach=4.5):
    """The line of the bar or handle the hand holds, in Blender's axes, or None."""
    i = handle_index(solids, grip_rig, reach)
    if i is None:
        return None
    ab = (Vector(solids[i]['b']) - Vector(solids[i]['a'])).normalized()
    return Vector((ab[0], -ab[2], ab[1]))
