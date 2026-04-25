import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
const PADDLE_ENV: 'sandbox' | 'live' = clientToken?.startsWith('test_') ? 'sandbox' : 'live';

const REDIRECT_DELAY_MS = 2500;
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 20000;

type Phase = 'verifying' | 'confirmed' | 'timeout';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>('verifying');
  const [tier, setTier] = useState<string | null>(null);

  // Poll subscriptions until the webhook lands a row, then redirect.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      // `subscriptions` is not yet in generated Supabase types — cast to any
      // for the table lookup; row shape is validated below.
      const { data } = await (supabase as any)
        .from('subscriptions')
        .select('product_id, status, current_period_end')
        .eq('user_id', user.id)
        .eq('environment', PADDLE_ENV)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      const row = data as { product_id: string; status: string; current_period_end: string | null } | null;
      const isLive =
        !!row &&
        (['active', 'trialing', 'past_due'].includes(row.status));

      if (isLive && row) {
        setTier(row.product_id);
        setPhase('confirmed');
        return;
      }

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPhase('timeout');
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  // Auto-redirect once confirmed.
  useEffect(() => {
    if (phase !== 'confirmed') return;
    const t = setTimeout(() => navigate('/', { replace: true }), REDIRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, navigate]);

  return (
    <main className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-6">
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center space-y-5"
        style={{ background: 'hsl(var(--surface-0))', borderColor: 'hsl(32 100% 50% / 0.15)' }}
      >
        {phase === 'verifying' && (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <h1 className="text-xl font-bold tracking-wide text-foreground">
              CONFIRMANDO PAGAMENTO
            </h1>
            <p className="text-sm text-muted-foreground">
              Aguardando ativação da assinatura. Isso pode levar alguns segundos…
            </p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              {PADDLE_ENV === 'sandbox' ? 'Ambiente: TEST' : 'Ambiente: LIVE'}
            </p>
          </>
        )}

        {phase === 'confirmed' && (
          <>
            <CheckCircle2 className="h-14 w-14 mx-auto" style={{ color: 'hsl(142 76% 45%)' }} />
            <h1 className="text-xl font-bold tracking-wide text-foreground">
              PAGAMENTO CONFIRMADO
            </h1>
            <p className="text-sm text-muted-foreground">
              {tier ? <>Plano <span className="font-mono text-foreground">{tier}</span> ativo.</> : 'Assinatura ativa.'}
            </p>
            <p className="text-xs text-muted-foreground/80">
              Redirecionando para o dashboard…
            </p>
            <Button
              size="sm"
              onClick={() => navigate('/', { replace: true })}
              className="gap-2"
              style={{ background: 'hsl(32 100% 50%)', color: 'hsl(220 30% 6%)' }}
            >
              Ir agora
            </Button>
          </>
        )}

        {phase === 'timeout' && (
          <>
            <AlertCircle className="h-12 w-12 mx-auto" style={{ color: 'hsl(38 92% 50%)' }} />
            <h1 className="text-xl font-bold tracking-wide text-foreground">
              AGUARDANDO CONFIRMAÇÃO
            </h1>
            <p className="text-sm text-muted-foreground">
              O pagamento foi recebido, mas a confirmação ainda não chegou. Isso geralmente
              se resolve em poucos minutos. Você pode continuar para o dashboard — sua
              assinatura aparecerá automaticamente assim que for processada.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                Ver Billing
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/', { replace: true })}
                style={{ background: 'hsl(32 100% 50%)', color: 'hsl(220 30% 6%)' }}
              >
                Ir ao Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
