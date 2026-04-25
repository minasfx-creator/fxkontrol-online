import { useState } from 'react';
import { Sparkles, X, Megaphone, MessageSquarePlus } from 'lucide-react';
import BetaFeedbackDialog from './BetaFeedbackDialog';

const STORAGE_KEY = 'beta_promo_banner_dismissed_v1';

export default function BetaPromoBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
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

        <button
          onClick={handleDismiss}
          aria-label="Dispensar banner promocional"
          className="shrink-0 flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all active:scale-90"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
