import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import minasfxLogo from '@/assets/minasfx-logo.png';

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
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <img src={minasfxLogo} alt="MinasFX Special FX Solutions" className="h-10 mx-auto mb-4 object-contain brightness-0 invert" />
          <h1 className="text-xl font-semibold text-foreground">FX KONTROL</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
            className="bg-surface-2 border-border"
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-surface-2 border-border"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Cadastre-se' : 'Faça login'}
          </button>
        </p>

        <p className="text-center text-[9px] text-muted-foreground/40 font-mono">
          Powered by MinasFX Special FX Solutions
        </p>
      </div>
    </div>
  );
}
