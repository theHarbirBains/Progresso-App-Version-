"""Cuts Harbir's muscle-group tile sheets into the Exercise Library's Browse by Muscle pictures.

Each sheet is two rows of four tiles -- the male figures over the female ones -- each a muscle
group's figure with its name and a number drawn under it. The app draws the name and the real
count itself, so only the figure is kept: each tile's inside is cut out, the drawn name and number
are painted over with the tile's own near-black (the figure fading into it as it does on the
sheet), and the result is saved as a WebP per sex and group in apps/mobile/assets/muscle-groups,
with muscleTiles.generated.ts mapping them. The sheets stay outside the repo.

    python -I tools/muscle-tiles/cut.py SHEET1 SHEET2 SHEET3

SHEET1 is Chest, Back, Shoulders, Biceps; SHEET2 Triceps, Forearms, Quadriceps, Hamstrings;
SHEET3 Adductors, Glutes, Calves, Core. Run `npx prettier --write` on the map it writes after.
"""
import os
import sys

import numpy as np
from PIL import Image

GROUPS = [
    ['chest', 'back', 'shoulders', 'biceps'],
    ['triceps', 'forearms', 'quadriceps', 'hamstrings'],
    ['adductors', 'glutes', 'calves', 'core'],
]
SEXES = ['male', 'female']
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'apps', 'mobile', 'assets', 'muscle-groups')
MAP = os.path.join(ROOT, 'apps', 'mobile', 'src', 'exercises', 'muscleTiles.generated.ts')
# The saved picture's size: three times a 100pt tile, at the tile's own shape.
WIDTH = 300
# The tile's own near-black, painted under the name and count.
FILL = (8, 8, 7)
# How far above the drawn name the figure starts fading out.
FADE = 0.16


# Where the sheets' tile borders are (all three share one layout): each found on the sheet by
# its thin lit line, these where one can't be seen (a figure running to the edge).
LEFTS = [126, 538, 934, 1332]
RIGHTS = [502, 901, 1299, 1698]
TOPS = [11, 447]
BOTTOMS = [420, 867]


def thin_lines(counts, k=6):
    """Positions lit along a line with dark a few pixels either side: a tile's border."""
    return [
        i
        for i in range(k, len(counts) - k)
        if counts[i] > 150 and counts[i] >= 3 * max(counts[i - k], counts[i + k])
    ]


def snap(expected, found, outer):
    """The found line nearest where one's expected (its outer edge), else the expected one."""
    near = [f for f in found if abs(f - expected) <= 8]
    if not near:
        return expected
    return min(near) if outer == 'low' else max(near)


def tile_boxes(gray):
    """Each tile's box (x0, y0, x1, y1), row by row, from its thin light border."""
    lit = gray > 30
    cols = thin_lines(lit.sum(axis=0))
    rows = thin_lines(lit.sum(axis=1))
    lefts = [snap(x, cols, 'low') for x in LEFTS]
    rights = [snap(x, cols, 'high') for x in RIGHTS]
    tops = [snap(y, rows, 'low') for y in TOPS]
    bottoms = [snap(y, rows, 'high') for y in BOTTOMS]
    return [(l, t, r, b) for t, b in zip(tops, bottoms) for l, r in zip(lefts, rights)]


def label_top(tile):
    """The first row of the drawn name: white text in the tile's lower half."""
    h = tile.shape[0]
    white = (tile.min(axis=2) > 205) & (np.ptp(tile, axis=2) < 30)
    for y in range(int(h * 0.55), h):
        if white[y].sum() >= 6:
            return y
    raise SystemExit('No name found on a tile')


# The tile's rounded corners: their border's arc is painted out within this radius.
CORNER = 34


def clear_corners(out):
    """Paints each corner outside a rounded arc with the fill, so no border shows there."""
    h, w, _ = out.shape
    fill = np.array(FILL, dtype=float)
    ys, xs = np.mgrid[0:CORNER, 0:CORNER]
    outside = (CORNER - xs) ** 2 + (CORNER - ys) ** 2 > (CORNER - 6) ** 2
    for flip_y in (False, True):
        for flip_x in (False, True):
            mask = outside[::-1] if flip_y else outside
            mask = mask[:, ::-1] if flip_x else mask
            y0 = h - CORNER if flip_y else 0
            x0 = w - CORNER if flip_x else 0
            region = out[y0 : y0 + CORNER, x0 : x0 + CORNER]
            region[mask] = fill


def cut(tile):
    h, w, _ = tile.shape
    top = label_top(tile)
    out = tile.astype(float)
    clear_corners(out)
    fade_from = max(0, top - int(h * FADE))
    fill = np.array(FILL, dtype=float)
    for y in range(fade_from, h):
        # Smoothly to the fill by two pixels above the name, and the fill below.
        t = min(1.0, (y - fade_from) / max(1, top - 2 - fade_from))
        t = t * t * (3 - 2 * t)
        out[y] = out[y] * (1 - t) + fill * t
    return Image.fromarray(out.clip(0, 255).astype(np.uint8)), top / h


def main(sheets):
    if len(sheets) != 3:
        raise SystemExit(__doc__)
    entries = []
    for sheet, groups in zip(sheets, GROUPS):
        image = np.asarray(Image.open(sheet).convert('RGB'))
        boxes = tile_boxes(image.mean(axis=2))
        if len(boxes) != 8:
            raise SystemExit(f'{sheet}: found {len(boxes)} tiles, not 8')
        for i, (x0, y0, x1, y1) in enumerate(boxes):
            sex = SEXES[i // 4]
            group = groups[i % 4]
            # Inside the border and its glow.
            inside = image[y0 + 8 : y1 - 8, x0 + 8 : x1 - 8]
            picture, name_at = cut(inside)
            height = round(WIDTH * picture.height / picture.width)
            picture = picture.resize((WIDTH, height), Image.LANCZOS)
            os.makedirs(os.path.join(OUT, sex), exist_ok=True)
            path = os.path.join(OUT, sex, f'{group}.webp')
            picture.save(path, 'WEBP', quality=84, method=6)
            entries.append((sex, group, picture.width, picture.height))
            print(f'{sex:6} {group:11} {picture.width}x{picture.height}  name at {name_at:.2f}')

    lines = [
        '// GENERATED by tools/muscle-tiles/cut.py -- do not edit by hand.',
        "// Browse by Muscle's pictures: each muscle group's figure, male and female (Harbir's art),",
        '// its name and number painted out for the app to draw its own over the faded bottom.',
        "import type { MuscleGroup } from './muscleGroups';",
        '',
        'export interface MuscleTile {',
        '  image: number;',
        '  /** Width over height. */',
        '  aspect: number;',
        '}',
        '',
        "export const MUSCLE_TILES: Record<'male' | 'female', Partial<Record<MuscleGroup, MuscleTile>>> = {",
    ]
    for sex in SEXES:
        lines.append(f'  {sex}: {{')
        for s, group, w, h in entries:
            if s != sex:
                continue
            lines.append(
                f"    {group}: {{ image: require('../../assets/muscle-groups/{sex}/{group}.webp'), "
                f'aspect: {w / h:.4f} }},'
            )
        lines.append('  },')
    lines.append('};')
    with open(MAP, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main(sys.argv[1:])
