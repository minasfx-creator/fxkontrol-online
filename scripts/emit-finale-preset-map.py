import json, re, glob, os
data = json.load(open('/tmp/fwe/out.json'))

# Map filename -> canonical id used in src/data/effectLibrary.ts
ID_MAP = {
    '11_Horsetail.fwe': 'fin-11-horsetail',
    '12_Sky_Mine.fwe': 'fin-12-sky-mine',
    '13_Falling_Leaves.fwe': 'fin-13-falling-leaves',
    '14_Titanium_Salut.fwe': 'fin-14-titanium-salut',
    '15_Pattern_Shell_Half_Half.fwe': 'fin-15-pattern-half-half',
    '27_Multibreak_Shell.fwe': 'fin-27-multibreak',
    '28_Dragon_Egg.fwe': 'fin-28-dragon-egg',
    '29_Shell_of_Shells.fwe': 'fin-29-shell-of-shells',
    '30_Warimono.fwe': 'fin-30-warimono',
    '31_Hanabi.fwe': 'fin-31-hanabi',
    '40_Roman_Candle.fwe': 'fin-40-roman-candle',
    '41_Cake_I-Shape.fwe': 'fin-41-cake-i',
    '42_Cake_Z-Shape_V-Shape.fwe': 'fin-42-cake-zv',
    '43_Single_Row.fwe': 'fin-43-single-row',
    '44_Lancework.fwe': 'fin-44-lancework',
}

# Count Mine children (shots) per file
def count_mines(path):
    txt = open(path, encoding='utf-8-sig').read()
    return len(re.findall(r'xsi:type="Mine"', txt))

# Round caliber meters → inches (snap to standard 2/3/4/5/6/8 in)
STD_IN = [2, 3, 4, 5, 6, 8, 10, 12]
def snap_caliber(m):
    if not m: return None
    inch = m / 0.0254
    return min(STD_IN, key=lambda s: abs(s - inch))

PRESETS = []
for d in data:
    f = d['file']
    pid = ID_MAP.get(f)
    mines = count_mines(f'public/finale-presets/{f}')
    cols = [c['hex'] for c in d['colors'] if c.get('hex')]
    primary = cols[0] if cols else None
    secondary = cols[1] if len(cols) > 1 else None
    PRESETS.append({
        'id': pid,
        'file': f,
        'name': d['name'],
        'author': d['author'],
        'rootType': d['rootType'],
        'subTypes': d['subTypes'],
        'caliberM': d['caliberM'],
        'caliberIn': snap_caliber(d['caliberM']),
        'starCount': d['starCount'],
        'shotCount': mines if mines > 0 else d['shotCount'],
        'primaryColor': primary,
        'secondaryColor': secondary,
        'palette': cols[:6],
    })

# Emit JSON file
os.makedirs('public/finale-presets', exist_ok=True)
with open('public/finale-presets/_presetMap.json', 'w', encoding='utf-8') as fh:
    json.dump(PRESETS, fh, indent=2, ensure_ascii=False)

# Emit TS file
ts_lines = [
    "/**",
    " * Auto-generated from public/finale-presets/*.fwe by /tmp/fwe/parse.py",
    " * Canonical mapping of imported Finale 3D / FWsim presets:",
    " * id (matches EFFECT_LIBRARY) → name, root type, caliber, star count, shot count, palette.",
    " */",
    "export type FinalePresetMeta = {",
    "  id: string;",
    "  file: string;",
    "  name: string | null;",
    "  author: string | null;",
    "  rootType: string | null;",
    "  subTypes: string[];",
    "  /** Diameter in meters as declared in the .fwe file. */",
    "  caliberM: number | null;",
    "  /** Snapped to standard pyro caliber in inches (2,3,4,5,6,8,10,12). */",
    "  caliberIn: number | null;",
    "  /** Total star particles emitted by the largest Stars node. */",
    "  starCount: number | null;",
    "  /** Number of Mine sub-effects (cakes / candles); null for single shells. */",
    "  shotCount: number | null;",
    "  primaryColor: string | null;",
    "  secondaryColor: string | null;",
    "  palette: string[];",
    "};",
    "",
    "export const FINALE_PRESET_MAP: Record<string, FinalePresetMeta> = {",
]
for p in PRESETS:
    pid = p['id'] or p['file']
    ts_lines.append(f"  '{pid}': " + json.dumps(p, ensure_ascii=False) + ",")
ts_lines.append("};")
ts_lines.append("")
ts_lines.append("export const FINALE_PRESET_LIST: FinalePresetMeta[] = Object.values(FINALE_PRESET_MAP);")
ts_lines.append("")

open('src/data/finalePresetMap.ts', 'w', encoding='utf-8').write('\n'.join(ts_lines))
print('Wrote src/data/finalePresetMap.ts and public/finale-presets/_presetMap.json')
print(f'{len(PRESETS)} presets')
