"""blender -b -P render_exercise.py -- <slug> <out_dir> [preview]

Renders one built-in exercise's How to Do It phases: the avatar posed to each of the app's frames,
its equipment around it, the same camera and light for every phase. Writes <slug>_<frame>.png
(transparent) into out_dir."""
import json
import os
import sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import avatar  # noqa: E402
import equipment as eq  # noqa: E402
import stage  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:]
slug, out_dir = args[0], args[1]
preview = len(args) > 2 and args[2] == 'preview'
spec = json.load(open(os.path.join(HERE, 'work', 'poses.json')))[slug]


def hand_grip(arm, letter):
    """The middle of a closed fist and the line across its knuckles (where a handle lies)."""
    mw = arm.matrix_world
    pb = arm.pose.bones
    h = mw @ pb[f'Bip01 {letter} Hand'].head
    knuckles = sum((mw @ pb[f'Bip01 {letter} Finger{i}'].head for i in range(1, 5)), Vector()) / 4
    across = (mw @ pb[f'Bip01 {letter} Finger1'].head) - (mw @ pb[f'Bip01 {letter} Finger4'].head)
    return h + (knuckles - h) * 0.9, across.normalized()


# Each exercise: its palms (the app's axes), how its hands reach (free weights at the avatar's own
# arm length; a machine's fixed handles exactly), and its equipment.
EXERCISES = {
    'db-bench-press': dict(palms={'r': (1, 0, 0), 'l': (1, 0, 0)}, free_hands=True),
    'pl-leg-press': dict(palms={'r': (0, -1, 0.3), 'l': (0, -1, -0.3)}, free_hands=False),
    'pl-t-bar-row': dict(palms={'r': (0, 0, -1), 'l': (0, 0, 1)}, free_hands=False),
}
cfg = EXERCISES[slug]


def static_equipment():
    if slug == 'db-bench-press':
        return None
    if slug == 'pl-leg-press':
        eq.leg_press_static()
    if slug == 'pl-t-bar-row':
        eq.tbar_static()


def moving_equipment(arm, body, frame):
    """The parts that move with the body this frame; returns the objects made."""
    before = set(bpy.data.objects)
    if slug == 'db-bench-press':
        # The bench under the back: its pad top just under the body there.
        deps = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(deps)
        mesh = ev.to_mesh()
        mw = ev.matrix_world
        sh = avatar.bl(frame['shoulderCenter'])
        pel = avatar.bl(frame['pelvis'])
        zs = [(mw @ v.co).z for v in mesh.vertices
              if min(sh.x, pel.x) - 0.05 < (mw @ v.co).x < max(sh.x, pel.x) + 0.12 and abs((mw @ v.co).y) < 0.12]
        ev.to_mesh_clear()
        top = min(zs) + 0.004
        eq.flat_bench(top, sh.x - 0.3, pel.x + 0.42)
        for letter in ('R', 'L'):
            c, across = hand_grip(arm, letter)
            eq.dumbbell(f'db_{letter}', c, across)
    elif slug == 'pl-leg-press':
        feet = (avatar.bl(frame['feet']['r']['toe']) + avatar.bl(frame['feet']['l']['toe'])
                + avatar.bl(frame['feet']['r']['heel']) + avatar.bl(frame['feet']['l']['heel'])) / 4
        eq.leg_press_sled(feet)
    elif slug == 'pl-t-bar-row':
        # The pad against the chest: just in front of the body's surface, along the torso.
        pel, sh = avatar.bl(frame['pelvis']), avatar.bl(frame['shoulderCenter'])
        along = (sh - pel).normalized()
        facing = avatar.bl_dir(frame['chestFrame']['forward'])
        chest = pel + (sh - pel) * 0.62
        if 'tb_chest' not in bpy.data.objects:
            # Only the torso's own skin counts (the arms hang in front of it).
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
    return [o for o in bpy.data.objects if o not in before]


def pose(arm, frame):
    if cfg['free_hands']:
        # Free weights: each hand where the app's is along the arm, at this avatar's arm length.
        frame = json.loads(json.dumps(frame))
        for side in ('r', 'l'):
            a = frame['arms'][side]
            sh = Vector(frame['shoulders'][side])
            end = Vector(a['end'])
            ours = 30.0 + 30.0
            theirs = 30.3 + 28.8 + 7.5
            reach = (end - sh) * (theirs / ours)
            a['end'] = list(sh + reach)
    avatar.pose(arm, frame, cfg['palms'])


bpy.ops.wm.read_factory_settings(use_empty=True)
arm, body = avatar.load_avatar()
static_equipment()
frames = spec['frames']

# Frame everything in every phase alike: gather each phase's extent first.
coords = []
for frame in frames:
    pose(arm, frame)
    made = moving_equipment(arm, body, frame)
    coords += stage.world_coords([o for o in bpy.context.scene.objects if o.type == 'MESH'])
    for o in made:
        bpy.data.objects.remove(o)
device = stage.setup(spec['view'], [], preview=preview, coords=coords)
print('DEVICE', device)
os.makedirs(out_dir, exist_ok=True)
for i, frame in enumerate(frames):
    pose(arm, frame)
    made = moving_equipment(arm, body, frame)
    bpy.context.scene.render.filepath = os.path.join(out_dir, f'{slug}_{i}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', bpy.context.scene.render.filepath)
    for o in made:
        bpy.data.objects.remove(o)
