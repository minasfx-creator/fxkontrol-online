import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, ExternalLink, ArrowUpRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
const PADDLE_ENV: 'sandbox' | 'live' = clientToken?.startsWith('test_') ? 'sandbox' : 'live';

type Subscription = {
  id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  paddle_subscription_id: string;
  paddle_customer_id: string;
};

const STATUS_META: Record<string, { label: string; tone: 'ok' | 'warn' | 'err' | 'muted'; description: string }> = {
  active:    { label: 'Ativa',     tone: 'ok',    description: 'Assinatura paga e em dia.' },
  trialing:  { label: 'Trial',     tone: 'ok',    description: 'Período de teste em andamento.' },
  past_due:  { label: 'Em atraso', tone: 'warn',  description: 'Pagamento falhou. Atualize seu método de pagamento.' },
  paused:    { label: 'Pausada',   tone: 'warn',  description: 'Assinatura pausada temporariamente.' },
  canceled:  { label: 'Cancelada', tone: 'err',   description: 'Acesso ativo até o fim do período pago.' },
};

const TONE_COLOR: Record<string, string> = {
  ok:    'hsl(142 76% 45%)',
  warn:  'hsl(38 92% 50%)',
  err:   'hsl(0 84% 60%)',
  muted: 'hsl(var(--muted-foreground))',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BillingTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('environment', PADDLE_ENV)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[billing] fetch error', error);
    }
    setSub((data as Subscription | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Realtime — re-fetch with env filter on any change to this user's rows.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`billing-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` },
        () => fetchSubscription(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSubscription]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { environment: PADDLE_ENV },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error('No portal URL returned');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      // customer-portal function isn't deployed yet — fail soft with guidance.
      console.error('[billing] portal error', e);
      toast({
        title: 'Portal indisponível',
        description: 'O portal de gerenciamento ainda não está disponível. Use o link Paddle (paddle.net) recebido por email para gerenciar sua assinatura.',
        variant: 'destructive',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const hasSub = !!sub;
  const meta = sub ? STATUS_META[sub.status] ?? { label: sub.status, tone: 'muted' as const, description: '' } : null;
  const toneColor = meta ? TONE_COLOR[meta.tone] : TONE_COLOR.muted;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-wide flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            ASSINATURA E COBRANÇA
          </h2>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            Ambiente: {PADDLE_ENV === 'sandbox' ? 'TEST' : 'LIVE'}
          </p>
        </div>
      </div>

      {/* Plan card */}
      <div className="rounded-xl border p-5 space-y-4"
        style={{ background: 'hsl(var(--surface-0))', borderColor: 'hsl(32 100% 50% / 0.1)' }}>
        {hasSub && sub && meta ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Plano atual</p>
                <p className="text-lg font-bold text-foreground font-mono uppercase">{sub.product_id}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{sub.price_id}</p>
              </div>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-widest shrink-0"
                style={{ background: `${toneColor.replace('hsl(', 'hsl(').replace(')', ' / 0.15)')}`, color: toneColor }}
              >
                {meta.tone === 'ok' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                {meta.label}
              </span>
            </div>

            {meta.description && (
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            )}

            <Separator className="opacity-20" />

            {/* Billing period */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-0.5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Período atual</p>
                <p className="text-sm text-foreground font-mono">{fmtDate(sub.current_period_start)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {sub.cancel_at_period_end ? 'Acesso até' : 'Próxima renovação'}
                </p>
                <p className="text-sm text-foreground font-mono">{fmtDate(sub.current_period_end)}</p>
              </div>
            </div>

            {sub.cancel_at_period_end && (
              <div className="flex items-start gap-2 p-2.5 rounded-md text-xs"
                style={{ background: 'hsl(38 92% 50% / 0.1)', color: 'hsl(38 92% 50%)' }}>
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Cancelamento agendado. Você manterá acesso até {fmtDate(sub.current_period_end)}.</span>
              </div>
            )}

            <Separator className="opacity-20" />

            {/* Actions */}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/pricing')}>
                <ArrowUpRight className="h-3.5 w-3.5" />
                Mudar plano
              </Button>
              <Button
                size="sm"
                onClick={openPortal}
                disabled={portalLoading}
                className="gap-2"
                style={{ background: 'hsl(32 100% 50%)', color: 'hsl(220 30% 6%)' }}
              >
                {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                Gerenciar assinatura
              </Button>
            </div>
          </>
        ) : (
          /* Free tier — no subscription */
          <>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Plano atual</p>
              <p className="text-lg font-bold text-foreground font-mono uppercase">FREE</p>
              <p className="text-xs text-muted-foreground">Você está no plano gratuito. Faça upgrade para liberar exports, hardware e JOI ilimitado.</p>
            </div>

            <Separator className="opacity-20" />

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => navigate('/pricing')}
                className="gap-2"
                style={{ background: 'hsl(32 100% 50%)', color: 'hsl(220 30% 6%)' }}
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                Ver planos
              </Button>
            </div>
          </>
        )}
      </div>

      {/* MoR note */}
      <p className="text-[10px] text-muted-foreground/70 font-mono leading-relaxed">
        Cobrança processada por Paddle.com (Merchant of Record). Recibos, faturas e reembolsos
        são emitidos pela Paddle. Dúvidas? Veja{' '}
        <a href="/legal/refund" className="text-primary hover:underline">Política de Reembolso</a>.
      </p>
    </div>
  );
}
