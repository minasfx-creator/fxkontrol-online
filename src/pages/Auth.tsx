import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ambientSound } from '@/lib/ambientSound';
import minasfxLogo from '@/assets/minasfx-logo-tactical.png';
import fxkLogo from '@/assets/fxk-logo-tactical.png';

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

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background relative overflow-hidden br2049-rain">
      {/* Scanline sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
        <div className="absolute w-full h-[2px] animate-scanline-sweep" style={{
          background: 'linear-gradient(90deg, transparent 0%, hsl(32 100% 50% / 0.3) 50%, transparent 100%)',
        }} />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: 'linear-gradient(hsl(32 100% 50% / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(32 100% 50% / 0.6) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
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
      <div className={`relative z-10 w-full max-w-sm px-4 transition-all duration-[1000ms] ease-out ${
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
            className="h-6 object-contain opacity-25"
          />
        </div>
      </div>
    </div>
  );
}
