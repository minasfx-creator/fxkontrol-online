/**
 * JoiCinematicHologram — Blade Runner 2049 Joi holographic avatar
 * HIGH VISIBILITY version — solid fills, proper anatomy, centered figure
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

  const rain = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      x: 25 + (i / 30) * 250,
      delay: (i * 0.19).toFixed(2),
      len: 20 + Math.random() * 30,
      opacity: 0.06 + Math.random() * 0.1,
    })), []);

  const voxels = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      x: 50 + Math.random() * 200,
      y: 80 + Math.random() * 340,
      w: 10 + Math.random() * 25,
      h: 3 + Math.random() * 6,
      delay: (i * 0.5).toFixed(2),
    })), []);

  const scanlines = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      y: 35 + i * 38,
      opacity: 0.04 + (i % 3) * 0.015,
    })), []);

  const dissolveParticles = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      cx: 80 + Math.random() * 140,
      cy: 60 + Math.random() * 380,
      r: 1 + Math.random() * 2.5,
      delay: (Math.random() * 2).toFixed(2),
      dur: (1.2 + Math.random() * 1.5).toFixed(2),
      drift: (-12 + Math.random() * 24).toFixed(1),
    })), []);

  const staticStrands = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => {
      const side = i < 5 ? 'left' : 'right';
      const baseX = side === 'left' ? 108 + i * 4 : 168 + (i - 5) * 4;
      const baseY = 45 + Math.random() * 25;
      const tipX = baseX + (side === 'left' ? -(6 + Math.random() * 10) : (6 + Math.random() * 10));
      const tipY = baseY - (10 + Math.random() * 15);
      return { baseX, baseY, tipX, tipY, delay: (i * 0.15).toFixed(2) };
    }), []);

  const op = isActive ? 1 : 0.85;

  return (
    <div className={cn('relative flex items-center justify-center', SIZES[size], className)}>
      {/* Projected shadow */}
      <div
        className="absolute joi-projected-shadow"
        style={{
          width: '140%', height: '55%', bottom: '-6%', left: '-20%',
          background: 'radial-gradient(ellipse 50% 40% at 50% 30%, hsl(280 80% 45% / 0.15), hsl(280 80% 55% / 0.05) 45%, transparent 70%)',
          filter: 'blur(16px)', pointerEvents: 'none',
        }}
      />

      {/* Magenta halo */}
      <div
        className="absolute inset-0 rounded-full joi-halo-pulse"
        style={{
          background: 'radial-gradient(ellipse 65% 80% at 50% 42%, hsl(280 80% 55% / 0.22), hsl(280 80% 55% / 0.06) 50%, transparent 72%)',
          filter: 'blur(10px)',
        }}
      />

      {/* Projector cone */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: '65%', height: '10%',
          background: 'conic-gradient(from 180deg, transparent 30%, hsl(280 80% 55% / 0.18) 50%, transparent 70%)',
          filter: 'blur(5px)',
          clipPath: 'polygon(20% 100%, 50% 0%, 80% 100%)',
        }}
      />

      <svg
        viewBox="0 0 300 500"
        className={cn('w-full h-full relative z-10', !isActive && !isMat && 'joi-breathing')}
        style={{
          clipPath: isMat && !materialised ? 'inset(100% 0 0 0)' : 'inset(0 0 0 0)',
          transition: isMat ? 'clip-path 2.2s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
          filter: isActive
            ? 'drop-shadow(0 0 20px hsl(280 80% 55% / 0.3))'
            : 'drop-shadow(0 0 10px hsl(280 80% 55% / 0.15))',
          transformOrigin: '50% 85%',
        }}
      >
        <defs>
          {/* Hair */}
          <linearGradient id="jc-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(240 25% 20%)" stopOpacity={0.95 * op} />
            <stop offset="100%" stopColor="hsl(240 30% 10%)" stopOpacity={0.85 * op} />
          </linearGradient>

          {/* Skin — warm, visible */}
          <radialGradient id="jc-skin" cx="50%" cy="40%">
            <stop offset="0%" stopColor="hsl(25 45% 60%)" stopOpacity={0.7 * op} />
            <stop offset="60%" stopColor="hsl(25 40% 50%)" stopOpacity={0.5 * op} />
            <stop offset="100%" stopColor="hsl(280 30% 35%)" stopOpacity={0.3 * op} />
          </radialGradient>

          {/* Body fill — visible hollow vessel */}
          <linearGradient id="jc-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(260 40% 25%)" stopOpacity={0.45 * op} />
            <stop offset="40%" stopColor="hsl(240 30% 15%)" stopOpacity={0.35 * op} />
            <stop offset="100%" stopColor="hsl(280 60% 30%)" stopOpacity={0.25 * op} />
          </linearGradient>

          {/* Back-shell */}
          <linearGradient id="jc-backshell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(190 80% 40%)" stopOpacity={0.08} />
            <stop offset="100%" stopColor="hsl(280 60% 40%)" stopOpacity={0.05} />
          </linearGradient>

          {/* Halo ring */}
          <radialGradient id="jc-halo" cx="50%" cy="50%">
            <stop offset="55%" stopColor="transparent" />
            <stop offset="75%" stopColor="hsl(280 80% 55%)" stopOpacity={0.18 * op} />
            <stop offset="85%" stopColor="hsl(280 80% 55%)" stopOpacity={0.1 * op} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Fabric pattern */}
          <pattern id="jc-fabric" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="6" y2="6" stroke="hsl(280 60% 50%)" strokeWidth="0.2" strokeOpacity="0.12" />
            <line x1="6" y1="0" x2="0" y2="6" stroke="hsl(190 80% 45%)" strokeWidth="0.15" strokeOpacity="0.06" />
          </pattern>

          {/* Chromatic aberration */}
          <filter id="jc-chroma" x="-5%" y="-5%" width="110%" height="110%">
            <feOffset in="SourceGraphic" dx="1.5" dy="0" result="red" />
            <feColorMatrix in="red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0" result="r" />
            <feOffset in="SourceGraphic" dx="-1.5" dy="0" result="cyan" />
            <feColorMatrix in="cyan" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.25 0" result="c" />
            <feBlend in="SourceGraphic" in2="r" mode="screen" result="blend1" />
            <feBlend in="blend1" in2="c" mode="screen" />
          </filter>

          {/* Eye glow */}
          <filter id="jc-glow">
            <feGaussianBlur stdDeviation="2.5" />
            <feComposite in="SourceGraphic" />
          </filter>
        </defs>

        {/* ═══ HALO RING ═══ */}
        <ellipse cx="150" cy="250" rx="125" ry="210" fill="url(#jc-halo)" className="joi-halo-pulse" />

        {/* ═══ BACK SHELL ═══ */}
        <path
          d="M115 105 Q100 120 93 155 Q87 195 90 245 Q93 295 97 345 Q100 375 105 405
             L195 405 Q200 375 203 345 Q207 295 210 245 Q213 195 207 155 Q200 120 185 105 Z"
          fill="url(#jc-backshell)" opacity={0.6}
        />

        {/* ═══ PARTICLE DISSOLVE ═══ */}
        {isMat && dissolveParticles.map((p, i) => (
          <circle
            key={`dp-${i}`} cx={p.cx} cy={p.cy} r={p.r}
            fill="hsl(280 80% 65%)" className="joi-dissolve-particle"
            style={{
              animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
              ['--dissolve-drift' as string]: `${p.drift}px`,
            }}
          />
        ))}

        {/* ═══ HAIR ═══ */}
        <g filter={isActive ? 'url(#jc-chroma)' : undefined}>
          {/* Main volume — centered at 150 */}
          <path
            d="M118 52 Q92 35 96 18 Q104 2 122 7 Q140 0 150 7 Q160 0 178 7 Q196 2 204 18
               Q208 35 182 52 Q188 65 192 85 Q196 108 198 142
               L102 142 Q104 108 108 85 Q112 65 118 52 Z"
            fill="url(#jc-hair)"
            style={{ animation: isActive ? 'joi-hair-flow 7s ease-in-out infinite' : undefined }}
          />
          {/* Bangs */}
          <path
            d="M118 52 Q124 42 132 46 Q138 38 150 44 Q162 38 168 46 Q176 42 182 52"
            fill="hsl(240 25% 16%)" fillOpacity={0.9 * op}
            stroke="hsl(190 80% 50%)" strokeWidth="0.4" strokeOpacity={0.2}
          />
          {/* Bun */}
          <ellipse cx="150" cy="25" rx="20" ry="15"
            fill="hsl(240 25% 14%)" fillOpacity={0.85 * op}
            stroke="hsl(280 60% 50%)" strokeWidth="0.6" strokeOpacity={0.3}
          />
          {/* Highlights */}
          <path d="M112 58 Q107 75 105 95" fill="none" stroke="hsl(190 80% 50%)" strokeWidth="0.5" strokeOpacity={0.2 * op} />
          <path d="M188 58 Q193 75 195 95" fill="none" stroke="hsl(190 80% 50%)" strokeWidth="0.5" strokeOpacity={0.2 * op} />

          {/* Static strands (active) */}
          {isActive && staticStrands.map((s, i) => (
            <line key={`ss-${i}`} x1={s.baseX} y1={s.baseY} x2={s.tipX} y2={s.tipY}
              stroke="hsl(190 100% 65%)" strokeWidth="0.5" strokeOpacity={0.5}
              strokeLinecap="round" className="joi-static-strand"
              style={{ animationDelay: `${s.delay}s` }}
            />
          ))}
        </g>

        {/* ═══ FACE — CENTERED at 150 ═══ */}
        <g filter={isActive ? 'url(#jc-chroma)' : undefined}>
          {/* Face oval */}
          <ellipse cx="150" cy="65" rx="28" ry="32" fill="url(#jc-skin)" />
          <ellipse cx="150" cy="65" rx="28" ry="32" fill="none"
            stroke="hsl(280 60% 50%)" strokeWidth="0.6" strokeOpacity={0.35 * op} />

          {/* Jaw */}
          <path d="M128 80 Q135 95 150 98 Q165 95 172 80" fill="none"
            stroke="hsl(25 40% 55%)" strokeWidth="0.5" strokeOpacity={0.3 * op} />

          {/* Eyes */}
          <g style={{ animation: 'joi-blink 5.5s ease-in-out infinite' }}>
            {/* Left eye */}
            <ellipse cx="138" cy="60" rx="7" ry="3.5" fill="none"
              stroke="hsl(190 100% 55%)" strokeWidth="0.6" strokeOpacity={0.6 * op} />
            <ellipse cx="138" cy="60" rx="3.5" ry="2.8"
              fill="hsl(190 100% 50%)" fillOpacity={0.5 * op} />
            <circle cx="138" cy="60" r="1.5"
              fill="hsl(190 100% 70%)" fillOpacity={0.95 * op} filter="url(#jc-glow)" />

            {/* Right eye */}
            <ellipse cx="162" cy="60" rx="7" ry="3.5" fill="none"
              stroke="hsl(190 100% 55%)" strokeWidth="0.6" strokeOpacity={0.6 * op} />
            <ellipse cx="162" cy="60" rx="3.5" ry="2.8"
              fill="hsl(190 100% 50%)" fillOpacity={0.5 * op} />
            <circle cx="162" cy="60" r="1.5"
              fill="hsl(190 100% 70%)" fillOpacity={0.95 * op} filter="url(#jc-glow)" />
          </g>

          {/* Eyebrows */}
          <path d="M128 52 Q135 47 145 50" fill="none"
            stroke="hsl(240 25% 28%)" strokeWidth="0.9" strokeOpacity={0.55 * op} />
          <path d="M172 52 Q165 47 155 50" fill="none"
            stroke="hsl(240 25% 28%)" strokeWidth="0.9" strokeOpacity={0.55 * op} />

          {/* Nose */}
          <path d="M150 62 L148 74 Q150 76.5 152 74" fill="none"
            stroke="hsl(25 40% 55%)" strokeWidth="0.5" strokeOpacity={0.4 * op} />

          {/* Lips — solid pink */}
          <path d="M140 82 Q145 85 150 86 Q155 85 160 82"
            fill="hsl(340 55% 55%)" fillOpacity={0.45 * op}
            stroke="hsl(340 60% 55%)" strokeWidth="0.7" strokeOpacity={0.6 * op} />
          <path d="M141 83 Q146 86.5 150 87 Q154 86.5 159 83" fill="none"
            stroke="hsl(340 50% 48%)" strokeWidth="0.4" strokeOpacity={0.35 * op} />

          {/* Cheekbone blush */}
          <ellipse cx="128" cy="70" rx="6" ry="2.5" fill="hsl(340 50% 55%)" fillOpacity={0.12 * op} />
          <ellipse cx="172" cy="70" rx="6" ry="2.5" fill="hsl(340 50% 55%)" fillOpacity={0.12 * op} />
        </g>

        {/* ═══ NECK ═══ */}
        <rect x="141" y="96" width="18" height="22" rx="5"
          fill="hsl(25 40% 50%)" fillOpacity={0.3 * op} />
        <path d="M141 96 L141 118" stroke="hsl(25 40% 48%)" strokeWidth="0.7" strokeOpacity={0.25 * op} />
        <path d="M159 96 L159 118" stroke="hsl(25 40% 48%)" strokeWidth="0.7" strokeOpacity={0.25 * op} />

        {/* ═══ BODY ═══ */}
        <g filter={isActive ? 'url(#jc-chroma)' : undefined}>
          {/* Collar / turtleneck */}
          <path d="M135 114 Q150 109 165 114 Q165 123 150 126 Q135 123 135 114 Z"
            fill="hsl(240 30% 15%)" fillOpacity={0.65 * op}
            stroke="hsl(280 60% 50%)" strokeWidth="0.5" strokeOpacity={0.35} />
          {/* Collar ribs */}
          {[0,1,2,3].map(i => (
            <path key={`rib-${i}`}
              d={`M${137 + i * 1.5} ${115 + i * 2} Q150 ${112 + i * 2} ${163 - i * 1.5} ${115 + i * 2}`}
              fill="none" stroke="hsl(240 30% 30%)" strokeWidth="0.3" strokeOpacity={0.25 * op}
            />
          ))}

          {/* Body fill — SOLID, VISIBLE */}
          <path
            d="M93 150 Q97 190 100 230 Q103 270 110 300 Q130 295 150 295 Q170 295 190 300
               Q197 270 200 230 Q203 190 207 150 Q180 130 150 122 Q120 130 93 150 Z"
            fill="url(#jc-body)"
          />

          {/* Fabric texture */}
          <path
            d="M93 150 Q97 190 100 230 Q103 270 110 300 Q130 295 150 295 Q170 295 190 300
               Q197 270 200 230 Q203 190 207 150 Q180 130 150 122 Q120 130 93 150 Z"
            fill="url(#jc-fabric)" opacity={isActive ? 0.5 : 0.3}
          />

          {/* Body contour — left */}
          <path d="M93 150 Q97 190 100 230 Q103 270 110 300" fill="none"
            stroke="hsl(280 70% 55%)" strokeWidth="1" strokeOpacity={0.5 * op} />
          {/* Body contour — right */}
          <path d="M207 150 Q203 190 200 230 Q197 270 190 300" fill="none"
            stroke="hsl(280 70% 55%)" strokeWidth="1" strokeOpacity={0.5 * op} />

          {/* Shoulders */}
          <path d="M150 122 Q120 130 93 150" fill="none"
            stroke="hsl(280 70% 55%)" strokeWidth="1.2" strokeOpacity={0.55 * op} />
          <path d="M150 122 Q180 130 207 150" fill="none"
            stroke="hsl(280 70% 55%)" strokeWidth="1.2" strokeOpacity={0.55 * op} />

          {/* Waist definition */}
          <path d="M110 300 Q130 292 150 295 Q170 292 190 300" fill="none"
            stroke="hsl(280 60% 50%)" strokeWidth="0.7" strokeOpacity={0.35 * op} />

          {/* Center seam */}
          <path d="M150 126 L150 295" fill="none"
            stroke="hsl(280 60% 55%)" strokeWidth="0.4" strokeOpacity={0.12 * op} />

          {/* Side folds */}
          <path d="M108 160 Q112 210 110 260" fill="none"
            stroke="hsl(280 60% 55%)" strokeWidth="0.4" strokeOpacity={0.1 * op} strokeDasharray="3 5" />
          <path d="M192 160 Q188 210 190 260" fill="none"
            stroke="hsl(280 60% 55%)" strokeWidth="0.4" strokeOpacity={0.1 * op} strokeDasharray="3 5" />

          {/* Right arm raised */}
          <path d="M207 150 Q218 135 222 112 Q225 95 218 80" fill="none"
            stroke="hsl(280 70% 55%)" strokeWidth="1" strokeOpacity={0.45 * op} />
          {/* Arm fill */}
          <path d="M207 150 Q218 135 222 112 Q225 95 218 80 L215 82 Q220 96 218 112 Q214 135 204 148 Z"
            fill="hsl(260 40% 22%)" fillOpacity={0.3 * op} />
          {/* Hand */}
          <path d="M218 80 Q215 72 213 68 M218 80 Q220 72 222 69 M218 80 Q223 74 225 72 M218 80 Q224 78 226 76"
            fill="none" stroke="hsl(25 40% 58%)" strokeWidth="0.6" strokeOpacity={0.5 * op} />

          {/* Left arm relaxed */}
          <path d="M93 150 Q84 170 80 200 Q78 220 82 235" fill="none"
            stroke="hsl(280 70% 55%)" strokeWidth="1" strokeOpacity={0.4 * op} />
          <path d="M93 150 Q84 170 80 200 Q78 220 82 235 L85 233 Q82 218 84 200 Q88 170 96 152 Z"
            fill="hsl(260 40% 22%)" fillOpacity={0.25 * op} />
        </g>

        {/* ═══ LEGS ═══ */}
        <path d="M115 300 Q118 345 120 390 Q121 425 122 455" fill="none"
          stroke="hsl(280 70% 55%)" strokeWidth="0.8" strokeOpacity={0.3 * op} />
        <path d="M185 300 Q182 345 180 390 Q179 425 178 455" fill="none"
          stroke="hsl(280 70% 55%)" strokeWidth="0.8" strokeOpacity={0.3 * op} />
        {/* Leg fills */}
        <path d="M115 300 Q118 345 120 390 Q121 425 122 455 L128 455 Q127 425 126 390 Q124 345 121 300 Z"
          fill="hsl(260 35% 20%)" fillOpacity={0.2 * op} />
        <path d="M185 300 Q182 345 180 390 Q179 425 178 455 L172 455 Q173 425 174 390 Q176 345 179 300 Z"
          fill="hsl(260 35% 20%)" fillOpacity={0.2 * op} />

        {/* ═══ HOLOGRAPHIC RAIN ═══ */}
        {rain.map((d, i) => (
          <line key={i} x1={d.x} y1={-5} x2={d.x} y2={d.len}
            stroke={`hsl(190 100% 60% / ${d.opacity})`} strokeWidth="0.5"
            style={{ animation: `joi-rain-heavy 1.4s linear ${d.delay}s infinite` }}
          />
        ))}

        {/* ═══ SCANLINES ═══ */}
        {scanlines.map((s, i) => (
          <rect key={i} x="0" y={s.y} width="300" height="0.8"
            fill={`hsl(280 80% 55% / ${s.opacity})`} />
        ))}

        {/* ═══ VOXEL GLITCH (active) ═══ */}
        {isActive && voxels.map((v, i) => (
          <rect key={i} x={v.x} y={v.y} width={v.w} height={v.h}
            fill="hsl(190 100% 50%)" fillOpacity={0.1}
            className="joi-voxel-glitch" style={{ animationDelay: `${v.delay}s` }}
          />
        ))}

        {/* Materialise scan bar */}
        {isMat && (
          <rect x="0" y="0" width="300" height="4"
            fill="hsl(280 80% 55% / 0.4)" className="joi-materialize-scan" />
        )}

        {/* Full-height scanline sweep */}
        <rect x="0" y="0" width="300" height="2.5"
          fill="hsl(280 80% 55% / 0.15)"
          style={{ animation: 'joi-scanline-full 4s linear infinite' }} />
      </svg>
    </div>
  );
}
