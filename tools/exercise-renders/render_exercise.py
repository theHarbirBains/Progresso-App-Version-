"""blender -b -P render_exercise.py -- <out_dir> [preview] [slug ...]

Renders built-in exercises' How to Do It phases (every active one, or the slugs given): the avatar
posed to each of the app's frames, its equipment around it -- built by hand for the exercises in
CUSTOM, otherwise rebuilt from the solids the app lays out (generic.py), the hands and what they
hold kept clear of the body (clearance.py) -- one camera and light for every phase. Writes <slug>_<frame>.png (transparent) and <slug>.json (where the body is in each
image, for thumbnails and close-ups) into out_dir. An exercise already rendered is skipped."""
import copy
import json
import os
import sys
import time
import traceback

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import avatar  # noqa: E402
import clearance  # noqa: E402
import equipment as eq  # noqa: E402
import generic  # noqa: E402
import stage  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:]
out_dir = os.path.abspath(args[0])
preview = 'preview' in args[1:]
asked = [a for a in args[1:] if a != 'preview']
LIBRARY = json.load(open(os.path.join(HERE, 'work', 'library.json')))
slugs = asked or list(LIBRARY)


def hand_grip(arm, letter):
    """The middle of a closed fist and the line across its knuckles (where a handle lies)."""
    mw = arm.matrix_world
    pb = arm.pose.bones
    h = mw @ pb[f'Bip01 {letter} Hand'].head
    knuckles = sum((mw @ pb[f'Bip01 {letter} Finger{i}'].head for i in range(1, 5)), Vector()) / 4
    across = (mw @ pb[f'Bip01 {letter} Finger1'].head) - (mw @ pb[f'Bip01 {letter} Finger4'].head)
    return h + (knuckles - h) * 0.9, across.normalized()


# ------------------------------------------------------------------- The hand-built exercises

def _bench(arm, body, frame):
    deps = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(deps)
    mesh = ev.to_mesh()
    mw = ev.matrix_world
    sh = avatar.bl(frame['shoulderCenter'])
    pel = avatar.bl(frame['pelvis'])
    zs = [(mw @ v.co).z for v in mesh.vertices
          if min(sh.x, pel.x) - 0.05 < (mw @ v.co).x < max(sh.x, pel.x) + 0.12 and abs((mw @ v.co).y) < 0.12]
    ev.to_mesh_clear()
    eq.flat_bench(min(zs) + 0.004, sh.x - 0.3, pel.x + 0.42)
    for letter in ('R', 'L'):
        c, across = hand_grip(arm, letter)
        eq.dumbbell(f'db_{letter}', c, across)


def _leg_press(arm, body, frame):
    feet = (avatar.bl(frame['feet']['r']['toe']) + avatar.bl(frame['feet']['l']['toe'])
            + avatar.bl(frame['feet']['r']['heel']) + avatar.bl(frame['feet']['l']['heel'])) / 4
    eq.leg_press_static()
    eq.leg_press_sled(feet)


def _tbar(arm, body, frame):
    eq.tbar_static()
    pel, sh = avatar.bl(frame['pelvis']), avatar.bl(frame['shoulderCenter'])
    along = (sh - pel).normalized()
    facing = avatar.bl_dir(frame['chestFrame']['forward'])
    chest = pel + (sh - pel) * 0.62
    torso = {g.index for g in body.vertex_groups if g.name in avatar.TORSO[:4]}
    deps = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(deps)
    mesh = ev.to_mesh()
    mw = ev.matrix_world
    depth = max(((mw @ v.co) - chest).dot(facing) for v in mesh.vertices
                if v.groups and max(v.groups, key=lambda g: g.weight).group in torso
                and abs(((mw @ v.co) - chest).dot(along)) < 0.12)
    ev.to_mesh_clear()
    eq.tbar_pad(chest + facing * depth, along, facing)
    cr, _ = hand_grip(arm, 'R')
    cl, _ = hand_grip(arm, 'L')
    eq.tbar_lever(cr, cl)


# Each: its hands (free weights reach at the avatar's own arm length), its palms, its equipment.
CUSTOM = {
    'db-bench-press': dict(palms={'r': (1, 0, 0), 'l': (1, 0, 0)}, free_hands=True, build=_bench),
    'pl-leg-press': dict(palms={'r': (0, -1, 0.3), 'l': (0, -1, -0.3)}, free_hands=False, build=_leg_press),
    'pl-t-bar-row': dict(palms={'r': (0, 0, -1), 'l': (0, 0, 1)}, free_hands=False, build=_tbar),
}


# ------------------------------------------------------------------------------- The hands

def hands_for(spec, frame):
    """Each hand: lined up along the handle it holds (knuckles toward the middle for an overhand
    grip, outward for underhand, up for neutral), else open."""
    out = {}
    pel, sh = Vector(frame['pelvis']), Vector(frame['shoulderCenter'])
    spine = (sh - pel).normalized()
    for side in ('r', 'l'):
        a = frame['arms'][side]
        end, joint = Vector(a['end']), Vector(a['joint'])
        forearm = (end - joint).normalized()
        h = generic.handle_near(frame['solids'], end)
        if h is None:
            if end.y < 22:
                # On the floor (a push-up, a plank): flat, fingers toward the head.
                ahead = Vector((spine.x, 0, spine.z))
                ahead = ahead.normalized() if ahead.length > 1e-3 else Vector((1, 0, 0))
                out[side] = dict(flat=avatar.bl_dir(ahead), curl=0.08)
            else:
                out[side] = dict(palm=tuple(-forearm.cross(spine)), curl=0.35)
            continue
        h_rig = Vector((h.x, h.z, -h.y))
        # Toward the body's middle line, square to the forearm.
        t = (end - pel).dot(spine)
        mid = pel + spine * t
        m = mid - end
        m -= forearm * m.dot(forearm)
        across = h_rig.copy()
        if m.length > 1e-3 and abs(across.normalized().dot(m.normalized())) > 0.5:
            toward = across.dot(m) > 0
            want_toward = spec['grip'] != 'underhand'
            if toward != want_toward:
                across = -across
        else:
            up = spine if abs(across.normalized().dot(spine)) > 0.2 else Vector((0, 1, 0))
            if across.dot(up) < 0:
                across = -across
        out[side] = dict(across=avatar.bl_dir(across), curl=1.0)
    return out


def pose(arm, slug, spec, frame):
    custom = CUSTOM.get(slug)
    if custom:
        if custom['free_hands']:
            frame = json.loads(json.dumps(frame))
            for side in ('r', 'l'):
                a = frame['arms'][side]
                sh = Vector(frame['shoulders'][side])
                a['end'] = list(sh + (Vector(a['end']) - sh) * ((30.3 + 28.8 + 7.5) / 60.0))
        avatar.pose(arm, frame, {s: dict(palm=custom['palms'][s], curl=1.0) for s in ('r', 'l')})
    else:
        avatar.pose(arm, frame, hands_for(spec, frame))


def equipment_for(arm, body, slug, frame, index):
    before = set(bpy.data.objects)
    if slug in CUSTOM:
        CUSTOM[slug]['build'](arm, body, frame)
    else:
        generic.build(frame['solids'], f'eq{index}')
    return [o for o in bpy.data.objects if o not in before]


def grounded(frame):
    """The frame with a foot its pose sinks below the floor (a toe pressed into it) tipped up to rest
    on it, so the floor -- the lowest point of all -- is where the planted feet are."""
    if all(frame['feet'][s][p][1] >= 0 for s in ('r', 'l') for p in ('toe', 'heel')):
        return frame
    f = copy.deepcopy(frame)
    for side in ('r', 'l'):
        for point in ('toe', 'heel'):
            f['feet'][side][point][1] = max(0.0, f['feet'][side][point][1])
    return f


# --------------------------------------------------------------------- Where the body shows

def anchors(arm, body, cam):
    """Where the body is in the image (0-1 across, 0-1 down): the parts a close-up looks at,
    and the body's bounds (for the thumbnail)."""
    scene = bpy.context.scene
    mw = arm.matrix_world
    pb = arm.pose.bones

    def at(p):
        v = world_to_camera_view(scene, cam, p)
        return [round(v.x, 4), round(1 - v.y, 4)]

    def head(name):
        return mw @ pb[name].head

    near = 'R' if (head('Bip01 R Calf') - cam.location).length < (head('Bip01 L Calf') - cam.location).length else 'L'
    grips = [hand_grip(arm, letter)[0] for letter in ('R', 'L')]
    feet = [(head(f'Bip01 {s} Foot') + head(f'Bip01 {s} Toe0')) / 2 for s in ('R', 'L')]
    out = {
        'hands': at((grips[0] + grips[1]) / 2),
        'feet': at((feet[0] + feet[1]) / 2),
        'hip': at(head(f'Bip01 {near} Thigh')),
        'knee': at(head(f'Bip01 {near} Calf')),
        'ankle': at(head(f'Bip01 {near} Foot')),
        'hips': at(head('Bip01 Pelvis')),
        'torso': at((head('Bip01 Pelvis') + head('Bip01 Neck')) / 2),
        'shoulders': at((head('Bip01 R UpperArm') + head('Bip01 L UpperArm')) / 2),
        'head': at((head('Bip01 Head') + head('Bip01 REye') + head('Bip01 LEye')) / 3),
    }
    pts = [at(p) for p in stage.world_coords([body])[::7]]
    out['bounds'] = [min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)]
    return out


# --------------------------------------------------------------------------------- Rendering

def render_one(slug):
    spec = LIBRARY[slug]
    frames = spec['frames']
    pngs = [os.path.join(out_dir, f'{slug}_{i}.png') for i in range(len(frames))]
    meta_path = os.path.join(out_dir, f'{slug}.json')
    if all(os.path.exists(p) for p in pngs) and os.path.exists(meta_path):
        return 'skipped'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    eq._MATS.clear()
    arm, body = avatar.load_avatar()
    frames = [grounded(f) for f in frames]
    if slug not in CUSTOM:
        frames = [clearance.settle(body, slug, spec, f, lambda f: pose(arm, slug, spec, f))[0] for f in frames]
    coords = []
    for i, frame in enumerate(frames):
        pose(arm, slug, spec, frame)
        made = equipment_for(arm, body, slug, frame, i)
        coords += stage.world_coords([o for o in bpy.context.scene.objects if o.type == 'MESH'])
        for o in made:
            bpy.data.objects.remove(o)
    stage.setup(spec['view'], coords, preview=preview)
    cam = bpy.context.scene.camera
    meta = {'frames': []}
    for i, frame in enumerate(frames):
        pose(arm, slug, spec, frame)
        made = equipment_for(arm, body, slug, frame, i)
        bpy.context.scene.render.filepath = pngs[i]
        bpy.ops.render.render(write_still=True)
        meta['frames'].append(anchors(arm, body, cam))
        for o in made:
            bpy.data.objects.remove(o)
    json.dump(meta, open(meta_path, 'w'))
    return 'rendered'


os.makedirs(out_dir, exist_ok=True)
for n, slug in enumerate(slugs, 1):
    start = time.time()
    try:
        result = render_one(slug)
        print(f'PROGRESS {n}/{len(slugs)} {slug} {result} {time.time() - start:.0f}s', flush=True)
    except Exception:
        print(f'FAILED {n}/{len(slugs)} {slug}', flush=True)
        traceback.print_exc()
