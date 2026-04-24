import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { clearLazyRetryFlag } from '@/lib/lazyRetry';

interface Props {
  children: ReactNode;
  onError?: (err: Error) => void;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SwarmGPT panel crashed', error, info);
    this.props.onError?.(error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  private handleReload = () => {
    clearLazyRetryFlag();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message ?? 'Erro desconhecido ao renderizar o painel.';
    const truncated = message.length > 280 ? `${message.slice(0, 280)}…` : message;

    return (
      <div className="h-full w-full flex items-center justify-center p-5">
        <div className="w-full max-w-sm space-y-3 text-center">
          <h2 className="text-sm font-bold tracking-wide text-foreground">
            Painel SwarmGPT indisponível
          </h2>
          <p className="text-xs text-muted-foreground">
            Algo falhou ao renderizar o gerador. O restante do Commander continua ativo.
            Tente novamente ou recarregue a aplicação.
          </p>
          <pre className="text-[10px] font-mono text-muted-foreground bg-background/40 border border-border/40 rounded-md p-2 text-left whitespace-pre-wrap break-words max-h-32 overflow-auto">
            {truncated}
          </pre>
          <div className="flex gap-2 justify-center pt-1">
            <Button variant="secondary" size="sm" onClick={this.handleRetry}>
              Tentar novamente
            </Button>
            <Button variant="default" size="sm" onClick={this.handleReload}>
              Recarregar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default PanelErrorBoundary;
