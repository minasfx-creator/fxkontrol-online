/**
 * CrashRecoveryBanner — Shows when a dirty session is detected from IndexedDB.
 * Offers instant restore or dismiss.
 */
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBlackBox } from '@/hooks/useBlackBox';
import { cn } from '@/lib/utils';

export default function CrashRecoveryBanner() {
  const { hasDirtySession, dirtySessionName, dirtyTimestamp, restoreSession, dismissSession } = useBlackBox();

  if (!hasDirtySession) return null;

  const timeAgo = Math.round((Date.now() - dirtyTimestamp) / 60000);
  const timeLabel = timeAgo < 1 ? 'agora' : timeAgo < 60 ? `${timeAgo}min atrás` : `${Math.round(timeAgo / 60)}h atrás`;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-md w-full animate-in slide-in-from-top-2 duration-300">
      <div className="bg-amber-950/95 border border-amber-500/40 rounded-lg p-3 shadow-2xl backdrop-blur-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-200">Sessão não salva detectada</p>
            <p className="text-[10px] text-amber-200/70 mt-0.5">
              Projeto "<span className="font-semibold">{dirtySessionName}</span>" — {timeLabel}
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                className="h-6 text-[10px] gap-1 bg-amber-600 hover:bg-amber-500 text-black font-bold"
                onClick={restoreSession}
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-amber-200/60 hover:text-amber-200"
                onClick={dismissSession}
              >
                <X className="w-3 h-3" />
                Descartar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
