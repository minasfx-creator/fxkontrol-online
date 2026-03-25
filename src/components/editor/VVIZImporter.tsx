import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileJson, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/store/useProjectStore';
import { importVVIZ, type VVIZImportResult } from '@/lib/vvizImporter';
import { useMyLibrary } from '@/hooks/useMyLibrary';
import { toast } from 'sonner';

type ImportPhase = 'idle' | 'reading' | 'parsing' | 'importing' | 'done';

export default function VVIZImporter({ open, onOpenChange, initialFile = null }: { open: boolean; onOpenChange: (v: boolean) => void; initialFile?: File | null }) {
  const { batchImportVVIZ } = useProjectStore();
  const [result, setResult] = useState<VVIZImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { saveToLibrary } = useMyLibrary();

  const parseFile = useCallback((file: File) => {
    setFileName(file.name);
    setCurrentFile(file);
    setPhase('reading');
    setProgress(10);
    setProgressLabel('Lendo arquivo...');

    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 30));
      }
    };
    reader.onload = () => {
      setPhase('parsing');
      setProgress(35);
      setProgressLabel('Analisando performances...');

      // Use requestAnimationFrame to let the UI update before heavy parsing
      requestAnimationFrame(() => {
        const text = reader.result as string;
        const parsed = importVVIZ(text);

        setProgress(90);
        setProgressLabel(`${parsed.droneCount} drones encontrados`);

        setTimeout(() => {
          setResult(parsed);
          setPhase('idle');
          setProgress(100);
          setProgressLabel('Pronto');
          if (parsed.errors.length > 0) {
            toast.warning(`${parsed.errors.length} aviso(s) durante o import`);
          }
        }, 150);
      });
    };
    reader.readAsText(file);
  }, []);

  useEffect(() => {
    if (initialFile && open) parseFile(initialFile);
  }, [initialFile, open, parseFile]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
  }, [parseFile]);

  const handleImport = useCallback(() => {
    if (!result) return;

    setPhase('importing');
    setProgress(0);
    setProgressLabel(`Importando 0/${result.droneCount} drones...`);

    // Smooth progress animation — 25 steps over ~500ms
    const totalSteps = 25;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const pct = Math.min((step / totalSteps) * 95, 95);
      const dronesProcessed = Math.min(Math.round((pct / 95) * result.droneCount), result.droneCount);
      setProgress(pct);
      setProgressLabel(`Importando ${dronesProcessed}/${result.droneCount} drones...`);

      if (step >= totalSteps) {
        clearInterval(interval);

        // Defer the heavy batch operation to next frame so the 95% paint lands first
        requestAnimationFrame(() => {
          batchImportVVIZ(result.positions, result.trajectories, result.projectName, result.duration);

          // Let React flush the store update, then show completion
          setTimeout(() => {
            setProgress(100);
            setProgressLabel(`${result.droneCount} drones importados ✓`);
            setPhase('done');

            toast.success(`Importado: ${result.droneCount} drones, ${result.trajectories.length} trajetórias`);

            // Auto-save to library
            if (currentFile) {
              saveToLibrary(currentFile, { name: fileName || 'VVIZ Import', source: 'vviz', file_format: 'vviz', tags: ['show', 'vviz'] });
            }

            setTimeout(() => {
              onOpenChange(false);
              setResult(null);
              setFileName(null);
              setCurrentFile(null);
              setPhase('idle');
              setProgress(0);
            }, 1000);
          }, 50);
        });
      }
    }, 20);
  }, [result, batchImportVVIZ, onOpenChange, currentFile, fileName, saveToLibrary]);

  const isProcessing = phase === 'reading' || phase === 'parsing' || phase === 'importing';

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileJson className="h-4 w-4 text-primary" />
            Importar VVIZ (Finale 3D)
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Carregue um arquivo .vviz para importar posições, trajetórias e cores dos drones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div
            className={`border-2 border-dashed border-border rounded-md p-6 text-center transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}`}
            onClick={() => !isProcessing && fileRef.current?.click()}
          >
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              {fileName ? fileName : 'Clique para selecionar arquivo .vviz'}
            </p>
            <input ref={fileRef} type="file" accept=".vviz,.json" onChange={handleFile} className="hidden" />
          </div>

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-[10px] text-muted-foreground font-mono">{progressLabel}</span>
              </div>
              <Progress value={progress} className="h-1.5" />
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                <span>{phase === 'reading' ? 'Leitura' : phase === 'parsing' ? 'Análise' : 'Importação'}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          )}

          {/* Done indicator */}
          {phase === 'done' && (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-sm p-2">
              <Check className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-primary font-semibold">{progressLabel}</span>
            </div>
          )}

          {result && !isProcessing && phase !== 'done' && (
            <div className="bg-surface-2 rounded-sm p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Preview
                </span>
                <span className="text-[10px] font-mono-code text-foreground">
                  {result.projectName}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-surface-1 rounded-sm p-1.5">
                  <p className="text-lg font-bold text-primary font-mono-code">{result.droneCount}</p>
                  <p className="text-[9px] text-muted-foreground">Drones</p>
                </div>
                <div className="bg-surface-1 rounded-sm p-1.5">
                  <p className="text-lg font-bold text-electric font-mono-code">{result.trajectories.length}</p>
                  <p className="text-[9px] text-muted-foreground">Trajetórias</p>
                </div>
                <div className="bg-surface-1 rounded-sm p-1.5">
                  <p className="text-lg font-bold text-safety font-mono-code">{result.duration}s</p>
                  <p className="text-[9px] text-muted-foreground">Duração</p>
                </div>
              </div>

              {/* Color samples */}
              {result.positions.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] text-muted-foreground mr-1">Cores:</span>
                  {[...new Set(result.positions.map(p => p.color))].slice(0, 12).map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-1.5">
                  <div className="flex items-center gap-1 text-destructive text-[10px] font-semibold mb-1">
                    <AlertTriangle className="h-3 w-3" />
                    Avisos ({result.errors.length})
                  </div>
                  {result.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-[9px] text-destructive/80">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isProcessing} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!result || result.droneCount === 0 || isProcessing}
              className="h-7 text-xs"
            >
              {isProcessing ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando...</>
              ) : (
                <><Check className="h-3 w-3 mr-1" /> Importar {result?.droneCount || 0} Drones</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
