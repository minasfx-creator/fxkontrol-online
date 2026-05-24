/**
 * ConsoleLogos — 7 Inline SVG Logos for FXK Console Family
 * BR2049 tactical precision, thin strokes, geometric
 */

interface LogoProps {
  size?: number;
  active?: boolean;
  className?: string;
}

/* FXK-PYRO: Flame inside hexagonal reticle */
export function LogoPyro({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(0 85% 48%)';
  const g = active ? `drop-shadow(0 0 6px ${c})` : 'none';
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" className={className} style={{ filter: g }}>
      {/* Hex reticle */}
      <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" stroke={c} strokeWidth="1" fill="none" opacity={active ? 0.6 : 0.25} />
      <polygon points="24,8 38,16 38,32 24,40 10,32 10,16" stroke={c} strokeWidth="0.5" fill="none" opacity={0.15} />
      {/* Crosshairs */}
      <line x1="24" y1="2" x2="24" y2="10" stroke={c} strokeWidth="0.7" opacity={0.4} />
      <line x1="24" y1="38" x2="24" y2="46" stroke={c} strokeWidth="0.7" opacity={0.4} />
      <line x1="2" y1="24" x2="10" y2="24" stroke={c} strokeWidth="0.7" opacity={0.4} />
      <line x1="38" y1="24" x2="46" y2="24" stroke={c} strokeWidth="0.7" opacity={0.4} />
      {/* Flame */}
      <path d="M24 14 C24 14, 30 22, 30 28 C30 32, 27 36, 24 36 C21 36, 18 32, 18 28 C18 22, 24 14, 24 14Z" 
        fill={active ? c : 'none'} stroke={c} strokeWidth="1.2" opacity={active ? 0.8 : 0.5} />
      <path d="M24 22 C24 22, 27 26, 27 29 C27 31, 25.5 33, 24 33 C22.5 33, 21 31, 21 29 C21 26, 24 22, 24 22Z"
        fill="none" stroke={c} strokeWidth="0.6" opacity={0.3} />
      {active && <circle cx="24" cy="24" r="22" stroke={c} strokeWidth="0.3" fill="none" opacity={0.15}>
        <animate attributeName="r" values="20;22;20" dur="2s" repeatCount="indefinite" />
      </circle>}
    </svg>
  );
}

/* FXK-DMX: Lightning bolt inside oscilloscope ring */
export function LogoDmx({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(200 80% 48%)';
  const g = active ? `drop-shadow(0 0 6px ${c})` : 'none';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter: g }}>
      {/* Oscilloscope ring */}
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="1" fill="none" opacity={active ? 0.5 : 0.2} />
      <circle cx="24" cy="24" r="17" stroke={c} strokeWidth="0.4" fill="none" opacity={0.1} strokeDasharray="2 3" />
      {/* Waveform arc */}
      <path d="M8 24 Q14 16, 20 24 Q26 32, 32 24 Q38 16, 44 24" stroke={c} strokeWidth="0.7" fill="none" opacity={0.25} />
      {/* Lightning bolt */}
      <path d="M26 10 L20 23 L26 23 L22 38 L30 22 L24 22 Z" 
        fill={active ? c : 'none'} stroke={c} strokeWidth="1.2" strokeLinejoin="round" opacity={active ? 0.8 : 0.5} />
      {/* Tick marks */}
      {[0, 90, 180, 270].map(a => (
        <line key={a} x1="24" y1="2" x2="24" y2="6" stroke={c} strokeWidth="0.5" opacity={0.3}
          transform={`rotate(${a} 24 24)`} />
      ))}
    </svg>
  );
}

/* FXK-LIGHT: Beam cone from lens with fixture ring */
export function LogoLight({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(240 50% 52%)';
  const g = active ? `drop-shadow(0 0 6px ${c})` : 'none';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter: g }}>
      {/* Fixture ring */}
      <circle cx="24" cy="24" r="20" stroke={c} strokeWidth="0.8" fill="none" opacity={active ? 0.4 : 0.15} />
      {/* Lens element */}
      <circle cx="24" cy="16" r="5" stroke={c} strokeWidth="1.2" fill={active ? c : 'none'} opacity={active ? 0.5 : 0.3} />
      <circle cx="24" cy="16" r="2.5" stroke={c} strokeWidth="0.6" fill="none" opacity={0.4} />
      {/* Beam cone */}
      <path d="M19 20 L12 42 L36 42 L29 20" stroke={c} strokeWidth="0.8" fill={active ? `${c}15` : 'none'} opacity={active ? 0.6 : 0.25} />
      {/* Beam center line */}
      <line x1="24" y1="20" x2="24" y2="42" stroke={c} strokeWidth="0.4" opacity={0.2} strokeDasharray="2 2" />
      {/* Fixture mount marks */}
      <line x1="16" y1="14" x2="14" y2="10" stroke={c} strokeWidth="0.5" opacity={0.2} />
      <line x1="32" y1="14" x2="34" y2="10" stroke={c} strokeWidth="0.5" opacity={0.2} />
    </svg>
  );
}

/* FXK-DRONE: Quadcopter inside radar sweep */
export function LogoDrone({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(165 100% 42%)';
  const g = active ? `drop-shadow(0 0 6px ${c})` : 'none';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter: g }}>
      {/* Radar sweep circle */}
      <circle cx="24" cy="24" r="21" stroke={c} strokeWidth="0.8" fill="none" opacity={active ? 0.4 : 0.15} />
      <circle cx="24" cy="24" r="14" stroke={c} strokeWidth="0.4" fill="none" opacity={0.1} strokeDasharray="1 2" />
      <circle cx="24" cy="24" r="7" stroke={c} strokeWidth="0.4" fill="none" opacity={0.1} />
      {/* Cardinal marks */}
      {['N', 'E', 'S', 'W'].map((d, i) => (
        <text key={d} x={24 + [0, 19, 0, -19][i]} y={24 + [-19, 1, 21, 1][i]}
          textAnchor="middle" fill={c} fontSize="5" fontFamily="monospace" opacity={0.35}>{d}</text>
      ))}
      {/* Quadcopter body */}
      <rect x="21" y="21" width="6" height="6" rx="1" stroke={c} strokeWidth="1" fill={active ? c : 'none'} opacity={active ? 0.5 : 0.35} />
      {/* Arms + rotors */}
      {[[14, 14], [34, 14], [14, 34], [34, 34]].map(([cx, cy], i) => (
        <g key={i}>
          <line x1="24" y1="24" x2={cx} y2={cy} stroke={c} strokeWidth="0.7" opacity={0.3} />
          <circle cx={cx} cy={cy} r="4" stroke={c} strokeWidth="0.6" fill="none" opacity={active ? 0.5 : 0.2} />
          {active && <circle cx={cx} cy={cy} r="3" stroke={c} strokeWidth="0.3" fill="none" opacity={0.3} strokeDasharray="1 1">
            <animateTransform attributeName="transform" type="rotate" values={`0 ${cx} ${cy};360 ${cx} ${cy}`} dur="1s" repeatCount="indefinite" />
          </circle>}
        </g>
      ))}
      {/* Radar sweep line */}
      {active && <line x1="24" y1="24" x2="24" y2="3" stroke={c} strokeWidth="0.5" opacity={0.4}>
        <animateTransform attributeName="transform" type="rotate" values="0 24 24;360 24 24" dur="3s" repeatCount="indefinite" />
      </line>}
    </svg>
  );
}

/* SHOW CTRL: 4-quadrant diamond with mission star */
export function LogoShowCtrl({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(32 100% 50%)';
  const g = active ? `drop-shadow(0 0 6px ${c})` : 'none';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter: g }}>
      {/* Diamond reticle */}
      <polygon points="24,4 44,24 24,44 4,24" stroke={c} strokeWidth="1" fill="none" opacity={active ? 0.5 : 0.2} />
      {/* Cross dividers */}
      <line x1="24" y1="4" x2="24" y2="44" stroke={c} strokeWidth="0.4" opacity={0.15} />
      <line x1="4" y1="24" x2="44" y2="24" stroke={c} strokeWidth="0.4" opacity={0.15} />
      {/* System dots in quadrants */}
      <circle cx="18" cy="18" r="2" fill="hsl(0 85% 48%)" opacity={active ? 0.8 : 0.4} /> {/* PYRO */}
      <circle cx="30" cy="18" r="2" fill="hsl(200 80% 48%)" opacity={active ? 0.8 : 0.4} /> {/* DMX */}
      <circle cx="18" cy="30" r="2" fill="hsl(240 50% 52%)" opacity={active ? 0.8 : 0.4} /> {/* LIGHT */}
      <circle cx="30" cy="30" r="2" fill="hsl(165 100% 42%)" opacity={active ? 0.8 : 0.4} /> {/* DRONE */}
      {/* Center mission star */}
      <polygon points="24,16 26,22 32,22 27,26 29,32 24,28 19,32 21,26 16,22 22,22"
        fill={active ? c : 'none'} stroke={c} strokeWidth="0.8" opacity={active ? 0.7 : 0.35} />
      {active && <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="0.3" fill="none" opacity={0.2}>
        <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2s" repeatCount="indefinite" />
      </circle>}
    </svg>
  );
}

/* MODULE: Circuit traces to central chip */
export function LogoModule({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(270 60% 50%)';
  const g = active ? `drop-shadow(0 0 6px ${c})` : 'none';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter: g }}>
      {/* Chip die */}
      <rect x="18" y="18" width="12" height="12" rx="1" stroke={c} strokeWidth="1.2" fill={active ? `${c}20` : 'none'} opacity={active ? 0.7 : 0.35} />
      <rect x="21" y="21" width="6" height="6" rx="0.5" stroke={c} strokeWidth="0.6" fill={active ? c : 'none'} opacity={active ? 0.5 : 0.25} />
      {/* Pin traces - top */}
      {[20, 24, 28].map(x => <line key={`t${x}`} x1={x} y1="18" x2={x} y2="8" stroke={c} strokeWidth="0.7" opacity={0.3} />)}
      {/* Pin traces - bottom */}
      {[20, 24, 28].map(x => <line key={`b${x}`} x1={x} y1="30" x2={x} y2="40" stroke={c} strokeWidth="0.7" opacity={0.3} />)}
      {/* Pin traces - left */}
      {[20, 24, 28].map(y => <line key={`l${y}`} x1="18" y1={y} x2="8" y2={y} stroke={c} strokeWidth="0.7" opacity={0.3} />)}
      {/* Pin traces - right */}
      {[20, 24, 28].map(y => <line key={`r${y}`} x1="30" y1={y} x2="40" y2={y} stroke={c} strokeWidth="0.7" opacity={0.3} />)}
      {/* Pin dots */}
      {[
        [20, 8], [24, 8], [28, 8], [20, 40], [24, 40], [28, 40],
        [8, 20], [8, 24], [8, 28], [40, 20], [40, 24], [40, 28],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.2" fill={c} opacity={active ? 0.6 : 0.2} />
      ))}
      {active && <rect x="18" y="18" width="12" height="12" rx="1" stroke={c} strokeWidth="0.5" fill="none" opacity={0.3}>
        <animate attributeName="opacity" values="0.1;0.4;0.1" dur="1.5s" repeatCount="indefinite" />
      </rect>}
    </svg>
  );
}

/* DMX MONITOR: Waveform inside terminal brackets */
export function LogoDmxMonitor({ size = 48, active = false, className }: LogoProps) {
  const c = 'hsl(120 70% 42%)';
  const g = active ? `drop-shadow(0 0 6px ${c})` : 'none';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} style={{ filter: g }}>
      {/* Terminal brackets [ ] */}
      <path d="M10 10 L6 10 L6 38 L10 38" stroke={c} strokeWidth="1.2" fill="none" opacity={active ? 0.5 : 0.25} />
      <path d="M38 10 L42 10 L42 38 L38 38" stroke={c} strokeWidth="1.2" fill="none" opacity={active ? 0.5 : 0.25} />
      {/* Signal waveform */}
      <path d="M10 24 L14 24 L16 16 L18 32 L20 12 L22 36 L24 14 L26 34 L28 18 L30 30 L32 20 L34 28 L36 24 L38 24"
        stroke={c} strokeWidth="1.2" fill="none" opacity={active ? 0.7 : 0.35} strokeLinejoin="round" />
      {/* Baseline */}
      <line x1="6" y1="24" x2="42" y2="24" stroke={c} strokeWidth="0.3" opacity={0.12} />
      {/* Scan dots */}
      {active && <>
        <circle cx="10" cy="24" r="1" fill={c} opacity={0.5}>
          <animate attributeName="cx" values="10;38;10" dur="2s" repeatCount="indefinite" />
        </circle>
      </>}
      {/* Top/bottom tick marks */}
      {[14, 20, 26, 32].map(x => (
        <g key={x}>
          <line x1={x} y1="8" x2={x} y2="10" stroke={c} strokeWidth="0.4" opacity={0.2} />
          <line x1={x} y1="38" x2={x} y2="40" stroke={c} strokeWidth="0.4" opacity={0.2} />
        </g>
      ))}
    </svg>
  );
}

/* Map mode key → logo component */
export const CONSOLE_LOGOS: Record<string, React.FC<LogoProps>> = {
  pyro_fire: LogoPyro,
  super_dmx: LogoDmx,
  fxk_light: LogoLight,
  drone_ops: LogoDrone,
  show_control: LogoShowCtrl,
  module: LogoModule,
  dmx_monitor: LogoDmxMonitor,
};
