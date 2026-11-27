"""The chest-supported T-bar row, modelled for the exercise guides: a plate-loaded incline lever row
in the general look of gym equipment, no brand's (Harbir's call). Built from the render pipeline's
own parts (tools/exercise-renders/equipment.py: bevelled steel tube, upholstered pads, knurled
chrome, plates, tread) and laid out so the movement works:

- the lever pivots in a bearing behind the feet and runs down the middle, between the two foot
  plates, under the chest pad, to a yoke under the pad's top end;
- the upper handles are one bar across the lever on an upright from the yoke, at right angles to
  the lever's plane -- so the bar stays level with the ground at every lever angle -- with a
  rubber grip at each end, held overhand;
- the diagonal handles branch from the yoke, lower and narrower, angled out, held palms in;
- the plates load on a horn out of the yoke's front, clear of the hands and the head, and the
  lever rests on a rubber stop with the arms long.

Blender axes, metres: +X toward the person's head, +Y their left, +Z up; the floor at z = 0.
Everything a movement needs is a function of the lever's angle (`lever_deg`), so a template can
animate the machine and put the hands where its handles are.
"""
import math
from mathutils import Vector

import equipment as eq

# ----------------------------------------------------------------------------- Its geometry

PIVOT = Vector((-1.30, 0.0, 0.16))
# The lever, pivot to yoke, and the upper bar's upright, square off it.
LEVER_LEN = 1.7025
UPRIGHT = 0.18
# The lever's angle above the floor with the arms long (on its stop) and at the top of a row.
REST_DEG = 9.6
TOP_DEG = 24.2

PAD_CENTRE = Vector((0.0, 0.0, 1.0))
PAD_TILT_DEG = 40.0
PAD_HALF = (0.33, 0.165, 0.045)

UPPER_HALF_SPAN = 0.30  # the upper bar's length each side of the lever
UPPER_GRIP = (0.17, 0.30)  # each rubber grip, from and to, out from the middle
DIAGONAL_OUT = 0.10  # where each diagonal handle leaves the yoke, out from the middle
DIAGONAL_LEN = 0.15
DIAGONAL_SPLAY_DEG = 28  # each diagonal handle, out from straight down the lever's normal

PLATFORM = Vector((-0.50, 0.0, 0.20))  # each foot plate's top, front-to-back middle
PLATFORM_TILT_DEG = 10.0


def _dir(deg):
    a = math.radians(deg)
    return Vector((math.cos(a), 0.0, math.sin(a)))


def _normal(deg):
    a = math.radians(deg)
    return Vector((-math.sin(a), 0.0, math.cos(a)))


def yoke(lever_deg):
    """The lever's end, where the handles are: a point that moves on an arc about the pivot."""
    return PIVOT + _dir(lever_deg) * LEVER_LEN


def upper_bar_centre(lever_deg):
    return yoke(lever_deg) + _normal(lever_deg) * UPRIGHT


def upper_grip(lever_deg, side):
    """Where a hand holds the upper bar (side +1 left, -1 right), and the bar's direction there --
    across the body, level with the floor: an overhand (pronated) grip."""
    mid = (UPPER_GRIP[0] + UPPER_GRIP[1]) / 2
    return upper_bar_centre(lever_deg) + Vector((0, side * mid, 0)), Vector((0, 1, 0))


def diagonal_grip(lever_deg, side):
    """Where a hand holds a diagonal handle, and the handle's direction: down from the yoke and out
    -- a neutral grip, palms facing in."""
    n, out = _normal(lever_deg), Vector((0, side, 0))
    splay = math.radians(DIAGONAL_SPLAY_DEG)
    along = (-n * math.cos(splay) + out * math.sin(splay)).normalized()
    start = yoke(lever_deg) + out * DIAGONAL_OUT
    return start + along * (DIAGONAL_LEN * 0.55), along


def lever_deg_at(phase):
    """The lever's angle through a rep, 0 to 1: up over the first 40%, a short squeeze at the top,
    and back down slower -- eased at each end so the loop is seamless."""
    if phase < 0.40:
        t = phase / 0.40
    elif phase < 0.50:
        t = 1.0
    else:
        t = 1.0 - (phase - 0.50) / 0.50
    eased = 0.5 - 0.5 * math.cos(math.pi * t)
    return REST_DEG + (TOP_DEG - REST_DEG) * eased


# ----------------------------------------------------------------------------- Building it

def build_static():
    """The frame, the pad and its posts, the foot plates, the bearing and the stop."""
    objs = []
    # The base: a spine down the middle, a foot across each end.
    objs.append(eq.tube('tb_spine', (PIVOT.x - 0.12, 0, 0.035), (0.62, 0, 0.035), half=0.035))
    objs.append(eq.tube('tb_rear_foot', (PIVOT.x - 0.06, -0.36, 0.03), (PIVOT.x - 0.06, 0.36, 0.03), half=0.03))
    objs.append(eq.tube('tb_front_foot', (0.62, -0.42, 0.03), (0.62, 0.42, 0.03), half=0.03))
    for side in (-1, 1):
        objs.append(eq.box(f'tb_foot_cap_{side}', (0.62, side * 0.43, 0.03), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (0.035, 0.015, 0.035), 'rubber'))
    # The bearing: two cheeks on the spine, the pivot shaft through them.
    for side in (-1, 1):
        objs.append(eq.box(f'tb_bearing_{side}', (PIVOT.x, side * 0.065, PIVOT.z / 2 + 0.02), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (0.06, 0.012, PIVOT.z / 2 + 0.03)))
    objs.append(eq.cylinder('tb_pivot', (PIVOT.x, -0.09, PIVOT.z), (PIVOT.x, 0.09, PIVOT.z), 0.022, 'chrome'))
    # The foot plates either side of the lever, on struts from the spine, ridged on top.
    tilt = math.radians(PLATFORM_TILT_DEG)
    fx, fz = Vector((math.cos(tilt), 0, -math.sin(tilt))), Vector((math.sin(tilt), 0, math.cos(tilt)))
    for side in (-1, 1):
        c = PLATFORM + Vector((0, side * 0.215, -0.012))
        objs.append(eq.box(f'tb_platform_{side}', c, (fx, Vector((0, 1, 0)), fz), (0.17, 0.085, 0.012), 'tread', bevel=0.004))
        objs.append(eq.tube(f'tb_platform_strut_{side}', (c.x - 0.10, side * 0.215, 0.05), (c.x - 0.10, side * 0.215, c.z - 0.03), half=0.022))
        objs.append(eq.tube(f'tb_platform_strut_f_{side}', (c.x + 0.10, side * 0.215, 0.05), (c.x + 0.10, side * 0.215, c.z - 0.06), half=0.022))
        objs.append(eq.tube(f'tb_platform_arm_{side}', (c.x - 0.10, side * 0.05, 0.05), (c.x - 0.10, side * 0.215, 0.05), half=0.022))
        objs.append(eq.tube(f'tb_platform_arm_f_{side}', (c.x + 0.10, side * 0.05, 0.05), (c.x + 0.10, side * 0.215, 0.05), half=0.022))
    # The chest pad on two posts, either side of the lever.
    t = math.radians(PAD_TILT_DEG)
    along, up = Vector((math.cos(t), 0, math.sin(t))), Vector((-math.sin(t), 0, math.cos(t)))
    objs.append(eq.pad('tb_chest_pad', PAD_CENTRE, (along, Vector((0, 1, 0)), up), PAD_HALF))
    under = PAD_CENTRE - up * (PAD_HALF[2] + 0.02)
    objs.append(eq.box('tb_pad_plate', under, (along, Vector((0, 1, 0)), up), (0.22, 0.13, 0.012)))
    for side in (-1, 1):
        top = under + Vector((0.06, side * 0.11, -0.01))
        objs.append(eq.tube(f'tb_pad_post_{side}', (0.08, side * 0.11, 0.05), top, half=0.028))
        objs.append(eq.tube(f'tb_pad_post_foot_{side}', (0.08, side * 0.04, 0.05), (0.08, side * 0.11, 0.05), half=0.028))
    # The rubber stop the lever rests on, arms long.
    rest_under = PIVOT + _dir(REST_DEG) * (0.10 - PIVOT.x) / math.cos(math.radians(REST_DEG))
    stop_top = rest_under.z - 0.045
    objs.append(eq.tube('tb_stop_post', (0.10, 0, 0.05), (0.10, 0, stop_top - 0.03), half=0.025))
    objs.append(eq.box('tb_stop', (0.10, 0, stop_top - 0.015), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (0.04, 0.05, 0.015), 'rubber'))
    return objs


def build_lever(lever_deg, handles=('upper', 'diagonal'), marked=()):
    """The lever at an angle, with its yoke, its handles and its plates -- the grips of the handles
    in `marked` in the accent (the equipment picture's: the handles this exercise uses)."""
    objs = []
    grip_mat = (lambda which: 'accent' if which in marked else 'rubber')
    d, n = _dir(lever_deg), _normal(lever_deg)
    end = yoke(lever_deg)
    objs.append(eq.tube('tb_lever', PIVOT + d * 0.02, end, half=0.04))
    objs.append(eq.cylinder('tb_lever_collar', PIVOT + Vector((0, -0.05, 0)), PIVOT + Vector((0, 0.05, 0)), 0.045, 'frame'))
    # The yoke: a cross piece at the lever's end.
    objs.append(eq.box('tb_yoke', end, (d, Vector((0, 1, 0)), n), (0.05, 0.13, 0.035)))
    if 'upper' in handles:
        bar = upper_bar_centre(lever_deg)
        objs.append(eq.tube('tb_upright', end, bar - n * 0.02, half=0.025))
        objs.append(eq.cylinder('tb_upper_bar', bar + Vector((0, -UPPER_HALF_SPAN, 0)), bar + Vector((0, UPPER_HALF_SPAN, 0)), 0.016, 'chrome'))
        for side in (-1, 1):
            a = bar + Vector((0, side * UPPER_GRIP[0], 0))
            b = bar + Vector((0, side * UPPER_GRIP[1], 0))
            objs.append(eq.cylinder(f'tb_upper_grip_{side}', a, b, 0.0185, grip_mat('upper'), bevel=0.004))
            objs.append(eq.cylinder(f'tb_upper_cap_{side}', b, b + Vector((0, side * 0.012, 0)), 0.022, 'frame'))
    if 'diagonal' in handles:
        for side in (-1, 1):
            centre, along = diagonal_grip(lever_deg, side)
            start = end + Vector((0, side * DIAGONAL_OUT, 0))
            objs.append(eq.cylinder(f'tb_diag_stem_{side}', start, start + along * 0.03, 0.016, 'chrome'))
            objs.append(eq.cylinder(f'tb_diag_grip_{side}', start + along * 0.03, start + along * DIAGONAL_LEN, 0.0185, grip_mat('diagonal'), bevel=0.004))
    # The plate horn out of the yoke's front, with two plates.
    horn_a, horn_b = end + d * 0.05, end + d * 0.40
    objs.append(eq.cylinder('tb_horn', horn_a, horn_b, 0.025, 'chrome'))
    objs.append(eq.cylinder('tb_horn_collar', horn_a, horn_a + d * 0.03, 0.05, 'frame'))
    for i, at in enumerate((0.13, 0.18)):
        eq.plate(f'tb_plate_{i}', end + d * at, d)
    return objs
