import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ambientSound } from '@/lib/ambientSound';
import minasfxLogo from '@/assets/minasfx-logo-tactical.webp';
import fxkLogo from '@/assets/fxk-logo-tactical.webp';

const BOOT_LINES = [
  'NEXUS AUTH v4.2 · SECURE CHANNEL',
  'ENCRYPTION ............. AES-256',
  'BIOMETRIC LOCK ......... STANDBY',
  'STATUS ................. READY',
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootPhase, setBootPhase] = useState<'blackout' | 'boot' | 'ready'>('blackout');
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setBootPhase('boot'), 200);
    const t2 = setTimeout(() => setBootPhase('ready'), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (bootPhase !== 'boot') return;
    const timers = BOOT_LINES.map((_, i) =>
      setTimeout(() => setVisibleLines(i + 1), 150 + i * 200)
    );
    return () => timers.forEach(clearTimeout);
  }, [bootPhase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        ambientSound.play('boot');
        toast.success('Login efetuado!');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        ambientSound.play('boot');
        toast.success('Verifique seu email para confirmar o cadastro.');
      }
    } catch (err: any) {
      ambientSound.play('error');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      ambientSound.play('boot');
      toast.success('Login efetuado!');
    } catch (err: any) {
      ambientSound.play('error');
      toast.error(err?.message ?? 'Falha no login com Google');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('apple', {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      ambientSound.play('boot');
      toast.success('Login efetuado!');
    } catch (err: any) {
      ambientSound.play('error');
      toast.error(err?.message ?? 'Falha no login com Apple');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background relative overflow-hidden br2049-rain">
      {/* Scanline sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
        <div className="absolute w-full h-[2px] animate-scanline-sweep" style={{
          background: 'linear-gradient(90deg, transparent 0%, hsl(32 100% 50% / 0.3) 50%, transparent 100%)',
        }} />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(hsl(32 100% 50% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(32 100% 50% / 0.5) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        willChange: 'auto',
      }} />

      {/* Amber orbs */}
      <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-auth-orb-1"
        style={{ background: 'hsl(32 100% 50% / 0.07)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] animate-auth-orb-2"
        style={{ background: 'hsl(38 100% 58% / 0.05)' }} />

      {/* Boot terminal overlay */}
      {bootPhase === 'boot' && (
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 z-20 w-72">
          <div className="space-y-1">
            {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
              <p key={i} className="font-mono text-[8px] tracking-wider" style={{
                color: line.includes('READY') ? 'hsl(120 70% 45% / 0.7)' : 'hsl(32 100% 50% / 0.4)',
              }}>
                {'> '}{line}
              </p>
            ))}
            <span className="inline-block w-1.5 h-2.5 animate-pulse" style={{ background: 'hsl(32 100% 50% / 0.5)' }} />
          </div>
        </div>
      )}

      {/* Glass card */}
      <div className={`relative z-10 w-full max-w-sm px-4 transition-all duration-1000 ease-out ${
        bootPhase === 'ready' ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-6'
      }`}>
        <div className="rounded-2xl p-6 space-y-5 relative overflow-hidden" style={{
          background: 'hsl(220 18% 6% / 0.88)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          border: '1px solid hsl(32 100% 50% / 0.1)',
          boxShadow: '0 0 40px hsl(32 100% 50% / 0.06), 0 8px 32px hsl(220 22% 3% / 0.6), inset 0 1px 0 hsl(32 100% 60% / 0.04)',
        }}>
          {/* Inner scanline */}
          <div className="absolute inset-0 animate-holographic-scan pointer-events-none opacity-30" />

          <div className="text-center relative z-10">
            {/* FXK Logo */}
            <div className="flex justify-center mb-3">
              <img
                src={fxkLogo}
                alt="FX Kontrol"
                width={64}
                height={64}
                decoding="async"
                fetchPriority="high"
                className="h-16 w-16 object-contain"
                style={{ filter: 'drop-shadow(0 0 12px hsl(32 100% 50% / 0.3))' }}
              />
            </div>

            <h1 className="text-lg font-bold text-foreground tracking-[0.15em] uppercase">FX KONTROL</h1>
            <p className="text-[9px] mt-0.5 font-mono tracking-[0.15em] uppercase" style={{ color: 'hsl(32 100% 50% / 0.5)' }}>
              NEXUS AUTHENTICATION
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              {isLogin ? 'Entre para acessar seus projetos' : 'Crie sua conta'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[hsl(var(--surface-0)/0.6)] border-[hsl(32_100%_50%/0.12)] rounded-xl h-10 text-sm focus:border-[hsl(32_100%_50%/0.35)] focus:ring-1 focus:ring-[hsl(32_100%_50%/0.15)]"
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-[hsl(var(--surface-0)/0.6)] border-[hsl(32_100%_50%/0.12)] rounded-xl h-10 text-sm focus:border-[hsl(32_100%_50%/0.35)] focus:ring-1 focus:ring-[hsl(32_100%_50%/0.15)]"
            />
            <Button type="submit" className="w-full h-10 rounded-xl font-semibold text-sm" style={{
              background: 'linear-gradient(135deg, hsl(32 100% 50%), hsl(38 100% 55%))',
              color: 'hsl(220 20% 3%)',
            }} disabled={loading}>
              {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
            </Button>
          </form>

          <div className="relative z-10 flex items-center gap-2">
            <div className="flex-1 h-px bg-[hsl(32_100%_50%/0.12)]" />
            <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-[hsl(32_100%_50%/0.12)]" />
          </div>

          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            variant="outline"
            className="relative z-10 w-full h-10 rounded-xl font-medium text-sm bg-[hsl(var(--surface-0)/0.6)] border-[hsl(32_100%_50%/0.15)] hover:bg-[hsl(var(--surface-0)/0.9)] hover:border-[hsl(32_100%_50%/0.3)] gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
            </svg>
            Continuar com Google
          </Button>

          <Button
            type="button"
            onClick={handleAppleSignIn}
            disabled={loading}
            variant="outline"
            className="relative z-10 w-full h-10 rounded-xl font-medium text-sm bg-[hsl(var(--surface-0)/0.6)] border-[hsl(32_100%_50%/0.15)] hover:bg-[hsl(var(--surface-0)/0.9)] hover:border-[hsl(32_100%_50%/0.3)] gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Continuar com Apple
          </Button>

          <p className="text-center text-xs text-muted-foreground relative z-10">
            {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Cadastre-se' : 'Faça login'}
            </button>
          </p>
        </div>

        {/* MinasFX branding */}
        <div className="flex justify-center mt-4">
          <img
            src={minasfxLogo}
            alt="Minas FX"
            width={24}
            height={24}
            loading="lazy"
            decoding="async"
            className="h-6 w-6 object-contain opacity-25"
          />
        </div>
      </div>
    </div>
  );
}
