/**
 * Auto-generated from public/finale-presets/*.fwe by /tmp/fwe/parse.py
 * Canonical mapping of imported Finale 3D / FWsim presets:
 * id (matches EFFECT_LIBRARY) → name, root type, caliber, star count, shot count, palette.
 */
export type FinalePresetMeta = {
  id: string;
  file: string;
  name: string | null;
  author: string | null;
  rootType: string | null;
  subTypes: string[];
  /** Diameter in meters as declared in the .fwe file. */
  caliberM: number | null;
  /** Snapped to standard pyro caliber in inches (2,3,4,5,6,8,10,12). */
  caliberIn: number | null;
  /** Total star particles emitted by the largest Stars node. */
  starCount: number | null;
  /** Number of Mine sub-effects (cakes / candles); null for single shells. */
  shotCount: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  palette: string[];
};

export const FINALE_PRESET_MAP: Record<string, FinalePresetMeta> = {
  'fin-11-horsetail': {"id": "fin-11-horsetail", "file": "11_Horsetail.fwe", "name": "Gold (short, thin)", "author": "Marcus Athmer", "rootType": "Shell", "subTypes": ["BurstingCharge", "CustomTailsLink", "MineDistribution", "StarTails", "Stars"], "caliberM": 0.15, "caliberIn": 6, "starCount": 20, "shotCount": null, "primaryColor": "#FFE2AE", "secondaryColor": "#FFE2AE", "palette": ["#FFE2AE", "#FFE2AE", "#9F5000", "#C68100", "#8A4500", "#FF6B6B"]},
  'fin-12-sky-mine': {"id": "fin-12-sky-mine", "file": "12_Sky_Mine.fwe", "name": "Silver (short, thin)", "author": "Marcus Athmer", "rootType": "Shell", "subTypes": ["BurstingCharge", "CustomTailsLink", "MineDistribution", "StarTails", "Stars"], "caliberM": 0.15, "caliberIn": 6, "starCount": 16, "shotCount": null, "primaryColor": "#FFE2AE", "secondaryColor": "#FFC082", "palette": ["#FFE2AE", "#FFC082", "#A85400", "#8A4500", "#FF1A1A", "#FF6B6B"]},
  'fin-13-falling-leaves': {"id": "fin-13-falling-leaves", "file": "13_Falling_Leaves.fwe", "name": "13 Falling Leaves", "author": "Marcus Athmer (Effekt-Vorschau)", "rootType": "Shell", "subTypes": ["BurstingCharge", "MineDistribution", "Stars"], "caliberM": 0.15, "caliberIn": 6, "starCount": 27, "shotCount": null, "primaryColor": "#3F7BFF", "secondaryColor": "#FF6B6B", "palette": ["#3F7BFF", "#FF6B6B", "#FFE2AE"]},
  'fin-14-titanium-salut': {"id": "fin-14-titanium-salut", "file": "14_Titanium_Salut.fwe", "name": "Silver (short, wide)", "author": "Marcus Athmer", "rootType": "Shell", "subTypes": ["BurstingCharge", "CustomTailsLink", "SphericalDistribution", "StarTails", "Stars"], "caliberM": 0.15, "caliberIn": 6, "starCount": 150, "shotCount": null, "primaryColor": "#FFE2AE", "secondaryColor": "#FFC082", "palette": ["#FFE2AE", "#FFC082", "#A85400", "#8A4500", "#FF6B6B"]},
  'fin-15-pattern-half-half': {"id": "fin-15-pattern-half-half", "file": "15_Pattern_Shell_Half_Half.fwe", "name": "15 Pattern Shell: Half & Half", "author": "Marcus Athmer (Effekt-Vorschau)", "rootType": "Shell", "subTypes": ["BurstingCharge", "HemisphereDistribution", "Stars"], "caliberM": 0.15, "caliberIn": 6, "starCount": 100, "shotCount": null, "primaryColor": "#7CFFB0", "secondaryColor": "#FF6B6B", "palette": ["#7CFFB0", "#FF6B6B", "#FF66C4", "#FFE2AE"]},
  'fin-27-multibreak': {"id": "fin-27-multibreak", "file": "27_Multibreak_Shell.fwe", "name": "Brocade (short)", "author": "Marcus Athmer", "rootType": "Shell", "subTypes": ["BurstingCharge", "CustomTailsLink", "RingDistribution", "SphericalDistribution", "StarTails", "Stars"], "caliberM": 0.15, "caliberIn": 6, "starCount": 59, "shotCount": null, "primaryColor": "#FFE2AE", "secondaryColor": "#623100", "palette": ["#FFE2AE", "#623100", "#934900", "#A65300", "#FF6B6B", "#A24BFF"]},
  'fin-28-dragon-egg': {"id": "fin-28-dragon-egg", "file": "28_Dragon_Egg.fwe", "name": "Silver (short, wide)", "author": "Marcus Athmer", "rootType": "Shell", "subTypes": ["AscentStar", "BurstingCharge", "CustomTailsLink", "FadeInfo", "RingDistribution", "SphericalDistribution", "StarTails", "Stars", "SubShells"], "caliberM": 0.15, "caliberIn": 6, "starCount": 150, "shotCount": null, "primaryColor": "#FFE2AE", "secondaryColor": "#FFC082", "palette": ["#FFE2AE", "#FFC082", "#A85400", "#8A4500", "#FF6B6B", "#FFD27A"]},
  'fin-29-shell-of-shells': {"id": "fin-29-shell-of-shells", "file": "29_Shell_of_Shells.fwe", "name": "29 Shell of Shells", "author": "Marcus Athmer (Effekt-Vorschau)", "rootType": "Shell", "subTypes": ["AscentStar", "BurstingCharge", "FadeInfo", "SphericalDistribution", "Stars", "SubShells"], "caliberM": 0.15, "caliberIn": 6, "starCount": 45, "shotCount": null, "primaryColor": "#FF1A1A", "secondaryColor": "#FF6B6B", "palette": ["#FF1A1A", "#FF6B6B", "#FFE2AE", "#FFD27A", "#3F7BFF", "#FFFFFF"]},
  'fin-30-warimono': {"id": "fin-30-warimono", "file": "30_Warimono.fwe", "name": "30 Warimono", "author": "Marcus Athmer (Effekt-Vorschau)", "rootType": "Shell", "subTypes": ["BurstingCharge", "SphericalDistribution", "Stars"], "caliberM": 0.15, "caliberIn": 6, "starCount": 450, "shotCount": null, "primaryColor": "#FFD600", "secondaryColor": "#A24BFF", "palette": ["#FFD600", "#A24BFF", "#FFE2AE"]},
  'fin-31-hanabi': {"id": "fin-31-hanabi", "file": "31_Hanabi.fwe", "name": "Silver (short, thin)", "author": "Marcus Athmer", "rootType": "Shell", "subTypes": ["BurstingCharge", "Crossette", "CustomTailsLink", "SphericalDistribution", "StarTails", "Stars"], "caliberM": 0.208, "caliberIn": 8, "starCount": 400, "shotCount": null, "primaryColor": "#FFE2AE", "secondaryColor": "#FFC082", "palette": ["#FFE2AE", "#FFC082", "#A85400", "#8A4500", "#7DB6FF", "#A24BFF"]},
  'fin-40-roman-candle': {"id": "fin-40-roman-candle", "file": "40_Roman_Candle.fwe", "name": "40 Roman Candle", "author": "Marcus Athmer (Effekt-Vorschau)", "rootType": "Cake", "subTypes": ["BurstingCharge", "Mine", "MineDistribution", "StarTails", "Stars"], "caliberM": 0.2, "caliberIn": 8, "starCount": 1, "shotCount": 3, "primaryColor": "#FF8A00", "secondaryColor": "#FFE2AE", "palette": ["#FF8A00", "#FFE2AE", "#008000", "#FF1A1A", "#FBDEAA"]},
  'fin-41-cake-i': {"id": "fin-41-cake-i", "file": "41_Cake_I-Shape.fwe", "name": "Brocade (short, thin)", "author": "Marcus Athmer", "rootType": "Cake", "subTypes": ["AscentEffect", "AscentStar", "Bengal", "BurstingCharge", "CustomTailsLink", "FadeInfo", "Shell", "SphericalDistribution", "StarTails", "Stars"], "caliberM": 0.15, "caliberIn": 6, "starCount": 80, "shotCount": null, "primaryColor": "#FFE2AE", "secondaryColor": "#FFB871", "palette": ["#FFE2AE", "#FFB871", "#824100", "#FF1A1A", "#FF8A00", "#FFE2AE"]},
  'fin-42-cake-zv': {"id": "fin-42-cake-zv", "file": "42_Cake_Z-Shape_V-Shape.fwe", "name": "Brocade (short, thin)", "author": "Marcus Athmer", "rootType": "Cake", "subTypes": ["AscentEffect", "Bengal", "BurstingCharge", "CustomTailsLink", "Mine", "MineDistribution", "Shell", "SphericalDistribution", "StarTails", "Stars"], "caliberM": 0.2, "caliberIn": 8, "starCount": 80, "shotCount": 3, "primaryColor": "#FFE2AE", "secondaryColor": "#623100", "palette": ["#FFE2AE", "#623100", "#934900", "#A65300", "#3F7BFF", "#FF8A00"]},
  'fin-43-single-row': {"id": "fin-43-single-row", "file": "43_Single_Row.fwe", "name": "Gold", "author": "Marcus Athmer", "rootType": "Cake", "subTypes": ["BurstingCharge", "CustomTailsLink", "Mine", "MineDistribution", "StarTails", "Stars"], "caliberM": 0.2, "caliberIn": 8, "starCount": 60, "shotCount": 1, "primaryColor": "#FFE2AE", "secondaryColor": "#FFE2AE", "palette": ["#FFE2AE", "#FFE2AE", "#9F5000", "#C68100", "#8A4500", "#FF8A00"]},
  'fin-44-lancework': {"id": "fin-44-lancework", "file": "44_Lancework.fwe", "name": "Lancework Preset", "author": "LT", "rootType": "Lancework", "subTypes": [], "caliberM": null, "caliberIn": null, "starCount": null, "shotCount": null, "primaryColor": null, "secondaryColor": null, "palette": []},
};

export const FINALE_PRESET_LIST: FinalePresetMeta[] = Object.values(FINALE_PRESET_MAP);
