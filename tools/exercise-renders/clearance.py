"""Keeping the hands, and whatever they hold, out of the body. The avatar is fuller in the chest, back
and thighs than the app's slim figure, so a bar the app rests on the upper back, at the chest or
against the thighs -- or a hand on a hip -- would sit inside it. Each frame, a grip nearer the body's
surface than a hand around a handle allows (or a bar nearer than its own radius) is moved straight
out from the body, with everything it holds: the solids touching its handle, through to a bar's
plates or a dumbbell's heads. A cable, band or strap running to it from an anchor stretches instead,
and a machine's levers never move. Frames and solids are in the app's coordinates (cm)."""
import copy

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import avatar
import generic

# How far a grip (a handle's middle) stays out from the body: the fingers around a handle, or the
# palm's thickness.
CLEAR_HANDLE = 3.0
CLEAR_PALM = 1.8
# How close two solids are to count as touching, cm.
TOUCH = 1.0
# The most a grip is ever moved, cm: anything deeper is the pose's own business.
MOST = 15.0
# How far along a bar from a hand it's kept clear of the body, cm.
NEAR = 40.0
_ARM_BONES = ('UpperArm', 'Forearm', 'Hand', 'Finger')


def _rig(v):
    """A Blender vector (m) in the app's axes (cm)."""
    return Vector((v.x * 100.0, v.z * 100.0, -v.y * 100.0))


def body_surface(body):
    """The posed body's surface, arms left out (a hand's own arm is never in its way)."""
    arm_groups = {g.index for g in body.vertex_groups if any(k in g.name for k in _ARM_BONES)}
    dominant = [max(v.groups, key=lambda x: x.weight).group if v.groups else -1 for v in body.data.vertices]
    polygons = [list(p.vertices) for p in body.data.polygons if not any(dominant[i] in arm_groups for i in p.vertices)]
    ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = ev.to_mesh()
    verts = [ev.matrix_world @ v.co for v in mesh.vertices]
    ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polygons)


def _push(surface, p, clear):
    """How far the point `p` (app) must move to be `clear` out from the body: None if it is."""
    at = avatar.bl(p)
    loc, normal, _, _ = surface.find_nearest(at)
    if loc is None:
        return None
    out = _rig(normal).normalized()
    depth = _rig(at - loc).dot(out)
    return None if depth >= clear - 0.2 else out * (clear - depth)


# ------------------------------------------------------------------------------- Solids


def _is_thin(s):
    """A cable, band or strap: stretched from its anchor rather than moved."""
    return s['kind'] == 'cylinder' and (s['side'] in ('band', 'strap') or (s['side'] == 'metal' and s['r'] < 0.9))


def _segment_distance(p, a, b):
    ab = b - a
    t = 0.0 if ab.length_squared < 1e-9 else max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length


def _core(s):
    """A solid as a segment (a ball's is a point) and its radius."""
    if s['kind'] == 'ball':
        c = Vector(s['center'])
        return c, c, s['r']
    return Vector(s['a']), Vector(s['b']), s['r']


def _gap(s1, s2):
    """Roughly how far apart two round solids' surfaces are."""
    a1, b1, r1 = _core(s1)
    a2, b2, r2 = _core(s2)
    samples = [a1 + (b1 - a1) * (i / 8) for i in range(9)]
    d = min(_segment_distance(p, a2, b2) for p in samples)
    d = min(d, *(_segment_distance(a2 + (b2 - a2) * (i / 8), a1, b1) for i in range(9)))
    return d - r1 - r2


def _surface_distance(s, p):
    a, b, r = _core(s)
    return _segment_distance(p, a, b) - r


def held(solids, seed):
    """Everything moving with the solid `seed`: the round solids touching it, and touching those."""
    group, todo = {seed}, [seed]
    while todo:
        i = todo.pop()
        if _is_thin(solids[i]):
            continue
        for j, s in enumerate(solids):
            if j in group or s['kind'] == 'box' or _is_thin(s):
                continue
            if _gap(solids[i], s) <= TOUCH:
                group.add(j)
                todo.append(j)
    return group


def _gripped(solids, grip):
    """What a hand holds: its handle, else a ball or plate it rests on; None for nothing."""
    i = generic.handle_index(solids, grip)
    if i is not None:
        return i
    near = [(_surface_distance(s, grip), j) for j, s in enumerate(solids) if s['kind'] != 'box' and not _is_thin(s)]
    near = [n for n in near if n[0] < 3.0]
    return min(near)[1] if near else None


def _move(s, v):
    if s['kind'] == 'ball':
        s['center'] = list(Vector(s['center']) + v)
    elif s['kind'] == 'cylinder':
        s['a'] = list(Vector(s['a']) + v)
        s['b'] = list(Vector(s['b']) + v)


def _stretch(solids, group, v):
    """Each cable, band or strap attached to `group` (before it moves): its pieces in a line from
    the attached end, moved by `v` there and less toward its anchor."""
    moved = [solids[i] for i in group]
    for i, s in enumerate(solids):
        if i in group or not _is_thin(s):
            continue
        ends = [Vector(s['a']), Vector(s['b'])]
        touching = [e for e in ends if min(_surface_distance(m, e) for m in moved) <= 2.0]
        if not touching:
            continue
        attach = touching[0]
        line = (ends[1] - ends[0]).normalized()
        chain = [j for j, t in enumerate(solids)
                 if j not in group and _is_thin(t)
                 and abs((Vector(t['b']) - Vector(t['a'])).normalized().dot(line)) > 0.97
                 and _segment_distance(Vector(t['a']), attach - line * 1000, attach + line * 1000) < 0.5]
        far = max((Vector(solids[j][k]) for j in chain for k in ('a', 'b')), key=lambda e: (e - attach).length)
        span = max((far - attach).length, 1e-6)
        for j in chain:
            for k in ('a', 'b'):
                e = Vector(solids[j][k])
                solids[j][k] = list(e + v * max(0.0, 1.0 - (e - attach).length / span))


# --------------------------------------------------------------------------------- Frames


def settle(body, slug, spec, frame, pose):
    """The frame with its hands, and what they hold, clear of the body, and how far the furthest
    moved (cm). `pose(frame)` poses the avatar; the body's surface without the arms doesn't depend on
    the hands, so it's read once."""
    pose(frame)
    surface = body_surface(body)
    f = copy.deepcopy(frame)
    solids, arms = f['solids'], f['arms']
    # A machine's handles are on its levers; a Smith machine's bar moves freely.
    mounted = spec['equipment'] == 'machine' and not slug.startswith('sm-')
    # What moves together: each held thing (its solids) with the hands on it, or a hand on its own.
    holders = {}
    for side in ('r', 'l'):
        end = Vector(arms[side]['end'])
        seed = _gripped(solids, end)
        if seed is None and end.y < 22:
            continue  # flat on the floor
        if seed is not None and mounted:
            continue
        holders.setdefault(side if seed is None else frozenset(held(solids, seed)), []).append(side)
    total, heading, stuck = {}, {}, set()
    for _ in range(10):
        moves = {}
        for key, sides in holders.items():
            if key in stuck:
                continue
            group = key if isinstance(key, frozenset) else ()
            ends = [Vector(arms[side]['end']) for side in sides]
            grips = [v for v in (_push(surface, e, CLEAR_HANDLE if group else CLEAR_PALM) for e in ends) if v is not None]
            # The bar or handle itself, near the hands (a bar resting on the back, the hips, the chest).
            rest = []
            for i in group:
                s = solids[i]
                if s['kind'] == 'cylinder' and s['r'] <= 3.6 and not _is_thin(s):
                    a, b = Vector(s['a']), Vector(s['b'])
                    for p in (a + (b - a) * (k / 6) for k in range(7)):
                        v = _push(surface, p, s['r'] + 0.3) if min((p - e).length for e in ends) < NEAR else None
                        if v is not None:
                            rest.append(v)
            if not grips and not rest:
                continue
            if key not in heading:
                # Out the way the deepest point needs -- unless two hands need opposite ways: then
                # the way they agree on (a kettlebell held between the thighs comes forward), and
                # none at all if they don't (a trap bar's handles inside the hips).
                if any(u.dot(w) < 0 for u in grips for w in grips):
                    way = sum(grips, Vector())
                    if way.length < 0.3 * max(u.length for u in grips):
                        stuck.add(key)
                        continue
                else:
                    way = max(grips + rest, key=lambda u: u.length)
                heading[key] = way.normalized()
            step = max(u.dot(heading[key]) for u in grips + rest)
            if step < 0.05 or total.get(key, Vector()).length + step > MOST:
                stuck.add(key)
            else:
                moves[key] = heading[key] * step
        if not moves:
            break
        for key, v in moves.items():
            total[key] = total.get(key, Vector()) + v
            for side in holders[key]:
                for joint in ('end', 'joint'):
                    arms[side][joint] = list(Vector(arms[side][joint]) + v)
            if isinstance(key, frozenset):
                _stretch(solids, key, v)
                for i in key:
                    _move(solids[i], v)
    return f, max((v.length for v in total.values()), default=0.0)
