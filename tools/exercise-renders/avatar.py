"""The rigged human: Microsoft Rocketbox Sports_Male_04 (MIT), posed from the app's own solved
skeletons (poses.json). The torso is set bone by bone to the pose's pelvis, chest and head frames;
the arms and legs reach the pose's wrists and ankles by IK, elbows and knees toward the pose's own;
the feet follow the soles; the hands close around the grip."""
import math
import os
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
AVATAR = os.path.join(HERE, 'work', 'assets', 'rocketbox', 'Sports_Male_04')
# The app's skeleton is a little longer in the leg than this avatar (hip height 95 cm vs 89.5).
SCALE = 95.0 / 89.5


def bl(p):
    """The app's rig (cm; x forward, y up, z the figure's right) to Blender (m; z up)."""
    return Vector((p[0] / 100.0, -p[2] / 100.0, p[1] / 100.0))


def bl_dir(v):
    return Vector((v[0], -v[2], v[1])).normalized()


def frame_matrix(forward, up, right):
    return Matrix((forward, up, right)).transposed()


def load_avatar():
    bpy.ops.import_scene.fbx(filepath=os.path.join(AVATAR, 'Sports_Male_04.fbx'))
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    for o in list(bpy.context.scene.objects):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o)
    arm.scale = arm.scale * SCALE
    bpy.context.view_layer.update()
    body = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    skin_materials(body)
    for poly in body.data.polygons:
        poly.use_smooth = True
    return arm, body


def _tex(nodes, name, colour=True):
    node = nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(os.path.join(AVATAR, 'Textures', name))
    node.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    return node


def skin_materials(body):
    for slot in body.material_slots:
        m = slot.material
        part = 'head' if 'head' in m.name else 'body'
        m.use_nodes = True
        nodes, links = m.node_tree.nodes, m.node_tree.links
        nodes.clear()
        out = nodes.new('ShaderNodeOutputMaterial')
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
        colour = _tex(nodes, f'm026_{part}_color.tga')
        links.new(colour.outputs['Color'], bsdf.inputs['Base Color'])
        normal = _tex(nodes, f'm026_{part}_normal.tga', colour=False)
        nmap = nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = 0.8
        links.new(normal.outputs['Color'], nmap.inputs['Color'])
        links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
        spec = _tex(nodes, f'm026_{part}_specular.tga', colour=False)
        # Glossier where the specular map is bright (skin, eyes), matte cloth elsewhere.
        inv = nodes.new('ShaderNodeMapRange')
        inv.inputs['From Min'].default_value = 0.0
        inv.inputs['From Max'].default_value = 1.0
        inv.inputs['To Min'].default_value = 0.78
        inv.inputs['To Max'].default_value = 0.38
        links.new(spec.outputs['Color'], inv.inputs['Value'])
        links.new(inv.outputs['Result'], bsdf.inputs['Roughness'])
        # A little subsurface for skin.
        bsdf.inputs['Subsurface Weight'].default_value = 0.12
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.2)
        bsdf.inputs['Subsurface Scale'].default_value = 0.01


TORSO = ['Bip01 Pelvis', 'Bip01 Spine', 'Bip01 Spine1', 'Bip01 Spine2', 'Bip01 Neck', 'Bip01 Head']
REST_FRAME = frame_matrix(Vector((0, -1, 0)), Vector((0, 0, 1)), Vector((-1, 0, 0)))


def _set_world_rotation(arm, pb, rot_world, head_world=None):
    """Sets a pose bone so its rest orientation is turned by `rot_world` (and its head, if given)."""
    mw = arm.matrix_world
    arm_rot = mw.to_quaternion().to_matrix()
    rest_arm = pb.bone.matrix_local.to_3x3().normalized()
    rot_arm = arm_rot.inverted() @ rot_world @ arm_rot @ rest_arm
    head = head_world if head_world is not None else mw @ pb.head
    m = rot_arm.to_4x4()
    m.translation = mw.inverted() @ head
    pb.matrix = m
    bpy.context.view_layer.update()


def _turn(frame):
    return frame_matrix(bl_dir(frame['forward']), bl_dir(frame['up']), bl_dir(frame['right'])) @ REST_FRAME.transposed()


def _blend(a, b, t):
    return a.to_quaternion().slerp(b.to_quaternion(), t).to_matrix()


def pose(arm, f, palms):
    """Poses the avatar to one frame of the app's skeleton. `palms`: each side's palm direction (rig)."""
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    bpy.context.view_layer.update()
    pelvis_turn = _turn(f['pelvisFrame'])
    chest_turn = _turn(f['chestFrame'])
    head_turn = _turn(f['headFrame'])
    pbs = arm.pose.bones
    _set_world_rotation(arm, pbs['Bip01 Pelvis'], pelvis_turn, bl(f['pelvis']))
    _set_world_rotation(arm, pbs['Bip01 Spine'], pelvis_turn)
    _set_world_rotation(arm, pbs['Bip01 Spine1'], _blend(pelvis_turn, chest_turn, 0.5))
    _set_world_rotation(arm, pbs['Bip01 Spine2'], chest_turn)
    # The head carries on from the chest more than the app's drawn head does (a real neck is stiffer).
    _set_world_rotation(arm, pbs['Bip01 Neck'], _blend(chest_turn, head_turn, 0.25))
    _set_world_rotation(arm, pbs['Bip01 Head'], _blend(chest_turn, head_turn, 0.5))

    for side, letter in (('r', 'R'), ('l', 'L')):
        a = f['arms'][side]
        end, joint = Vector(a['end']), Vector(a['joint'])
        along = end - joint
        along.normalize()
        wrist = bl(end - along * 7.5)
        _limb(arm, f'Bip01 {letter} UpperArm', f'Bip01 {letter} Forearm', f'Bip01 {letter} Hand',
              wrist, bl(joint))
        _hand(arm, letter, bl_dir(palms[side]))
        lg = f['legs'][side]
        _limb(arm, f'Bip01 {letter} Thigh', f'Bip01 {letter} Calf', f'Bip01 {letter} Foot',
              bl(lg['end']), bl(lg['joint']))
        foot = f['feet'][side]
        sole = Vector(foot['toe']) - Vector(foot['heel'])
        _foot(arm, letter, bl_dir(sole))
    fist(arm)
    return []


def _frame(a, b):
    """An orthonormal frame from a main direction `a` and a second one `b` (made square to it)."""
    x = a.normalized()
    z = x.cross(b).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed()


def _rest_world(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local


def _posed_world(arm, name):
    return arm.matrix_world @ arm.pose.bones[name].head


def _limb(arm, upper, lower, end, target, pole):
    """Two-bone IK by hand: the upper and lower bones aimed so `end`'s head reaches `target`, bending
    in the plane of `pole` (the app's own elbow or knee), at the avatar's own bone lengths."""
    s0, e0, w0 = _rest_world(arm, upper), _rest_world(arm, lower), _rest_world(arm, end)
    l1, l2 = (e0 - s0).length, (w0 - e0).length
    s = _posed_world(arm, upper)
    to = target - s
    d = max(abs(l1 - l2) + 1e-4, min(l1 + l2 - 1e-4, to.length))
    axis = to.normalized()
    w = s + axis * d
    off = pole - s
    off = off - axis * off.dot(axis)
    if off.length < 1e-6:
        off = axis.orthogonal()
    off.normalize()
    a_len = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - a_len * a_len))
    e = s + axis * a_len + off * h
    # The hinge each bone turns about: square to the limb's plane, at rest and now.
    hinge0 = (e0 - s0).cross(w0 - e0)
    if hinge0.length < 1e-6:
        hinge0 = (e0 - s0).orthogonal()
    hinge = (e - s).cross(w - e)
    for bone, a0, a1 in ((upper, e0 - s0, e - s), (lower, w0 - e0, w - e)):
        turn = _frame(a1, hinge) @ _frame(a0, hinge0).transposed()
        _set_world_rotation(arm, arm.pose.bones[bone], turn)


def _hand(arm, letter, palm):
    """The wrist straight on the forearm's line, the palm turned to face `palm`."""
    hand = f'Bip01 {letter} Hand'
    h0 = _rest_world(arm, hand)
    knuckles0 = sum((_rest_world(arm, f'Bip01 {letter} Finger{i}') for i in range(1, 5)), Vector()) / 4
    index0, pinky0 = _rest_world(arm, f'Bip01 {letter} Finger1'), _rest_world(arm, f'Bip01 {letter} Finger4')
    along0 = knuckles0 - h0
    palm0 = along0.cross(index0 - pinky0)
    # Pointing in toward the body at rest (A-pose palms face the thighs).
    if palm0.dot(Vector((0, 0, 0)) - h0 + Vector((0, 0, h0.z))) < 0:
        palm0 = -palm0
    f_head = _posed_world(arm, f'Bip01 {letter} Forearm')
    along = _posed_world(arm, hand) - f_head
    turn = _frame(along, palm) @ _frame(along0, palm0).transposed()
    _set_world_rotation(arm, arm.pose.bones[hand], turn)


def _foot(arm, letter, sole):
    """The foot along the sole's line, its top up from the sole."""
    foot = f'Bip01 {letter} Foot'
    f0 = _rest_world(arm, foot)
    toe0 = _rest_world(arm, f'Bip01 {letter} Toe0')
    along0 = Vector((toe0.x - f0.x, toe0.y - f0.y, 0.0))
    up0 = Vector((0, 0, 1))
    side = sole.cross(Vector((0, 0, 1)))
    up = side.cross(sole) if side.length > 1e-6 else Vector((1, 0, 0))
    turn = _frame(sole, up) @ _frame(along0, up0).transposed()
    _set_world_rotation(arm, arm.pose.bones[foot], turn)


def fist(arm, curl=1.0):
    """Closes each hand around its grip: every finger curled at each joint, the thumb across."""
    for letter in ('R', 'L'):
        for finger in range(1, 5):
            for j, amount in ((f'{finger}', 55), (f'{finger}1', 85), (f'{finger}2', 60)):
                pb = arm.pose.bones[f'Bip01 {letter} Finger{j}']
                pb.rotation_mode = 'XYZ'
                pb.rotation_euler = (0, 0, math.radians(amount * curl) * (1 if letter == 'R' else 1))
        for j, rot in (('0', (0, 20, 25)), ('01', (0, 0, 30)), ('02', (0, 0, 35))):
            pb = arm.pose.bones[f'Bip01 {letter} Finger{j}']
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = tuple(math.radians(v * curl) for v in rot)
    bpy.context.view_layer.update()
