import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Tactical grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(hsl(32 100% 50% / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(32 100% 50% / 0.5) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div className="text-center relative z-10 space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded border-2 flex items-center justify-center"
            style={{ borderColor: 'hsl(32 100% 50% / 0.3)', background: 'hsl(32 100% 50% / 0.05)' }}>
            <AlertTriangle className="h-8 w-8" style={{ color: 'hsl(32 100% 50% / 0.6)' }} />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold font-display text-foreground tracking-wider">404</h1>
          <p className="text-xs font-mono text-muted-foreground tracking-[0.2em] uppercase mt-1">
            ROTA NÃO ENCONTRADA
          </p>
        </div>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          O módulo <code className="text-primary font-mono text-xs">{location.pathname}</code> não existe no sistema.
        </p>
        <Button asChild variant="outline" className="border-primary/20 text-primary hover:bg-primary/10">
          <a href="/">← Voltar ao Dashboard</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
