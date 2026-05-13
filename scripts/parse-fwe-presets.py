"""Extract preset metadata from .fwe (Finale 3D / FWsim XML)."""
import glob, json, os, re
from xml.etree import ElementTree as ET
from collections import Counter

NS = {'xsi': 'http://www.w3.org/2001/XMLSchema-instance'}

NAMED_COLORS = {
    'PastelRed': '#FF6B6B', 'Red': '#FF1A1A', 'PastelGreen': '#7CFFB0',
    'Green': '#00E676', 'PastelBlue': '#7DB6FF', 'Blue': '#3F7BFF',
    'Yellow': '#FFD600', 'Orange': '#FF8A00', 'Pink': '#FF66C4',
    'Purple': '#A24BFF', 'Magenta': '#FF00C8', 'Cyan': '#33D6FF',
    'Aqua': '#33D6FF', 'White': '#FFFFFF', 'Silver': '#E5E5E5',
    'Gold': '#FFD27A', 'Spark': '#FFE2AE', 'Brocade': '#FFE2AE',
    'Lemon': '#FFF59A', 'Invisible': None,
}

def hex_from(r, g, b):
    return '#%02X%02X%02X' % (max(0, min(255, int(r))), max(0, min(255, int(g))), max(0, min(255, int(b))))

def parse(path):
    raw = open(path, encoding='utf-8-sig').read()
    root = ET.fromstring(raw)
    name_el = root.find('.//{*}ComponentID/{*}Name') if False else None
    # Top-level effect name + author
    names = [e.text for e in root.iter() if e.tag.endswith('}Name') or e.tag == 'Name']
    authors = [e.text for e in root.iter() if e.tag.endswith('}Author') or e.tag == 'Author']
    # Effect type = first BaseEffectNode xsi:type at root.Children
    root_type = None
    for child in root.iter():
        t = child.attrib.get('{http://www.w3.org/2001/XMLSchema-instance}type')
        if t and child.tag.endswith('BaseEffectNode'):
            root_type = t
            break
    # Collect all xsi:types
    types = []
    for el in root.iter():
        t = el.attrib.get('{http://www.w3.org/2001/XMLSchema-instance}type')
        if t:
            types.append(t)
    # Colors: walk Stars children and capture Color + (CustomR,G,B)
    colors = []
    for stars in root.iter():
        if stars.attrib.get('{http://www.w3.org/2001/XMLSchema-instance}type') in ('Stars', 'AscentStar', 'Bengal'):
            for star in list(stars) + [stars]:
                pass
        # look for Color sibling tags
    # Simpler: walk tree and group adjacent Color/CustomR/G/B
    def walk(el):
        out = []
        children = list(el)
        for i, c in enumerate(children):
            if c.tag.endswith('Color') or c.tag == 'Color':
                color_name = (c.text or '').strip()
                # find sibling CustomR/G/B in same parent within nearby
                r = g = b = None
                for sib in children:
                    if sib.tag.endswith('CustomR') or sib.tag == 'CustomR':
                        r = sib.text
                    elif sib.tag.endswith('CustomG') or sib.tag == 'CustomG':
                        g = sib.text
                    elif sib.tag.endswith('CustomB') or sib.tag == 'CustomB':
                        b = sib.text
                if color_name == 'Custom' and r is not None:
                    out.append({'name': 'Custom', 'hex': hex_from(r, g, b)})
                elif color_name and color_name not in ('Invisible','true','false','True','False'):
                    out.append({'name': color_name, 'hex': NAMED_COLORS.get(color_name)})
            out.extend(walk(c))
        return out
    raw_colors = walk(root)
    # Dedupe colors keeping first occurrence
    seen = set()
    unique_colors = []
    for c in raw_colors:
        key = (c['name'], c.get('hex'))
        if key in seen: continue
        seen.add(key)
        unique_colors.append(c)
    # Numeric fields
    def collect(tag):
        return [el.text for el in root.iter() if el.tag == tag or el.tag.endswith('}' + tag)]
    diameters = [float(x) for x in collect('Diameter') if x]
    counts = [int(float(x)) for x in collect('Count') if x]
    shot_counts = [int(float(x)) for x in collect('ShotCount') if x]
    lift_charges = [float(x) for x in collect('LiftCharge') if x]
    # Caliber heuristic: largest Diameter (meters → inches via /0.0254)
    caliber_in = round(max(diameters) / 0.0254, 1) if diameters else None
    # Star count: take max Count under Stars-typed nodes (approx via biggest count)
    star_count = max(counts) if counts else None
    return {
        'file': os.path.basename(path),
        'name': names[0] if names else None,
        'author': authors[0] if authors else None,
        'rootType': root_type,
        'subTypes': sorted(set(types) - {root_type}) if root_type else sorted(set(types)),
        'caliberM': max(diameters) if diameters else None,
        'caliberIn': caliber_in,
        'starCount': star_count,
        'shotCount': shot_counts[0] if shot_counts else None,
        'colors': unique_colors[:8],
    }

results = [parse(f) for f in sorted(glob.glob('public/finale-presets/*.fwe'))]
print(json.dumps(results, indent=2, ensure_ascii=False))
