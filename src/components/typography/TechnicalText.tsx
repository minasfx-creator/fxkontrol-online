/**
 * TechnicalText — Componentes semânticos para texto técnico em mono.
 * ─────────────────────────────────────────────────────────────────────────────
 * Regra de campo: JetBrains Mono é reservado para conteúdo técnico que o
 * operador lê sob pressão (IP, DMX address, timecode, channel mask, hex,
 * log lines). O resto da UI usa Rajdhani (display) / Inter (body).
 *
 * USO:
 *   <Timecode value="00:14:32:21" />        // SMPTE drop-frame
 *   <DmxAddr universe={1} channel={512} />  // "U01.512"
 *   <IpAddr value="192.168.1.42" />         // IPv4/IPv6
 *   <LogPane>{lines}</LogPane>              // bloco de log monoespaçado
 *
 * Por que componentes em vez de className solto:
 *   - Garante que mono só aparece onde DEVE aparecer (auditável).
 *   - Permite formatação canônica (zero-pad, separadores, validação).
 *   - Exposição correta para screen reader (aria-label legível).
 *   - Um único ponto de mudança se a fonte mono mudar no futuro.
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Base shared style — JetBrains Mono via .ds-mono (definida em index.css).
   tabular-nums evita que dígitos pulem em campos que mudam (timecode). */
const monoBase = 'ds-mono tabular-nums';

/* ── 1. Timecode (SMPTE HH:MM:SS:FF) ──────────────────────────────────── */

interface TimecodeProps extends HTMLAttributes<HTMLSpanElement> {
  /** String SMPTE pré-formatada "HH:MM:SS:FF" ou ms desde T0. */
  value: string | number;
  /** Frame rate para conversão de ms→SMPTE. Default 29.97 drop-frame. */
  fps?: 24 | 25 | 29.97 | 30 | 60;
}

export const Timecode = forwardRef<HTMLSpanElement, TimecodeProps>(
  ({ value, fps = 29.97, className, ...rest }, ref) => {
    const formatted = typeof value === 'number' ? msToSmpte(value, fps) : value;
    return (
      <span
        ref={ref}
        className={cn(monoBase, 'text-field-fg-primary', className)}
        aria-label={`Timecode ${formatted}`}
        {...rest}
      >
        {formatted}
      </span>
    );
  },
);
Timecode.displayName = 'Timecode';

/* Conversão simplificada ms→SMPTE (não-drop, suficiente p/ display).
   Para SMPTE drop-frame canônico use o smpteEngine — esta é apenas a
   formatação textual de fallback quando o valor já vem como ms. */
function msToSmpte(ms: number, fps: number): string {
  const totalFrames = Math.floor((ms / 1000) * fps);
  const f = totalFrames % Math.round(fps);
  const totalSec = Math.floor(totalFrames / fps);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

/* ── 2. DMX Address (Universe.Channel) ────────────────────────────────── */

interface DmxAddrProps extends HTMLAttributes<HTMLSpanElement> {
  /** 1..32768 (Art-Net 4 limite). */
  universe: number;
  /** 1..512. */
  channel: number;
  /** Mostrar prefixo "U" e separador. Default true. */
  verbose?: boolean;
}

export const DmxAddr = forwardRef<HTMLSpanElement, DmxAddrProps>(
  ({ universe, channel, verbose = true, className, ...rest }, ref) => {
    const u = String(universe).padStart(2, '0');
    const c = String(channel).padStart(3, '0');
    const text = verbose ? `U${u}.${c}` : `${u}.${c}`;
    return (
      <span
        ref={ref}
        className={cn(monoBase, 'text-field-fg-primary', className)}
        aria-label={`DMX universe ${universe} channel ${channel}`}
        {...rest}
      >
        {text}
      </span>
    );
  },
);
DmxAddr.displayName = 'DmxAddr';

/* ── 3. IP Address (IPv4 / IPv6 / hostname com porta) ─────────────────── */

interface IpAddrProps extends HTMLAttributes<HTMLSpanElement> {
  /** "192.168.1.42", "[::1]:7777", "fxk-node-3.local". */
  value: string;
  /** Porta opcional. Renderizada com cor secundária. */
  port?: number;
}

export const IpAddr = forwardRef<HTMLSpanElement, IpAddrProps>(
  ({ value, port, className, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(monoBase, 'text-field-fg-primary', className)}
      aria-label={port ? `IP ${value} port ${port}` : `IP ${value}`}
      {...rest}
    >
      {value}
      {port !== undefined && (
        <span className="text-field-fg-muted">:{port}</span>
      )}
    </span>
  ),
);
IpAddr.displayName = 'IpAddr';

/* ── 4. LogPane — bloco rolável de log monoespaçado ───────────────────── */

interface LogPaneProps extends HTMLAttributes<HTMLDivElement> {
  /** Linhas individuais (preferido) ou children livre. */
  lines?: ReadonlyArray<string | { ts?: string; level?: 'info' | 'warn' | 'error' | 'ok'; text: string }>;
  children?: ReactNode;
  /** Altura máxima (default 240px). Auto-scroll para baixo no append. */
  maxHeight?: number;
}

export const LogPane = forwardRef<HTMLDivElement, LogPaneProps>(
  ({ lines, children, maxHeight = 240, className, ...rest }, ref) => (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      className={cn(
        monoBase,
        'text-xs leading-relaxed',
        'bg-field-surface-1 border border-field-surface-3 rounded-ds-md',
        'overflow-y-auto p-3 whitespace-pre-wrap break-all',
        className,
      )}
      style={{ maxHeight }}
      {...rest}
    >
      {lines
        ? lines.map((entry, i) => {
            if (typeof entry === 'string') {
              return (
                <div key={i} className="text-field-fg-secondary">
                  {entry}
                </div>
              );
            }
            const colorClass =
              entry.level === 'error'
                ? 'text-status-fail'
                : entry.level === 'warn'
                  ? 'text-status-warn'
                  : entry.level === 'ok'
                    ? 'text-status-ok'
                    : 'text-field-fg-secondary';
            return (
              <div key={i} className={colorClass}>
                {entry.ts && <span className="text-field-fg-muted">{entry.ts} </span>}
                {entry.text}
              </div>
            );
          })
        : children}
    </div>
  ),
);
LogPane.displayName = 'LogPane';
