/**
 * SkyCanvas 2.0 — Error boundary.
 *
 * Encapsula o `<Canvas>` para que qualquer throw em layers (R3F,
 * shader compile, GPU OOM) NUNCA derrube o editor. Mostra um card
 * Vantablack/cyan com "Reiniciar viewport" que remonta a árvore via
 * key bump. Loga via console.warn (e via prop `onError` opcional para
 * que o consumidor possa escalar p/ logger.warn ou para alternar a
 * feature-flag de fallback).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Called once with the captured error so callers can log/disable v2. */
  onError?: (err: Error, info: ErrorInfo) => void;
  /** Replace the default fallback UI. */
  fallback?: (reset: () => void, err: Error) => ReactNode;
}

interface State {
  err: Error | null;
  /** Bumped on reset to force-remount children. */
  resetKey: number;
}

export class SkyCanvas2ErrorBoundary extends Component<Props, State> {
  state: State = { err: null, resetKey: 0 };

  static getDerivedStateFromError(err: Error): Partial<State> {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.warn('[SkyCanvas2] viewport crashed →', err.message, info.componentStack);
    this.props.onError?.(err, info);
  }

  private _reset = () => {
    this.setState((s) => ({ err: null, resetKey: s.resetKey + 1 }));
  };

  render(): ReactNode {
    const { err, resetKey } = this.state;
    if (err) {
      if (this.props.fallback) return this.props.fallback(this._reset, err);
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#050810',
            color: '#7dd3fc',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              border: '1px solid rgba(45,212,255,0.3)',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.55)',
              maxWidth: 360,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              SKYCANVAS · VIEWPORT FAULT
            </div>
            <div style={{ fontSize: 14, marginBottom: 12, color: '#fca5a5' }}>
              {err.message || 'unknown render error'}
            </div>
            <button
              type="button"
              onClick={this._reset}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                color: '#050810',
                background: '#2dd4ff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              REINICIAR VIEWPORT
            </button>
          </div>
        </div>
      );
    }
    // Children remount on reset by changing key.
    return <div key={resetKey} style={{ position: 'absolute', inset: 0 }}>{this.props.children}</div>;
  }
}

export default SkyCanvas2ErrorBoundary;
