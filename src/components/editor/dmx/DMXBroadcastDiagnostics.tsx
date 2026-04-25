/**
 * DMXBroadcastDiagnostics
 * ───────────────────────────────────────────────────────────────────
 * Painel de diagnóstico em tempo real para o broadcast USB DMX.
 * Mostra: FPS alvo vs real, latência (last/avg/max), erros de escrita
 * acumulados, e sparkline da latência (últimos ~24s).
 *
 * Render é throttled pelo parent (~5 Hz). Sparkline desenha em <canvas>
 * com requestAnimationFrame e não causa re-render React.
 *
 * Use design tokens semânticos (bg-surface-*, text-foreground, etc.).
 */
import { useEffect, useRef } from 'react';

interface DMXBroadcastDiagnosticsProps {
  streaming: boolean;
  fpsTarget: 10 | 20 | 40;
  fpsActual: number;
  frames: number;
  lastLatencyMs: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  writeErrors: number;
  lastErrorMsg: string;
  lastErrorTs: number;            // performance.now()
  /** Ring buffer de latência. Atualizado pelo hook do parent. */
  latencyHistory: Float32Array;
  latencyHistoryIdx: number;
  latencyHistoryFilled: number;
  /** Threshold E-STOP em ms (visualizado como linha vermelha). */
  estopMs?: number;
}

const Sparkline = ({
  history, idx, filled, estopMs = 50,
}: {
  history: Float32Array;
  idx: number;
  filled: number;
  estopMs?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // refs vivas — evitam recriar rAF a cada render
  const dataRef = useRef({ history, idx, filled });
  dataRef.current = { history, idx, filled };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let cancelled = false;

    const draw = () => {
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { history: hist, idx: i, filled: f } = dataRef.current;
      const len = hist.length;
      // Escala: 0–80ms (cobre confortavelmente o E-STOP @ 50ms)
      const maxY = 80;

      // Grid sutil
      ctx.strokeStyle = 'hsl(220 12% 18%)';
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g++) {
        const y = (h * g) / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Linha E-STOP (50ms)
      const estopY = h - (estopMs / maxY) * h;
      ctx.strokeStyle = 'hsl(0 75% 55% / 0.5)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, estopY);
      ctx.lineTo(w, estopY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (f === 0) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // Desenha do mais antigo para o mais recente
      ctx.strokeStyle = 'hsl(180 70% 55%)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const startIdx = f < len ? 0 : i;
      for (let k = 0; k < f; k++) {
        const sample = hist[(startIdx + k) % len];
        const x = (k / Math.max(1, f - 1)) * w;
        const y = h - Math.min(1, sample / maxY) * h;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [estopMs]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-12 w-full rounded-sm bg-surface-1"
      aria-label="Histórico de latência DMX (últimos 24s)"
    />
  );
};

export default function DMXBroadcastDiagnostics({
  streaming, fpsTarget, fpsActual, frames,
  lastLatencyMs, avgLatencyMs, maxLatencyMs,
  writeErrors, lastErrorMsg, lastErrorTs,
  latencyHistory, latencyHistoryIdx, latencyHistoryFilled,
  estopMs = 50,
}: DMXBroadcastDiagnosticsProps) {
  // Health do FPS: ≥95% do alvo = OK, ≥80% warn, <80% crit
  const fpsRatio = fpsTarget > 0 ? fpsActual / fpsTarget : 0;
  const fpsHealth: 'ok' | 'warn' | 'crit' = !streaming
    ? 'ok'
    : fpsRatio >= 0.95 ? 'ok' : fpsRatio >= 0.8 ? 'warn' : 'crit';
  const fpsColor =
    fpsHealth === 'ok' ? 'text-emerald-400'
    : fpsHealth === 'warn' ? 'text-amber-400'
    : 'text-destructive';

  const latColor =
    avgLatencyMs >= estopMs ? 'text-destructive'
    : avgLatencyMs >= estopMs * 0.5 ? 'text-amber-400'
    : 'text-emerald-400';

  const errColor = writeErrors > 0 ? 'text-destructive' : 'text-muted-foreground';

  // Idade do último erro (em segundos), p/ humanizar
  const errAgeSec = lastErrorTs > 0
    ? Math.max(0, Math.round((performance.now() - lastErrorTs) / 1000))
    : null;

  return (
    <div className="space-y-2 rounded-sm border border-border/30 bg-surface-1/60 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-mono-code uppercase tracking-wider text-muted-foreground">
          BROADCAST DIAGNOSTICS
        </span>
        <span className={`text-[8px] font-mono-code uppercase tracking-wider ${streaming ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
          {streaming ? '● LIVE' : '○ IDLE'}
        </span>
      </div>

      {/* Métricas chave em grid 2×2 */}
      <div className="grid grid-cols-2 gap-1.5">
        <Metric
          label="FPS"
          value={streaming ? `${fpsActual.toFixed(1)}` : '—'}
          sub={`alvo ${fpsTarget}Hz`}
          colorClass={fpsColor}
        />
        <Metric
          label="LATÊNCIA AVG"
          value={streaming ? `${avgLatencyMs}ms` : '—'}
          sub={`max ${maxLatencyMs}ms · last ${lastLatencyMs}ms`}
          colorClass={latColor}
        />
        <Metric
          label="FRAMES"
          value={frames.toLocaleString('pt-BR')}
          sub={streaming ? 'enviados' : 'aguardando'}
          colorClass="text-foreground"
        />
        <Metric
          label="WRITE ERRORS"
          value={writeErrors.toString()}
          sub={errAgeSec !== null ? `há ${errAgeSec}s` : 'sem erros'}
          colorClass={errColor}
        />
      </div>

      {/* Sparkline */}
      <div>
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[7px] font-mono-code uppercase tracking-wider text-muted-foreground/70">
            LATÊNCIA · ÚLT. 24s
          </span>
          <span className="text-[7px] font-mono-code text-muted-foreground/50">
            E-STOP @ {estopMs}ms
          </span>
        </div>
        <Sparkline
          history={latencyHistory}
          idx={latencyHistoryIdx}
          filled={latencyHistoryFilled}
          estopMs={estopMs}
        />
      </div>

      {/* Última mensagem de erro (se houver) */}
      {writeErrors > 0 && lastErrorMsg && (
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-1.5 py-1">
          <p className="text-[8px] font-mono-code text-destructive/90 line-clamp-2">
            ↳ {lastErrorMsg}
          </p>
        </div>
      )}
    </div>
  );
}

const Metric = ({
  label, value, sub, colorClass,
}: { label: string; value: string; sub: string; colorClass: string }) => (
  <div className="rounded-sm bg-surface-2/40 px-1.5 py-1">
    <div className="text-[7px] font-mono-code uppercase tracking-wider text-muted-foreground/70">
      {label}
    </div>
    <div className={`text-[12px] font-mono-code font-bold leading-tight ${colorClass}`}>
      {value}
    </div>
    <div className="text-[7px] font-mono-code text-muted-foreground/60">
      {sub}
    </div>
  </div>
);
