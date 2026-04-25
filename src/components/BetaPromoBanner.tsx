import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X, Megaphone, MessageSquarePlus, Plug, Clock } from 'lucide-react';
import BetaFeedbackDialog from './BetaFeedbackDialog';

type DialogCategory = 'bug' | 'suggestion' | 'integration' | 'other';

const STORAGE_KEY = 'beta_promo_banner_dismissed_v1';

// Default end date for the Beta promotion. Override via prop or VITE_BETA_PROMO_ENDS_AT (ISO string).
const DEFAULT_ENDS_AT =
  (import.meta.env.VITE_BETA_PROMO_ENDS_AT as string | undefined) ??
  '2026-06-30T23:59:59-03:00';

interface BetaPromoBannerProps {
  /** ISO datetime string when the promo should auto-hide. Pass null to disable schedule. */
  endsAt?: string | null;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function BetaPromoBanner({ endsAt = DEFAULT_ENDS_AT }: BetaPromoBannerProps = {}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [dialogCategory, setDialogCategory] = useState<DialogCategory>('bug');

  if (dismissed) return null;

  const openFeedback = (cat: DialogCategory) => {
    setDialogCategory(cat);
    setFeedbackOpen(true);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
    <>
    <div
      role="region"
      aria-label="Beta Test Promotion"
      className="relative w-full overflow-hidden border-b"
      style={{
        background:
          'linear-gradient(90deg, hsl(32 100% 50% / 0.18) 0%, hsl(32 100% 50% / 0.08) 50%, hsl(32 100% 50% / 0.18) 100%)',
        borderColor: 'hsl(32 100% 50% / 0.3)',
      }}
    >
      {/* Animated scan line */}
      <div className="absolute inset-0 animate-holographic-scan pointer-events-none opacity-30" />

      <div className="relative z-10 flex items-center gap-3 px-3 py-2 md:px-6 md:py-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <Megaphone
            className="h-4 w-4 md:h-5 md:w-5 animate-pulse"
            style={{ color: 'hsl(32 100% 55%)' }}
          />
          <span
            className="hidden sm:inline text-[10px] md:text-[11px] font-mono font-black tracking-[0.25em] uppercase px-2 py-0.5 rounded"
            style={{
              background: 'hsl(32 100% 50% / 0.2)',
              color: 'hsl(32 100% 65%)',
              border: '1px solid hsl(32 100% 50% / 0.4)',
            }}
          >
            BETA TEST
          </span>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 text-[10px] md:text-xs leading-tight">
            <Sparkles
              className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0"
              style={{ color: 'hsl(48 100% 60%)' }}
            />
            <p className="truncate md:whitespace-normal">
              <span
                className="font-bold tracking-wide"
                style={{ color: 'hsl(32 100% 70%)' }}
              >
                BETA TEST PROMOTION
              </span>
              <span className="mx-1.5 opacity-60">—</span>
              <span className="font-semibold text-foreground">
                Garanta sua pré-assinatura com valor promocional de inauguração
              </span>
              <span className="hidden md:inline text-muted-foreground">
                {' '}durante nossa fase de testes, qualidade e auditoria. Faça parte desta revolução: envie sugestões de melhorias, bugs e conexões com novos sistemas de equipamentos.
              </span>
            </p>
          </div>
        </div>

        {/* Integrate Equipment link (desktop) */}
        <button
          onClick={() => openFeedback('integration')}
          className="shrink-0 hidden md:flex items-center gap-1.5 h-7 px-2.5 rounded text-[10px] md:text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95"
          style={{
            background: 'hsl(32 100% 50% / 0.15)',
            color: 'hsl(32 100% 70%)',
            border: '1px dashed hsl(32 100% 50% / 0.5)',
          }}
          title="Solicitar integração de novo equipamento (marca, modelo, protocolo)"
        >
          <Plug className="h-3.5 w-3.5" />
          <span>Integrar Equipamento</span>
        </button>

        {/* Integrate Equipment icon (mobile/tablet) */}
        <button
          onClick={() => openFeedback('integration')}
          aria-label="Solicitar integração de novo equipamento"
          className="shrink-0 md:hidden flex items-center justify-center h-7 w-7 rounded transition-all active:scale-90"
          style={{
            background: 'hsl(32 100% 50% / 0.15)',
            color: 'hsl(32 100% 70%)',
            border: '1px dashed hsl(32 100% 50% / 0.4)',
          }}
          title="Integrar equipamento"
        >
          <Plug className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => openFeedback('bug')}
          className="shrink-0 hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded text-[10px] md:text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95"
          style={{
            background: 'hsl(32 100% 50% / 0.25)',
            color: 'hsl(32 100% 75%)',
            border: '1px solid hsl(32 100% 50% / 0.5)',
          }}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span>Feedback</span>
        </button>

        <button
          onClick={() => openFeedback('bug')}
          aria-label="Enviar feedback"
          className="shrink-0 sm:hidden flex items-center justify-center h-7 w-7 rounded transition-all active:scale-90"
          style={{
            background: 'hsl(32 100% 50% / 0.2)',
            color: 'hsl(32 100% 70%)',
            border: '1px solid hsl(32 100% 50% / 0.4)',
          }}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleDismiss}
          aria-label="Dispensar banner promocional"
          className="shrink-0 flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all active:scale-90"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    <BetaFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} initialCategory={dialogCategory} />
    </>
  );
}
