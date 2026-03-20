import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileCode, Palette, Sparkles, AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseUAsset, parseUMap, linearColorToHex, type UAssetParseResult } from '@/lib/uassetParser';
import { NIAGARA_COLOR_PRESETS } from '@/lib/niagaraColorPresets';
import { useProjectStore, type Effect } from '@/store/useProjectStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ParsedFile {
  fileName: string;
  result: UAssetParseResult;
  selected: boolean;
}

interface UAssetImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UAssetImporter({ open, onOpenChange }: UAssetImporterProps) {
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    setLoading(true);
    const results: ParsedFile[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.uasset') && !file.name.endsWith('.umap')) continue;
      const buffer = await file.arrayBuffer();
      const result = file.name.endsWith('.umap')
        ? parseUMap(buffer, file.name)
        : parseUAsset(buffer, file.name);
      results.push({ fileName: file.name, result, selected: true });
    }

    setParsedFiles(results);
    setLoading(false);
    setImported(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const toggleFile = (index: number) => {
    setParsedFiles(prev => prev.map((f, i) => i === index ? { ...f, selected: !f.selected } : f));
  };

  const handleImport = useCallback(() => {
    const store = useProjectStore.getState();
    const selected = parsedFiles.filter(f => f.selected);
    let addedCount = 0;

    for (const file of selected) {
      const { result } = file;
      const h = result.heuristic;

      // Find matching Niagara preset
      const preset = NIAGARA_COLOR_PRESETS.find(p => p.source === file.fileName);

      const effect: Effect = {
        id: `niagara-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: preset?.name || h.suggestedName,
        category: h.suggestedCategory === 'aerial' ? 'morteiros' : h.suggestedCategory === 'ground' ? 'sfx' : 'sfx',
        type: 'firework',
        color: preset?.primary || (result.extractedColors.length > 0
          ? linearColorToHex(result.extractedColors[0])
          : h.suggestedColor),
        duration: preset?.particleProfile.lifetime
          ? preset.particleProfile.lifetime + 1.5
          : 3.5,
        cost: 25,
        icon: '🎆',
        partType: 'shell',
        caliber: 5,
        heightMeters: 100,
        prefire: 2.5,
        pattern: h.suggestedPattern,
        safetyDistance: 140,
      };

      // Add to timeline at a staggered position
      store.addTimelineItem({
        id: `tl-niagara-${Date.now()}-${addedCount}`,
        effectId: effect.id,
        startTime: addedCount * 2,
        trackIndex: 0,
        position: { x: addedCount * 5, y: 0, z: 0 },
      });

      addedCount++;
    }

    setImported(true);
    toast.success(`${addedCount} efeitos Niagara importados com sucesso`);
  }, [parsedFiles]);

  const handleReset = () => {
    setParsedFiles([]);
    setImported(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border-border/20 bg-card" style={{ maxHeight: '85vh' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-display tracking-wide">
            <FileCode className="h-5 w-5 text-primary" />
            Unreal Engine Asset Importer
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Importe arquivos .uasset (Niagara Particle Systems) e .umap para extrair efeitos pirotécnicos
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 px-1">
            {/* Drop zone */}
            {parsedFiles.length === 0 && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                  "border-border/30 hover:border-primary/50 hover:bg-primary/5",
                  loading && "pointer-events-none opacity-60"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".uasset,.umap"
                  className="hidden"
                  onChange={e => e.target.files && handleFiles(e.target.files)}
                />
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <span className="text-sm text-muted-foreground">Analisando arquivos binários...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-10 w-10 text-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-medium text-foreground/80">Arraste .uasset / .umap aqui</p>
                      <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar arquivos</p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">Niagara Systems</Badge>
                      <Badge variant="outline" className="text-[10px]">Niagara Emitters</Badge>
                      <Badge variant="outline" className="text-[10px]">Level Maps</Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Parsed results */}
            {parsedFiles.length > 0 && (
              <div className="space-y-3">
                {parsedFiles.map((file, index) => (
                  <ParsedFileCard
                    key={file.fileName}
                    file={file}
                    onToggle={() => toggleFile(index)}
                    imported={imported}
                  />
                ))}

                {/* Niagara preset palette */}
                <div className="rounded-xl border border-border/20 bg-surface-0/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Palette className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground/80 font-display tracking-wide uppercase">Niagara Color Palette</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {NIAGARA_COLOR_PRESETS.map(preset => (
                      <div key={preset.id} className="space-y-1.5">
                        <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
                          {preset.gradient.map((color, i) => (
                            <div
                              key={i}
                              className="flex-1"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <p className="text-[9px] text-muted-foreground font-mono-code truncate">{preset.name}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 h-10 rounded-xl text-xs" onClick={handleReset}>
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-10 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleImport}
                    disabled={imported || parsedFiles.filter(f => f.selected).length === 0}
                  >
                    {imported ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Importado!
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Importar {parsedFiles.filter(f => f.selected).length} efeitos
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ParsedFileCard({ file, onToggle, imported }: { file: ParsedFile; onToggle: () => void; imported: boolean }) {
  const { result } = file;
  const colorSwatches = result.extractedColors.length > 0
    ? result.extractedColors.slice(0, 6)
    : [{ r: 0.5, g: 0.5, b: 0.5, a: 1 }];

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all cursor-pointer",
        file.selected
          ? "border-primary/40 bg-primary/5"
          : "border-border/20 bg-surface-0/30 opacity-60",
        imported && "pointer-events-none"
      )}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
            file.selected ? "border-primary bg-primary" : "border-border/40"
          )}>
            {file.selected && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{result.heuristic.suggestedName}</p>
            <p className="text-[10px] text-muted-foreground font-mono-code">{file.fileName} · {(result.fileSize / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        <div className="flex gap-1">
          {result.valid && <Badge className="text-[8px] bg-success/15 text-success border-0">UE4 Valid</Badge>}
          {result.isNiagaraSystem && <Badge className="text-[8px] bg-primary/15 text-primary border-0">Niagara</Badge>}
          {!result.valid && <Badge className="text-[8px] bg-warning/15 text-warning border-0">Heuristic</Badge>}
        </div>
      </div>

      {/* Extracted colors */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[9px] text-muted-foreground/60 uppercase font-display">Colors:</span>
        <div className="flex gap-1">
          {colorSwatches.map((c, i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-md border border-border/20"
              style={{ backgroundColor: linearColorToHex(c) }}
              title={linearColorToHex(c)}
            />
          ))}
        </div>
        <div
          className="w-5 h-5 rounded-md border-2 border-border/30"
          style={{ backgroundColor: result.heuristic.suggestedColor }}
          title={`Suggested: ${result.heuristic.suggestedColor}`}
        />
      </div>

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Badge variant="outline" className="text-[8px]">Pattern: {result.heuristic.suggestedPattern}</Badge>
        <Badge variant="outline" className="text-[8px]">Category: {result.heuristic.suggestedCategory}</Badge>
        {result.rawStringTable.length > 0 && (
          <Badge variant="outline" className="text-[8px]">{result.rawStringTable.length} strings</Badge>
        )}
        {result.extractedColors.length > 0 && (
          <Badge variant="outline" className="text-[8px]">{result.extractedColors.length} colors</Badge>
        )}
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-warning">
          <AlertTriangle className="h-3 w-3" />
          {result.errors[0]}
        </div>
      )}
    </div>
  );
}
