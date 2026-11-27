"""Cuts Harbir's heat-map figures into the layers Progress's Muscles tab draws its heat map from.

The source is one picture of a figure from the front and from behind, side by side, its trained
muscles gold on a dark, glowing background (Harbir's art). Each side becomes:

- `<side>-body.webp`: the body alone in grey on a clear background -- every muscle grey, the gold
  turned to the grey of the muscles around it, the background and its glow gone;
- `<side>-<group>.webp` for each muscle group seen from that side: its muscles alone, white, as
  strong as they're lit (their shading kept), with a soft glow round them off the body -- for the
  app to tint in the group's heat colour over the body;

and muscleHeatmap.generated.ts maps them, with each side's tap map: which group's muscles are at
each point of the picture.

Where each group's muscles are is drawn here by hand for each sex's picture, as an area of it
(MALE_REGIONS, FEMALE_REGIONS): a gold
group takes the gold inside its area, exactly as Harbir drew it; a group his picture leaves grey
(the core, the lats and lower back, the inner thighs, the forearms) takes the body inside its
area. Run it again on new art by redrawing the areas.

    python -I tools/muscle-heatmap/cut.py SOURCE [SEX]

SEX is male (the default) or female. Run `npx prettier --write` on the map it writes after.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'apps', 'mobile', 'assets', 'muscle-heatmap')
MAP = os.path.join(ROOT, 'apps', 'mobile', 'src', 'progress', 'muscleHeatmap.generated.ts')

# Each side's part of the source picture (x0, y0, x1, y1), in the source's own pixels -- the same
# for both sexes' pictures, so the figures are drawn the same size.
CROPS = {'front': (330, 0, 766, 960), 'back': (776, 0, 1212, 960)}
# The tap map's cell, in source pixels.
CELL = 8

# Each sex's picture, drawn by hand from it:
# - `middles`: the front figure's middle (its sternum) and the back's (its spine) -- a mirrored area
#   is drawn for the figure's left of the picture and mirrored across it;
# - `regions`: each group's areas on each side, in source pixels: (polygon, 'gold' or 'body',
#   mirrored). A gold area takes the gold inside it; a body area the whole body inside it.
MALE_REGIONS = {
    'front': {
        'shoulders': [([(378, 160), (462, 158), (468, 200), (452, 250), (440, 264), (398, 264), (374, 226)], 'gold', True)],
        'chest': [([(462, 150), (634, 150), (644, 250), (630, 266), (548, 274), (466, 266), (452, 250)], 'gold', False)],
        'biceps': [([(398, 236), (456, 236), (458, 300), (448, 354), (404, 358), (395, 300)], 'gold', True)],
        'forearms': [([(346, 300), (396, 296), (403, 352), (446, 350), (440, 400), (420, 470), (368, 478), (343, 440), (343, 360)], 'body', True)],
        'core': [([(466, 268), (630, 268), (630, 330), (616, 400), (602, 428), (578, 442), (548, 450), (518, 442), (494, 428), (480, 400), (466, 330)], 'body', False)],
        'quadriceps': [([(428, 420), (522, 436), (530, 520), (526, 645), (468, 648), (430, 600)], 'gold', True)],
        'adductors': [([(512, 440), (530, 455), (546, 490), (546, 540), (535, 590), (522, 600), (516, 520)], 'body', True)],
        'calves': [([(422, 650), (522, 650), (522, 885), (422, 885)], 'gold', True)],
    },
    'back': {
        'shoulders': [([(838, 160), (905, 158), (912, 200), (905, 250), (872, 264), (836, 242), (828, 200)], 'gold', True)],
        'back': [
            ([(905, 100), (1085, 100), (1092, 175), (1090, 250), (1000, 350), (990, 350), (900, 250), (898, 175)], 'gold', False),
            ([(902, 215), (1088, 215), (1090, 245), (1085, 300), (1078, 340), (1070, 392), (995, 398), (920, 392), (912, 340), (905, 300), (900, 245)], 'body', False),
        ],
        'triceps': [([(828, 236), (900, 240), (903, 300), (892, 350), (872, 368), (834, 362), (823, 300)], 'gold', True)],
        'forearms': [([(800, 350), (884, 334), (880, 380), (856, 456), (814, 462), (795, 420)], 'body', True)],
        'glutes': [([(898, 382), (1092, 382), (1088, 516), (902, 516)], 'gold', False)],
        'hamstrings': [([(894, 505), (992, 505), (992, 668), (894, 668)], 'gold', True)],
        'calves': [([(858, 640), (987, 640), (987, 892), (858, 892)], 'gold', True)],
    },
}
FEMALE_REGIONS = {
    'front': {
        'shoulders': [([(410, 175), (470, 180), (470, 215), (462, 238), (445, 246), (415, 250), (405, 220)], 'gold', True)],
        'chest': [([(468, 170), (614, 170), (622, 240), (608, 282), (541, 286), (474, 282), (460, 240)], 'gold', False)],
        'biceps': [([(415, 238), (466, 238), (467, 290), (459, 346), (425, 350), (412, 300)], 'gold', True)],
        'forearms': [([(378, 298), (418, 294), (426, 346), (462, 346), (455, 400), (440, 470), (390, 476), (370, 432), (370, 350)], 'body', True)],
        'core': [([(476, 272), (606, 272), (608, 330), (600, 400), (585, 425), (560, 440), (541, 445), (522, 440), (497, 425), (482, 400), (474, 330)], 'body', False)],
        'quadriceps': [([(436, 390), (522, 405), (530, 500), (526, 632), (468, 638), (436, 590)], 'gold', True)],
        'adductors': [([(505, 418), (522, 428), (536, 468), (536, 525), (528, 570), (516, 580), (510, 520)], 'body', True)],
        'calves': [([(418, 636), (522, 636), (522, 892), (418, 892)], 'gold', True)],
    },
    'back': {
        'shoulders': [([(868, 172), (920, 168), (928, 205), (920, 246), (895, 260), (866, 242), (858, 205)], 'gold', True)],
        'back': [
            ([(915, 112), (1079, 112), (1084, 180), (1080, 240), (1002, 348), (992, 348), (914, 240), (910, 180)], 'gold', False),
            ([(912, 215), (1082, 215), (1085, 250), (1078, 300), (1072, 340), (1068, 392), (997, 398), (926, 392), (922, 340), (916, 300), (909, 250)], 'body', False),
        ],
        'triceps': [([(856, 232), (916, 240), (919, 300), (906, 350), (886, 366), (856, 362), (848, 300)], 'gold', True)],
        'forearms': [([(828, 346), (896, 334), (891, 386), (871, 460), (834, 466), (820, 420)], 'body', True)],
        'glutes': [([(892, 382), (1102, 382), (1102, 500), (1050, 507), (997, 501), (944, 507), (892, 500)], 'gold', False)],
        'hamstrings': [([(898, 500), (996, 500), (996, 656), (898, 656)], 'gold', True)],
        'calves': [([(868, 648), (993, 648), (993, 896), (868, 896)], 'gold', True)],
    },
}
ART = {
    'male': {'middles': {'front': 548, 'back': 995}, 'regions': MALE_REGIONS},
    'female': {'middles': {'front': 541, 'back': 997}, 'regions': FEMALE_REGIONS},
}
# Where areas overlap, the earlier group takes the pixel.
PRIORITY = ['chest', 'shoulders', 'biceps', 'triceps', 'back', 'core', 'forearms', 'glutes',
            'quadriceps', 'adductors', 'hamstrings', 'calves']
# The tap map's letter for each group ('.' none).
CODES = {group: chr(ord('a') + i) for i, group in enumerate(PRIORITY)}


def polygon_mask(shape, points):
    """A polygon's inside, as a boolean picture."""
    from PIL import ImageDraw

    img = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(img).polygon(points, fill=255)
    return np.asarray(img) > 0


def body_mask(lum):
    """The two figures: the background is smooth, the body drawn in fine fibres."""
    detail = lum - ndi.gaussian_filter(lum, 2.0)
    texture = np.sqrt(ndi.uniform_filter(detail ** 2, 7))
    mask = texture > 0.005
    mask = ndi.binary_closing(mask, structure=np.ones((5, 5)), iterations=2)
    mask = ndi.binary_fill_holes(mask)
    mask = ndi.binary_opening(mask, structure=np.ones((3, 3)), iterations=2)
    labels, count = ndi.label(mask)
    sizes = ndi.sum(mask, labels, range(1, count + 1))
    keep = np.argsort(sizes)[::-1][:2] + 1
    # The closing reaches a few pixels into the glow round the body: take them back.
    return ndi.binary_erosion(np.isin(labels, keep), iterations=3)


def main(source, sex='male'):
    rgb = np.asarray(Image.open(source).convert('RGB')).astype(float) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    high, low = rgb.max(axis=2), rgb.min(axis=2)
    sat = np.where(high > 0, (high - low) / np.maximum(high, 1e-6), 0)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    body = body_mask(lum)
    # The gold, softly: how gold each pixel is, 0 to 1, on the body only.
    goldness = np.clip((sat - 0.3) / 0.3, 0, 1) * ((r > g) & (g > b) & (high > 0.2)) * body
    gold = ndi.binary_dilation(goldness > 0.5, iterations=2) & body

    # The body in grey: the gold brought down to the grey of the muscles round it.
    grey_level = np.median(lum[body & (goldness < 0.1)])
    gold_level = np.median(lum[goldness > 0.8])
    grey = lum * (1 - goldness * (1 - grey_level / gold_level))
    alpha_body = ndi.gaussian_filter(body.astype(float), 0.8)

    os.makedirs(os.path.join(OUT, sex), exist_ok=True)
    out = {}
    art = ART[sex]
    for side, (x0, y0, x1, y1) in CROPS.items():
        middle = art['middles'][side]
        taken = np.zeros(lum.shape, bool)
        labels = np.full(lum.shape, '.', dtype='<U1')
        layers = {}
        for group in PRIORITY:
            areas = art['regions'][side].get(group)
            if not areas:
                continue
            mask = np.zeros(lum.shape, bool)
            for points, kind, mirrored in areas:
                shapes = [points] + ([[(2 * middle - x, y) for x, y in points]] if mirrored else [])
                for shape in shapes:
                    inside = polygon_mask(lum.shape, shape)
                    if kind == 'gold':
                        # The gold's highlights (white, not gold) are the muscle too.
                        mask |= ndi.binary_fill_holes(inside & gold) & inside & body
                    else:
                        mask |= inside & body
            mask &= ~taken
            taken |= mask
            labels[mask] = CODES[group]
            soft = ndi.gaussian_filter(mask.astype(float), 1.0) * alpha_body
            # As strong as it's lit, against the group's own brightest -- its shading kept.
            lit = np.where(gold, lum, grey)
            top = np.percentile(lit[mask], 97) if mask.any() else 1.0
            # Deep in the shadows, faint: the grey's fibres and creases show through the colour.
            shade = 0.22 + 0.78 * np.clip(lit / max(top, 1e-6), 0, 1.0) ** 1.6
            # A glow round it, off the body.
            glow = ndi.gaussian_filter(mask.astype(float), 14) * 0.85 * (1 - alpha_body)
            alpha = np.clip(soft * shade + glow, 0, 1)
            layers[group] = alpha

        crop = (slice(y0, y1), slice(x0, x1))
        base = np.dstack([grey[crop]] * 3 + [alpha_body[crop]]) * 255
        Image.fromarray(base.clip(0, 255).astype(np.uint8), 'RGBA').save(
            os.path.join(OUT, sex, f'{side}-body.webp'), 'WEBP', quality=86, method=6)
        for group, alpha in layers.items():
            layer = np.dstack([np.ones(alpha[crop].shape)] * 3 + [alpha[crop]]) * 255
            Image.fromarray(layer.clip(0, 255).astype(np.uint8), 'RGBA').save(
                os.path.join(OUT, sex, f'{side}-{group}.webp'), 'WEBP', quality=86, method=6)

        # The tap map: each cell's group, the one covering most of it (none under a quarter).
        rows = []
        for y in range(y0, y1, CELL):
            row = ''
            for x in range(x0, x1, CELL):
                cell = labels[y:y + CELL, x:x + CELL].ravel()
                codes, counts = np.unique(cell[cell != '.'], return_counts=True)
                row += codes[np.argmax(counts)] if counts.size and counts.max() >= CELL * CELL / 4 else '.'
            rows.append(row)
        out[side] = {'groups': list(layers), 'rows': rows, 'size': [x1 - x0, y1 - y0]}
        print(side, 'groups', list(layers))

    # What this sex's art holds, kept here: the map is written from every sex's.
    with open(os.path.join(HERE, f'{sex}.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f)
    write_map()


def write_map():
    sexes = {}
    for sex in ('male', 'female'):
        path = os.path.join(HERE, f'{sex}.json')
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                sexes[sex] = json.load(f)
    lines = [
        '// GENERATED by tools/muscle-heatmap/cut.py -- do not edit by hand.',
        "// The Muscles tab's heat map (Harbir's art): each side's body in grey, each muscle group's",
        '// muscles alone to tint in its heat colour, and a tap map of which group is where.',
        "import type { MuscleGroup } from '../exercises/muscleGroups';",
        '',
        'export interface HeatmapSide {',
        '  /** The body alone, grey, on a clear background. */',
        '  body: number;',
        '  /** Width over height. */',
        '  aspect: number;',
        "  /** Each group's muscles alone, white: tinted in its heat colour over `body`. */",
        '  layers: Partial<Record<MuscleGroup, number>>;',
        '  /** The tap map: rows top to bottom, a letter per cell (`TAP_CODES`), `.` for none. */',
        '  tapRows: string[];',
        '}',
        '',
        '/** Which group each tap-map letter is. */',
        'export const TAP_CODES: Record<string, MuscleGroup> = {',
    ]
    for group, code in CODES.items():
        lines.append(f"  {code}: '{group}',")
    lines += [
        '};',
        '',
        "/** Each sex's figure that's been drawn; a sex without one uses the other's. */",
        "export const MUSCLE_HEATMAP: Partial<Record<'male' | 'female', Record<'front' | 'back', HeatmapSide>>> = {",
    ]
    for sex, out in sexes.items():
        lines.append(f'  {sex}: {{')
        for side, info in out.items():
            w, h = info['size']
            lines.append(f'    {side}: {{')
            lines.append(f"      body: require('../../assets/muscle-heatmap/{sex}/{side}-body.webp'),")
            lines.append(f'      aspect: {round(w / h, 4)},')
            lines.append('      layers: {')
            for group in info['groups']:
                lines.append(f"        {group}: require('../../assets/muscle-heatmap/{sex}/{side}-{group}.webp'),")
            lines.append('      },')
            lines.append('      tapRows: [')
            for row in info['rows']:
                lines.append(f"        '{row}',")
            lines.append('      ],')
            lines.append('    },')
        lines.append('  },')
    lines += ['};', '']
    with open(MAP, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))


if __name__ == '__main__':
    main(*sys.argv[1:])
