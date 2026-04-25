/**
 * ConsoleLogos — 7 SVG inline para a família FXK Console
 * Estética BR2049 / mission-control: hairlines, reticulados duplos,
 * gradientes sutis, micro tick marks, animações no estado `active`.
 *
 * API pública preservada (mesmos exports e mesma prop signature).
 */

import { useId } from 'react';

interface LogoProps {
  size?: number;
  active?: boolean;
  className?: string;
}

/* ----------------------------------------------------------------- *
 * Helpers visuais reutilizados pelos logos
 * ----------------------------------------------------------------- */

function useGradId(prefix: string) {
  const id = useId().replace(/[:]/g, '');
  return `${prefix}-${id}`;
}

interface CornerTicksProps {
  color: string;
  opacity?: number;
}
/** Marcas de canto tipo HUD (4 cantos, L-shape) */
function CornerTicks({ color, opacity = 0.35 }: CornerTicksProps) {
  const t = 3.2;
  const o = 2;
  return (
    <g stroke={color} strokeWidth="0.6" opacity={opacity} fill="none" strokeLinecap="square">
      <path d={`M${o} ${o + t} L${o} ${o} L${o + t} ${o}`} />
      <path d={`M${48 - o - t} ${o} L${48 - o} ${o} L${48 - o} ${o + t}`} />
      <path d={`M${o} ${48 - o - t} L${o} ${48 - o} L${o + t} ${48 - o}`} />
      <path d={`M${48 - o - t} ${48 - o} L${48 - o} ${48 - o} L${48 - o} ${48 - o - t}`} />
    </g>
  );
}

/* ----------------------------------------------------------------- *
 * FXK-PYRO — chama dentro de reticulado hexagonal duplo
 * ----------------------------------------------------------------- */
export function LogoPyro({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(0 85% 52%)';
  const c2 = 'hsl(22 95% 56%)';
  const gid = useGradId('pyro');
  const filter = active ? `drop-shadow(0 0 6px ${c})` : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={c} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>

      {/* Reticulado hex duplo */}
      <polygon points="24,4 42,14 42,34 24,44 6,34 6,14"
        stroke={c} strokeWidth="0.9" fill="none" opacity={active ? 0.55 : 0.22} strokeLinejoin="round" />
      <polygon points="24,8 38,16 38,32 24,40 10,32 10,16"
        stroke={c} strokeWidth="0.4" fill="none" opacity={0.18} strokeDasharray="2 3" />

      {/* Crosshairs externos */}
      <line x1="24" y1="2" x2="24" y2="6" stroke={c} strokeWidth="0.6" opacity={0.4} />
      <line x1="24" y1="42" x2="24" y2="46" stroke={c} strokeWidth="0.6" opacity={0.4} />
      <line x1="2" y1="24" x2="6" y2="24" stroke={c} strokeWidth="0.6" opacity={0.4} />
      <line x1="42" y1="24" x2="46" y2="24" stroke={c} strokeWidth="0.6" opacity={0.4} />

      <CornerTicks color={c} opacity={0.3} />

      {/* Chama principal com gradiente */}
      <path d="M24 13 C24 13, 31 21, 31 28 C31 33, 28 37, 24 37 C20 37, 17 33, 17 28 C17 21, 24 13, 24 13Z"
        fill={active ? `url(#${gid})` : 'none'}
        stroke={`url(#${gid})`} strokeWidth="1.1" opacity={active ? 0.95 : 0.6} strokeLinejoin="round" />
      {/* Chama interna */}
      <path d="M24 21 C24 21, 27.5 25, 27.5 29 C27.5 31.4, 25.9 33.4, 24 33.4 C22.1 33.4, 20.5 31.4, 20.5 29 C20.5 25, 24 21, 24 21Z"
        fill={active ? c2 : 'none'} stroke={c2} strokeWidth="0.5" opacity={active ? 0.85 : 0.32} />

      {active && (
        <circle cx="24" cy="24" r="22" stroke={c} strokeWidth="0.3" fill="none" opacity={0.18}>
          <animate attributeName="r" values="20;22;20" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

/* ----------------------------------------------------------------- *
 * FXK-DMX — bolt dentro de osciloscópio
 * ----------------------------------------------------------------- */
export function LogoDmx({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(200 85% 55%)';
  const c2 = 'hsl(190 95% 65%)';
  const gid = useGradId('dmx');
  const filter = active ? `drop-shadow(0 0 6px ${c})` : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c2} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
      </defs>

      {/* Anel principal */}
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="0.9" fill="none" opacity={active ? 0.55 : 0.22} />
      <circle cx="24" cy="24" r="17" stroke={c} strokeWidth="0.4" fill="none" opacity={0.12} strokeDasharray="2 3" />
      <circle cx="24" cy="24" r="12" stroke={c} strokeWidth="0.3" fill="none" opacity={0.08} />

      {/* Waveform de fundo */}
      <path d="M6 24 Q12 14, 18 24 T30 24 T42 24"
        stroke={c} strokeWidth="0.6" fill="none" opacity={0.28} />

      {/* Bolt com gradiente */}
      <path d="M27 9 L19 24 L25 24 L21 39 L31 22 L25 22 Z"
        fill={active ? `url(#${gid})` : 'none'}
        stroke={`url(#${gid})`} strokeWidth="1.1" strokeLinejoin="round" opacity={active ? 0.95 : 0.6} />

      {/* Tick marks cardinais */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <line key={a} x1="24" y1="3" x2="24" y2={a % 90 === 0 ? '6' : '5'}
          stroke={c} strokeWidth={a % 90 === 0 ? 0.6 : 0.35}
          opacity={a % 90 === 0 ? 0.45 : 0.22}
          transform={`rotate(${a} 24 24)`} />
      ))}

      <CornerTicks color={c} opacity={0.25} />
    </svg>
  );
}

/* ----------------------------------------------------------------- *
 * FXK-LIGHT — feixe cônico
 * ----------------------------------------------------------------- */
export function LogoLight({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(240 60% 62%)';
  const c2 = 'hsl(220 85% 70%)';
  const gid = useGradId('light');
  const beamId = useGradId('beam');
  const filter = active ? `drop-shadow(0 0 6px ${c})` : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c2} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
        <linearGradient id={beamId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c2} stopOpacity={active ? 0.45 : 0.18} />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Anel da fixture */}
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="0.7" fill="none" opacity={active ? 0.4 : 0.15} />

      {/* Lente (com gradiente quando ativa) */}
      <circle cx="24" cy="16" r="5.2" stroke={`url(#${gid})`} strokeWidth="1.2"
        fill={active ? `url(#${gid})` : 'none'} opacity={active ? 0.85 : 0.45} />
      <circle cx="24" cy="16" r="2.6" stroke={c2} strokeWidth="0.6" fill="none" opacity={0.55} />
      <circle cx="24" cy="16" r="0.9" fill={c2} opacity={active ? 0.95 : 0.5} />

      {/* Cone do feixe (preenchido com gradiente vertical) */}
      <path d="M19.2 20 L11 42 L37 42 L28.8 20 Z"
        fill={`url(#${beamId})`} stroke={c} strokeWidth="0.7" opacity={active ? 0.7 : 0.3} strokeLinejoin="round" />

      {/* Linhas internas do cone */}
      <line x1="22" y1="20" x2="17" y2="42" stroke={c} strokeWidth="0.3" opacity={0.18} />
      <line x1="26" y1="20" x2="31" y2="42" stroke={c} strokeWidth="0.3" opacity={0.18} />
      <line x1="24" y1="20" x2="24" y2="42" stroke={c} strokeWidth="0.3" opacity={0.16} strokeDasharray="2 2" />

      {/* Mounts laterais */}
      <line x1="15.5" y1="14" x2="13" y2="9" stroke={c} strokeWidth="0.5" opacity={0.3} />
      <line x1="32.5" y1="14" x2="35" y2="9" stroke={c} strokeWidth="0.5" opacity={0.3} />

      <CornerTicks color={c} opacity={0.25} />
    </svg>
  );
}

/* ----------------------------------------------------------------- *
 * FXK-DRONE — quadcopter dentro de radar
 * ----------------------------------------------------------------- */
export function LogoDrone({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(165 95% 48%)';
  const c2 = 'hsl(150 95% 60%)';
  const gid = useGradId('drone');
  const sweepId = useGradId('sweep');
  const filter = active ? `drop-shadow(0 0 6px ${c})` : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c2} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
        <linearGradient id={sweepId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.5" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Anéis do radar */}
      <circle cx="24" cy="24" r="21" stroke={c} strokeWidth="0.8" fill="none" opacity={active ? 0.42 : 0.16} />
      <circle cx="24" cy="24" r="14" stroke={c} strokeWidth="0.4" fill="none" opacity={0.12} strokeDasharray="1 2" />
      <circle cx="24" cy="24" r="7" stroke={c} strokeWidth="0.35" fill="none" opacity={0.12} />

      {/* Cardinais */}
      {['N', 'E', 'S', 'W'].map((d, i) => (
        <text key={d} x={24 + [0, 19, 0, -19][i]} y={24 + [-19, 1, 21, 1][i]}
          textAnchor="middle" fill={c} fontSize="4.5" fontFamily="monospace" opacity={0.4}
          letterSpacing="0.5">{d}</text>
      ))}

      {/* Corpo do quadcopter */}
      <rect x="20.5" y="20.5" width="7" height="7" rx="1.4"
        stroke={`url(#${gid})`} strokeWidth="1"
        fill={active ? `url(#${gid})` : 'none'} opacity={active ? 0.7 : 0.4} />
      <circle cx="24" cy="24" r="1.2" fill={c2} opacity={active ? 0.9 : 0.5} />

      {/* Braços + rotores */}
      {[[14, 14], [34, 14], [14, 34], [34, 34]].map(([cx, cy], i) => (
        <g key={i}>
          <line x1="24" y1="24" x2={cx} y2={cy} stroke={c} strokeWidth="0.7" opacity={0.35} />
          <circle cx={cx} cy={cy} r="4" stroke={c} strokeWidth="0.7" fill="none" opacity={active ? 0.55 : 0.25} />
          <circle cx={cx} cy={cy} r="2.2" stroke={c2} strokeWidth="0.4" fill="none" opacity={active ? 0.45 : 0.2} />
          {active && (
            <circle cx={cx} cy={cy} r="3.2" stroke={c2} strokeWidth="0.35" fill="none" opacity={0.5} strokeDasharray="1.2 1">
              <animateTransform attributeName="transform" type="rotate"
                values={`0 ${cx} ${cy};360 ${cx} ${cy}`} dur="0.9s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}

      {/* Sweep do radar */}
      {active && (
        <g style={{ transformOrigin: '24px 24px' }}>
          <path d="M24 24 L24 3 A21 21 0 0 1 39.8 13.5 Z"
            fill={`url(#${sweepId})`} opacity="0.5">
            <animateTransform attributeName="transform" type="rotate"
              values="0 24 24;360 24 24" dur="3.2s" repeatCount="indefinite" />
          </path>
        </g>
      )}
    </svg>
  );
}

/* ----------------------------------------------------------------- *
 * SHOW CTRL — diamante com mission star + 4 systems
 * ----------------------------------------------------------------- */
export function LogoShowCtrl({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(32 100% 55%)';
  const c2 = 'hsl(42 100% 65%)';
  const gid = useGradId('show');
  const filter = active ? `drop-shadow(0 0 6px ${c})` : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c2} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
      </defs>

      {/* Diamond duplo */}
      <polygon points="24,4 44,24 24,44 4,24"
        stroke={c} strokeWidth="0.9" fill="none" opacity={active ? 0.55 : 0.22} strokeLinejoin="round" />
      <polygon points="24,9 39,24 24,39 9,24"
        stroke={c} strokeWidth="0.4" fill="none" opacity={0.18} strokeDasharray="2 2" />

      {/* Cross dividers */}
      <line x1="24" y1="4" x2="24" y2="44" stroke={c} strokeWidth="0.4" opacity={0.18} />
      <line x1="4" y1="24" x2="44" y2="24" stroke={c} strokeWidth="0.4" opacity={0.18} />

      {/* System dots quadrantes (anel + ponto) */}
      {[
        { x: 18, y: 18, k: 'hsl(0 85% 55%)' },
        { x: 30, y: 18, k: 'hsl(200 85% 55%)' },
        { x: 18, y: 30, k: 'hsl(240 65% 65%)' },
        { x: 30, y: 30, k: 'hsl(165 95% 50%)' },
      ].map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r="2.6" stroke={s.k} strokeWidth="0.5" fill="none" opacity={active ? 0.7 : 0.3} />
          <circle cx={s.x} cy={s.y} r="1.2" fill={s.k} opacity={active ? 0.9 : 0.45} />
        </g>
      ))}

      {/* Mission star com gradiente */}
      <polygon points="24,15 26.2,21.6 33,21.6 27.4,25.7 29.6,32.3 24,28.2 18.4,32.3 20.6,25.7 15,21.6 21.8,21.6"
        fill={active ? `url(#${gid})` : 'none'}
        stroke={`url(#${gid})`} strokeWidth="0.8" opacity={active ? 0.85 : 0.4} strokeLinejoin="round" />

      {active && (
        <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="0.3" fill="none" opacity={0.22}>
          <animate attributeName="opacity" values="0.1;0.32;0.1" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

/* ----------------------------------------------------------------- *
 * MODULE — chip com pinos e traces
 * ----------------------------------------------------------------- */
export function LogoModule({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(270 70% 60%)';
  const c2 = 'hsl(285 90% 72%)';
  const gid = useGradId('mod');
  const filter = active ? `drop-shadow(0 0 6px ${c})` : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c2} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
      </defs>

      {/* PCB outer reticule */}
      <rect x="3" y="3" width="42" height="42" rx="2"
        stroke={c} strokeWidth="0.4" fill="none" opacity={0.15} strokeDasharray="3 3" />

      {/* Chip outer */}
      <rect x="17.5" y="17.5" width="13" height="13" rx="1.2"
        stroke={`url(#${gid})`} strokeWidth="1.2"
        fill={active ? `url(#${gid})` : 'none'} opacity={active ? 0.55 : 0.35} />
      {/* Chip die */}
      <rect x="20.5" y="20.5" width="7" height="7" rx="0.6"
        stroke={c2} strokeWidth="0.5"
        fill={active ? c2 : 'none'} opacity={active ? 0.7 : 0.3} />
      {/* Pin 1 marker */}
      <circle cx="19.5" cy="19.5" r="0.6" fill={c2} opacity={active ? 0.95 : 0.5} />

      {/* Pin traces */}
      {[20, 24, 28].map(x => <line key={`t${x}`} x1={x} y1="17.5" x2={x} y2="8" stroke={c} strokeWidth="0.7" opacity={0.35} />)}
      {[20, 24, 28].map(x => <line key={`b${x}`} x1={x} y1="30.5" x2={x} y2="40" stroke={c} strokeWidth="0.7" opacity={0.35} />)}
      {[20, 24, 28].map(y => <line key={`l${y}`} x1="17.5" y1={y} x2="8" y2={y} stroke={c} strokeWidth="0.7" opacity={0.35} />)}
      {[20, 24, 28].map(y => <line key={`r${y}`} x1="30.5" y1={y} x2="40" y2={y} stroke={c} strokeWidth="0.7" opacity={0.35} />)}

      {/* Pin pads (square) */}
      {[
        [20, 8], [24, 8], [28, 8], [20, 40], [24, 40], [28, 40],
        [8, 20], [8, 24], [8, 28], [40, 20], [40, 24], [40, 28],
      ].map(([x, y], i) => (
        <rect key={i} x={x - 1.1} y={y - 1.1} width="2.2" height="2.2" rx="0.3"
          fill={c} opacity={active ? 0.7 : 0.3} />
      ))}

      <CornerTicks color={c} opacity={0.28} />

      {active && (
        <rect x="17.5" y="17.5" width="13" height="13" rx="1.2"
          stroke={c2} strokeWidth="0.5" fill="none" opacity={0.4}>
          <animate attributeName="opacity" values="0.15;0.5;0.15" dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}
    </svg>
  );
}

/* ----------------------------------------------------------------- *
 * DMX MONITOR — waveform dentro de brackets de terminal
 * ----------------------------------------------------------------- */
export function LogoDmxMonitor({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(140 75% 48%)';
  const c2 = 'hsl(120 90% 60%)';
  const gid = useGradId('mon');
  const filter = active ? `drop-shadow(0 0 6px ${c})` : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c} />
          <stop offset="50%" stopColor={c2} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
      </defs>

      {/* Brackets [ ] */}
      <path d="M11 8 L5 8 L5 40 L11 40" stroke={c} strokeWidth="1.2" fill="none"
        opacity={active ? 0.6 : 0.32} strokeLinejoin="round" strokeLinecap="square" />
      <path d="M37 8 L43 8 L43 40 L37 40" stroke={c} strokeWidth="1.2" fill="none"
        opacity={active ? 0.6 : 0.32} strokeLinejoin="round" strokeLinecap="square" />

      {/* Grid de leitura */}
      <line x1="6" y1="24" x2="42" y2="24" stroke={c} strokeWidth="0.3" opacity={0.18} strokeDasharray="2 2" />
      <line x1="6" y1="16" x2="42" y2="16" stroke={c} strokeWidth="0.25" opacity={0.1} />
      <line x1="6" y1="32" x2="42" y2="32" stroke={c} strokeWidth="0.25" opacity={0.1} />

      {/* Waveform com gradiente */}
      <path d="M9 24 L13 24 L15 16 L17 32 L19 12 L21 36 L24 14 L27 34 L29 18 L31 30 L33 20 L35 28 L37 24 L39 24"
        stroke={`url(#${gid})`} strokeWidth="1.3" fill="none" strokeLinejoin="round"
        opacity={active ? 0.9 : 0.5} />

      {/* Scan dot */}
      {active && (
        <circle cx="9" cy="24" r="1.4" fill={c2} opacity="0.9">
          <animate attributeName="cx" values="9;39;9" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Tick marks topo/base */}
      {[12, 18, 24, 30, 36].map(x => (
        <g key={x}>
          <line x1={x} y1="6" x2={x} y2="9" stroke={c} strokeWidth="0.4" opacity={0.28} />
          <line x1={x} y1="39" x2={x} y2="42" stroke={c} strokeWidth="0.4" opacity={0.28} />
        </g>
      ))}

      <CornerTicks color={c} opacity={0.25} />
    </svg>
  );
}

/* Mapa mode key → componente (preservado) */
export const CONSOLE_LOGOS: Record<string, React.FC<LogoProps>> = {
  pyro_fire: LogoPyro,
  super_dmx: LogoDmx,
  fxk_light: LogoLight,
  drone_ops: LogoDrone,
  show_control: LogoShowCtrl,
  module: LogoModule,
  dmx_monitor: LogoDmxMonitor,
};
