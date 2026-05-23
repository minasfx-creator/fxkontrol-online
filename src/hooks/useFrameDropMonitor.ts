/**
 * useFrameDropMonitor
 * ───────────────────────────────────────────────────────────────────
 * Mede o FPS médio do navegador via requestAnimationFrame em uma janela
 * deslizante e indica sobrecarga sustentada (frame drops).
 *
 * Uso típico — Safety Mode do DMX broadcast:
 *   const { avgFps, isOverloaded } = useFrameDropMonitor({
 *     overloadFpsThreshold: 45,    // < 45fps é considerado degradado
 *     overloadSustainMs: 2500,     // precisa permanecer degradado por ≥2.5s
 *     recoverFpsThreshold: 55,     // sai do estado de overload acima disso
 *     recoverSustainMs: 4000,
 *   });
 *
 * Características:
 * - Zero-GC no hot path (ring buffer pré-alocado).
 * - rAF pausa em background tabs → não dispara falsos overloads.
 * - Throttle de re-render (~5 Hz) para não causar render storm.
 */
import { useEffect, useRef, useState } from 'react';

export interface FrameDropMonitorOptions {
  /** FPS abaixo do qual o sistema é considerado degradado. Default 45. */
  overloadFpsThreshold?: number;
  /** Tempo (ms) que o FPS precisa ficar abaixo do threshold para acionar overload. Default 2500. */
  overloadSustainMs?: number;
  /** FPS acima do qual o sistema é considerado recuperado. Default 55. */
  recoverFpsThreshold?: number;
  /** Tempo (ms) que o FPS precisa ficar acima do threshold para sair do overload. Default 4000. */
  recoverSustainMs?: number;
  /** Frequência máxima de re-render do hook em Hz. Default 5. */
  reportHz?: number;
  /** Tamanho da janela de amostras (frames). Default 60 (~1s a 60fps). */
  windowSize?: number;
  /** Desabilita o monitor (útil para testes / SSR). */
  enabled?: boolean;
}

export interface FrameDropMonitorState {
  /** FPS médio na janela atual. */
  avgFps: number;
  /** true quando o navegador está sustentadamente degradado. */
  isOverloaded: boolean;
}

export function useFrameDropMonitor(options: FrameDropMonitorOptions = {}): FrameDropMonitorState {
  const {
    overloadFpsThreshold = 45,
    overloadSustainMs = 2500,
    recoverFpsThreshold = 55,
    recoverSustainMs = 4000,
    reportHz = 5,
    windowSize = 60,
    enabled = true,
  } = options;

  const [state, setState] = useState<FrameDropMonitorState>({ avgFps: 60, isOverloaded: false });

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      return;
    }

    // Ring buffer de deltas (ms) entre frames — pré-alocado, zero-GC.
    const deltas = new Float32Array(windowSize);
    let writeIdx = 0;
    let filled = 0;
    let prevTs = -1;
    let overloadSince = -1;
    let recoverSince = -1;
    let lastReportTs = 0;
    let rafId = 0;
    let cancelled = false;

    const reportIntervalMs = 1000 / Math.max(1, reportHz);

    const tick = (ts: number) => {
      if (cancelled) return;
      if (prevTs >= 0) {
        const delta = ts - prevTs;
        // Ignora deltas anômalos (tab voltou do background, ≥250ms entre frames).
        if (delta > 0 && delta < 250) {
          deltas[writeIdx] = delta;
          writeIdx = (writeIdx + 1) % windowSize;
          if (filled < windowSize) filled++;
        } else {
          // Reset janela se houve gap (background tab, etc.) para não envenenar a média.
          filled = 0;
          writeIdx = 0;
          overloadSince = -1;
          recoverSince = -1;
        }
      }
      prevTs = ts;

      if (filled >= 10) {
        // Média dos deltas válidos
        let sum = 0;
        for (let i = 0; i < filled; i++) sum += deltas[i];
        const avgDelta = sum / filled;
        const avgFps = avgDelta > 0 ? 1000 / avgDelta : 0;

        const prev = stateRef.current;

        // Máquina de estados com hysteresis
        let nextOverloaded = prev.isOverloaded;
        if (!prev.isOverloaded) {
          if (avgFps < overloadFpsThreshold) {
            if (overloadSince < 0) overloadSince = ts;
            if (ts - overloadSince >= overloadSustainMs) {
              nextOverloaded = true;
              overloadSince = -1;
            }
          } else {
            overloadSince = -1;
          }
        } else {
          if (avgFps > recoverFpsThreshold) {
            if (recoverSince < 0) recoverSince = ts;
            if (ts - recoverSince >= recoverSustainMs) {
              nextOverloaded = false;
              recoverSince = -1;
            }
          } else {
            recoverSince = -1;
          }
        }

        // Throttle re-render para reportHz (≤5/s por padrão)
        if (
          ts - lastReportTs >= reportIntervalMs &&
          (Math.abs(avgFps - prev.avgFps) > 1 || nextOverloaded !== prev.isOverloaded)
        ) {
          lastReportTs = ts;
          setState({ avgFps, isOverloaded: nextOverloaded });
        } else if (nextOverloaded !== prev.isOverloaded) {
          // Mudança de estado é sempre reportada imediatamente (segurança).
          lastReportTs = ts;
          setState({ avgFps, isOverloaded: nextOverloaded });
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [enabled, overloadFpsThreshold, overloadSustainMs, recoverFpsThreshold, recoverSustainMs, reportHz, windowSize]);

  return state;
}
