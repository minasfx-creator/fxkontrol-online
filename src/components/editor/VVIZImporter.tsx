import { useState, useRef, useCallback, useEffect, startTransition, useMemo } from 'react';
import { Upload, FileJson, X, Check, AlertTriangle, Loader2, Replace, Plus, Wifi, WifiOff } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { isEnabled } from '@/lib/featureFlags';
import { importVvizFile } from '@/modules/vviz';
// tus-js-client loaded dynamically to reduce initial bundle

type ImportPhase = 'idle' | 'uploading' | 'reading' | 'parsing' | 'importing' | 'done';

const TUS_THRESHOLD = 20 * 1024 * 1024; // 20MB — above this, use TUS resumable upload
const TUS_CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks

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
  const [replaceMode, setReplaceMode] = useState(true);
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
      tusRef.current?.abort();
      tusRef.current = null;
    };
  }, []);

  const existingDroneCount = useMemo(() => {
    return useProjectStore.getState().positions.filter(p => p.type === 'drone-pad').length;
  }, [open]);

  const commitChunks = useCallback(async (
    projectName: string, duration: number, droneCount: number
  ) => {
    const { positions, trajectories } = accRef.current;
    const store = useProjectStore.getState();

    startTransition(() => {
      if (replaceMode) {
        store.replaceImportVVIZ(positions, trajectories, projectName, duration);
      } else {
        store.batchImportVVIZ(positions, trajectories, projectName, duration);
      }
    });

    // ── Sync to ShowPlan (canonical source of truth) ──
    // Convert accumulated drone data into ShowPlan drone paths
    try {
      const { importVVIZToShowPlan } = await import('@/core/showplan/importers/VVIZToShowPlan');
      const vvizDrones = trajectories.map((traj: any, idx: number) => ({
        id: traj.id || `vviz-drone-${idx}`,
        label: positions[idx]?.name || `Drone-${idx + 1}`,
        color: positions[idx]?.color || '#00ffff',
        waypoints: (traj.waypoints || []).map((wp: any) => ({
          time: wp.time ?? 0,
          x: wp.position?.x ?? 0,
          y: wp.position?.y ?? 0,
          z: wp.position?.z ?? 0,
          speed: wp.maxSpeed ?? 5,
        })),
      }));
      const result = importVVIZToShowPlan(vvizDrones, { invertZ: false }); // already normalized by worker
      console.log(`[VVIZImporter] ShowPlan synced: ${result.droneCount} drones, ${result.totalWaypoints} waypoints`);
    } catch (e) {
      console.warn('[VVIZImporter] ShowPlan sync failed:', e);
    }

    // Cleanup accumulator
    accRef.current = { positions: [], trajectories: [] };

    setProgress(100);
    setProgressLabel(`${droneCount} drones importados ✓`);
    setPhase('done');
    toast.success(`Importado: ${droneCount} drones, ${trajectories.length} trajetórias`);
  }, [replaceMode]);

  const tusRef = useRef<any>(null);

  const sendToWorker = useCallback((buffer: ArrayBuffer, runId: number) => {
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

    const safetyTimeout = setTimeout(() => {
      if (runId !== parseRunRef.current) return;
      setPhase('idle');
      setProgress(0);
      setProgressLabel('');
      toast.error('Timeout: importação VVIZ demorou demais (>120s).');
      worker.terminate();
      workerRef.current = null;
    }, 120_000);

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
        if (msg.pos) {
          accRef.current.positions.push(msg.pos);
          colors.add(msg.pos.color);
        }
        if (msg.traj) accRef.current.trajectories.push(msg.traj);
      }

      if (msg.type === 'complete') {
        clearTimeout(safetyTimeout);
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
        clearTimeout(safetyTimeout);
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
      clearTimeout(safetyTimeout);
      setPhase('idle');
      setProgress(0);
      setProgressLabel('');
      toast.error('Erro no Web Worker ao processar VVIZ');
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ type: 'parse', buffer, maxWaypoints: device.maxWaypoints }, [buffer]);
  }, []);

  const uploadViaTUS = useCallback(async (file: File, runId: number): Promise<ArrayBuffer | null> => {
    const bucketName = 'assets';
    const storagePath = `vviz-uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Get session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Autenticação necessária para upload de arquivos grandes.');
      return null;
    }

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const tus = await import('tus-js-client');
    return new Promise<ArrayBuffer | null>((resolve) => {
      const upload = new tus.Upload(file, {
        endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        chunkSize: TUS_CHUNK_SIZE,
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName,
          objectName: storagePath,
          contentType: file.type || 'application/json',
          cacheControl: '3600',
        },
        onError: (error) => {
          console.error('TUS upload error:', error);
          toast.error('Upload interrompido — tentando novamente...');
          tusRef.current = null;
          resolve(null);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (runId !== parseRunRef.current) return;
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          setProgress(Math.min(pct * 0.08, 8)); // 0-8% for upload phase
          setProgressLabel(`Upload resumível: ${Math.round(bytesUploaded / 1024 / 1024)}MB / ${Math.round(bytesTotal / 1024 / 1024)}MB`);
        },
        onSuccess: async () => {
          tusRef.current = null;
          if (runId !== parseRunRef.current) { resolve(null); return; }

          setProgressLabel('Download do storage para processamento...');
          setProgress(9);

          try {
            // Download back as ArrayBuffer for Worker processing
            const { data, error } = await supabase.storage.from(bucketName).download(storagePath);
            if (error || !data) {
              toast.error('Falha ao recuperar arquivo do storage.');
              resolve(null);
              return;
            }
            const arrayBuffer = await data.arrayBuffer();

            // Cleanup: delete the temp file from storage (fire-and-forget)
            supabase.storage.from(bucketName).remove([storagePath]).catch(() => {});

            resolve(arrayBuffer);
          } catch {
            toast.error('Falha ao processar arquivo após upload.');
            resolve(null);
          }
        },
      });

      tusRef.current = upload;

      // Check for previous uploads to resume
      upload.findPreviousUploads().then((prev) => {
        if (prev.length > 0) {
          upload.resumeFromPreviousUpload(prev[0]);
          toast.info('Retomando upload anterior...');
        }
        upload.start();
      });
    });
  }, []);

  const parseFile = useCallback(async (file: File) => {
    const runId = ++parseRunRef.current;
    workerRef.current?.terminate();
    workerRef.current = null;
    tusRef.current?.abort();
    tusRef.current = null;
    accRef.current = { positions: [], trajectories: [] };

    setFileName(file.name);
    setCurrentFile(file);
    setPreviewData(null);
    setProgress(1);

    try {
      let buffer: ArrayBuffer;

      if (file.size > TUS_THRESHOLD) {
        // Large file → TUS resumable upload → download → Worker
        setPhase('uploading');
        setProgressLabel(`Upload resumível (${Math.round(file.size / 1024 / 1024)}MB)...`);
        const result = await uploadViaTUS(file, runId);
        if (!result || runId !== parseRunRef.current) {
          if (runId === parseRunRef.current) {
            setPhase('idle'); setProgress(0); setProgressLabel('');
          }
          return;
        }
        buffer = result;
      } else {
        // Small file → optional pre-flight via @/modules/vviz, then direct
        // FileReader (zero-copy) for the worker. Pre-flight is a structural
        // sanity check (size cap, JSON parse, top-level shape). It does NOT
        // feed the renderer — vvizWorker remains the source of drone data.
        if (isEnabled('vviz_module_pipeline')) {
          setPhase('parsing');
          setProgressLabel('Pré-validação (módulo vviz)...');
          setProgress(3);
          try {
            await importVvizFile(file, {
              maxFileMb: Math.max(1, Math.ceil(TUS_THRESHOLD / 1024 / 1024)),
              onProgress: (p) => {
                if (runId !== parseRunRef.current) return;
                setProgress(Math.min(8, 3 + Math.round(p.progress * 5)));
                if (p.message) setProgressLabel(`Pré-validação: ${p.message}`);
              },
            });
            if (runId !== parseRunRef.current) return;
          } catch (err) {
            // Pre-flight failure: surface, then fall through to legacy worker
            // so we never block a renderable file on a stricter checker.
            console.warn('[VVIZImporter] Pré-validação falhou, usando fallback:', err);
            toast.warning('Pré-validação falhou — usando importador legado.');
          }
        }

        setPhase('reading');
        setProgressLabel('Lendo arquivo...');
        setProgress(5);
        buffer = await file.arrayBuffer();
      }

      if (runId !== parseRunRef.current) return;
      sendToWorker(buffer, runId);
    } catch {
      if (runId !== parseRunRef.current) return;
      setPhase('idle');
      setProgress(0);
      setProgressLabel('');
      toast.error('Falha ao ler arquivo VVIZ');
    }
  }, [sendToWorker, uploadViaTUS]);

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

  const isProcessing = phase === 'uploading' || phase === 'reading' || phase === 'parsing' || phase === 'importing';
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
                <span>{phase === 'uploading' ? 'Upload TUS' : phase === 'reading' ? 'Leitura' : phase === 'parsing' ? 'Web Worker' : 'Importação'}</span>
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

          {hasResult && existingDroneCount > 0 && !isProcessing && phase !== 'done' && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-sm p-2">
              <button
                onClick={() => setReplaceMode(true)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${replaceMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Replace className="h-3 w-3" /> Substituir ({existingDroneCount} existentes)
              </button>
              <button
                onClick={() => setReplaceMode(false)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${!replaceMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Plus className="h-3 w-3" /> Adicionar ao show
              </button>
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
                  <Check className="h-3 w-3 mr-1" /> {replaceMode && existingDroneCount > 0 ? 'Substituir' : 'Importar'} {previewData?.droneCount || 0} Drones
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
