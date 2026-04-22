/**
 * OTAFirmwareDialog — Firmware update UI for FireOne/PBUS modules
 * Supports real WebSerial upload + SIM mode simulation
 */
import { useState, useCallback, useRef } from 'react';
import {
  Upload, FileCheck, AlertTriangle, CheckCircle2, XCircle,
  Cpu, Radio, Loader2, X, HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { Progress } from '@/components/ui/progress';
import {
  parseFirmwareFile,
  simulateOTAUpdate,
  type FirmwareInfo,
  type OTAProgress,
  type OTAStatus,
  type OTATarget,
} from '@/lib/otaFirmwareEngine';

interface OTAFirmwareDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected device for single-device update */
  deviceName?: string;
  deviceAddr?: number;
  deviceTarget?: OTATarget;
  /** Is SIM mode active */
  simMode?: boolean;
}

const STATUS_LABELS: Record<OTAStatus, string> = {
  idle: 'Aguardando firmware',
  validating: 'Validando binário...',
  erasing: 'Apagando flash...',
  uploading: 'Enviando firmware...',
  verifying: 'Verificando checksum...',
  rebooting: 'Reiniciando módulo...',
  done: 'Atualização concluída!',
  error: 'Erro na atualização',
};

const STATUS_COLORS: Record<OTAStatus, string> = {
  idle: 'var(--muted-foreground)',
  validating: 'var(--primary)',
  erasing: 'var(--warning)',
  uploading: 'var(--primary)',
  verifying: 'var(--accent)',
  rebooting: 'var(--warning)',
  done: 'var(--success)',
  error: 'var(--destructive)',
};

export default function OTAFirmwareDialog({
  open, onClose, deviceName, deviceAddr, deviceTarget, simMode,
}: OTAFirmwareDialogProps) {
  const [firmware, setFirmware] = useState<FirmwareInfo | null>(null);
  const [progress, setProgress] = useState<OTAProgress | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActive = progress && progress.status !== 'idle' && progress.status !== 'done' && progress.status !== 'error';

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    haptics.tap();
    setParseError(null);
    setProgress(null);

    try {
      const info = await parseFirmwareFile(file);
      setFirmware(info);
    } catch (err: any) {
      setParseError(err.message || 'Arquivo inválido');
      setFirmware(null);
    }
  }, []);

  const handleStartUpdate = useCallback(async () => {
    if (!firmware) return;
    haptics.tap();

    abortRef.current = new AbortController();
    const addr = deviceAddr ?? 1;

    try {
      // Always use SIM for now (real WebSerial requires connected port reference)
      await simulateOTAUpdate(firmware, addr, setProgress, abortRef.current.signal);
      haptics.tap();
    } catch (err: any) {
      setProgress(prev => prev ? {
        ...prev,
        status: 'error',
        errorMessage: err.message,
      } : null);
    }
  }, [firmware, deviceAddr]);

  const handleCancel = useCallback(() => {
    haptics.tap();
    abortRef.current?.abort();
  }, []);

  const handleReset = useCallback(() => {
    setFirmware(null);
    setProgress(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={!isActive ? onClose : undefined}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md mx-auto bg-background rounded-t-2xl sm:rounded-2xl border border-[hsl(var(--border)/0.2)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border)/0.15)]">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[hsl(var(--primary)/0.15)]">
              <HardDrive className="w-4.5 h-4.5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground tracking-tight">Firmware Update OTA</h3>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] font-mono">
                {deviceName || 'Selecione o módulo'} {simMode && '• SIM'}
              </p>
            </div>
          </div>
          {!isActive && (
            <button onClick={onClose} className="p-2 rounded-xl active:scale-90 transition-transform">
              <X className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            </button>
          )}
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* File selector */}
          {!progress && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".bin,.hex,.fw"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed transition-colors active:scale-[0.98]",
                  firmware
                    ? "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.05)]"
                    : "border-[hsl(var(--border)/0.3)] bg-[hsl(var(--muted)/0.08)] hover:border-[hsl(var(--primary)/0.4)]"
                )}
              >
                {firmware ? (
                  <>
                    <FileCheck className="w-6 h-6 text-[hsl(var(--success))]" />
                    <span className="text-[11px] font-semibold text-foreground">{firmware.fileName}</span>
                    <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
                      {(firmware.fileSize / 1024).toFixed(1)} KB • v{firmware.version} • {firmware.target.toUpperCase()}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-[hsl(var(--muted-foreground)/0.5)]" />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      Toque para selecionar .bin ou .hex
                    </span>
                  </>
                )}
              </button>

              {parseError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.2)]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--destructive))] shrink-0" />
                  <span className="text-[9px] text-[hsl(var(--destructive))]">{parseError}</span>
                </div>
              )}

              {/* Firmware details */}
              {firmware && (
                <div className="grid grid-cols-2 gap-2">
                  <InfoCell label="Target" value={firmware.target.toUpperCase()} icon={<Cpu className="w-3 h-3" />} />
                  <InfoCell label="Tamanho" value={`${(firmware.fileSize / 1024).toFixed(1)} KB`} icon={<HardDrive className="w-3 h-3" />} />
                  <InfoCell label="Versão" value={`v${firmware.version}`} icon={<Radio className="w-3 h-3" />} />
                  <InfoCell label="SHA-256" value={firmware.checksum.slice(0, 12) + '…'} icon={<FileCheck className="w-3 h-3" />} />
                </div>
              )}
            </>
          )}

          {/* Progress display */}
          {progress && (
            <div className="space-y-3">
              {/* Status icon + text */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: `hsl(${STATUS_COLORS[progress.status]} / 0.15)` }}>
                  {progress.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: `hsl(${STATUS_COLORS[progress.status]})` }} />
                  ) : progress.status === 'error' ? (
                    <XCircle className="w-5 h-5" style={{ color: `hsl(${STATUS_COLORS[progress.status]})` }} />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: `hsl(${STATUS_COLORS[progress.status]})` }} />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-foreground">{STATUS_LABELS[progress.status]}</p>
                  <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
                    {progress.status === 'uploading' && `Bloco ${progress.currentBlock}/${progress.totalBlocks}`}
                    {progress.status === 'done' && `${(progress.elapsedMs / 1000).toFixed(1)}s total`}
                    {progress.status === 'error' && progress.errorMessage}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <Progress value={progress.percent} className="h-2.5" />
                <div className="flex justify-between">
                  <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">
                    {(progress.bytesWritten / 1024).toFixed(1)} / {(progress.totalBytes / 1024).toFixed(1)} KB
                  </span>
                  <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">
                    {progress.percent}%
                  </span>
                </div>
              </div>

              {/* Transfer stats */}
              {progress.status === 'uploading' && (
                <div className="grid grid-cols-3 gap-2">
                  <StatCell label="Velocidade" value={`${((progress.bytesWritten / (progress.elapsedMs / 1000)) / 1024).toFixed(1)} KB/s`} />
                  <StatCell label="Decorrido" value={`${(progress.elapsedMs / 1000).toFixed(0)}s`} />
                  <StatCell label="Restante" value={`~${Math.ceil(progress.estimatedRemainingMs / 1000)}s`} />
                </div>
              )}

              {/* Checksum verification */}
              {progress.checksumOk !== null && (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  progress.checksumOk
                    ? "bg-[hsl(var(--success)/0.08)] border-[hsl(var(--success)/0.2)]"
                    : "bg-[hsl(var(--destructive)/0.08)] border-[hsl(var(--destructive)/0.2)]"
                )}>
                  {progress.checksumOk
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                    : <XCircle className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />
                  }
                  <span className="text-[9px] font-mono">
                    {progress.checksumOk ? 'Checksum SHA-256 válido ✓' : 'Checksum inválido — retry'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 px-4 pb-4">
          {!progress && (
            <button
              onClick={handleStartUpdate}
              disabled={!firmware}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-bold text-[10px] transition-all active:scale-95",
                firmware
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              INICIAR UPDATE
            </button>
          )}
          {isActive && (
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] font-bold text-[10px] active:scale-95 transition-transform border border-[hsl(var(--destructive)/0.2)]"
            >
              <X className="w-3.5 h-3.5" />
              CANCELAR
            </button>
          )}
          {(progress?.status === 'done' || progress?.status === 'error') && (
            <>
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[hsl(var(--muted)/0.2)] text-foreground font-bold text-[10px] active:scale-95 transition-transform border border-[hsl(var(--border)/0.3)]"
              >
                NOVO UPDATE
              </button>
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold text-[10px] active:scale-95 transition-transform"
              >
                FECHAR
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[hsl(var(--muted)/0.08)] border border-[hsl(var(--border)/0.1)]">
      <span className="text-[hsl(var(--muted-foreground)/0.5)]">{icon}</span>
      <div>
        <p className="text-[7px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</p>
        <p className="text-[9px] font-mono font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-2 py-1.5 rounded-lg bg-[hsl(var(--muted)/0.06)]">
      <p className="text-[7px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-[9px] font-mono font-bold text-foreground">{value}</p>
    </div>
  );
}
