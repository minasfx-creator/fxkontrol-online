#!/usr/bin/env python3
"""Batch extractor for the 159 .fwc tail/insert components.

Walks every `.fwc` under `public/finale-presets/standard-effects/Effect Components/`
and emits a single JSON bundle consumed by `src/data/tailComponentCatalog.ts`.

Honest: extracts only XML facts (Color, Density, Life, Width, Strobe) plus
heuristic `kind` from the filename. No invented numbers.

Run:
    python3 scripts/parse-fwc-components.py
"""
import json, os, re, datetime, glob
from xml.etree import ElementTree as ET

ROOT_DIR = 'public/finale-presets/standard-effects/Effect Components'
OUT_PATH = 'src/data/effectsLibraries/generated/tailComponents.json'

XSI = '{http://www.w3.org/2001/XMLSchema-instance}type'

NAMED = {
    'Red': '#FF1A1A', 'Green': '#00E676', 'Blue': '#3F7BFF',
    'Yellow': '#FFD600', 'Orange': '#FF8A00', 'Pink': '#FF66C4',
    'Purple': '#A24BFF', 'White': '#FFFFFF', 'Silver': '#E5E5E5',
    'Gold': '#FFD27A', 'Brocade': '#FFE2AE', 'Aqua': '#33D6FF',
    'Mint': '#A2FFD6',
}

# Kind detection from filename — ordered, first match wins.
KIND_RULES = [
    (r'criss[- ]cross', 'crissCross'),
    (r'crackling pearls?', 'cracklingPearls'),
    (r'popping flowers?', 'poppingFlowers'),
    (r'dragon eggs?', 'dragonEggs'),
    (r'snowballs?', 'snowballs'),
    (r'mortar sparks?', 'mortarSparks'),
    (r'explosion sparks?', 'explosionSparks'),
    (r'gold spider', 'spider'),
    (r'polyp', 'polyp'),
    (r'microstars?_?\s*\w*\s*strobe', 'microstarStrobe'),
    (r'\bglitter\b', 'glitter'),
    (r'\bcrackling\b', 'crackling'),
    (r'\bspider\b', 'spider'),
    (r'\bbrocade\b', 'brocade'),
    (r'\bgold\b', 'gold'),
    (r'\bsilver\b', 'silver'),
]

LENGTH_RULES = [
    (r'\blong\b', 'long'), (r'\bshort\b', 'short'),
    (r'\bmedium\b', 'medium'), (r'\bthin\b', 'thin'),
    (r'\bthick\b', 'thick'), (r'\bwide\b', 'wide'),
]

SIZE_RULES = [
    (r'\(\s*large\s*\)', 'large'), (r'\(\s*medium\s*\)', 'medium'),
    (r'\(\s*small\s*\)', 'small'),
]


def hexc(r, g, b):
    return '#%02X%02X%02X' % (
        max(0, min(255, int(float(r)))),
        max(0, min(255, int(float(g)))),
        max(0, min(255, int(float(b)))),
    )


def slugify(s):
    s = re.sub(r'\.fwc$', '', s, flags=re.IGNORECASE)
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return s


def detect_kind(name_lower):
    for pat, k in KIND_RULES:
        if re.search(pat, name_lower):
            return k
    return 'none'


def detect_length(name_lower):
    for pat, k in LENGTH_RULES:
        if re.search(pat, name_lower):
            return k
    return None


def detect_size(name_lower):
    for pat, k in SIZE_RULES:
        if re.search(pat, name_lower):
            return k
    return None


def extract(path):
    raw = open(path, encoding='utf-8-sig', errors='replace').read()
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return None

    palette = []
    densities = []
    widths = []
    lives = []
    strobe = False
    strobe_freqs = []

    for el in root.iter():
        tag = el.tag.split('}')[-1]
        if tag == 'Color':
            text = (el.text or '').strip()
            if text in NAMED:
                hx = NAMED[text]
                if hx not in palette and len(palette) < 4:
                    palette.append(hx)
        elif tag == 'CustomR':
            # Custom color sibling triplet under the same parent
            parent = None
            for cand in root.iter():
                if el in list(cand):
                    parent = cand
                    break
            if parent is not None:
                r = el.text
                g = b = None
                for sib in parent:
                    st = sib.tag.split('}')[-1]
                    if st == 'CustomG': g = sib.text
                    elif st == 'CustomB': b = sib.text
                if g is not None and b is not None:
                    try:
                        hx = hexc(r, g, b)
                        if hx not in palette and len(palette) < 4:
                            palette.append(hx)
                    except (TypeError, ValueError):
                        pass
        elif tag == 'Density' and el.text:
            try: densities.append(float(el.text))
            except ValueError: pass
        elif tag == 'Width' and el.text:
            try: widths.append(float(el.text))
            except ValueError: pass
        elif tag == 'Life' and el.text:
            try: lives.append(float(el.text))
            except ValueError: pass
        elif tag == 'Strobe' and (el.text or '').strip().lower() == 'true':
            strobe = True
        elif tag == 'StrobeFreqMean' and el.text:
            try: strobe_freqs.append(float(el.text))
            except ValueError: pass

    file_name = os.path.basename(path)
    stem = re.sub(r'\.fwc$', '', file_name, flags=re.IGNORECASE)
    name_lower = stem.lower()
    rel = os.path.relpath(path, ROOT_DIR).replace('\\', '/')
    collection = rel.split('/')[0] if '/' in rel else '_root'
    deprecated = 'deprecated' in rel.lower()

    return {
        'id': 'fwc-' + slugify(collection) + '-' + slugify(stem),
        'fileName': file_name,
        'collection': collection,
        'displayName': stem,
        'kind': detect_kind(name_lower),
        'color': palette,
        'density': round(max(densities), 1) if densities else None,
        'width': round(max(widths), 3) if widths else None,
        'life': round(max(lives), 3) if lives else None,
        'length': detect_length(name_lower),
        'size': detect_size(name_lower),
        'strobe': strobe,
        'strobeFreqHz': round(max(strobe_freqs), 2) if strobe_freqs else None,
        'deprecated': deprecated,
    }


def main():
    parts = []
    by_kind = {}
    files = sorted(glob.glob(os.path.join(ROOT_DIR, '**', '*.fwc'), recursive=True))
    for path in files:
        rec = extract(path)
        if rec is None:
            continue
        parts.append(rec)
        by_kind[rec['kind']] = by_kind.get(rec['kind'], 0) + 1
    bundle = {
        'version': 1,
        'generatedAt': datetime.datetime.utcnow().isoformat() + 'Z',
        'total': len(parts),
        'byKind': by_kind,
        'parts': parts,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(bundle, f, separators=(',', ':'))
    print(f'wrote {OUT_PATH} — {len(parts)} tail components')
    for k, n in sorted(by_kind.items(), key=lambda x: -x[1]):
        print(f'  {n:4d}  {k}')


if __name__ == '__main__':
    main()
