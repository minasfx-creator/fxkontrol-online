import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, Check, ArrowRight, RefreshCw, Database, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useProjectStore, type Effect, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { parseCatalogFile, catalogToEffects, parseAnyFormat, type CatalogColumnMapping, type ParsedCatalogEffect } from '@/lib/catalogImporter';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FIELD_OPTIONS = [
  { value: 'none', label: '— Skip —' },
  { value: 'name', label: 'Name / Description' },
  { value: 'caliber', label: 'Caliber (inches)' },
  { value: 'duration', label: 'Duration (s)' },
  { value: 'color', label: 'Color' },
  { value: 'type', label: 'Part Type' },
  { value: 'height', label: 'Height (m)' },
  { value: 'cost', label: 'Cost ($)' },
  { value: 'prefire', label: 'Prefire / Lift Time' },
  { value: 'pattern', label: 'Burst Pattern' },
  { value: 'shotCount', label: 'Shot Count' },
  { value: 'safety', label: 'Safety Distance' },
  { value: 'vdl', label: 'VDL String' },
  { value: 'sku', label: 'SKU / Part Number' },
  { value: 'manufacturer', label: 'Manufacturer' },
];

type Step = 'upload' | 'mapping' | 'preview';

export default function CatalogImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [columns, setColumns] = useState<CatalogColumnMapping[]>([]);
  const [parsedEffects, setParsedEffects] = useState<ParsedCatalogEffect[]>([]);
  const [delimiter, setDelimiter] = useState(',');
  const [selectedEffects, setSelectedEffects] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setRawText(text);
      const result = parseCatalogFile(text);
      setColumns(result.columns);
      setParsedEffects(result.effects);
      setDelimiter(result.delimiter);
      setSelectedEffects(new Set(result.effects.map((_, i) => i)));
      setStep('mapping');
    };
    reader.readAsText(file);
  }, []);

  const handleReparse = useCallback(() => {
    if (!rawText) return;
    // Re-parse with updated column mappings applied
    const result = parseCatalogFile(rawText);
    // Override auto-mappings with user selections
    result.columns.forEach((col, i) => {
      if (columns[i]) {
        col.mappedTo = columns[i].mappedTo;
      }
    });
    setParsedEffects(result.effects);
  }, [rawText, columns]);

  const updateMapping = (index: number, mappedTo: string) => {
    setColumns(prev => prev.map((c, i) => 
      i === index ? { ...c, mappedTo: mappedTo === 'none' ? null : mappedTo } : c
    ));
  };

  const handleImport = useCallback(() => {
    const selected = parsedEffects.filter((_, i) => selectedEffects.has(i));
    if (selected.length === 0) {
      toast.error('Nenhum efeito selecionado');
      return;
    }

    const effects = catalogToEffects(selected);
    
    // Add to the store's custom effects (we'll add them to EFFECT_LIBRARY dynamically)
    const store = useProjectStore.getState();
    // For now, add as timeline-compatible effects by extending the library
    // We store them in a way they can be used
    (window as any).__customEffects = [
      ...((window as any).__customEffects || []),
      ...effects,
    ];
    
    // Also push to EFFECT_LIBRARY (mutable operation for runtime)
    effects.forEach(eff => {
      if (!EFFECT_LIBRARY.find(e => e.id === eff.id)) {
        EFFECT_LIBRARY.push(eff);
      }
    });

    toast.success(`${effects.length} efeitos importados do catálogo "${fileName}"`, {
      icon: '📦',
      description: `Disponíveis na Asset Palette`,
    });

    onOpenChange(false);
    setStep('upload');
    setParsedEffects([]);
    setColumns([]);
    setFileName(null);
  }, [parsedEffects, selectedEffects, fileName, onOpenChange]);

  const toggleSelectAll = () => {
    if (selectedEffects.size === parsedEffects.length) {
      setSelectedEffects(new Set());
    } else {
      setSelectedEffects(new Set(parsedEffects.map((_, i) => i)));
    }
  };

  const mappedCount = columns.filter(c => c.mappedTo).length;
  const totalColumns = columns.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-primary" />
            Import Finale 3D Catalog
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Import effect catalogs from CSV, FDB, or TSV files. Supports Finale 3D, FireOne, and generic formats.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-1 mb-2">
          {(['upload', 'mapping', 'preview'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border",
                step === s ? "bg-primary text-primary-foreground border-primary" :
                  (['upload', 'mapping', 'preview'].indexOf(step) > i)
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "bg-muted text-muted-foreground border-border"
              )}>
                {i + 1}
              </div>
              <span className={cn("text-[10px] uppercase tracking-wider", step === s ? "text-foreground font-semibold" : "text-muted-foreground")}>
                {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Mapping' : 'Preview'}
              </span>
              {i < 2 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-xs text-foreground font-medium">
                {fileName || 'Click to select catalog file'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Supports: .csv, .fdb, .tsv, .txt
              </p>
              <input ref={fileRef} type="file" accept=".csv,.fdb,.tsv,.txt,.dat" onChange={handleFile} className="hidden" />
            </div>

            <div className="bg-muted/50 rounded-md p-3 space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Supported Formats</h4>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3 h-3 text-primary" />
                  <span>Finale 3D .fdb catalog</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3 h-3 text-primary" />
                  <span>Generic CSV with headers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3 h-3 text-primary" />
                  <span>FireOne export</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3 h-3 text-primary" />
                  <span>Tab-separated (TSV)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-3 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {mappedCount}/{totalColumns} columns mapped · Delimiter: {delimiter === '\t' ? 'TAB' : delimiter === ';' ? ';' : ','} · {parsedEffects.length} rows
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setStep('preview')}>
                Next → Preview
              </Button>
            </div>

            <ScrollArea className="h-64 border border-border rounded-md">
              <div className="p-2 space-y-1.5">
                {columns.map((col, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-foreground truncate">{col.header}</div>
                      <div className="text-[8px] text-muted-foreground truncate">
                        {col.sampleValues.slice(0, 2).join(' | ')}
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <Select value={col.mappedTo || 'none'} onValueChange={(v) => updateMapping(i, v)}>
                      <SelectTrigger className="w-40 h-7 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-[10px]">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {col.mappedTo && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setStep('upload')}>
                ← Back
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleReparse}>
                <RefreshCw className="w-3 h-3" /> Re-parse
              </Button>
              <div className="flex-1" />
              <Button size="sm" className="h-7 text-[10px]" onClick={() => setStep('preview')}>
                Preview →
              </Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-3 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {selectedEffects.size}/{parsedEffects.length} effects selected
              </span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={toggleSelectAll}>
                {selectedEffects.size === parsedEffects.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <ScrollArea className="h-72 border border-border rounded-md">
              <div className="p-1 space-y-0.5">
                {parsedEffects.map((eff, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedEffects(prev => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      });
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors text-[10px]",
                      selectedEffects.has(i)
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEffects.has(i)}
                      readOnly
                      className="w-3 h-3 accent-primary"
                    />
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-border/50"
                      style={{ backgroundColor: eff.colorHex }}
                    />
                    <span className="flex-1 truncate font-medium">{eff.name}</span>
                    <span className="text-muted-foreground">{eff.partType}</span>
                    {eff.caliber > 0 && <span className="text-muted-foreground">{eff.caliber}"</span>}
                    <span className="text-muted-foreground">{eff.duration}s</span>
                    {eff.cost > 0 && <span className="text-accent">${eff.cost}</span>}
                  </button>
                ))}
              </div>
            </ScrollArea>

            {parsedEffects.length === 0 && (
              <div className="text-center py-6">
                <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum efeito encontrado. Verifique o mapeamento de colunas.</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setStep('mapping')}>
                ← Mapping
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => onOpenChange(false)}>
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-[10px]"
                onClick={handleImport}
                disabled={selectedEffects.size === 0}
              >
                <Check className="w-3 h-3 mr-1" /> Import {selectedEffects.size} Effects
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
