/**
 * VdlColorPicker — Grid of the 25 canonical Finale 3D VDL colors.
 * Pure presentation. Fires onPick(hex, name) when the user clicks a swatch.
 *
 * Source of truth: src/lib/vdlQuantizer.ts (VDL_PALETTE).
 * We re-export a minimal shape here to avoid importing internal entries.
 */
import { rgbToNearestVdl, type VdlMatch } from '@/lib/vdlQuantizer';

// Mirror of VDL_PALETTE (kept in sync intentionally — the quantizer file
// keeps its array private). If a color is added there, add it here too.
const VDL_SWATCHES: { name: string; hex: string; impliesTrail: boolean }[] = [
  { name: 'Aqua', hex: '#337fcc', impliesTrail: false },
  { name: 'Blue', hex: '#4c66ff', impliesTrail: false },
  { name: 'Charcoal', hex: '#5a280a', impliesTrail: true },
  { name: 'Cyan', hex: '#51a3cc', impliesTrail: false },
  { name: 'Dark', hex: '#000000', impliesTrail: false },
  { name: 'Fresh Yellow', hex: '#b29959', impliesTrail: false },
  { name: 'Fuchsia', hex: '#d859e5', impliesTrail: false },
  { name: 'Gamboge', hex: '#ff9959', impliesTrail: true },
  { name: 'Gold', hex: '#504605', impliesTrail: true },
  { name: 'Grass Green', hex: '#3fb20c', impliesTrail: false },
  { name: 'Green', hex: '#26b21c', impliesTrail: false },
  { name: 'Indigo', hex: '#7f3fff', impliesTrail: false },
  { name: 'Lavender', hex: '#a03fff', impliesTrail: false },
  { name: 'Lemon', hex: '#bf990c', impliesTrail: false },
  { name: 'Lime', hex: '#59b21c', impliesTrail: false },
  { name: 'Magenta', hex: '#cc338a', impliesTrail: false },
  { name: 'Orange', hex: '#cc5919', impliesTrail: false },
  { name: 'Peach', hex: '#ff9966', impliesTrail: false },
  { name: 'Pink', hex: '#ff66cc', impliesTrail: false },
  { name: 'Purple', hex: '#993fcc', impliesTrail: false },
  { name: 'Red', hex: '#cc1919', impliesTrail: false },
  { name: 'Sky Blue', hex: '#66b2ff', impliesTrail: false },
  { name: 'Teal', hex: '#1c7f80', impliesTrail: false },
  { name: 'White', hex: '#ffffff', impliesTrail: false },
  { name: 'Yellow', hex: '#ffd900', impliesTrail: false },
];

export interface VdlSwatch { name: string; hex: string; impliesTrail: boolean }

interface Props {
  selectedHex?: string;
  onPick: (swatch: VdlSwatch) => void;
}

export default function VdlColorPicker({ selectedHex, onPick }: Props) {
  const norm = (selectedHex ?? '').toLowerCase();
  // Highlight closest VDL match to the current free-form hex when present.
  let nearest: VdlMatch | null = null;
  if (norm && /^#[0-9a-f]{6}$/.test(norm)) {
    const r = parseInt(norm.slice(1, 3), 16);
    const g = parseInt(norm.slice(3, 5), 16);
    const b = parseInt(norm.slice(5, 7), 16);
    nearest = rgbToNearestVdl(r, g, b);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2">
        {VDL_SWATCHES.map((s) => {
          const isSelected = norm === s.hex.toLowerCase();
          const isNearest = !isSelected && nearest?.name === s.name;
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onPick(s)}
              title={`${s.name}${s.impliesTrail ? ' • trail' : ''}`}
              className={`relative flex flex-col items-center gap-1 rounded-md border p-2 text-[10px] transition-all hover:scale-105 ${
                isSelected
                  ? 'border-cyan-400 ring-2 ring-cyan-400/50'
                  : isNearest
                  ? 'border-amber-400/70'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <span
                className="block h-7 w-full rounded shadow-inner"
                style={{ backgroundColor: s.hex }}
              />
              <span className="truncate text-foreground/80">{s.name}</span>
              {s.impliesTrail && (
                <span className="absolute right-1 top-1 text-[8px] text-amber-300">
                  ◆
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        ◆ = canonical trail color (Finale 3D VDL spec). Selecting a swatch
        writes the hex into the cue's <code>colorOverride</code>.
      </p>
    </div>
  );
}
