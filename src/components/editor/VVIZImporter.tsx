import { useState, useRef, useCallback, useEffect, startTransition } from 'react';
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
import { importVVIZAsync, type VVIZImportResult } from '@/lib/vvizImporter';
import { useMyLibrary } from '@/hooks/useMyLibrary';
import { toast } from 'sonner';

type ImportPhase = 'idle' | 'reading' | 'parsing' | 'importing' | 'done';

function formatCompact(n: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, n));
}

export default function VVIZImporter({
  open,
  onOpenChange,
  initialFile = null,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialFile?: File | null;
}) {
  const { batchImportVVIZ } = useProjectStore();
  const [result, setResult] = useState<VVIZImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const parseRunRef = useRef(0);
  const { saveToLibrary } = useMyLibrary();

  const parseFile = useCallback(async (file: File) => {
    const runId = ++parseRunRef.current;

    setFileName(file.name);
    setCurrentFile(file);
    setResult(null);
    setPhase('reading');
    setProgress(5);
    setProgressLabel('Lendo arquivo...');

    try {
      // Read file text — will be released after JSON.parse inside importVVIZAsync
      let text: string | null = await file.text();
      if (runId !== parseRunRef.current) return;

      setPhase('parsing');
      setProgress(10);
      setProgressLabel('Analisando performances...');

      // Pass text and immediately null the reference so GC can reclaim the raw string
      const parsePromise = importVVIZAsync(text, (doneDrones, totalDrones, doneSamples, totalSamples) => {
        if (runId !== parseRunRef.current) return;

        const progressRatio = totalSamples > 0
          ? doneSamples / totalSamples
          : doneDrones / Math.max(1, totalDrones);

        const pct = 10 + Math.round(progressRatio * 85);
        setProgress(Math.max(10, Math.min(95, pct)));
        setProgressLabel(`Processando ${doneDrones}/${totalDrones} drones • ${formatCompact(doneSamples)}/${formatCompact(totalSamples)} pontos`);
      });

      if (runId !== parseRunRef.current) return;

      setResult(parsed);
      setPhase('idle');
      setProgress(95);
      setProgressLabel(`${parsed.droneCount} drones prontos para importar`);

      if (parsed.errors.length > 0) {
        toast.warning(`${parsed.errors.length} aviso(s) durante análise`);
      }

      if ((parsed.stats?.compressionRatio || 0) > 0.35) {
        toast.info(`Otimização automática aplicada (${Math.round((parsed.stats?.compressionRatio || 0) * 100)}% menos pontos)`);
      }
    } catch {
      if (runId !== parseRunRef.current) return;
      setPhase('idle');
      setProgress(0);
      setProgressLabel('');
      toast.error('Falha ao ler/analisar arquivo VVIZ');
    }
  }, []);

  useEffect(() => {
    if (initialFile && open) parseFile(initialFile);
  }, [initialFile, open, parseFile]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleImport = useCallback(() => {
    if (!result) return;

    setPhase('importing');
    setProgress(96);
    setProgressLabel(`Aplicando ${result.droneCount} drones ao projeto...`);

    requestAnimationFrame(() => {
      startTransition(() => {
        batchImportVVIZ(result.positions, result.trajectories, result.projectName, result.duration);
      });

      setTimeout(() => {
        setProgress(100);
        setProgressLabel(`${result.droneCount} drones importados ✓`);
        setPhase('done');

        toast.success(`Importado: ${result.droneCount} drones, ${result.trajectories.length} trajetórias`);

        if (currentFile) {
          saveToLibrary(currentFile, {
            name: fileName || 'VVIZ Import',
            source: 'vviz',
            file_format: 'vviz',
            tags: ['show', 'vviz'],
          });
        }

        setTimeout(() => {
          onOpenChange(false);
          setResult(null);
          setFileName(null);
          setCurrentFile(null);
          setPhase('idle');
          setProgress(0);
          setProgressLabel('');
        }, 1000);
      }, 80);
    });
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
              {fileName || 'Clique para selecionar arquivo .vviz'}
            </p>
            <input ref={fileRef} type="file" accept=".vviz,.json" onChange={handleFile} className="hidden" />
          </div>

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

              {result.stats && (
                <div className="bg-surface-1 rounded-sm p-1.5 flex items-center justify-between text-[9px] font-mono-code">
                  <span className="text-muted-foreground">Pontos:</span>
                  <span className="text-foreground">
                    {result.stats.totalTraversalSamples.toLocaleString('pt-BR')} → {result.stats.totalWaypoints.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}

              {result.positions.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] text-muted-foreground mr-1">Cores:</span>
                  {[...new Set(result.positions.map((p) => p.color))].slice(0, 12).map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}

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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!result || result.droneCount === 0 || isProcessing}
              className="h-7 text-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" /> Importar {result?.droneCount || 0} Drones
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
