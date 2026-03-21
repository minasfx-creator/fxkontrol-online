import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Upload, FileSpreadsheet, X, Check, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useProjectStore, type Position, type PositionType } from '@/store/useProjectStore';
import { useMyLibrary } from '@/hooks/useMyLibrary';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────

type DetectedFormat = 'positions-csv' | 'finale-generic' | 'cobra' | 'fireone' | 'pyromate' | 'do-it-yourself' | 'finale-inventory';
type AngleConvention = 'up-is-0' | 'up-is-90' | 'guess';
type UnitMode = 'seconds' | 'milliseconds';
type ChainInterpretation = 'chains' | 'individual';
type SizeInterpretation = 'inches' | 'millimeters' | 'shots';

interface ImportOptions {
  angleConvention: AngleConvention;
  prefireUnits: UnitMode;
  durationUnits: UnitMode;
  chainInterpretation: ChainInterpretation;
  sizeInterpretation: SizeInterpretation;
}

const DEFAULT_OPTIONS: ImportOptions = {
  angleConvention: 'guess',
  prefireUnits: 'seconds',
  durationUnits: 'seconds',
  chainInterpretation: 'chains',
  sizeInterpretation: 'inches',
};

interface ParsedRow {
  name: string;
  type: PositionType;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  color: string;
  // Extended Finale fields
  description?: string;
  eventTime?: number;
  prefire?: number;
  duration?: number;
  size?: number;
  angle?: number;
  pan?: number;
  tilt?: number;
  spin?: number;
  quantity?: number;
  partType?: string;
  vdl?: string;
  manufacturer?: string;
  partNumber?: string;
  coordinates?: string;
}

// ── Column Mapping ──────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['name', 'nome', 'position', 'position name', 'pos', 'posname'],
  type: ['type', 'tipo', 'parttype', 'part type', 'device type'],
  x: ['x', 'lon', 'longitude', 'east', 'easting'],
  y: ['y', 'alt', 'altitude', 'elevation', 'height'],
  z: ['z', 'lat', 'latitude', 'north', 'northing'],
  heading: ['heading', 'hdg', 'h', 'azimuth'],
  pitch: ['pitch', 'p'],
  roll: ['roll', 'r'],
  description: ['description', 'desc', 'effect', 'effect name', 'vdl', 'visual description'],
  eventTime: ['event time', 'eventtime', 'time', 'fire time', 'firetime', 'cue time', 'cuetime', 'start time'],
  prefire: ['prefire', 'pre-fire', 'pft', 'lift time', 'lifttime'],
  duration: ['duration', 'dur', 'effect duration', 'star time'],
  size: ['size', 'caliber', 'calibre', 'cal', 'diameter'],
  angle: ['angle', 'tilt angle', 'side angle', 'firing angle'],
  pan: ['pan'],
  tilt: ['tilt'],
  spin: ['spin'],
  quantity: ['quantity', 'qty', 'count', 'num', 'chains', 'flights'],
  partNumber: ['part number', 'partnumber', 'part#', 'item', 'item number', 'itemnumber', 'sku'],
  manufacturer: ['manufacturer', 'mfg', 'brand', 'supplier'],
  coordinates: ['coordinates', 'coords', 'coordinate'],
  color: ['color', 'colour', 'cor'],
};

function findColumnIndex(headers: string[], field: string): number {
  const aliases = COLUMN_ALIASES[field] || [field];
  return headers.findIndex(h => aliases.includes(h.toLowerCase().trim()));
}

// ── Format Detection ────────────────────────────────────────────────

function detectFormat(fileName: string, headers: string[]): DetectedFormat {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  if (ext === 'fir') return 'fireone';
  if (ext === 'shw') return 'cobra';

  // Check for Finale inventory columns
  if (lowerHeaders.includes('partnumber') || lowerHeaders.includes('part number')) {
    if (lowerHeaders.includes('parttype') || lowerHeaders.includes('part type')) return 'finale-inventory';
  }

  // Check for Finale script columns
  const finaleColumns = ['event time', 'eventtime', 'description', 'prefire', 'duration'];
  const hasFinale = finaleColumns.some(fc => lowerHeaders.includes(fc));
  if (hasFinale) return 'finale-generic';

  // Check for Cobra/ShowCreator
  if (lowerHeaders.includes('cue') && lowerHeaders.includes('module')) return 'cobra';

  // Check for PyroMate
  if (lowerHeaders.includes('fire time') || lowerHeaders.includes('firetime')) return 'pyromate';

  // Position-only CSV
  const hasPosition = lowerHeaders.some(h => ['x', 'lon', 'longitude'].includes(h));
  if (hasPosition && !hasFinale) return 'positions-csv';

  return 'do-it-yourself';
}

// ── Inference Helpers ───────────────────────────────────────────────

function inferFromCaliber(sizeInches: number) {
  // Simplified Finale 3D inference tables
  const breakHeights: Record<number, number> = { 1: 15, 1.5: 25, 2: 35, 3: 55, 4: 80, 5: 110, 6: 140, 8: 190 };
  const prefires: Record<number, number> = { 1: 0.8, 1.5: 1.1, 2: 1.5, 3: 2.0, 4: 2.7, 5: 3.2, 6: 3.7, 8: 4.5 };
  const durations: Record<number, number> = { 1: 0.8, 1.5: 1.1, 2: 1.4, 3: 1.6, 4: 2.2, 5: 2.8, 6: 3.5, 8: 4.5 };

  const nearest = Object.keys(breakHeights).map(Number).sort((a, b) => Math.abs(a - sizeInches) - Math.abs(b - sizeInches))[0] || 3;
  return {
    height: breakHeights[nearest] || 55,
    prefire: prefires[nearest] || 2.0,
    duration: durations[nearest] || 1.6,
  };
}

function applyAngleConvention(angle: number, convention: AngleConvention): number {
  switch (convention) {
    case 'up-is-0': return 90 - angle; // Convert so 0=up becomes 90=up (our internal)
    case 'up-is-90': return angle;      // Already in our convention
    case 'guess':
    default: {
      // Heuristic: if most angles cluster around 0, assume up=0
      // For single values, if |angle| < 45, probably up=0
      if (Math.abs(angle) <= 45) return 90 - angle;
      return angle;
    }
  }
}

function parseFannedAngles(angleStr: string): number[] {
  // Finale convention: "60-90-120" means three angles
  if (angleStr.includes('-') && !angleStr.startsWith('-')) {
    return angleStr.split('-').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
  }
  const v = parseFloat(angleStr);
  return isNaN(v) ? [] : [v];
}

// ── Main Parser ─────────────────────────────────────────────────────

function parseCSV(text: string, options: ImportOptions): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim());
  const lowerHeader = header.map(h => h.toLowerCase().trim());
  const format = detectFormat('file.csv', lowerHeader);

  const idx = (field: string) => findColumnIndex(lowerHeader, field);
  const nameIdx = idx('name');
  const typeIdx = idx('type');
  const xIdx = idx('x');
  const yIdx = idx('y');
  const zIdx = idx('z');
  const hIdx = idx('heading');
  const pIdx = idx('pitch');
  const rIdx = idx('roll');
  const descIdx = idx('description');
  const timeIdx = idx('eventTime');
  const prefireIdx = idx('prefire');
  const durIdx = idx('duration');
  const sizeIdx = idx('size');
  const angleIdx = idx('angle');
  const panIdx = idx('pan');
  const tiltIdx = idx('tilt');
  const spinIdx = idx('spin');
  const qtyIdx = idx('quantity');
  const coordIdx = idx('coordinates');
  const colorIdx = idx('color');
  const partNumIdx = idx('partNumber');
  const mfgIdx = idx('manufacturer');

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 2) continue;

    const rawType = typeIdx >= 0 ? cols[typeIdx]?.toLowerCase() : '';
    const type: PositionType = rawType?.includes('drone') ? 'drone-pad' : rawType?.includes('light') ? 'light' : 'pyro';

    // Parse size with interpretation
    let sizeVal = sizeIdx >= 0 ? parseFloat(cols[sizeIdx]) || 0 : 0;
    if (sizeVal > 0 && options.sizeInterpretation === 'millimeters') {
      sizeVal = sizeVal / 25.4; // mm → inches
    }

    // Parse coordinates (3 or 9 space-separated numbers)
    let cx = 0, cy = 0, cz = 0;
    let cHeading = 0, cPitch = 0, cRoll = 0;
    let cPan: number | undefined, cTilt: number | undefined, cSpin: number | undefined;
    if (coordIdx >= 0 && cols[coordIdx]) {
      const nums = cols[coordIdx].split(/\s+/).map(Number).filter(n => !isNaN(n));
      if (nums.length >= 3) { cx = nums[0]; cy = nums[1]; cz = nums[2]; }
      if (nums.length >= 6) { cHeading = nums[3]; cPitch = nums[4]; cRoll = nums[5]; }
      if (nums.length >= 9) { cPan = nums[6]; cTilt = nums[7]; cSpin = nums[8]; }
    }

    // Parse prefire/duration with unit conversion
    let prefire = prefireIdx >= 0 ? parseFloat(cols[prefireIdx]) || undefined : undefined;
    let duration = durIdx >= 0 ? parseFloat(cols[durIdx]) || undefined : undefined;
    if (prefire && options.prefireUnits === 'milliseconds') prefire /= 1000;
    if (duration && options.durationUnits === 'milliseconds') duration /= 1000;

    // Parse angle (with fanned angles support: "60-90-120")
    let pan: number | undefined;
    let tilt: number | undefined;
    if (panIdx >= 0) pan = parseFloat(cols[panIdx]) || undefined;
    if (tiltIdx >= 0) tilt = parseFloat(cols[tiltIdx]) || undefined;
    if (cPan !== undefined) pan = cPan;
    if (cTilt !== undefined) tilt = cTilt;

    if (angleIdx >= 0 && cols[angleIdx] && pan === undefined) {
      const angles = parseFannedAngles(cols[angleIdx]);
      if (angles.length === 1) {
        tilt = applyAngleConvention(angles[0], options.angleConvention);
        // Finale convention: cakes face audience (pan=0), others side-tilt (pan=90)
        pan = rawType?.includes('cake') ? 0 : 90;
      }
      // Multi-angle fanned entries generate multiple rows
      if (angles.length > 1) {
        for (const a of angles) {
          const appliedAngle = applyAngleConvention(a, options.angleConvention);
          rows.push(buildRow(i, cols, {
            nameIdx, type, xIdx, yIdx, zIdx, hIdx, pIdx, rIdx, descIdx, timeIdx,
            colorIdx, partNumIdx, mfgIdx, sizeVal, prefire, duration,
            cx, cy, cz, cHeading, cPitch, cRoll,
            pan: rawType?.includes('cake') ? 0 : 90,
            tilt: appliedAngle,
            spin: spinIdx >= 0 ? parseFloat(cols[spinIdx]) || undefined : undefined,
          }));
        }
        continue; // skip normal push
      }
    }

    // Auto-infer missing fields from caliber
    if (sizeVal > 0) {
      const inferred = inferFromCaliber(sizeVal);
      if (!prefire) prefire = inferred.prefire;
      if (!duration) duration = inferred.duration;
    }

    rows.push({
      name: nameIdx >= 0 ? cols[nameIdx] || `POS-${i}` : `POS-${i}`,
      type,
      x: xIdx >= 0 ? parseFloat(cols[xIdx]) || cx : cx,
      y: yIdx >= 0 ? parseFloat(cols[yIdx]) || cy : cy,
      z: zIdx >= 0 ? parseFloat(cols[zIdx]) || cz : cz,
      heading: hIdx >= 0 ? parseFloat(cols[hIdx]) || cHeading : cHeading,
      pitch: pIdx >= 0 ? parseFloat(cols[pIdx]) || cPitch : cPitch,
      roll: rIdx >= 0 ? parseFloat(cols[rIdx]) || cRoll : cRoll,
      color: colorIdx >= 0 && cols[colorIdx] ? cols[colorIdx] : type === 'drone-pad' ? '#00B4D8' : '#FF6B35',
      description: descIdx >= 0 ? cols[descIdx] : undefined,
      eventTime: timeIdx >= 0 ? parseFloat(cols[timeIdx]) || undefined : undefined,
      prefire,
      duration,
      size: sizeVal || undefined,
      pan,
      tilt,
      spin: cSpin ?? (spinIdx >= 0 ? parseFloat(cols[spinIdx]) || undefined : undefined),
      quantity: qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || undefined : undefined,
      partType: rawType || undefined,
      partNumber: partNumIdx >= 0 ? cols[partNumIdx] : undefined,
      manufacturer: mfgIdx >= 0 ? cols[mfgIdx] : undefined,
    });
  }

  return rows;
}

function buildRow(i: number, cols: string[], ctx: any): ParsedRow {
  return {
    name: ctx.nameIdx >= 0 ? cols[ctx.nameIdx] || `POS-${i}` : `POS-${i}`,
    type: ctx.type,
    x: ctx.xIdx >= 0 ? parseFloat(cols[ctx.xIdx]) || ctx.cx : ctx.cx,
    y: ctx.yIdx >= 0 ? parseFloat(cols[ctx.yIdx]) || ctx.cy : ctx.cy,
    z: ctx.zIdx >= 0 ? parseFloat(cols[ctx.zIdx]) || ctx.cz : ctx.cz,
    heading: ctx.hIdx >= 0 ? parseFloat(cols[ctx.hIdx]) || ctx.cHeading : ctx.cHeading,
    pitch: ctx.pIdx >= 0 ? parseFloat(cols[ctx.pIdx]) || ctx.cPitch : ctx.cPitch,
    roll: ctx.rIdx >= 0 ? parseFloat(cols[ctx.rIdx]) || ctx.cRoll : ctx.cRoll,
    color: ctx.type === 'drone-pad' ? '#00B4D8' : '#FF6B35',
    description: ctx.descIdx >= 0 ? cols[ctx.descIdx] : undefined,
    eventTime: ctx.timeIdx >= 0 ? parseFloat(cols[ctx.timeIdx]) || undefined : undefined,
    prefire: ctx.prefire,
    duration: ctx.duration,
    size: ctx.sizeVal || undefined,
    pan: ctx.pan,
    tilt: ctx.tilt,
    spin: ctx.spin,
  };
}

// ── Component ───────────────────────────────────────────────────────

export default function CSVImporter({ open, onOpenChange, initialFile }: { open: boolean; onOpenChange: (v: boolean) => void; initialFile?: File | null }) {
  const { addPosition } = useProjectStore();
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_OPTIONS);
  const [showOptions, setShowOptions] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { saveToLibrary } = useMyLibrary();

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setCurrentFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.trim().split('\n');
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.toLowerCase().trim());
        const fmt = detectFormat(file.name, headers);
        setDetectedFormat(fmt);
        // Auto-show options for complex formats
        if (fmt !== 'positions-csv') setShowOptions(true);
      }
      setParsed(parseCSV(text, options));
    };
    reader.readAsText(file);
  }, [options]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  useEffect(() => {
    if (!initialFile || !open) return;
    processFile(initialFile);
  }, [initialFile, open, processFile]);

  // Re-parse when options change
  const reparse = useCallback(() => {
    if (!fileName) return;
    // We need the raw text again — store it
  }, [fileName]);

  const [rawText, setRawText] = useState<string | null>(null);

  // Override processFile to also store raw text
  const processFileWithRaw = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setRawText(text);
      const lines = text.trim().split('\n');
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.toLowerCase().trim());
        const fmt = detectFormat(file.name, headers);
        setDetectedFormat(fmt);
        if (fmt !== 'positions-csv') setShowOptions(true);
      }
      setParsed(parseCSV(text, options));
    };
    reader.readAsText(file);
  }, [options]);

  // Re-parse when options change and we have raw text
  useEffect(() => {
    if (rawText) {
      setParsed(parseCSV(rawText, options));
    }
  }, [options, rawText]);

  const handleImport = useCallback(() => {
    for (const row of parsed) {
      addPosition({
        id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: row.name,
        type: row.type,
        x: row.x,
        y: row.y,
        z: row.z,
        heading: row.heading,
        pitch: row.pitch,
        roll: row.roll,
        color: row.color,
      });
    }
    toast.success(`${parsed.length} posições importadas (${detectedFormat || 'CSV'})`);
    onOpenChange(false);
    setParsed([]);
    setFileName(null);
    setRawText(null);
    setDetectedFormat(null);
    setShowOptions(false);
  }, [parsed, addPosition, onOpenChange, detectedFormat]);

  const formatLabels: Record<DetectedFormat, string> = {
    'positions-csv': 'Posições CSV',
    'finale-generic': 'Finale Generic CSV',
    'cobra': 'Cobra / Show Creator',
    'fireone': 'FireOne (.fir)',
    'pyromate': 'PyroMate / SmartShow',
    'do-it-yourself': 'CSV Personalizado',
    'finale-inventory': 'Inventário Finale',
  };

  const hasScriptData = parsed.some(r => r.eventTime || r.prefire || r.duration || r.description);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Importar Show / Posições
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Suporta CSV, FireOne (.fir), Cobra, PyroMate, Finale 3D e arquivos personalizados.
            Campos ausentes são inferidos automaticamente pelo calibre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Drop area */}
          <div
            className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              {fileName ? fileName : 'Clique para selecionar arquivo'}
            </p>
            <p className="text-[9px] text-muted-foreground mt-1">.csv .txt .fir .shw</p>
            <input ref={fileRef} type="file" accept=".csv,.txt,.fir,.shw" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFileWithRaw(file);
            }} className="hidden" />
          </div>

          {/* Format badge */}
          {detectedFormat && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-sm font-medium">
                {formatLabels[detectedFormat]}
              </span>
              {hasScriptData && (
                <span className="text-[9px] bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-sm">
                  + Script Data
                </span>
              )}
              <button
                onClick={() => setShowOptions(v => !v)}
                className="ml-auto text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Settings2 className="h-3 w-3" />
                Opções
              </button>
            </div>
          )}

          {/* Import Options (Finale-style) */}
          {showOptions && (
            <div className="bg-muted/50 rounded-sm p-2 space-y-2 border border-border">
              <p className="text-[9px] font-semibold text-foreground uppercase tracking-wider">Opções de Importação</p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-muted-foreground uppercase">Convenção de Ângulo</label>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {([
                      { id: 'guess', label: 'Automático' },
                      { id: 'up-is-0', label: 'Cima = 0°' },
                      { id: 'up-is-90', label: 'Cima = 90°' },
                    ] as const).map(opt => (
                      <button key={opt.id} onClick={() => setOptions(o => ({ ...o, angleConvention: opt.id }))}
                        className={cn("text-[8px] px-2 py-0.5 rounded-sm text-left",
                          options.angleConvention === opt.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[8px] text-muted-foreground uppercase">Interpretação de Tamanho</label>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {([
                      { id: 'inches', label: 'Polegadas' },
                      { id: 'millimeters', label: 'Milímetros' },
                      { id: 'shots', label: 'Tiros (cake)' },
                    ] as const).map(opt => (
                      <button key={opt.id} onClick={() => setOptions(o => ({ ...o, sizeInterpretation: opt.id }))}
                        className={cn("text-[8px] px-2 py-0.5 rounded-sm text-left",
                          options.sizeInterpretation === opt.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-muted-foreground uppercase">Unidade Prefire</label>
                  <div className="flex gap-0.5 mt-0.5">
                    {(['seconds', 'milliseconds'] as const).map(u => (
                      <button key={u} onClick={() => setOptions(o => ({ ...o, prefireUnits: u }))}
                        className={cn("text-[8px] px-2 py-0.5 rounded-sm",
                          options.prefireUnits === u ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
                        {u === 'seconds' ? 'Seg' : 'ms'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground uppercase">Unidade Duração</label>
                  <div className="flex gap-0.5 mt-0.5">
                    {(['seconds', 'milliseconds'] as const).map(u => (
                      <button key={u} onClick={() => setOptions(o => ({ ...o, durationUnits: u }))}
                        className={cn("text-[8px] px-2 py-0.5 rounded-sm",
                          options.durationUnits === u ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
                        {u === 'seconds' ? 'Seg' : 'ms'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Quantidade = ?</label>
                <div className="flex gap-0.5 mt-0.5">
                  {([
                    { id: 'chains', label: 'Cadeias (chains)' },
                    { id: 'individual', label: 'Efeitos individuais' },
                  ] as const).map(opt => (
                    <button key={opt.id} onClick={() => setOptions(o => ({ ...o, chainInterpretation: opt.id }))}
                      className={cn("text-[8px] px-2 py-0.5 rounded-sm",
                        options.chainInterpretation === opt.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="bg-muted/30 rounded-sm p-2 max-h-48 overflow-y-auto border border-border">
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">
                Preview: {parsed.length} posições
              </p>
              <div className="space-y-0.5">
                {parsed.slice(0, 12).map((row, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px] font-mono text-foreground/80">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="w-16 truncate">{row.name}</span>
                    <span className="text-muted-foreground w-10">{row.type}</span>
                    {row.description && (
                      <span className="text-primary/70 truncate max-w-[100px]">{row.description}</span>
                    )}
                    {row.eventTime !== undefined && (
                      <span className="text-accent-foreground">{row.eventTime.toFixed(1)}s</span>
                    )}
                    <span className="ml-auto text-muted-foreground">
                      {row.x.toFixed(1)},{row.y.toFixed(1)},{row.z.toFixed(1)}
                    </span>
                  </div>
                ))}
                {parsed.length > 12 && (
                  <p className="text-[9px] text-muted-foreground text-center">+{parsed.length - 12} mais</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={parsed.length === 0}
              className="h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" /> Importar {parsed.length} Posições
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
