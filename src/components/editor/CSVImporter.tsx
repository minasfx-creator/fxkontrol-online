import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useProjectStore, type Position, type PositionType } from '@/store/useProjectStore';

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
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'nome');
  const typeIdx = header.findIndex((h) => h === 'type' || h === 'tipo');
  const xIdx = header.findIndex((h) => h === 'x' || h === 'lon' || h === 'longitude');
  const yIdx = header.findIndex((h) => h === 'y' || h === 'alt' || h === 'altitude' || h === 'elevation');
  const zIdx = header.findIndex((h) => h === 'z' || h === 'lat' || h === 'latitude');
  const hIdx = header.findIndex((h) => h === 'heading' || h === 'hdg' || h === 'h');
  const pIdx = header.findIndex((h) => h === 'pitch' || h === 'p');
  const rIdx = header.findIndex((h) => h === 'roll' || h === 'r');

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < 3) continue;

    const rawType = typeIdx >= 0 ? cols[typeIdx]?.toLowerCase() : 'pyro';
    const type: PositionType = rawType?.includes('drone') ? 'drone-pad' : 'pyro';

    rows.push({
      name: nameIdx >= 0 ? cols[nameIdx] : `POS-${i}`,
      type,
      x: xIdx >= 0 ? parseFloat(cols[xIdx]) || 0 : 0,
      y: yIdx >= 0 ? parseFloat(cols[yIdx]) || 0 : 0,
      z: zIdx >= 0 ? parseFloat(cols[zIdx]) || 0 : 0,
      heading: hIdx >= 0 ? parseFloat(cols[hIdx]) || 0 : 0,
      pitch: pIdx >= 0 ? parseFloat(cols[pIdx]) || 0 : 0,
      roll: rIdx >= 0 ? parseFloat(cols[rIdx]) || 0 : 0,
      color: type === 'drone-pad' ? '#00B4D8' : '#FF6B35',
    });
  }

  return rows;
}

export default function CSVImporter({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addPosition } = useProjectStore();
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setParsed(parseCSV(text));
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(() => {
    for (const row of parsed) {
      addPosition({
        id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ...row,
      });
    }
    onOpenChange(false);
    setParsed([]);
    setFileName(null);
  }, [parsed, addPosition, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Import Positions from CSV
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            CSV columns: Name, Type (pyro/drone), X, Y, Z, Heading, Pitch, Roll.
            Also supports Lat/Lon/Alt headers.
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
              {fileName ? fileName : 'Click to select CSV file'}
            </p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="bg-surface-2 rounded-sm p-2 max-h-48 overflow-y-auto">
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">
                Preview: {parsed.length} positions
              </p>
              <div className="space-y-0.5">
                {parsed.slice(0, 10).map((row, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px] font-mono-code text-foreground/80">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="w-20 truncate">{row.name}</span>
                    <span className="text-muted-foreground">{row.type}</span>
                    <span className="ml-auto">
                      X:{row.x.toFixed(1)} Y:{row.y.toFixed(1)} Z:{row.z.toFixed(1)}
                    </span>
                  </div>
                ))}
                {parsed.length > 10 && (
                  <p className="text-[9px] text-muted-foreground text-center">+{parsed.length - 10} more</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={parsed.length === 0}
              className="h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" /> Import {parsed.length} Positions
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
