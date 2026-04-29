import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Top-level error boundary. Catches render-time errors anywhere in the app
 * (LazyChunkBoundary handles chunk-load failures specifically).
 * Surfaces a recovery UI without leaking stack traces to the user.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
     
    console.error("[AppErrorBoundary] uncaught render error", error, info);
  }

  private reload = () => window.location.reload();
  private home = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md border border-border bg-card p-6 rounded-lg space-y-4 text-center">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado na aplicação. Suas alterações locais foram preservadas.
          </p>
          {this.state.message && (
            <pre className="text-[10px] font-mono text-muted-foreground/70 bg-muted/30 rounded p-2 text-left overflow-auto max-h-24">
              {this.state.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={this.home}>
              Ir para início
            </Button>
            <Button onClick={this.reload}>Recarregar</Button>
          </div>
        </div>
      </div>
    );
  }
}
