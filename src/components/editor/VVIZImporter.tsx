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
import { useMyLibrary } from '@/hooks/useMyLibrary';
import { toast } from 'sonner';
import { getDeviceProfile } from '@/lib/deviceCapability';

type ImportPhase = 'idle' | 'reading' | 'parsing' | 'importing' | 'done';

function formatCompact(n: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, n));
}

const CHUNK_SIZE = 40; // drones per store commit

export default function VVIZImporter({
  open,
  onOpenChange,
  initialFile = null,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialFile?: File | null;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [previewData, setPreviewData] = useState<{
    projectName: string; droneCount: number; duration: number;
    errors: string[]; stats: any; colors: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const parseRunRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  // Accumulator for streamed drones (outside React state to avoid re-renders)
  const accRef = useRef<{ positions: any[]; trajectories: any[] }>({ positions: [], trajectories: [] });
  const { saveToLibrary } = useMyLibrary();

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const commitChunks = useCallback(async (
    projectName: string, duration: number, droneCount: number
  ) => {
    const { positions, trajectories } = accRef.current;
    const store = useProjectStore.getState();

    // Single atomic commit — avoids repeated array copies from chunked set() calls
    // This is O(n) once instead of O(n*chunks)
    startTransition(() => {
      store.batchImportVVIZ(positions, trajectories, projectName, duration);
    });

    // Cleanup accumulator
    accRef.current = { positions: [], trajectories: [] };

    setProgress(100);
    setProgressLabel(`${droneCount} drones importados ✓`);
    setPhase('done');
    toast.success(`Importado: ${droneCount} drones, ${trajectories.length} trajetórias`);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    const runId = ++parseRunRef.current;
    workerRef.current?.terminate();
    workerRef.current = null;
    accRef.current = { positions: [], trajectories: [] };

    setFileName(file.name);
    setCurrentFile(file);
    setPreviewData(null);
    setPhase('reading');
    setProgress(5);
    setProgressLabel('Lendo arquivo...');

    try {
      const text = await file.text();
      if (runId !== parseRunRef.current) return;

      setPhase('parsing');
      setProgress(10);
      setProgressLabel('Iniciando Web Worker...');

      const device = getDeviceProfile();
      const worker = new Worker(
        new URL('@/lib/vvizWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      const colors = new Set<string>();

      worker.onmessage = (e: MessageEvent) => {
        if (runId !== parseRunRef.current) return;
        const msg = e.data;

        if (msg.type === 'progress') {
          const ratio = msg.totalSamples > 0
            ? msg.samples / msg.totalSamples
            : msg.done / Math.max(1, msg.total);
          const pct = 10 + Math.round(ratio * 75);
          setProgress(Math.max(10, Math.min(85, pct)));
          setProgressLabel(`Processando ${msg.done}/${msg.total} drones • ${formatCompact(msg.samples)}/${formatCompact(msg.totalSamples)} pontos`);
        }

        if (msg.type === 'drone') {
          // Accumulate outside React state
          if (msg.pos) {
            accRef.current.positions.push(msg.pos);
            colors.add(msg.pos.color);
          }
          if (msg.traj) accRef.current.trajectories.push(msg.traj);
        }

        if (msg.type === 'complete') {
          setProgress(90);
          setProgressLabel(`${msg.droneCount} drones prontos para importar`);
          setPreviewData({
            projectName: msg.projectName,
            droneCount: msg.droneCount,
            duration: msg.duration,
            errors: msg.errors,
            stats: msg.stats,
            colors: [...colors].slice(0, 12),
          });
          setPhase('idle');

          if (msg.errors.length > 0) {
            toast.warning(`${msg.errors.length} aviso(s) durante análise`);
          }
          if ((msg.stats?.compressionRatio || 0) > 0.35) {
            toast.info(`Otimização automática aplicada (${Math.round((msg.stats?.compressionRatio || 0) * 100)}% menos pontos)`);
          }

          worker.terminate();
          workerRef.current = null;
        }

        if (msg.type === 'error') {
          setPhase('idle');
          setProgress(0);
          setProgressLabel('');
          toast.error(msg.message || 'Falha ao analisar arquivo VVIZ');
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = () => {
        if (runId !== parseRunRef.current) return;
        setPhase('idle');
        setProgress(0);
        setProgressLabel('');
        toast.error('Erro no Web Worker ao processar VVIZ');
        worker.terminate();
        workerRef.current = null;
      };

      worker.postMessage({ type: 'parse', text, maxWaypoints: device.maxWaypoints });

    } catch {
      if (runId !== parseRunRef.current) return;
      setPhase('idle');
      setProgress(0);
      setProgressLabel('');
      toast.error('Falha ao ler arquivo VVIZ');
    }
  }, []);

  useEffect(() => {
    if (initialFile && open) parseFile(initialFile);
  }, [initialFile, open, parseFile]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleImport = useCallback(async () => {
    if (!previewData) return;

    setPhase('importing');
    setProgress(95);
    setProgressLabel(`Aplicando ${previewData.droneCount} drones ao projeto...`);

    // Use requestAnimationFrame to let UI update first
    requestAnimationFrame(async () => {
      await commitChunks(previewData.projectName, previewData.duration, previewData.droneCount);

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
        setPreviewData(null);
        setFileName(null);
        setCurrentFile(null);
        setPhase('idle');
        setProgress(0);
        setProgressLabel('');
      }, 1000);
    });
  }, [previewData, commitChunks, onOpenChange, currentFile, fileName, saveToLibrary]);

  const isProcessing = phase === 'reading' || phase === 'parsing' || phase === 'importing';
  const hasResult = previewData && accRef.current.positions.length > 0;

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
                <span>{phase === 'reading' ? 'Leitura' : phase === 'parsing' ? 'Web Worker' : 'Importação'}</span>
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

          {hasResult && !isProcessing && phase !== 'done' && previewData && (
            <div className="bg-surface-2 rounded-sm p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Preview
                </span>
                <span className="text-[10px] font-mono-code text-foreground">
                  {previewData.projectName}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-surface-1 rounded-sm p-1.5">
                  <p className="text-lg font-bold text-primary font-mono-code">{previewData.droneCount}</p>
                  <p className="text-[9px] text-muted-foreground">Drones</p>
                </div>
                <div className="bg-surface-1 rounded-sm p-1.5">
                  <p className="text-lg font-bold text-electric font-mono-code">{accRef.current.trajectories.length}</p>
                  <p className="text-[9px] text-muted-foreground">Trajetórias</p>
                </div>
                <div className="bg-surface-1 rounded-sm p-1.5">
                  <p className="text-lg font-bold text-safety font-mono-code">{previewData.duration}s</p>
                  <p className="text-[9px] text-muted-foreground">Duração</p>
                </div>
              </div>

              {previewData.stats && (
                <div className="bg-surface-1 rounded-sm p-1.5 flex items-center justify-between text-[9px] font-mono-code">
                  <span className="text-muted-foreground">Pontos:</span>
                  <span className="text-foreground">
                    {previewData.stats.totalTraversalSamples.toLocaleString('pt-BR')} → {previewData.stats.totalWaypoints.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}

              {previewData.colors.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] text-muted-foreground mr-1">Cores:</span>
                  {previewData.colors.map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}

              {previewData.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-1.5">
                  <div className="flex items-center gap-1 text-destructive text-[10px] font-semibold mb-1">
                    <AlertTriangle className="h-3 w-3" />
                    Avisos ({previewData.errors.length})
                  </div>
                  {previewData.errors.slice(0, 5).map((err, i) => (
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
              disabled={!hasResult || isProcessing}
              className="h-7 text-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" /> Importar {previewData?.droneCount || 0} Drones
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
