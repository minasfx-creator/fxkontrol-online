import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X, Megaphone, MessageSquarePlus, Plug, Clock, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import BetaFeedbackDialog from './BetaFeedbackDialog';

type DialogCategory = 'bug' | 'suggestion' | 'integration' | 'other';

const STORAGE_KEY = 'beta_promo_banner_dismissed_v1';
const PRESIGNUP_KEY = 'beta_presignup_email_v1';

// Promotional pricing details — surfaced in the confirmation message.
const PROMO = {
  monthly: 'R$ 149/mês',
  yearly: 'R$ 1.490/ano',
  retail: 'R$ 349/mês',
  savings: '57% OFF',
  perks: ['Lock-in vitalício do preço', 'Acesso prioritário a novos módulos', 'Suporte direto com a engenharia'],
} as const;

const emailSchema = z.string().trim().toLowerCase().email('Email inválido').max(255);

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

  // Pre-signup capture
  const [presignupOpen, setPresignupOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PRESIGNUP_KEY);
  });

  // Schedule: parse end date once, then tick every second to drive countdown + auto-hide.
  const endsAtMs = useMemo(() => {
    if (!endsAt) return null;
    const t = Date.parse(endsAt);
    return Number.isFinite(t) ? t : null;
  }, [endsAt]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAtMs == null) return;
    if (now >= endsAtMs) return; // expired — no need to tick
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endsAtMs, now]);

  const expired = endsAtMs != null && now >= endsAtMs;
  const remainingMs = endsAtMs != null ? Math.max(0, endsAtMs - now) : 0;
  const countdown = endsAtMs != null && !expired ? formatRemaining(remainingMs) : '';
  // Highlight the chip in red during the final 24h
  const urgent = endsAtMs != null && remainingMs > 0 && remainingMs < 24 * 3600 * 1000;

  if (dismissed || expired) return null;

  const openFeedback = (cat: DialogCategory) => {
    setDialogCategory(cat);
    setFeedbackOpen(true);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  const handlePresignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Email inválido');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('beta_feedback').insert({
        category: 'presignup',
        message: `Pre-signup: ${parsed.data}`,
        contact_email: parsed.data,
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'beta',
        metadata: { source: 'beta_promo_banner', promo: PROMO },
      });
      if (error) throw error;
      localStorage.setItem(PRESIGNUP_KEY, parsed.data);
      setConfirmedEmail(parsed.data);
      setEmail('');
      setPresignupOpen(false);
      toast.success('Pré-assinatura confirmada!', {
        description: `${parsed.data} · ${PROMO.monthly} (${PROMO.savings} vs ${PROMO.retail})`,
      });
    } catch (err: any) {
      console.error('[BetaPromoBanner] presignup failed', err);
      toast.error('Falha ao registrar', {
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    } finally {
      setSubmitting(false);
    }
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
          {countdown && (
            <span
              className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded tabular-nums"
              title={`Promoção termina em ${new Date(endsAtMs!).toLocaleString()}`}
              style={{
                background: urgent ? 'hsl(0 80% 50% / 0.18)' : 'hsl(48 100% 50% / 0.15)',
                color: urgent ? 'hsl(0 80% 70%)' : 'hsl(48 100% 70%)',
                border: `1px solid ${urgent ? 'hsl(0 80% 50% / 0.5)' : 'hsl(48 100% 50% / 0.4)'}`,
              }}
            >
              <Clock className="h-3 w-3" />
              Termina em {countdown}
            </span>
          )}
          {countdown && (
            <span
              className="md:hidden inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded tabular-nums"
              title={`Termina em ${countdown}`}
              style={{
                background: urgent ? 'hsl(0 80% 50% / 0.18)' : 'hsl(48 100% 50% / 0.15)',
                color: urgent ? 'hsl(0 80% 70%)' : 'hsl(48 100% 70%)',
                border: `1px solid ${urgent ? 'hsl(0 80% 50% / 0.5)' : 'hsl(48 100% 50% / 0.4)'}`,
              }}
            >
              <Clock className="h-2.5 w-2.5" />
              {countdown}
            </span>
          )}
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
