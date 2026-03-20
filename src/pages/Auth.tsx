import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import minasfxLogo from '@/assets/minasfx-logo-white.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Login efetuado!');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Verifique seu email para confirmar o cadastro.');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 auth-bg-grid" />
      <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[hsl(var(--primary)/0.06)] blur-[120px] animate-auth-orb-1" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[hsl(var(--accent)/0.05)] blur-[100px] animate-auth-orb-2" />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-[hsl(var(--fxk-violet)/0.04)] blur-[80px]" />

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="glass-card-glow rounded-2xl p-6 space-y-6">
          <div className="text-center">
            <img src={minasfxLogo} alt="MinasFX Special FX Solutions" className="h-10 mx-auto mb-4 object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.3)]" />
            <h1 className="text-xl font-bold text-foreground font-display tracking-tight">FX KONTROL</h1>
            <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono-code tracking-[0.15em] uppercase">
              Professional Show Control Platform
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              {isLogin ? 'Entre para acessar seus projetos' : 'Crie sua conta'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[hsl(var(--surface-0)/0.6)] border-[hsl(var(--border)/0.3)] rounded-xl h-11 text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-[hsl(var(--surface-0)/0.6)] border-[hsl(var(--border)/0.3)] rounded-xl h-11 text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
            />
            <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm" disabled={loading}>
              {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
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
