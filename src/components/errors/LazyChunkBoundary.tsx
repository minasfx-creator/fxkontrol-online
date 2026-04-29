import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { clearLazyRetryFlag } from '@/lib/lazyRetry';

interface State {
  hasError: boolean;
  errorMessage?: string;
}

const AUTO_RELOAD_KEY = 'lazyChunkAutoReload';

export class LazyChunkBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Lazy chunk load failed', error, errorInfo);

    // Auto-reload ONCE per session per path. Prevents infinite loops while
    // recovering from a stale-chunk after deploy without the user having to
    // click anything (and without losing the current route).
    try {
      const path = window.location.pathname;
      const key = `${AUTO_RELOAD_KEY}:${path}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, String(Date.now()));
        clearLazyRetryFlag();
        // Defer to the next tick so React finishes the error commit cleanly.
        setTimeout(() => window.location.reload(), 50);
      }
    } catch {
      /* sessionStorage may be unavailable (privacy mode) — ignore */
    }
  }

  private handleReload = () => {
    clearLazyRetryFlag();
    try {
      const path = window.location.pathname;
      sessionStorage.removeItem(`${AUTO_RELOAD_KEY}:${path}`);
    } catch { /* noop */ }
    window.location.reload();
  };

  private handleGoStudio = () => {
    clearLazyRetryFlag();
    try {
      sessionStorage.removeItem(`${AUTO_RELOAD_KEY}:/studio`);
    } catch { /* noop */ }
    // Hard navigation guarantees a clean module graph.
    window.location.href = '/studio';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const path = typeof window !== 'undefined' ? window.location.pathname : '';

    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md border border-border bg-card p-6 text-center space-y-4 rounded-lg">
          <h1 className="text-lg font-semibold text-foreground">Falha ao carregar a interface</h1>
          <p className="text-sm text-muted-foreground">
            Detectamos uma atualização incompleta de módulos. Recarregue para sincronizar
            os chunks atuais — a rota atual será preservada.
          </p>
          {path && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
              ROTA: {path}
            </p>
          )}
          {this.state.errorMessage && (
            <p className="text-[10px] font-mono text-destructive/80 break-all">
              {this.state.errorMessage}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={this.handleReload} className="w-full">
              Recarregar aplicativo
            </Button>
            <Button onClick={this.handleGoStudio} variant="outline" className="w-full">
              Voltar ao Studio
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
