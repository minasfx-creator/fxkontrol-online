import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { clearLazyRetryFlag } from '@/lib/lazyRetry';

interface State {
  hasError: boolean;
}

export class LazyChunkBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Lazy chunk load failed', error, errorInfo);
  }

  private handleReload = () => {
    clearLazyRetryFlag();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md border border-border bg-card p-6 text-center space-y-3 rounded-lg">
          <h1 className="text-lg font-semibold text-foreground">Falha ao carregar a interface</h1>
          <p className="text-sm text-muted-foreground">
            Detectamos uma atualização incompleta de módulos. Recarregue para sincronizar os chunks atuais.
          </p>
          <Button onClick={this.handleReload} className="w-full">
            Recarregar aplicativo
          </Button>
        </div>
      </div>
    );
  }
}