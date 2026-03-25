/**
 * GoogleTilesLoadingOverlay — shows loading state while Google Earth 3D Tiles load.
 * Industrial glassmorphism aesthetic matching FX KONTROL design system.
 */
import { useState, useEffect, useSyncExternalStore } from 'react';
import { Globe, AlertTriangle, Loader2 } from 'lucide-react';
import {
  getTilesLoadingState,
  getTilesLoadedCount,
  subscribeTilesLoading,
  type TilesLoadingState,
} from '@/core/geo/GoogleTilesEngine';
import { useSceneStore } from '@/store/useSceneStore';

function useTilesLoading() {
  const state = useSyncExternalStore(
    subscribeTilesLoading,
    getTilesLoadingState,
  );
  const count = useSyncExternalStore(
    subscribeTilesLoading,
    getTilesLoadedCount,
  );
  return { state, count };
}

const LABELS: Record<TilesLoadingState, string> = {
  idle: 'Inicializando...',
  'fetching-key': 'Obtendo credenciais...',
  'loading-tiles': 'Carregando terreno 3D...',
  ready: 'Terreno carregado',
  error: 'Falha ao carregar terreno',
};

export default function GoogleTilesLoadingOverlay() {
  const enabled = useSceneStore(st => st.settings.google3DTilesEnabled);
  const { state, count } = useTilesLoading();
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss 2s after ready
  useEffect(() => {
    if (state === 'ready') {
      const t = setTimeout(() => setDismissed(true), 2000);
      return () => clearTimeout(t);
    }
    setDismissed(false);
  }, [state]);

  if (!enabled || dismissed || state === 'idle') return null;

  const isError = state === 'error';
  const isReady = state === 'ready';

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div
        className={`
          flex items-center gap-3 px-4 py-2.5 rounded-xl border backdrop-blur-xl
          transition-all duration-500 pointer-events-auto
          ${isReady ? 'opacity-60 scale-95' : 'opacity-100 scale-100'}
        `}
        style={{
          background: isError
            ? 'hsla(0, 60%, 15%, 0.85)'
            : 'hsla(240, 10%, 6%, 0.85)',
          borderColor: isError
            ? 'hsla(0, 70%, 45%, 0.3)'
            : isReady
              ? 'hsla(142, 70%, 45%, 0.3)'
              : 'hsla(210, 70%, 50%, 0.2)',
        }}
      >
        {/* Icon */}
        {isError ? (
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        ) : isReady ? (
          <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <Loader2 className="w-4 h-4 text-sky-400 shrink-0 animate-spin" />
        )}

        {/* Label */}
        <span className="text-[11px] font-semibold text-foreground/90 whitespace-nowrap">
          {LABELS[state]}
        </span>

        {/* Tile count badge */}
        {state === 'loading-tiles' && count > 0 && (
          <span
            className="text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded-md"
            style={{
              background: 'hsla(210, 70%, 50%, 0.15)',
              color: 'hsl(210, 80%, 70%)',
            }}
          >
            {count} tiles
          </span>
        )}

        {/* Progress bar for loading state */}
        {(state === 'fetching-key' || state === 'loading-tiles') && (
          <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'hsla(0,0%,100%,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: state === 'fetching-key' ? '30%' : `${Math.min(100, count * 10)}%`,
                background: 'hsl(210, 80%, 55%)',
                animation: state === 'fetching-key' ? 'pulse 1.5s ease-in-out infinite' : undefined,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
