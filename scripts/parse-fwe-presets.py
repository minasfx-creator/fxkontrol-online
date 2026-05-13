"""Extract preset metadata from .fwe (Finale 3D / FWsim XML).

Outputs a JSON array (one object per .fwe file) with the shape consumed
by `src/data/fwsimBuiltinPresets.ts`. Run from the repo root:

    python3 scripts/parse-fwe-presets.py > src/data/fwsimBuiltinPresets.json
"""
import glob
import json
import os
import re
from xml.etree import ElementTree as ET

NAMED_COLORS = {
    'PastelRed': '#FF6B6B', 'Red': '#FF1A1A', 'PastelGreen': '#7CFFB0',
    'Green': '#00E676', 'PastelBlue': '#7DB6FF', 'Blue': '#3F7BFF',
    'Yellow': '#FFD600', 'Orange': '#FF8A00', 'Pink': '#FF66C4',
    'Purple': '#A24BFF', 'Magenta': '#FF00C8', 'Cyan': '#33D6FF',
    'Aqua': '#33D6FF', 'White': '#FFFFFF', 'Silver': '#E5E5E5',
    'Gold': '#FFD27A', 'Spark': '#FFE2AE', 'Brocade': '#FFE2AE',
    'Lemon': '#FFF59A', 'Invisible': None,
}

XSI_TYPE = '{http://www.w3.org/2001/XMLSchema-instance}type'


def hex_from(r, g, b):
    return '#%02X%02X%02X' % (
        max(0, min(255, int(float(r)))),
        max(0, min(255, int(float(g)))),
        max(0, min(255, int(float(b)))),
    )


def slugify(s):
    s = re.sub(r'\.fwe$', '', s, flags=re.IGNORECASE)
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return s


def parse(path):
    raw = open(path, encoding='utf-8-sig').read()
    root = ET.fromstring(raw)
    name = next(
        (e.text for e in root.iter() if (e.tag.endswith('}Name') or e.tag == 'Name') and e.text),
        None,
    )
    author = next(
        (e.text for e in root.iter() if (e.tag.endswith('}Author') or e.tag == 'Author') and e.text),
        None,
    )

    # First non-trivial xsi:type at the top of the tree
    root_type = None
    for el in root.iter():
        t = el.attrib.get(XSI_TYPE)
        if t and t in ('Cake', 'Shell', 'Mine', 'Lancework', 'RomanCandle', 'Fountain'):
            root_type = t
            break
    if root_type is None:
        for el in root.iter():
            t = el.attrib.get(XSI_TYPE)
            if t:
                root_type = t
                break

    # Walk colors (Color text + sibling CustomR/G/B)
    palette = []
    for parent in root.iter():
        children = list(parent)
        for c in children:
            if not (c.tag.endswith('Color') or c.tag == 'Color'):
                continue
            color_name = (c.text or '').strip()
            if color_name in ('', 'Invisible', 'true', 'false', 'True', 'False'):
                continue
            if color_name == 'Custom':
                r = g = b = None
                for sib in children:
                    tag = sib.tag.split('}')[-1]
                    if tag == 'CustomR':
                        r = sib.text
                    elif tag == 'CustomG':
                        g = sib.text
                    elif tag == 'CustomB':
                        b = sib.text
                if r is not None and g is not None and b is not None:
                    hx = hex_from(r, g, b)
                    if hx not in palette:
                        palette.append(hx)
            else:
                hx = NAMED_COLORS.get(color_name)
                if hx and hx not in palette:
                    palette.append(hx)
            if len(palette) >= 8:
                break
        if len(palette) >= 8:
            break

    # Numerics
    def collect(tag):
        return [
            el.text for el in root.iter()
            if (el.tag == tag or el.tag.endswith('}' + tag)) and el.text
        ]

    diameters = [float(x) for x in collect('Diameter')]
    counts = [int(float(x)) for x in collect('Count')]
    shot_counts = [int(float(x)) for x in collect('ShotCount')]
    caliber_in = round(max(diameters) / 0.0254, 1) if diameters else None

    file_name = os.path.basename(path)
    stem = re.sub(r'\.fwe$', '', file_name, flags=re.IGNORECASE)
    leading_num_match = re.match(r'^(\d{1,3})[ _-]', stem)
    leading_num = leading_num_match.group(1).zfill(2) if leading_num_match else None
    fwe_id = 'fin-' + slugify(stem)

    # Thumbnail derived from leading "NN " prefix → public/finale-presets/thumbs/NN.png
    thumb_url = (
        '/finale-presets/thumbs/' + leading_num + '.png' if leading_num else None
    )

    return {
        'id': fwe_id,
        'file': file_name,
        'leadingNumber': leading_num,
        'name': name,
        'author': author,
        'rootType': root_type,
        'caliberM': max(diameters) if diameters else None,
        'caliberIn': caliber_in,
        'starCount': max(counts) if counts else None,
        'shotCount': shot_counts[0] if shot_counts else None,
        'primaryColor': palette[0] if palette else None,
        'secondaryColor': palette[1] if len(palette) >= 2 else None,
        'palette': palette,
        'thumbUrl': thumb_url,
    }


if __name__ == '__main__':
    files = sorted(glob.glob('public/finale-presets/*.fwe'))
    out = []
    for f in files:
        try:
            out.append(parse(f))
        except Exception as e:  # pylint: disable=broad-except
            out.append({'file': os.path.basename(f), 'error': str(e)})
    print(json.dumps(out, indent=2, ensure_ascii=False))
