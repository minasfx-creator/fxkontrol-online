import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearLazyRetryFlag } from '@/lib/lazyRetry';

interface Props {
  children: ReactNode;
  /** Friendly label shown in the error banner (e.g. "3D viewport"). */
  area?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

const IS_DEV = import.meta.env.DEV;

/**
 * StudioErrorBoundary — narrow boundary used around lazy-loaded Studio
 * sub-trees (SkyCanvas, panel content, etc.) so a single failed dynamic
 * import doesn't leave the user stuck on an infinite spinner. Shows a
 * compact recovery card with a Reload action and surfaces error.message
 * in dev mode for debugging.
 */
export class StudioErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[StudioErrorBoundary${this.props.area ? ` · ${this.props.area}` : ''}] crashed`, error, info);
  }

  private handleReload = () => {
    clearLazyRetryFlag();
    try {
      sessionStorage.removeItem(`lazyChunkAutoReload:${window.location.pathname}`);
    } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message ?? 'Unknown error';
    return (
      <div className="w-full h-full flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full text-center space-y-3 border border-border/60 bg-card/80 backdrop-blur-sm rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Studio failed to load a module.
          </h2>
          <p className="text-xs text-muted-foreground">
            A piece of the {this.props.area ?? 'Studio'} could not load. Reload Studio to try again — your project state is preserved on disk.
          </p>
          {IS_DEV && (
            <pre className="text-[10px] font-mono text-destructive/80 bg-background/60 border border-border/40 rounded-md p-2 text-left whitespace-pre-wrap break-words max-h-32 overflow-auto">
              {message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider border border-primary/60 bg-primary/15 text-primary hover:bg-primary/25 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60"
          >
            Reload Studio
          </button>
        </div>
      </div>
    );
  }
}

export default StudioErrorBoundary;
