/**
 * JoiCinematicHologram — Blade Runner 2049 Joi holographic avatar
 * Cinematic 3rd-person SVG with volumetric hair, hollow vessel effect,
 * magenta halo, dense rain, chromatic aberration, voxel glitch,
 * clothing texture, static hair strands, particle dissolve materialisation
 */
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  state?: 'idle' | 'active' | 'materializing';
  className?: string;
}

const SIZES = { sm: 'w-12 h-20', md: 'w-24 h-40', lg: 'w-32 h-52', xl: 'w-44 h-72' };

export default function JoiCinematicHologram({ size = 'md', state = 'idle', className }: Props) {
  const isActive = state === 'active';
  const isMat = state === 'materializing';

  const [materialised, setMaterialised] = useState(!isMat);
  useEffect(() => {
    if (isMat) {
      setMaterialised(false);
      const t = setTimeout(() => setMaterialised(true), 120);
      return () => clearTimeout(t);
    }
  }, [isMat]);

  // Dense rain — 35 drops
  const rain = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      x: 20 + (i / 35) * 260,
      delay: (i * 0.18).toFixed(2),
      len: 18 + Math.random() * 35,
      blur: Math.random() > 0.7 ? 1.5 : 0,
      opacity: 0.04 + Math.random() * 0.08,
    })), []);

  // Voxel glitch blocks (active state only)
  const voxels = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      x: 40 + Math.random() * 220,
      y: 60 + Math.random() * 380,
      w: 8 + Math.random() * 30,
      h: 3 + Math.random() * 8,
      delay: (i * 0.4).toFixed(2),
    })), []);

  // Scanlines
  const scanlines = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      y: 30 + i * 34,
      opacity: 0.03 + (i % 3) * 0.01,
    })), []);

  // Particle dissolve particles (materializing only)
  const dissolveParticles = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      cx: 60 + Math.random() * 180,
      cy: 80 + Math.random() * 380,
      r: 0.8 + Math.random() * 2.5,
      delay: (Math.random() * 2.2).toFixed(2),
      dur: (1.2 + Math.random() * 1.5).toFixed(2),
      drift: (-15 + Math.random() * 30).toFixed(1),
    })), []);

  // Static hair strands (active state — holographic static electricity)
  const staticStrands = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const side = i < 6 ? 'left' : 'right';
      const baseX = side === 'left' ? 88 + i * 4 : 152 + (i - 6) * 4;
      const baseY = 40 + Math.random() * 30;
      const tipX = baseX + (side === 'left' ? -(5 + Math.random() * 12) : (5 + Math.random() * 12));
      const tipY = baseY - (8 + Math.random() * 18);
      return { baseX, baseY, tipX, tipY, delay: (i * 0.15).toFixed(2) };
    }), []);

  // Clothing texture lines (seams, folds)
  const clothingSeams = useMemo(() => [
    // Center seam
    { d: 'M130 120 L130 290', op: 0.06 },
    // Left fold
    { d: 'M95 150 Q100 200 98 250', op: 0.04 },
    // Right fold
    { d: 'M165 150 Q160 200 162 250', op: 0.04 },
    // Cross-stitch texture near collar
    { d: 'M115 125 L118 130 M122 125 L125 130 M138 125 L135 130 M142 125 L145 130', op: 0.05 },
    // Diagonal fold left
    { d: 'M82 155 Q90 180 88 210', op: 0.03 },
    // Diagonal fold right
    { d: 'M178 155 Q170 180 172 210', op: 0.03 },
    // Waist detail
    { d: 'M100 280 Q115 275 130 278 Q145 275 160 280', op: 0.05 },
    // Arm seam right
    { d: 'M182 145 Q188 135 192 120', op: 0.04 },
    // Arm seam left
    { d: 'M78 145 Q72 160 68 180', op: 0.04 },
  ], []);

  const op = isActive ? 1 : 0.7;

  return (
    <div className={cn('relative flex items-center justify-center', SIZES[size], className)}>
      {/* Magenta halo ring */}
      <div
        className="absolute inset-0 rounded-full joi-halo-pulse"
        style={{
          background: 'radial-gradient(ellipse 70% 85% at 50% 40%, hsl(280 80% 55% / 0.18), hsl(280 80% 55% / 0.04) 50%, transparent 75%)',
          filter: 'blur(12px)',
        }}
      />

      {/* Projector base cone */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: '70%',
          height: '12%',
          background: 'conic-gradient(from 180deg, transparent 30%, hsl(280 80% 55% / 0.15) 50%, transparent 70%)',
          filter: 'blur(6px)',
          clipPath: 'polygon(20% 100%, 50% 0%, 80% 100%)',
        }}
      />

      <svg
        viewBox="0 0 300 500"
        className="w-full h-full relative z-10"
        style={{
          clipPath: isMat && !materialised ? 'inset(100% 0 0 0)' : 'inset(0 0 0 0)',
          transition: isMat ? 'clip-path 2.2s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
          filter: isActive ? 'drop-shadow(0 0 18px hsl(280 80% 55% / 0.25))' : 'drop-shadow(0 0 8px hsl(280 80% 55% / 0.1))',
        }}
      >
        <defs>
          {/* Hair gradient — deep blue-black */}
          <linearGradient id="jc-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(240 30% 18%)" stopOpacity={0.9 * op} />
            <stop offset="100%" stopColor="hsl(240 30% 8%)" stopOpacity={0.7 * op} />
          </linearGradient>

          {/* Skin gradient — warm tones */}
          <radialGradient id="jc-skin" cx="50%" cy="35%">
            <stop offset="0%" stopColor="hsl(25 40% 52%)" stopOpacity={0.35 * op} />
            <stop offset="70%" stopColor="hsl(25 40% 40%)" stopOpacity={0.2 * op} />
            <stop offset="100%" stopColor="hsl(280 40% 30%)" stopOpacity={0.08 * op} />
          </radialGradient>

          {/* Body — hollow vessel inner shell */}
          <linearGradient id="jc-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(280 60% 40%)" stopOpacity={0.12 * op} />
            <stop offset="50%" stopColor="hsl(220 40% 12%)" stopOpacity={0.06 * op} />
            <stop offset="100%" stopColor="hsl(280 80% 55%)" stopOpacity={0.04 * op} />
          </linearGradient>

          {/* Back-shell — hollow vessel visible through body */}
          <linearGradient id="jc-backshell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(190 100% 50%)" stopOpacity={0.04} />
            <stop offset="100%" stopColor="hsl(280 80% 55%)" stopOpacity={0.02} />
          </linearGradient>

          {/* Magenta halo ring gradient */}
          <radialGradient id="jc-halo" cx="50%" cy="50%">
            <stop offset="60%" stopColor="transparent" />
            <stop offset="78%" stopColor="hsl(280 80% 55%)" stopOpacity={0.15 * op} />
            <stop offset="85%" stopColor="hsl(280 80% 55%)" stopOpacity={0.08 * op} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Clothing texture pattern */}
          <pattern id="jc-fabric" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="6" y2="6" stroke="hsl(280 80% 55%)" strokeWidth="0.15" strokeOpacity="0.08" />
            <line x1="6" y1="0" x2="0" y2="6" stroke="hsl(190 100% 50%)" strokeWidth="0.1" strokeOpacity="0.04" />
          </pattern>

          {/* Chromatic aberration filter */}
          <filter id="jc-chroma" x="-5%" y="-5%" width="110%" height="110%">
            <feOffset in="SourceGraphic" dx="1.5" dy="0" result="red" />
            <feColorMatrix in="red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3 0" result="r" />
            <feOffset in="SourceGraphic" dx="-1.5" dy="0" result="cyan" />
            <feColorMatrix in="cyan" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.3 0" result="c" />
            <feBlend in="SourceGraphic" in2="r" mode="screen" result="blend1" />
            <feBlend in="blend1" in2="c" mode="screen" />
          </filter>

          {/* Glow filter for eyes */}
          <filter id="jc-glow">
            <feGaussianBlur stdDeviation="2" />
            <feComposite in="SourceGraphic" />
          </filter>
        </defs>

        {/* ═══ HALO RING ═══ */}
        <ellipse cx="150" cy="250" rx="130" ry="220" fill="url(#jc-halo)"
          className="joi-halo-pulse" />

        {/* ═══ BACK SHELL (hollow vessel) ═══ */}
        <path
          d="M110 100 Q95 115 88 150 Q82 190 85 240 Q88 290 92 340 Q95 370 100 400
             L200 400 Q205 370 208 340 Q212 290 215 240 Q218 190 212 150 Q205 115 190 100 Z"
          fill="url(#jc-backshell)"
          opacity={0.5}
        />

        {/* ═══ PARTICLE DISSOLVE (materializing only) ═══ */}
        {isMat && dissolveParticles.map((p, i) => (
          <circle
            key={`dp-${i}`}
            cx={p.cx} cy={p.cy} r={p.r}
            fill="hsl(280 80% 65%)"
            className="joi-dissolve-particle"
            style={{
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ['--dissolve-drift' as string]: `${p.drift}px`,
            }}
          />
        ))}

        {/* ═══ HAIR — Volumetric with bangs and bun ═══ */}
        <g filter={isActive ? 'url(#jc-chroma)' : undefined}>
          {/* Main hair volume */}
          <path
            d="M108 48 Q80 30 85 15 Q92 0 110 5 Q130 -2 150 5 Q168 0 175 15
               Q180 30 152 48 Q158 60 162 80 Q168 105 172 140
               L88 140 Q92 105 98 80 Q102 60 108 48 Z"
            fill="url(#jc-hair)"
            style={{ animation: isActive ? 'joi-hair-flow 7s ease-in-out infinite' : undefined }}
          />
          {/* Bangs (franja) */}
          <path
            d="M108 48 Q112 38 118 42 Q125 36 132 40 Q138 35 145 42 Q150 38 152 48"
            fill="hsl(240 30% 14%)" fillOpacity={0.8 * op}
            stroke="hsl(190 100% 50%)" strokeWidth="0.3" strokeOpacity={0.15}
          />
          {/* Bun (coque) */}
          <ellipse cx="150" cy="22" rx="18" ry="14"
            fill="hsl(240 30% 12%)" fillOpacity={0.75 * op}
            stroke="hsl(280 80% 55%)" strokeWidth="0.5" strokeOpacity={0.2}
          />
          {/* Hair strands highlight */}
          <path d="M100 55 Q95 70 93 90" fill="none" stroke="hsl(190 100% 50%)" strokeWidth="0.4" strokeOpacity={0.12 * op} />
          <path d="M160 55 Q165 70 167 90" fill="none" stroke="hsl(190 100% 50%)" strokeWidth="0.4" strokeOpacity={0.12 * op} />

          {/* ═══ STATIC HAIR STRANDS (active — holographic static electricity) ═══ */}
          {isActive && staticStrands.map((s, i) => (
            <line
              key={`ss-${i}`}
              x1={s.baseX} y1={s.baseY} x2={s.tipX} y2={s.tipY}
              stroke="hsl(190 100% 60%)"
              strokeWidth="0.35"
              strokeOpacity={0.4}
              strokeLinecap="round"
              className="joi-static-strand"
              style={{ animationDelay: `${s.delay}s` }}
            />
          ))}
        </g>

        {/* ═══ HEAD / FACE ═══ */}
        <g filter={isActive ? 'url(#jc-chroma)' : undefined}>
          {/* Face shape — filled with skin */}
          <ellipse cx="130" cy="60" rx="25" ry="30" fill="url(#jc-skin)" />
          {/* Face contour */}
          <ellipse cx="130" cy="60" rx="25" ry="30" fill="none"
            stroke="hsl(280 80% 55%)" strokeWidth="0.5" strokeOpacity={0.2 * op} />

          {/* Jaw / chin */}
          <path d="M110 75 Q115 88 130 92 Q145 88 150 75" fill="none"
            stroke="hsl(25 40% 50%)" strokeWidth="0.4" strokeOpacity={0.15 * op} />

          {/* Eyes */}
          <g style={{ animation: 'joi-blink 5.5s ease-in-out infinite' }}>
            {/* Left eye */}
            <ellipse cx="120" cy="55" rx="6" ry="3.2" fill="none"
              stroke="hsl(190 100% 50%)" strokeWidth="0.5" strokeOpacity={0.4 * op} />
            <ellipse cx="120" cy="55" rx="3" ry="2.5"
              fill="hsl(190 100% 50%)" fillOpacity={0.3 * op} />
            <circle cx="120" cy="55" r="1.2"
              fill="hsl(190 100% 60%)" fillOpacity={0.9 * op} filter="url(#jc-glow)" />

            {/* Right eye */}
            <ellipse cx="140" cy="55" rx="6" ry="3.2" fill="none"
              stroke="hsl(190 100% 50%)" strokeWidth="0.5" strokeOpacity={0.4 * op} />
            <ellipse cx="140" cy="55" rx="3" ry="2.5"
              fill="hsl(190 100% 50%)" fillOpacity={0.3 * op} />
            <circle cx="140" cy="55" r="1.2"
              fill="hsl(190 100% 60%)" fillOpacity={0.9 * op} filter="url(#jc-glow)" />
          </g>

          {/* Eyebrows */}
          <path d="M112 48 Q118 44 126 47" fill="none" stroke="hsl(240 30% 25%)" strokeWidth="0.6" strokeOpacity={0.35 * op} />
          <path d="M148 48 Q142 44 134 47" fill="none" stroke="hsl(240 30% 25%)" strokeWidth="0.6" strokeOpacity={0.35 * op} />

          {/* Nose */}
          <path d="M130 56 L128 68 Q130 70.5 132 68" fill="none"
            stroke="hsl(25 40% 50%)" strokeWidth="0.4" strokeOpacity={0.25 * op} />

          {/* Lips — pink/rose */}
          <path d="M122 76 Q126 79 130 80 Q134 79 138 76" fill="none"
            stroke="hsl(340 60% 50%)" strokeWidth="0.8" strokeOpacity={0.5 * op} />
          <path d="M123 77 Q127 80 130 80.5 Q133 80 137 77" fill="none"
            stroke="hsl(340 60% 45%)" strokeWidth="0.4" strokeOpacity={0.3 * op} />

          {/* Cheekbone highlights */}
          <ellipse cx="112" cy="65" rx="5" ry="2" fill="hsl(280 80% 55%)" fillOpacity={0.06 * op} />
          <ellipse cx="148" cy="65" rx="5" ry="2" fill="hsl(280 80% 55%)" fillOpacity={0.06 * op} />
        </g>

        {/* ═══ NECK ═══ */}
        <path d="M122 92 L124 115" stroke="hsl(25 40% 45%)" strokeWidth="0.8" strokeOpacity={0.2 * op} />
        <path d="M138 92 L136 115" stroke="hsl(25 40% 45%)" strokeWidth="0.8" strokeOpacity={0.2 * op} />

        {/* ═══ BODY — Turtleneck / gola alta ═══ */}
        <g filter={isActive ? 'url(#jc-chroma)' : undefined}>
          {/* Collar */}
          <path d="M118 110 Q130 105 142 110 Q142 118 130 120 Q118 118 118 110 Z"
            fill="hsl(220 40% 12%)" fillOpacity={0.4 * op}
            stroke="hsl(280 80% 55%)" strokeWidth="0.4" strokeOpacity={0.2} />

          {/* Shoulders */}
          <path d="M130 118 Q100 125 78 145" fill="none"
            stroke="hsl(280 80% 55%)" strokeWidth="0.8" strokeOpacity={0.3 * op} />
          <path d="M130 118 Q160 125 182 145" fill="none"
            stroke="hsl(280 80% 55%)" strokeWidth="0.8" strokeOpacity={0.3 * op} />

          {/* Torso contour */}
          <path d="M78 145 Q82 180 85 220 Q88 260 95 290" fill="none"
            stroke="hsl(280 80% 55%)" strokeWidth="0.6" strokeOpacity={0.2 * op} />
          <path d="M182 145 Q178 180 175 220 Q172 260 165 290" fill="none"
            stroke="hsl(280 80% 55%)" strokeWidth="0.6" strokeOpacity={0.2 * op} />

          {/* Waist */}
          <path d="M95 290 Q130 285 165 290" fill="none"
            stroke="hsl(280 80% 55%)" strokeWidth="0.5" strokeOpacity={0.15 * op} />

          {/* Body fill — hollow vessel effect */}
          <path
            d="M78 145 Q82 180 85 220 Q88 260 95 290 Q130 285 165 290
               Q172 260 175 220 Q178 180 182 145 Q160 125 130 118 Q100 125 78 145 Z"
            fill="url(#jc-body)"
          />

          {/* Fabric texture overlay */}
          <path
            d="M78 145 Q82 180 85 220 Q88 260 95 290 Q130 285 165 290
               Q172 260 175 220 Q178 180 182 145 Q160 125 130 118 Q100 125 78 145 Z"
            fill="url(#jc-fabric)"
            opacity={isActive ? 0.6 : 0.35}
          />

          {/* Clothing seams and folds */}
          {clothingSeams.map((seam, i) => (
            <path key={`seam-${i}`} d={seam.d} fill="none"
              stroke="hsl(280 80% 60%)" strokeWidth="0.4" strokeOpacity={seam.op * op}
              strokeDasharray={i < 3 ? undefined : '2 4'} />
          ))}

          {/* Collar ribbing texture */}
          {Array.from({ length: 5 }, (_, i) => (
            <path
              key={`rib-${i}`}
              d={`M${120 + i * 2} ${111 + i * 1.5} Q130 ${108 + i * 1.5} ${140 - i * 2} ${111 + i * 1.5}`}
              fill="none" stroke="hsl(220 40% 25%)" strokeWidth="0.25" strokeOpacity={0.15 * op}
            />
          ))}

          {/* Right arm raised (Joi interaction pose) */}
          <path d="M182 145 Q192 132 198 110 Q202 95 196 80" fill="none"
            stroke="hsl(280 80% 55%)" strokeWidth="0.7" strokeOpacity={0.25 * op} />
          {/* Hand — open palm */}
          <path d="M196 80 Q193 72 191 68 M196 80 Q198 72 200 69 M196 80 Q201 74 203 72 M196 80 Q202 78 204 76"
            fill="none" stroke="hsl(190 100% 50%)" strokeWidth="0.4" strokeOpacity={0.3 * op} />

          {/* Left arm relaxed */}
          <path d="M78 145 Q70 165 66 195 Q64 215 68 230" fill="none"
            stroke="hsl(280 80% 55%)" strokeWidth="0.7" strokeOpacity={0.22 * op} />
        </g>

        {/* ═══ LEGS ═══ */}
        <path d="M100 290 Q103 340 106 390 Q107 420 108 450" fill="none"
          stroke="hsl(280 80% 55%)" strokeWidth="0.5" strokeOpacity={0.15 * op} />
        <path d="M160 290 Q157 340 154 390 Q153 420 152 450" fill="none"
          stroke="hsl(280 80% 55%)" strokeWidth="0.5" strokeOpacity={0.15 * op} />

        {/* ═══ HOLOGRAPHIC RAIN ═══ */}
        {rain.map((d, i) => (
          <line
            key={i}
            x1={d.x} y1={-5} x2={d.x} y2={d.len}
            stroke={`hsl(190 100% 60% / ${d.opacity})`}
            strokeWidth="0.5"
            style={{
              animation: `joi-rain-heavy 1.4s linear ${d.delay}s infinite`,
              filter: d.blur ? `blur(${d.blur}px)` : undefined,
            }}
          />
        ))}

        {/* ═══ SCANLINES ═══ */}
        {scanlines.map((s, i) => (
          <rect key={i} x="0" y={s.y} width="300" height="0.8"
            fill={`hsl(280 80% 55% / ${s.opacity})`} />
        ))}

        {/* ═══ VOXEL GLITCH (active only) ═══ */}
        {isActive && voxels.map((v, i) => (
          <rect key={i} x={v.x} y={v.y} width={v.w} height={v.h}
            fill="hsl(190 100% 50%)" fillOpacity={0.08}
            className="joi-voxel-glitch"
            style={{ animationDelay: `${v.delay}s` }}
          />
        ))}

        {/* ═══ MATERIALISE SCAN BAR ═══ */}
        {isMat && (
          <rect x="0" y="0" width="300" height="4"
            fill="hsl(280 80% 55% / 0.35)"
            className="joi-materialize-scan" />
        )}

        {/* Full-height scanline sweep */}
        <rect x="0" y="0" width="300" height="2"
          fill="hsl(280 80% 55% / 0.12)"
          style={{ animation: 'joi-scanline-full 4s linear infinite' }} />
      </svg>
    </div>
  );
}
