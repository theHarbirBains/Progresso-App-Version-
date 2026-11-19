"""python tools/guide-cards/publish.py <source_dir>

Publishes How to Do It's card pages to the app: for each built-in exercise listed in cards.json, its
two cards -- page 1, the demonstration and instructions; page 2, Technique & Setup -- as WebPs in
apps/mobile/assets/guide-cards, and apps/mobile/src/exercises/illustrations/guideCards.generated.ts
mapping each exercise's slug to them, formatted by the repo's Prettier.

The cards come from <source_dir> (kept outside the repo): a sheet named in cards.json is a grid of
exercises side by side, page 1 along the top and page 2 under it, a column for each exercise listed,
in order (null for a column to skip). It's cut between its cards -- on the thin lines drawn across a
sheet put together from screenshots; else in the gaps, each card then trimmed to its own border. A
file <slug>_1.png or <slug>_2.png (or .jpg, .webp) in the same folder takes that page's place, for a
card made on its own at full size. Every slug must be an active built-in, listed once. A card is
never made larger than it was drawn, only smaller past MAX_WIDTH. Files of exercises no longer
listed are removed."""
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
# How far from an even split the cut between two rows or two columns can be, as a share of a card:
# page 1 is taller than page 2, and every card's about as wide as the next.
ROW_REACH, COLUMN_REACH = 0.35, 0.25
# A line drawn across the whole sheet is at least this bright end to end (0-255); a card's own
# border isn't, since it stops at the gap between two rows or columns.
DRAWN = 35
# A line of pixels through a card crosses its border, so its brightest are at least this bright
# (0-255); one through the gap between cards, or the space around them, crosses nothing.
EDGE = 48
# The most trimmed off a side of a card, down to its border, px.
MOST_TRIMMED = 60
# How far from an even split a line between two cards of a sheet put together from screenshots is
# (they're laid out evenly), px.
SNAP = 12
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


def is_lined(grey):
    """Whether a sheet has lines drawn between its cards (one put together from screenshots): a line
    drawn right across it between its two rows, bright end to end."""
    height = len(grey)
    near = round(height / ROWS * ROW_REACH)
    return any(np.percentile(grey[y], 2) > DRAWN for y in range(height // 2 - near, height // 2 + near))


def separators(lines, count, reach, lined):
    """Where a sheet's cards part along one side (`lines`: each line of pixels across it), as the
    first and last line between each two, near each even split (within `reach` of a card). On a sheet with lines drawn between its
    cards, the line drawn right across it there, or with none (a card covers part of it), the
    brightest line beside the even split, each with its soft edges; on a sheet without, the darkest
    line of the gap, where no card's border is crossed."""
    size = len(lines)
    near = round(size / count * reach)
    brightness = lines.mean(axis=1)
    drawn = np.percentile(lines, 2, axis=1) > DRAWN
    # A card's border is a few pixels of a line across the whole sheet: its brightest 0.2%.
    peak = np.percentile(lines, 99.8, axis=1)
    found = []
    for k in range(1, count):
        guess = round(k * size / count)
        window = range(guess - near, guess + near)
        if lined:
            on_line = [i for i in window if drawn[i]] or range(guess - SNAP, guess + SNAP)
            first = last = max(on_line, key=lambda i: brightness[i])
            edge = brightness[first] * 0.5
            while brightness[first - 1] >= edge:
                first -= 1
            while brightness[last + 1] >= edge:
                last += 1
        else:
            gap = [i for i in window if peak[i] < EDGE]
            if not gap:
                sys.exit(f'no gap between cards near line {guess}')
            first = last = min(gap, key=lambda i: (peak[i], abs(i - guess)))
        found.append((first, last))
    return found


def trimmed(card):
    """A card cut down to its own border: the lines around it that cross nothing trimmed off each
    side, keeping one for the border's soft edge."""
    grey = np.asarray(card.convert('L'), dtype=float)

    def space(lines):
        # A line through the card crosses its two borders: its brightest 0.5%.
        peak = np.percentile(lines, 99.5, axis=1)
        n = 0
        while n < MOST_TRIMMED and peak[n] < EDGE:
            n += 1
        if n == MOST_TRIMMED:
            sys.exit('a card has no border to trim to')
        return max(n - 1, 0)

    left, right = space(grey.T), space(grey.T[::-1])
    top, bottom = space(grey), space(grey[::-1])
    return card.crop((left, top, card.width - right, card.height - bottom))


def sheet_cards(path, slugs):
    """Each listed exercise's two pages, cut from a sheet's grid. A sheet with lines drawn between
    its cards is cut on them and nothing more (its cards' borders are too faint to trim to); one
    without, in the gaps, each card then trimmed to its border."""
    sheet = Image.open(path)
    grey = np.asarray(sheet.convert('L'), dtype=float)
    lined = is_lined(grey)
    across = separators(grey.T, len(slugs), COLUMN_REACH, lined)
    down = separators(grey, ROWS, ROW_REACH, lined)
    xs = [0] + [b for first, last in across for b in (first, last + 1)] + [sheet.width]
    ys = [0] + [b for first, last in down for b in (first, last + 1)] + [sheet.height]

    def cut(col, row):
        card = sheet.crop((xs[2 * col], ys[2 * row], xs[2 * col + 1], ys[2 * row + 1]))
        return card if lined else trimmed(card)

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
