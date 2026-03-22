import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ambientSound } from '@/lib/ambientSound';
import minasfxLogo from '@/assets/minasfx-logo-white.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootPhase, setBootPhase] = useState<'booting' | 'ready'>('booting');

  // Boot sequence
  useEffect(() => {
    const t = setTimeout(() => setBootPhase('ready'), 1200);
    return () => clearTimeout(t);
  }, []);

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
      {/* Holographic scanline overlay */}
      <div className="absolute inset-0 animate-holographic-scan pointer-events-none z-[2]" />
      
      {/* Warm amber grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(hsl(32 100% 50% / 0.03) 1px, transparent 1px), linear-gradient(90deg, hsl(32 100% 50% / 0.03) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
      
      {/* Amber orbs */}
      <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-auth-orb-1"
        style={{ background: 'hsl(32 100% 50% / 0.08)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] animate-auth-orb-2"
        style={{ background: 'hsl(38 100% 58% / 0.06)' }} />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full blur-[80px]"
        style={{ background: 'hsl(25 80% 40% / 0.05)' }} />

      {/* Boot text */}
      {bootPhase === 'booting' && (
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 z-20">
          <p className="text-[11px] font-mono-code tracking-[0.2em] uppercase animate-terminal-type" style={{ color: 'hsl(32 100% 50% / 0.7)' }}>
            NEXUS TERMINAL v2.0 // INITIALIZING...
          </p>
        </div>
      )}

      {/* Glass card */}
      <div className={`relative z-10 w-full max-w-sm px-4 transition-all duration-700 ${bootPhase === 'booting' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <div className="rounded-2xl p-6 space-y-6 relative overflow-hidden animate-holo-materialize" style={{
          background: 'hsl(220 18% 6% / 0.85)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          border: '1px solid hsl(32 100% 50% / 0.12)',
          boxShadow: '0 0 40px hsl(32 100% 50% / 0.08), 0 8px 32px hsl(220 22% 3% / 0.6), inset 0 1px 0 hsl(32 100% 60% / 0.05)',
          animationDelay: '0.3s',
        }}>
          {/* Scanline inside card */}
          <div className="absolute inset-0 animate-holographic-scan pointer-events-none opacity-50" />
          
          <div className="text-center relative z-10">
            <img src={minasfxLogo} alt="MinasFX Special FX Solutions" className="h-10 mx-auto mb-4 object-contain animate-fxk-stagger" style={{ filter: 'drop-shadow(0 0 12px hsl(32 100% 50% / 0.4))', animationDelay: '0.4s' }} />
            <h1 className="text-xl font-bold text-foreground font-display tracking-tight">FX KONTROL</h1>
            <p className="text-[10px] mt-1 font-mono-code tracking-[0.15em] uppercase" style={{ color: 'hsl(32 100% 50% / 0.6)' }}>
              NEXUS AUTHENTICATION TERMINAL
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              {isLogin ? 'Entre para acessar seus projetos' : 'Crie sua conta'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
            <div className="animate-fxk-stagger" style={{ animationDelay: '0.5s' }}>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[hsl(var(--surface-0)/0.6)] border-[hsl(32_100%_50%/0.15)] rounded-xl h-11 text-sm focus:border-[hsl(32_100%_50%/0.4)] focus:ring-1 focus:ring-[hsl(32_100%_50%/0.2)]"
              />
            </div>
            <div className="animate-fxk-stagger" style={{ animationDelay: '0.55s' }}>
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-[hsl(var(--surface-0)/0.6)] border-[hsl(32_100%_50%/0.15)] rounded-xl h-11 text-sm focus:border-[hsl(32_100%_50%/0.4)] focus:ring-1 focus:ring-[hsl(32_100%_50%/0.2)]"
              />
            </div>
            <div className="animate-fxk-stagger" style={{ animationDelay: '0.6s' }}>
              <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm" style={{
                background: 'linear-gradient(135deg, hsl(32 100% 50%), hsl(38 100% 55%))',
                color: 'hsl(220 20% 3%)',
              }} disabled={loading}>
                {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
              </Button>
            </div>
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

        <p className="text-center text-[9px] text-muted-foreground/30 font-mono-code mt-4">
          Powered by MinasFX Special FX Solutions
        </p>
      </div>
    </div>
  );
}
