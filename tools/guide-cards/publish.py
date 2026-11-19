"""python tools/guide-cards/publish.py <source_dir>

Publishes How to Do It's card pages to the app: for each built-in exercise listed in cards.json, its
two cards -- page 1, the demonstration and instructions; page 2, Technique & Setup -- as WebPs in
apps/mobile/assets/guide-cards, and apps/mobile/src/exercises/illustrations/guideCards.generated.ts
mapping each exercise's slug to them, formatted by the repo's Prettier.

The cards come from <source_dir> (kept outside the repo): a sheet named in cards.json is a grid of
exercises side by side, page 1 along the top and page 2 under it, a column for each exercise listed,
in order (null for a column to skip). It's cut between its cards -- on the thin line drawn across the
sheet between them where there is one, else in the middle of the dark gap between them. A file
<slug>_1.png or <slug>_2.png (or .jpg, .webp) in the same folder takes that page's place, for a card
made on its own at full size. Every slug must be an active built-in, listed once. A card is never made larger than it was drawn, only smaller past
MAX_WIDTH. Files of exercises no longer listed are removed."""
import json
import os
import re
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ASSETS = os.path.join(ROOT, 'apps', 'mobile', 'assets', 'guide-cards')
ILLUSTRATIONS = os.path.join(ROOT, 'apps', 'mobile', 'src', 'exercises', 'illustrations')
GENERATED = os.path.join(ILLUSTRATIONS, 'guideCards.generated.ts')
ROWS = 2
# How far either side of the cut between two cards is left out, px.
LINE = 3
# A line drawn across the whole sheet is at least this bright end to end (0-255); a card's own
# border isn't, since it stops at the gap between two rows or columns.
DRAWN = 35
# The gap between two cards with no line in it is at least this wide, px.
GAP = 7
# An iPhone's widest page in pixels (430 pt at 3x would be 1290; the card sits inside its margins).
MAX_WIDTH = 1170
QUALITY = 90


def active_slugs():
    """Every active built-in's slug, from the catalogue's generated guides (active ones only)."""
    text = open(os.path.join(ILLUSTRATIONS, 'builtinGuides.generated.ts'), encoding='utf-8').read()
    return set(re.findall(r"^  '([a-z0-9-]+)': \{", text, re.M))


def own_card(source_dir, slug, page):
    """A page made on its own, if there is one."""
    for ext in ('png', 'jpg', 'jpeg', 'webp'):
        path = os.path.join(source_dir, f'{slug}_{page}.{ext}')
        if os.path.exists(path):
            return Image.open(path)
    return None


def cuts(lines, count, reach):
    """Where to cut a sheet between its cards, along one side (`lines`: each line of pixels across
    it): near each even split -- within `reach` of a card, since the cards aren't all one size (page
    1 is taller than page 2) -- on the brightest line drawn right across the sheet, or with none,
    in the middle of the darkest gap."""
    size = len(lines)
    near = round(size / count * reach)
    brightness = lines.mean(axis=1)
    drawn = np.percentile(lines, 2, axis=1) > DRAWN
    gap = np.convolve(brightness, np.ones(GAP) / GAP, mode='same')
    found = []
    for k in range(1, count):
        lo, hi = round(k * size / count) - near, round(k * size / count) + near
        on_line = [i for i in range(lo, hi) if drawn[i]]
        found.append(max(on_line, key=lambda i: brightness[i]) if on_line
                     else lo + int(np.argmin(gap[lo:hi])))
    return found


def sheet_cards(path, slugs):
    """Each listed exercise's two pages, cut from a sheet's grid."""
    sheet = Image.open(path)
    grey = np.asarray(sheet.convert('L'), dtype=float)
    xs = [-LINE] + cuts(grey.T, len(slugs), 0.25) + [sheet.width + LINE]
    ys = [-LINE] + cuts(grey, ROWS, 0.35) + [sheet.height + LINE]
    cut = lambda col, row: sheet.crop((xs[col] + LINE, ys[row] + LINE,
                                       xs[col + 1] - LINE + 1, ys[row + 1] - LINE + 1))
    return {slug: [cut(col, 0), cut(col, 1)] for col, slug in enumerate(slugs) if slug}


def main(source_dir):
    manifest = json.load(open(os.path.join(HERE, 'cards.json'), encoding='utf-8'))
    active = active_slugs()
    cards, problems = {}, []
    for name, slugs in manifest['sheets'].items():
        if not any(slugs):
            problems.append(f'{name}: lists no exercises')
            continue
        for slug in filter(None, slugs):
            if slug not in active:
                problems.append(f'{name}: {slug} is not an active built-in')
            if slug in cards:
                problems.append(f'{name}: {slug} is listed twice')
        cards.update(sheet_cards(os.path.join(source_dir, name), slugs))
    if problems:
        sys.exit('\n'.join(problems))
    os.makedirs(ASSETS, exist_ok=True)
    written, entries = set(), []
    for slug in sorted(cards):
        pages = []
        for page, img in enumerate(cards[slug], start=1):
            img = (own_card(source_dir, slug, page) or img).convert('RGB')
            if img.width > MAX_WIDTH:
                img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
            out = f'{slug}_{page}.webp'
            img.save(os.path.join(ASSETS, out), 'WEBP', quality=QUALITY, method=6)
            written.add(out)
            pages.append((out, img.width / img.height))
        entries.append((slug, pages))
    for name in os.listdir(ASSETS):
        if name not in written:
            os.remove(os.path.join(ASSETS, name))
    lines = [
        '// GENERATED by tools/guide-cards/publish.py -- do not edit by hand.',
        "// How to Do It's two card pages for each built-in exercise that has them, keyed by its slug:",
        '// the demonstration and instructions, then Technique & Setup.',
        '',
        'export interface GuideCardPage {',
        '  image: number;',
        '  /** Width over height. */',
        '  aspect: number;',
        '}',
        '',
        'export const GUIDE_CARDS: Record<string, readonly [GuideCardPage, GuideCardPage]> = {',
    ]
    for slug, pages in entries:
        lines.append(f"  '{slug}': [")
        lines.extend(f"    {{ image: require('../../../assets/guide-cards/{out}'), aspect: {aspect:.4f} }},"
                     for out, aspect in pages)
        lines.append('  ],')
    lines.append('};')
    open(GENERATED, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
    subprocess.run([shutil.which('npx'), 'prettier', '--write', GENERATED], cwd=ROOT, check=True, capture_output=True)
    total = sum(os.path.getsize(os.path.join(ASSETS, f)) for f in written)
    print(f'{len(entries)} exercises, {total / 1048576:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1])
