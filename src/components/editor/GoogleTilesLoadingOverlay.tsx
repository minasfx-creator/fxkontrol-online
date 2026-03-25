/**
 * GoogleTilesLoadingOverlay — shows loading state + debug telemetry
 * while Google Earth 3D Tiles load.
 */
import { useState, useEffect, useSyncExternalStore } from 'react';
import { Globe, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getTilesLoadingState,
  getTilesLoadedCount,
  getTilesDebugInfo,
  subscribeTilesLoading,
  type TilesLoadingState,
  type TilesDebugInfo,
} from '@/core/geo/GoogleTilesEngine';
import { useSceneStore } from '@/store/useSceneStore';

function useTilesDebug() {
  const debug = useSyncExternalStore(subscribeTilesLoading, getTilesDebugInfo);
  return debug;
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
  const debug = useTilesDebug();
  const { state, count } = debug;
  const [dismissed, setDismissed] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (state === 'ready' && !showDebug) {
      const t = setTimeout(() => setDismissed(true), 2000);
      return () => clearTimeout(t);
    }
    if (state !== 'ready') setDismissed(false);
  }, [state, showDebug]);

  if (!enabled || dismissed || state === 'idle') return null;

  const isError = state === 'error';
  const isReady = state === 'ready';

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div
        className={`
          flex flex-col rounded-xl border backdrop-blur-xl
          transition-all duration-500 pointer-events-auto
          ${isReady && !showDebug ? 'opacity-60 scale-95' : 'opacity-100 scale-100'}
        `}
        style={{
          background: isError
            ? 'hsla(0, 60%, 15%, 0.9)'
            : 'hsla(240, 10%, 6%, 0.9)',
          borderColor: isError
            ? 'hsla(0, 70%, 45%, 0.3)'
            : isReady
              ? 'hsla(142, 70%, 45%, 0.3)'
              : 'hsla(210, 70%, 50%, 0.2)',
          minWidth: '260px',
        }}
      >
        {/* Main status row */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          {isError ? (
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'hsl(0, 70%, 60%)' }} />
          ) : isReady ? (
            <Globe className="w-4 h-4 shrink-0" style={{ color: 'hsl(142, 70%, 55%)' }} />
          ) : (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'hsl(210, 80%, 60%)' }} />
          )}

          <span className="text-[11px] font-semibold text-foreground/90 whitespace-nowrap flex-1">
            {LABELS[state]}
          </span>

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

          {/* Debug toggle */}
          <button
            onClick={() => setShowDebug(v => !v)}
            className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
            title="Debug info"
          >
            {showDebug ? (
              <ChevronUp className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Progress bar */}
        {(state === 'fetching-key' || state === 'loading-tiles') && (
          <div className="px-4 pb-2">
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'hsla(0,0%,100%,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: state === 'fetching-key' ? '30%' : `${Math.min(100, count * 10)}%`,
                  background: 'hsl(210, 80%, 55%)',
                  animation: state === 'fetching-key' ? 'pulse 1.5s ease-in-out infinite' : undefined,
                }}
              />
            </div>
          </div>
        )}

        {/* Debug panel */}
        {showDebug && (
          <div
            className="border-t px-3 py-2"
            style={{
              borderColor: 'hsla(220, 20%, 25%, 0.4)',
              fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
              fontSize: '9px',
              lineHeight: '1.8',
              color: 'hsla(0, 0%, 75%, 0.9)',
            }}
          >
            <div style={{ fontSize: '7px', fontWeight: 700, letterSpacing: '0.12em', color: 'hsla(210, 80%, 65%, 0.7)', marginBottom: '2px' }}>
              TILES RENDERER DEBUG
            </div>
            <DebugRow label="State" value={state} color={isError ? 'hsl(0, 70%, 60%)' : isReady ? 'hsl(142, 70%, 55%)' : 'hsl(210, 80%, 65%)'} />
            <DebugRow label="Visible Tiles" value={String(count)} />
            <DebugRow label="SSE Target" value={debug.sse ? String(debug.sse) : '—'} />
            <DebugRow label="Renderer" value={debug.rendererActive ? 'Active' : 'Inactive'} color={debug.rendererActive ? 'hsl(142, 70%, 55%)' : 'hsl(0, 70%, 60%)'} />
            <DebugRow label="Group Visible" value={debug.groupVisible ? 'Yes' : 'No'} color={debug.groupVisible ? 'hsl(142, 70%, 55%)' : 'hsl(45, 90%, 55%)'} />
            <div style={{ height: '1px', background: 'hsla(220, 20%, 25%, 0.3)', margin: '3px 0' }} />
            <DebugRow label="Anchor Lat" value={debug.anchorLat.toFixed(6)} />
            <DebugRow label="Anchor Lon" value={debug.anchorLon.toFixed(6)} />
            <DebugRow label="Anchor Alt" value={`${debug.anchorAlt.toFixed(1)}m`} />
            {debug.errorMsg && (
              <>
                <div style={{ height: '1px', background: 'hsla(0, 60%, 40%, 0.3)', margin: '3px 0' }} />
                <div style={{ color: 'hsl(0, 70%, 60%)', wordBreak: 'break-all' }}>
                  ⚠ {debug.errorMsg}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DebugRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
      <span style={{ color: 'hsla(0, 0%, 55%, 0.8)' }}>{label}</span>
      <span style={{ color: color || 'hsla(0, 0%, 90%, 0.9)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
