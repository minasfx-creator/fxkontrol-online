#!/usr/bin/env python3
"""Batch extractor for the Standard Effects pack.

Walks every `.fwe` under `public/finale-presets/standard-effects/` and emits
a single JSON bundle consumed by `src/data/standardEffectsCatalog.ts`.

Run:
    python3 scripts/parse-standard-effects.py
"""
import json, os, re, sys, datetime, glob
from xml.etree import ElementTree as ET

ROOT_DIR = 'public/finale-presets/standard-effects'
OUT_PATH = 'src/data/effectsLibraries/generated/standardEffects.json'

NAMED = {
    'PastelRed': '#FF6B6B', 'Red': '#FF1A1A', 'DarkRed': '#B00000',
    'PastelGreen': '#7CFFB0', 'Green': '#00E676', 'DarkGreen': '#007A2E',
    'PastelBlue': '#7DB6FF', 'Blue': '#3F7BFF', 'DarkBlue': '#1C3A8A',
    'Yellow': '#FFD600', 'Orange': '#FF8A00', 'Pink': '#FF66C4',
    'PastelPink': '#FFC0DA', 'PastelPurple': '#D5B8FF',
    'Purple': '#A24BFF', 'Magenta': '#FF00C8', 'Cyan': '#33D6FF',
    'Aqua': '#33D6FF', 'Mint': '#A2FFD6', 'Lime': '#B6FF3F',
    'White': '#FFFFFF', 'Silver': '#E5E5E5', 'Gold': '#FFD27A',
    'Spark': '#FFE2AE', 'Brocade': '#FFE2AE', 'Lemon': '#FFF59A',
    'Invisible': None,
}
XSI = '{http://www.w3.org/2001/XMLSchema-instance}type'
KNOWN_ROOTS = ('Shell', 'Mine', 'Cake', 'Bengal', 'RomanCandle', 'Fountain',
               'Rocket', 'Crossette', 'Farfalle', 'Whistle', 'Eruption',
               'Tourbillon', 'Lancework')

# Extended sub-types (not always root; detected if first xsi:type matches OR appears as primary effect).
EXTENDED_TYPES = ('Vulcano', 'PhotoFlash', 'FlameJet', 'Lycopodium', 'Sparkler',
                  'Nautical', 'FrontPiece', 'GroundShellFlash', 'Sun')

CALIBER_TOKENS = [
    (r'\(\s*xsmall\s*\)|\bxsmall\b', 0.8),
    (r'\(\s*small\s*\)|\bsmall\b', 1.5),
    (r'\(\s*medium\s*\)|\bmedium\b', 2.5),
    (r'\(\s*big\s*\)|\bbig\b|\blarge\b', 4.0),
]

# Common color tokens for phase parsing.
PHASE_COLORS = {
    'red': '#FF1A1A', 'green': '#00E676', 'blue': '#3F7BFF',
    'yellow': '#FFD600', 'orange': '#FF8A00', 'pink': '#FF66C4',
    'purple': '#A24BFF', 'white': '#FFFFFF', 'silver': '#E5E5E5',
    'gold': '#FFD27A', 'aqua': '#33D6FF', 'mint': '#A2FFD6',
    'magenta': '#FF00C8', 'cyan': '#33D6FF',
    'pastel red': '#FF6B6B', 'pastel green': '#7CFFB0',
    'pastel blue': '#7DB6FF', 'pastel purple': '#D5B8FF',
    'coal gold': '#9C7A1C', 'charcoal gold': '#7A6818',
    'silver charcoal': '#8C8C8C', 'gold charcoal': '#8A6E1A',
    'brocade': '#FFE2AE', 'titanium': '#F5F5F5',
}


def parse_color_phases(stem):
    """Parse name like 'Red to Green' or 'X & Y' → [{at, hex, modifier?}]."""
    s = stem.lower()
    phases = []
    # Match modifiers
    mod = None
    if 'strobe' in s: mod = 'strobe'
    elif 'crackle' in s or 'crackling' in s: mod = 'crackle'
    elif 'glitter' in s: mod = 'glitter'
    elif 'charcoal' in s: mod = 'charcoal'
    # 'X to Y' transitions
    m = re.search(r'\b([a-z][a-z ]{1,18}?)\s+to\s+([a-z][a-z ]{1,18}?)(?=\s|$|[.,)\]\[])', s)
    if m:
        a, b = m.group(1).strip(), m.group(2).strip()
        ha = PHASE_COLORS.get(a) or next((v for k, v in PHASE_COLORS.items() if a.endswith(k)), None)
        hb = PHASE_COLORS.get(b) or next((v for k, v in PHASE_COLORS.items() if b.endswith(k)), None)
        if ha and hb:
            phases.append({'at': 0.0, 'hex': ha})
            phases.append({'at': 1.0, 'hex': hb, **({'modifier': mod} if mod else {})})
    return phases


def parse_tail_ref(stem):
    """Extract [Brocade Tail Medium] style references from filename."""
    m = re.search(r'\[([^\]]+)\]', stem)
    if not m: return None
    inner = m.group(1).strip()
    if inner.lower() == 'none': return 'none'
    return inner


def infer_caliber_from_name(stem, default=None):
    s = stem.lower()
    for pat, val in CALIBER_TOKENS:
        if re.search(pat, s):
            return val
    return default


def hexc(r, g, b):
    return '#%02X%02X%02X' % (
        max(0, min(255, int(float(r)))),
        max(0, min(255, int(float(g)))),
        max(0, min(255, int(float(b)))),
    )


def slugify(s):
    s = re.sub(r'\.fwe$', '', s, flags=re.IGNORECASE)
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return s


def bengal_seconds_from_name(name):
    m = re.search(r'\(\s*0*(\d{1,3})\s*s\s*\)', name, re.IGNORECASE)
    return int(m.group(1)) if m else None


def extract(path):
    raw = open(path, encoding='utf-8-sig').read()
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return None
    root_type = None
    distribution = None
    for el in root.iter():
        t = el.attrib.get(XSI)
        if not t:
            continue
        if root_type is None and t in KNOWN_ROOTS:
            root_type = t
        if distribution is None and t.endswith('Distribution'):
            distribution = t
    if root_type is None:
        for el in root.iter():
            t = el.attrib.get(XSI)
            if t:
                root_type = t
                break
    palette = []
    color_phases = []
    for parent in root.iter():
        children = list(parent)
        for c in children:
            tag = c.tag.split('}')[-1]
            if tag != 'Color':
                continue
            name = (c.text or '').strip()
            if name in ('', 'true', 'false', 'True', 'False'):
                continue
            if name == 'Custom':
                r = g = b = None
                for sib in children:
                    st = sib.tag.split('}')[-1]
                    if st == 'CustomR': r = sib.text
                    elif st == 'CustomG': g = sib.text
                    elif st == 'CustomB': b = sib.text
                if r is not None and g is not None and b is not None:
                    hx = hexc(r, g, b)
                    if hx not in palette and len(palette) < 8:
                        palette.append(hx)
            elif name in NAMED:
                hx = NAMED[name]
                if hx and hx not in palette and len(palette) < 8:
                    palette.append(hx)

    def collect_floats(tag):
        out = []
        for el in root.iter():
            t = el.tag.split('}')[-1]
            if t == tag and el.text:
                try: out.append(float(el.text))
                except ValueError: pass
        return out

    diameters = collect_floats('Diameter')
    caliber_in = round(max(diameters) / 0.0254, 1) if diameters else None
    counts = [int(x) for x in collect_floats('Count')]
    shot_counts = [int(x) for x in collect_floats('ShotCount')]
    rows = [int(x) for x in collect_floats('Rows')]
    fan_angles = collect_floats('FanAngle') or collect_floats('SpreadAngle')
    prefires = collect_floats('Prefire') or collect_floats('PreFire')
    lifts = collect_floats('Lift') or collect_floats('LiftTime')

    has_pistil = '<Name>Pistil</Name>' in raw or 'Pistil' in raw and 'pistil' in raw.lower()
    has_tails_link = 'xsi:type="CustomTailsLink"' in raw
    has_crackling = 'xsi:type="Crackling"' in raw or 'xsi:type="CustomCracklingLink"' in raw
    sub_shells = raw.count('xsi:type="SubShells"')

    file_name = os.path.basename(path)
    rel = os.path.relpath(path, ROOT_DIR).replace('\\', '/')
    collection = rel.split('/')[0]
    subPath = '/'.join(rel.split('/')[1:-1]) or None
    stem = re.sub(r'\.fwe$', '', file_name, flags=re.IGNORECASE)
    return {
        'id': 'se-' + slugify(collection) + '-' + slugify(stem),
        'fileName': file_name,
        'collection': collection,
        'subPath': subPath,
        'displayName': stem,
        'rootType': root_type,
        'distribution': distribution[:-len('Distribution')] if distribution else None,
        'palette': palette,
        'primary': palette[0] if palette else None,
        'secondary': palette[1] if len(palette) > 1 else None,
        'caliberIn': caliber_in,
        'shotCount': max(shot_counts) if shot_counts else None,
        'cakeRows': max(rows) if rows else None,
        'starCount': max(counts) if counts else None,
        'fanAngleDeg': max(fan_angles) if fan_angles else None,
        'prefire': prefires[0] if prefires else None,
        'lift': lifts[0] if lifts else None,
        'hasPistil': has_pistil,
        'hasTailsLink': has_tails_link,
        'hasCrackling': has_crackling,
        'subShellCount': sub_shells,
        'bengalDurationS': bengal_seconds_from_name(stem) if root_type == 'Bengal' else None,
    }


def main():
    parts = []
    by_collection = {}
    files = sorted(glob.glob(os.path.join(ROOT_DIR, '**', '*.fwe'), recursive=True))
    for path in files:
        # Skip 'Effect Components' (those are .fwc — fragments, not effects)
        if 'Effect Components' in path:
            continue
        rec = extract(path)
        if rec is None:
            continue
        parts.append(rec)
        c = rec['collection']
        by_collection[c] = by_collection.get(c, 0) + 1
    bundle = {
        'version': 1,
        'generatedAt': datetime.datetime.utcnow().isoformat() + 'Z',
        'totalParts': len(parts),
        'byCollection': by_collection,
        'parts': parts,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(bundle, f, separators=(',', ':'))
    print(f'wrote {OUT_PATH} — {len(parts)} parts across {len(by_collection)} collections')
    for c, n in sorted(by_collection.items()):
        print(f'  {n:4d}  {c}')


if __name__ == '__main__':
    main()
