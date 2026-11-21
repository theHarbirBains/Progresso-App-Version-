"""Downloads Health Canada's Dietary Reference Intakes tables and writes them, as published, to
sources/health-canada-dri.json -- the reference values' source of truth (generate.mjs reads it).

Usage, from the repository root:  python supabase/nutrients/fetch_dri.py [--from <dir>]
  --from <dir>  read the three pages from <dir> (reference-values-vitamins.html, ...) instead of
                downloading them -- for when canada.ca is slow to answer a script; fetch them with
                a browser or curl first. The file still records the published addresses.

Nothing is interpreted here: every table cell is kept as its text (footnote markers included,
"ND" left as it is), every footnote by its table and marker, each page with its address, title
and Health Canada's own "date modified". Run it again to see whether Health Canada changed
anything (the file is in git), then `npm run db:nutrients`. Standard library only.
"""

import datetime
import html
import json
import os
import re
import sys
import urllib.request
from html.parser import HTMLParser

BASE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables'
PAGES = {
    'vitamins': f'{BASE}/reference-values-vitamins.html',
    'elements': f'{BASE}/reference-values-elements.html',
    'macronutrients': f'{BASE}/reference-values-macronutrients.html',
}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sources', 'health-canada-dri.json')


def squash(text):
    return re.sub(r'\s+', ' ', text).strip()


class TableParser(HTMLParser):
    """Each top-level <table>: its caption and its rows, a cell as text with its column span."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.depth = [], 0
        self.table = self.row = self.cell = None
        self.in_caption = False
        self.in_footnotes = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'table':
            self.depth += 1
            if self.depth == 1:
                self.table = {'caption': '', 'rows': []}
            return
        if self.table is None:
            return
        # A table's own footnotes sit in a list inside it: they're read separately.
        if tag == 'dl':
            self.in_footnotes += 1
        if self.in_footnotes:
            return
        if tag == 'caption':
            self.in_caption = True
        elif tag == 'tr':
            self.row = []
        elif tag in ('td', 'th'):
            self.cell = {'text': '', 'span': int(a.get('colspan') or 1)}
        elif tag == 'sup' and self.cell is not None:
            self.cell['text'] += '^'

    def handle_endtag(self, tag):
        if self.table is None:
            return
        if tag == 'dl' and self.in_footnotes:
            self.in_footnotes -= 1
            return
        if tag == 'table':
            self.depth -= 1
            if self.depth == 0:
                self.table['caption'] = squash(self.table['caption'])
                self.tables.append(self.table)
                self.table = None
        elif self.in_footnotes:
            return
        elif tag == 'caption':
            self.in_caption = False
        elif tag in ('td', 'th') and self.cell is not None and self.row is not None:
            self.row.append({'text': squash(self.cell['text']), 'span': self.cell['span']})
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if self.row:
                self.table['rows'].append(self.row)
            self.row = None

    def handle_data(self, data):
        if self.table is None or self.in_footnotes:
            return
        if self.in_caption:
            self.table['caption'] += data
        elif self.cell is not None:
            self.cell['text'] += data


def footnotes(page):
    """Every footnote, keyed "<table>:<marker>" ("2:19", "1:*"), its text as published."""
    found = {}
    pattern = re.compile(
        r'<dt>\s*Table\s+(\d+)\s+[Ff]ootnote\s+([^<\s]+)\s*</dt>\s*<dd[^>]*>(.*?)</dd>', re.S
    )
    for table, marker, body in pattern.findall(page):
        paragraphs = [
            squash(html.unescape(re.sub(r'<[^>]+>', ' ', p)))
            for p in re.findall(r'<p(?![^>]*fn-rtn)[^>]*>(.*?)</p>', body, re.S)
        ]
        found[f'{table}:{marker}'] = ' '.join(p for p in paragraphs if p)
    return found


def additional_recommendations(page):
    """The macronutrient page's list of recommendations with no number (saturated fat, ...)."""
    text = squash(html.unescape(re.sub(r'<[^>]+>', ' ', page)))
    found = {}
    for name in ('Saturated fatty acids', 'Trans fatty acids', 'Dietary cholesterol', 'Added sugars'):
        match = re.search(re.escape(name) + r': (.*?)(?= [A-Z][a-z]+ [a-z]+ ?[a-z]*: | Although|$)', text)
        if match:
            found[name] = match.group(1).strip()
    return found


def fetch(url):
    request = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
    })
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read().decode('utf-8')


def main():
    local = sys.argv[sys.argv.index('--from') + 1] if '--from' in sys.argv else None
    out = {'retrievedAt': datetime.date.today().isoformat(), 'pages': {}}
    for key, url in PAGES.items():
        if local:
            with open(os.path.join(local, url.rsplit('/', 1)[-1]), encoding='utf-8') as f:
                page = f.read()
        else:
            page = fetch(url)
        parser = TableParser()
        parser.feed(page)
        title = re.search(r'<title>\s*(.*?)\s*</title>', page, re.S)
        modified = re.search(r'dcterms\.modified"[^>]*content="([0-9-]+)"', page)
        entry = {
            'url': url,
            'title': squash(html.unescape(title.group(1))) if title else None,
            'dateModified': modified.group(1) if modified else None,
            'tables': parser.tables,
            'footnotes': footnotes(page),
        }
        if key == 'macronutrients':
            entry['additionalRecommendations'] = additional_recommendations(page)
        out['pages'][key] = entry
        print(f'{key}: {len(parser.tables)} tables, {len(entry["footnotes"])} footnotes, modified {entry["dateModified"]}')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'Wrote {OUT}')


main()
