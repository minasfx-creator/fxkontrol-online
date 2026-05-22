import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackReleaseEnvelope, temporalFlicker, combustionFlicker, hash01, thermalColorRamp } from '@/lib/pyroNoise';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';
import { useProjectStore } from '@/store/useProjectStore';
import { readDensityAt, injectDensity, injectVelocity, type FluidGrid } from '@/render_ultra/fireworks/niagaraFluids';
import { getChemistryForRendering, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';
import { resolveMinePresetProps } from '@/data/finalePresets';
import { selectMineSilhouette } from '@/render/silhouettes/mineSilhouettes';
import { isEnabled } from '@/lib/featureFlags';
import { getFwsimGraphics, sampleCurve } from '@/data/fwsimGraphicsConfig';
import { getFwsimSmokeTexture } from '@/render/textures/fwsimSmokeTexture';

/**
 * Mine Effect — Multi-phase ground burst (PyroJam 2026 reference)
 * Phase 1: Column jet (narrow 5-15° cone, white-hot, fast)
 * Phase 2: Spray stars (wide 30-80° hemisphere, colored, jittered lifetime)
 * Phase 3: Drip sparks (low velocity, fall back, charcoal/titanium)
 * + Ground smoke plume expanding radially
 */

// Particle class boundaries (index ranges)
const COLUMN_FRAC = 0.28;
const SPRAY_FRAC = 0.60; // 20-80%
const DRIP_FRAC = 0.10;  // 80-90%
const BOUNCE_FRAC = 0.10; // 90-100% — ground bounce sparks

const SMOKE_COUNT = 40;

export type MinePattern = 'omni' | 'fan' | 'v';

export default function MineEffect({
  position,
  color,
  progress,
  caliber = 3,
  angleOffset = 0,
  heightMeters,
  formulationId,
  launchHeading = 0,
  launchPitch = 85,
  pattern = 'fan',
  presetId,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
  angleOffset?: number;
  heightMeters?: number;
  formulationId?: string;
  launchHeading?: number;
  launchPitch?: number;
  pattern?: MinePattern;
  /** Canonical Finale Mine preset id (rev5–7). Overrides body color and applies tail strobe. */
  presetId?: string;
}) {
  // Resolve canonical Finale Mine preset (rev5–7). Overrides body color and
  // tail strobe. Geometry/lifetime/count remain renderer-driven for now.
  const preset = useMemo(
    () => (presetId ? resolveMinePresetProps(presetId) : undefined),
    [presetId],
  );
  const effectiveColor = preset?.color ?? color;
  const tailStrobeHz = preset?.strobeHz ?? 0;

  const count = useMemo(() => Math.min(600, Math.round(200 + caliber * caliber * 14)), [caliber]);
  const pointsRef = useRef<THREE.Points>(null);
  const smokePointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.LineSegments>(null);
  const posRef = useMemo(() => new Float32Array(count * 3), [count]);
  const colRef = useMemo(() => new Float32Array(count * 3), [count]);
  const sizeRef = useMemo(() => new Float32Array(count), [count]);
  const injectedRef = useRef(false);

  // Smoke buffers (zero-GC)
  const smokePosRef = useMemo(() => new Float32Array(SMOKE_COUNT * 3), []);
  const smokeColRef = useMemo(() => new Float32Array(SMOKE_COUNT * 3), []);
  const smokeSizeRef = useMemo(() => new Float32Array(SMOKE_COUNT), []);

  // Chemistry-enhanced color: use formulation if available, else auto-match by color+type
  const chemistry = useMemo(() => {
    const fId = formulationId || autoMatchFormulation(effectiveColor, 'mine', caliber);
    return fId ? getChemistryForRendering(fId) : null;
  }, [formulationId, effectiveColor, caliber]);

  const baseColor = useMemo(() => {
    if (chemistry?.resultColor) return chemistry.resultColor.clone();
    return new THREE.Color(effectiveColor);
  }, [effectiveColor, chemistry]);
  const emberColor = useMemo(() => new THREE.Color().setHSL(0.05, 0.8, 0.12), []);
  const charcoalColor = useMemo(() => new THREE.Color(0.15, 0.08, 0.03), []);

  // Particle class indices
  const columnEnd = useMemo(() => Math.floor(count * COLUMN_FRAC), [count]);
  const sprayEnd = useMemo(() => Math.floor(count * (COLUMN_FRAC + SPRAY_FRAC)), [count]);
  const dripEnd = useMemo(() => Math.floor(count * (COLUMN_FRAC + SPRAY_FRAC + DRIP_FRAC)), [count]);
  
  // Trail buffers for spray comet trails
  const TRAIL_SEGS = 5;
  const sprayCount = sprayEnd - columnEnd;
  const trailPosRef = useMemo(() => new Float32Array(sprayCount * TRAIL_SEGS * 6), [sprayCount]);
  const trailColRef = useMemo(() => new Float32Array(sprayCount * TRAIL_SEGS * 6), [sprayCount]);

  // Silhouette-driven jet allocation (FWsim Mine_01/02/03 vectors).
  // When enabled, spray particles cluster around N discrete azimuthal jets +
  // a denser ground crown — matches the FWsim leque reference instead of
  // a uniform 360° hemisphere.
  const silhouette = useMemo(
    () => (isEnabled('r_silhouette_mines') ? selectMineSilhouette({ caliber, numDevices: 1 }) : null),
    [caliber],
  );

  const { velocities, lifetimes, sparkleSeeds, particleSizes, smokeSeeds } = useMemo(() => {
    const v = new Float32Array(count * 3);
    const l = new Float32Array(count);
    const s = new Float32Array(count);
    const ps = new Float32Array(count);
    const ss = new Float32Array(SMOKE_COUNT);

    const jets = silhouette?.jetAnglesDeg ?? null;
    const jitterRad = silhouette ? (silhouette.jitterDeg * Math.PI) / 180 : 0;
    const crownEnd = silhouette
      ? Math.floor(count * (COLUMN_FRAC + SPRAY_FRAC * silhouette.crownRatio))
      : -1;

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;

      // Pattern-aware azimuth: 'fan' = 360° around vertical (single tight upward cone),
      // 'v' = two opposite leques (split into 2 lateral cones), 'omni' = original hemisphere.
      let azTheta = theta;
      if (pattern === 'v') {
        // Bias to two opposite arcs ±60° around horizontal axis
        const side = Math.random() < 0.5 ? -1 : 1;
        azTheta = side * (Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 3);
      }

      if (i < Math.floor(count * COLUMN_FRAC)) {
        // Column particles: narrow cone (5-15°), high velocity
        const upAngle = 0.05 + Math.random() * 0.17;
        const speed = (15 + Math.random() * 22 + caliber * 5) * 1.5;
        v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
        v[i * 3 + 1] = Math.cos(upAngle) * speed + 3;
        v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
        l[i] = 0.18 + Math.random() * 0.25;
        ps[i] = 0.55;
      } else if (i < Math.floor(count * (COLUMN_FRAC + SPRAY_FRAC))) {
        // Spray particles: cone width depends on pattern
        // fan/v: tight upward cone ~30°±10° (FWsim look — discrete bright stars rising in a leque)
        // omni:  wide hemisphere 30-80° (legacy ground burst)
        // Silhouette mode: snap to one of N jet azimuths SIMÉTRICAS em 360°
        // ao redor do eixo Y (não front-fan unilateral), preservando count+jitter.
        if (silhouette && i < crownEnd) {
          // Crown burst: low + wide, short lifetime
          const upAngle = 0.95 + Math.random() * 0.45; // ~55–80° from vertical
          const speed = 6 + Math.random() * 8 + caliber * 2;
          v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
          v[i * 3 + 1] = Math.cos(upAngle) * speed + 1.4;
          v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
          l[i] = silhouette.crownLifetimeS * (0.7 + Math.random() * 0.6);
          ps[i] = 0.6 + Math.random() * 0.4;
        } else {
          let jetAzRad: number;
          if (jets && jets.length > 0) {
            // Distribui jets simetricamente ao redor de 360° → fan radial vertical
            // em vez de leque frontal (-50°..+50°), eliminando o "sempre angulado".
            const N = jets.length;
            const jetIdx = (i - Math.floor(count * COLUMN_FRAC)) % N;
            jetAzRad = (jetIdx / N) * Math.PI * 2
                     + (Math.random() - 0.5) * 2 * jitterRad;
          } else {
            jetAzRad = azTheta;
          }
          const upAngle = pattern === 'omni'
            ? 0.35 + Math.random() * 0.85
            : 0.30 + Math.random() * 0.35; // ~17–37° from vertical
          const speed = 10 + Math.random() * 18 + caliber * 4;
          v[i * 3] = Math.cos(jetAzRad) * Math.sin(upAngle) * speed;
          v[i * 3 + 1] = Math.cos(upAngle) * speed + 2;
          v[i * 3 + 2] = Math.sin(jetAzRad) * Math.sin(upAngle) * speed;
          l[i] = (0.4 + Math.random() * 1.0) * (0.6 + Math.random() * 0.8);
          ps[i] = 0.8 + Math.random() * 1.0;
        }
      } else if (i < Math.floor(count * (COLUMN_FRAC + SPRAY_FRAC + DRIP_FRAC))) {
        // Drip particles: low velocity, high drag, fall back
        const upAngle = 0.1 + Math.random() * 0.5;
        const speed = 3 + Math.random() * 3;
        v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
        v[i * 3 + 1] = Math.cos(upAngle) * speed + 1;
        v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
        l[i] = 0.8 + Math.random() * 1.5;
        ps[i] = 1.2;
      } else {
        // Bounce sparks: lateral spread, low height, delayed spawn
        const speed = 1 + Math.random() * 2.5;
        v[i * 3] = Math.cos(theta) * speed;
        v[i * 3 + 1] = 0.5 + Math.random() * 1.5;
        v[i * 3 + 2] = Math.sin(theta) * speed;
        l[i] = 0.15 + Math.random() * 0.35;
        ps[i] = 0.4 + Math.random() * 0.3;
      }

      s[i] = Math.random() * 999 + i;
    }

    // Smoke seeds
    for (let i = 0; i < SMOKE_COUNT; i++) {
      ss[i] = Math.random() * 999 + i;
    }

    return { velocities: v, lifetimes: l, sparkleSeeds: s, particleSizes: ps, smokeSeeds: ss };
  }, [count, caliber, columnEnd, sprayEnd, pattern, silhouette]);

  // Smoke initial velocities (radial expansion)
  const smokeVelocities = useMemo(() => {
    const sv = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      sv[i * 3] = Math.cos(theta) * speed;
      sv[i * 3 + 1] = 0.1 + Math.random() * 0.3;
      sv[i * 3 + 2] = Math.sin(theta) * speed;
    }
    return sv;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const geo = pointsRef.current.geometry;
    const posArr = posRef;
    const colArr = colRef;
    const sizeArr = sizeRef;
    const t = progress * 2.5;
    const GRAV = -9.81;
    const time = clock.getElapsedTime();
    const envelope = attackReleaseEnvelope(progress, 0.015, 0.55, 3.2);

    // Wind integration — mines are heavy ground spray (fast burn, dense ejecta).
    // Real-world wind tilts the smoke column, NOT the bright jets. The previous
    // coefficient (0.08) caused every burst to drift in the same direction →
    // user reported "todas tombadas pro mesmo lado". Drop to 0.012 so the jets
    // stay vertical-symmetric and only smoke/drips show a subtle lean.
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.012 : 0;
    const windZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.012 : 0;

    // Inject density into fluid grid on burst (once)
    const fluidGrid = (window as any).__niagaraFluidGrid as FluidGrid | undefined;
    if (fluidGrid && progress > 0.01 && progress < 0.1 && !injectedRef.current) {
      injectDensity(fluidGrid, position[0], position[2], 3.0 * caliber, caliber * 2);
      injectVelocity(fluidGrid, position[0], position[2], 0, -2, caliber * 2);
      injectedRef.current = true;
    }
    if (progress <= 0) injectedRef.current = false;

    const fluidDensity = fluidGrid ? readDensityAt(fluidGrid, position[0], position[2]) : 0;
    const smokeBoost = 1 + fluidDensity * 0.3;

    const basePointSize = 0.18 + caliber * 0.04;

    for (let i = 0; i < count; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const age = progress / lt;
      const fade = Math.max(0, 1 - age);
      const fadeSq = fade * fade;

      const isColumn = i < columnEnd;
      const isDrip = i >= sprayEnd && i < dripEnd;
      const isBounce = i >= dripEnd;

      // Bounce sparks: delayed spawn — appear when main particles hit ground (~30% progress)
      if (isBounce) {
        const bounceDelay = 0.25 + hash01(sparkleSeeds[i]) * 0.2;
        if (progress < bounceDelay) {
          colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
          sizeArr[i] = 0;
          continue;
        }
        const bounceAge = (progress - bounceDelay) / Math.max(0.01, lt);
        const bounceFade = Math.max(0, 1 - bounceAge * 3);
        const bt = (progress - bounceDelay) * 2.5;
        const bDrag = Math.exp(-0.12 * bt);
        posArr[i * 3] = vx * bt * bDrag + windX * bt * bt * 0.3;
        posArr[i * 3 + 1] = Math.max(0, vy * bt * bDrag + 0.5 * GRAV * bt * bt);
        posArr[i * 3 + 2] = vz * bt * bDrag + windZ * bt * bt * 0.3;
        // Amber/orange bounce spark color
        const sparkTwinkle = combustionFlicker(sparkleSeeds[i], time, 1.8);
        colArr[i * 3] = 0.9 * bounceFade * sparkTwinkle * envelope;
        colArr[i * 3 + 1] = 0.35 * bounceFade * sparkTwinkle * envelope;
        colArr[i * 3 + 2] = 0.05 * bounceFade * sparkTwinkle * envelope;
        sizeArr[i] = basePointSize * particleSizes[i] * bounceFade;
        continue;
      }

      // Column: visible in first 15% of progress
      if (isColumn && progress > 0.15) {
        // Column particles fade fast after initial jet
        const columnFade = Math.max(0, 1 - (progress - 0.05) / 0.15);
        if (columnFade <= 0) {
          colArr[i * 3] = 0;
          colArr[i * 3 + 1] = 0;
          colArr[i * 3 + 2] = 0;
          sizeArr[i] = 0;
          continue;
        }
      }

      // Drips have higher drag
      const dragCoeff = isDrip ? 0.08 : (isColumn ? 0.02 : 0.04);
      const dragH = Math.exp(-dragCoeff * t);
      const dragV = Math.exp(-(dragCoeff * 0.75) * t);

      const rawY = vy * t * dragV + 0.5 * GRAV * t * t;
      const bounced = rawY < 0;
      const restitution = isDrip ? 0.05 : 0.2;

      posArr[i * 3] = vx * t * dragH + windX * t * t * 0.5;
      posArr[i * 3 + 1] = bounced ? Math.abs(rawY) * restitution : rawY;
      posArr[i * 3 + 2] = vz * t * dragH + windZ * t * t * 0.5;

      // Combustion flicker for column particles, temporal for spray/drips.
      // When a Finale Mine preset declares a tail strobeHz (e.g. Gold Glitter
      // 29.4 Hz), we modulate the spray twinkle by a square-wave at that rate
      // so the canonical strobe character is visible.
      let twinkle = isColumn
        ? combustionFlicker(sparkleSeeds[i], time, 1.2)
        : temporalFlicker(sparkleSeeds[i], time, 0.6, 0.34, 0.36);
      if (!isColumn && tailStrobeHz > 0) {
        const phase = (time * tailStrobeHz + sparkleSeeds[i] * 0.137) % 1;
        const strobeGate = phase < 0.5 ? 1 : 0.35;
        twinkle *= strobeGate;
      }

      const flashIntensity = Math.max(0, 1 - progress * 15);
      const emberPhase = Math.max(0, (progress - 0.35) / 0.65);

      let r: number, g: number, b: number;

      if (isColumn) {
        // Column: white-hot → base using thermal ramp (very early life)
        // Flash compounds (aluminum/flash) use isFlash path for 80% white-hot phase
        const colLife = Math.min(1, progress * 8);
        const isFlashCompound = color.toLowerCase().includes('flash') || color === '#FFFFFF' || color === '#ffffff';
        const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, colLife * 0.3, 2.0, isFlashCompound);
        r = thermal.r;
        g = thermal.g;
        b = thermal.b;
      } else if (isDrip) {
        // Drip: thermal ramp with ember transition on ground bounce
        const dripLife = Math.min(1, age * 1.5);
        const thermal = thermalColorRamp(0.9, 0.35, 0.08, dripLife * 0.6 + 0.4, 0.8);
        if (bounced) {
          const emberMix = Math.min(1, Math.abs(rawY) * 0.5);
          r = thermal.r * (1 - emberMix) + charcoalColor.r * emberMix;
          g = thermal.g * (1 - emberMix) + charcoalColor.g * emberMix;
          b = thermal.b * (1 - emberMix) + charcoalColor.b * emberMix;
        } else {
          r = thermal.r;
          g = thermal.g;
          b = thermal.b;
        }
      } else {
        // Spray: standard thermal color ramp
        const sprayLife = Math.min(1, age * 0.8);
        const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, sprayLife, 1.5);
        r = thermal.r;
        g = thermal.g;
        b = thermal.b;
      }

      const hdrBoost = isColumn ? (1.5 + flashIntensity * 3.0) : (1.0 + flashIntensity * 2.0);
      colArr[i * 3] = r * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;
      colArr[i * 3 + 1] = g * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;
      colArr[i * 3 + 2] = b * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;

      // Per-particle size
      sizeArr[i] = basePointSize * particleSizes[i];
    }

    // ── Spray comet trails ──
    if (trailRef.current) {
      const tp = trailPosRef;
      const tc = trailColRef;
      for (let si = 0; si < sprayCount; si++) {
        const pi = columnEnd + si; // particle index
        const vx = velocities[pi * 3];
        const vy = velocities[pi * 3 + 1];
        const vz = velocities[pi * 3 + 2];
        const lt = lifetimes[pi];
        const age = progress / lt;
        const fade = Math.max(0, 1 - age) * envelope;
        
        for (let s = 0; s < TRAIL_SEGS; s++) {
          const dt = 0.015 * (s + 1);
          const tPast = Math.max(0, t - dt * s);
          const tPast2 = Math.max(0, t - dt * (s + 1));
          const dragPast = Math.exp(-0.04 * tPast);
          const dragPast2 = Math.exp(-0.04 * tPast2);
          const base = (si * TRAIL_SEGS + s) * 6;
          
          tp[base] = vx * tPast * dragPast + windX * tPast * tPast * 0.5;
          tp[base + 1] = vy * tPast * Math.exp(-0.03 * tPast) + 0.5 * GRAV * tPast * tPast;
          tp[base + 2] = vz * tPast * dragPast + windZ * tPast * tPast * 0.5;
          tp[base + 3] = vx * tPast2 * dragPast2 + windX * tPast2 * tPast2 * 0.5;
          tp[base + 4] = vy * tPast2 * Math.exp(-0.03 * tPast2) + 0.5 * GRAV * tPast2 * tPast2;
          tp[base + 5] = vz * tPast2 * dragPast2 + windZ * tPast2 * tPast2 * 0.5;
          
          const segFade = fade * Math.pow(1 - s / TRAIL_SEGS, 2) * 0.6;
          const endFade = fade * Math.pow(1 - (s + 1) / TRAIL_SEGS, 2) * 0.3;
          // Thermal ramp: white-hot → base → ember
          const warmth = s / TRAIL_SEGS;
          tc[base] = (1.0 - warmth * 0.5) * segFade * baseColor.r;
          tc[base + 1] = (0.8 - warmth * 0.4) * segFade * baseColor.g;
          tc[base + 2] = (0.5 - warmth * 0.3) * segFade * baseColor.b;
          tc[base + 3] = (1.0 - warmth * 0.5) * endFade * baseColor.r;
          tc[base + 4] = (0.8 - warmth * 0.4) * endFade * baseColor.g;
          tc[base + 5] = (0.5 - warmth * 0.3) * endFade * baseColor.b;
        }
      }
      const trailGeo = trailRef.current.geometry;
      const tPosAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
      const tColAttr = trailGeo.getAttribute('color') as THREE.BufferAttribute;
      if (tPosAttr) tPosAttr.needsUpdate = true;
      if (tColAttr) tColAttr.needsUpdate = true;
    }

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const szAttr = geo.getAttribute('size') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
    if (szAttr) szAttr.needsUpdate = true;

    // ── Ground smoke plume ──
    if (smokePointsRef.current && progress > 0.03 && progress < 0.92) {
      const smokePosArr = smokePosRef;
      const smokeColArr = smokeColRef;
      const smokeSizeArr = smokeSizeRef;
      const smokeAge = (progress - 0.03) / 0.89;

      for (let i = 0; i < SMOKE_COUNT; i++) {
        const svx = smokeVelocities[i * 3];
        const svy = smokeVelocities[i * 3 + 1];
        const svz = smokeVelocities[i * 3 + 2];
        const seed = smokeSeeds[i];

        // Turbulence drift
        const turbX = Math.sin(time * 0.3 + seed * 7.1) * 0.15;
        const turbZ = Math.cos(time * 0.25 + seed * 5.3) * 0.12;

        const st = smokeAge * 3;
        smokePosArr[i * 3] = svx * st + turbX + windX * st * st * 0.3;
        smokePosArr[i * 3 + 1] = svy * st * 0.5;
        smokePosArr[i * 3 + 2] = svz * st + turbZ + windZ * st * st * 0.3;

        // Warm gray smoke, fading with age
        const smokeFade = Math.max(0, 1 - smokeAge * 1.2) * 0.06;
        smokeColArr[i * 3] = (0.35 * 0.75 + baseColor.r * 0.25) * smokeFade;
        smokeColArr[i * 3 + 1] = (0.3 * 0.75 + baseColor.g * 0.25) * smokeFade;
        smokeColArr[i * 3 + 2] = (0.25 * 0.75 + baseColor.b * 0.25) * smokeFade;

        // Expanding size
        smokeSizeArr[i] = (1.5 + hash01(seed) * 2.5) * (1 + smokeAge * 2);
      }

      const smokeGeo = smokePointsRef.current.geometry;
      const sPosAttr = smokeGeo.getAttribute('position') as THREE.BufferAttribute;
      const sColAttr = smokeGeo.getAttribute('color') as THREE.BufferAttribute;
      if (sPosAttr) sPosAttr.needsUpdate = true;
      if (sColAttr) sColAttr.needsUpdate = true;
    }
  });

  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  // FWsim graphics.xml canonical tuning (opt-in via r_fwsim_mine_calibration).
  // mineFlame.sizeDependingOnEnergy maps caliber→size multiplier; brightness
  // and duration come from the same canonical block. When OFF, fall back to
  // the legacy literal constants used before the FWsim integration.
  const mineCalib = useMemo(() => {
    if (!isEnabled('r_fwsim_mine_calibration')) {
      return { sizeMult: 1, brightness: 0.7, durationMult: 1 };
    }
    const cfg = getFwsimGraphics().flashes.mineFlame;
    // caliber stored in inches; FWsim curve is x = launch energy ≈ shell mm.
    const calibMm = Math.max(16, Math.min(100, caliber * 25.4));
    const sizeMult = sampleCurve(
      cfg.sizeDependingOnEnergy as unknown as ReadonlyArray<readonly [number, number]>,
      calibMm,
    );
    return {
      sizeMult: Math.max(0.2, sizeMult),
      brightness: Math.max(0.1, Math.min(1, cfg.brightness * 0.5)), // brightness 2 → opacity ~1
      durationMult: Math.max(0.5, cfg.duration / 0.15),
    };
  }, [caliber]);

  // FWsim launchSparks.mine* canonical tuning (opt-in via r_fwsim_launch_sparks_mine).
  // Maps spec block { mineNrStars, mineExplosionRelativeSpeed, mineSpeedVariance,
  // mineMineWidth } into multiplicative factors over the legacy spray spark layer.
  // Canonical values (75 / 1.0 / 0.14 / 0.05) are intentionally neutral so OFF and
  // ON-with-default produce identical rendered sizes (bit-equivalent fallback).
  const sparkCalib = useMemo(() => {
    if (!isEnabled('r_fwsim_launch_sparks_mine')) {
      return { widthMult: 1, speedMult: 1, variance: 0.14, nrStarsTarget: sprayCount };
    }
    const cfg = getFwsimGraphics().launchSparks as unknown as {
      mineNrStars?: number;
      mineExplosionRelativeSpeed?: number;
      mineSpeedVariance?: number;
      mineMineWidth?: number;
    };
    const baseWidth = 0.05; // canonical reference width — neutral when matched.
    const widthMult = Math.max(0.25, Math.min(4, (cfg.mineMineWidth ?? baseWidth) / baseWidth));
    const speedMult = Math.max(0.25, Math.min(4, cfg.mineExplosionRelativeSpeed ?? 1));
    const variance = Math.max(0, Math.min(1, cfg.mineSpeedVariance ?? 0.14));
    const nrStarsTarget = Math.max(8, Math.round(cfg.mineNrStars ?? 75));
    return { widthMult, speedMult, variance, nrStarsTarget };
  }, [sprayCount]);

  // Mines are omnidirectional — root group is intentionally NOT rotated.
  // launchHeading/launchPitch are still accepted in the props for future
  // selective use (e.g. sutil column tilt ≤10°), but never tip the cloud.
  void launchHeading; void launchPitch;

  // Combustion-modulated muzzle flash
  const muzzleFlashOpacity = useMemo(() => 0.7 * mineCalib.brightness / 0.7, [mineCalib]);

  // FWsim smoke sprite (opt-in via r_fwsim_smoke_texture).
  const smokeMap = useMemo(
    () => (isEnabled('r_fwsim_smoke_texture') ? getFwsimSmokeTexture() : null),
    [],
  );

  // Per-particle size shader
  const sizeVertexShader = `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_PointSize = clamp(gl_PointSize, 1.0, 48.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const sizeFragmentShader = `
    varying vec3 vColor;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.15, dist);
      gl_FragColor = vec4(vColor, alpha * 0.95);
    }
  `;

  return (
    <group position={position} renderOrder={50}>
      {/* launchHeading/launchPitch intentionally NOT applied to the root group:
          mines are omnidirectional ground bursts (NFPA) — column rises vertical,
          spray fans hemispherically, drips fall by gravity. Tilting the whole
          group would tip the ground ring and the entire particle field. */}
      {/* Combustion muzzle flash with flicker */}
      {progress < 0.08 * mineCalib.durationMult && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[(0.6 + caliber * 0.3 + progress * 8) * mineCalib.sizeMult, 16, 16]} />
          <meshBasicMaterial
            color="#FFFFF0"
            transparent
            opacity={muzzleFlashOpacity * (1 - progress / (0.08 * mineCalib.durationMult))}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}

      {/* Ground ring flash */}
      {progress < 0.2 && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1, 2 + progress * 15 + caliber * 1.2, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.08 * (1 - progress / 0.2)}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Rising smoke cloud */}
      {progress > 0.02 && progress < 0.6 && (
        <mesh position={[0, progress * 4, 0]}>
          <sphereGeometry args={[0.6 + progress * 6, 8, 8]} />
          <meshBasicMaterial color="#887766" transparent opacity={0.06 * (1 - progress / 0.6)} depthTest={false} depthWrite={false} />
        </mesh>
      )}

      {/* Main particles with per-particle size shader */}
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posRef, 3]} />
          <bufferAttribute attach="attributes-color" args={[colRef, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizeRef, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={sizeVertexShader}
          fragmentShader={sizeFragmentShader}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Spray comet trails */}
      <lineSegments ref={trailRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPosRef, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColRef, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.7} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* Ground smoke plume */}
      {progress > 0.03 && progress < 0.92 && (
        <points ref={smokePointsRef} frustumCulled={false} renderOrder={50}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[smokePosRef, 3]} />
            <bufferAttribute attach="attributes-color" args={[smokeColRef, 3]} />
            <bufferAttribute attach="attributes-size" args={[smokeSizeRef, 1]} />
          </bufferGeometry>
          <shaderMaterial
            key={smokeMap ? 'fwsim-tex' : 'procedural'}
            vertexShader={sizeVertexShader}
            fragmentShader={smokeMap ? `
              uniform sampler2D uSmokeTex;
              varying vec3 vColor;
              void main() {
                vec4 tex = texture2D(uSmokeTex, gl_PointCoord);
                if (tex.a < 0.02) discard;
                gl_FragColor = vec4(vColor * tex.rgb, tex.a * 0.18);
              }
            ` : `
              varying vec3 vColor;
              void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                float alpha = smoothstep(0.5, 0.2, dist) * 0.08;
                gl_FragColor = vec4(vColor, alpha);
              }
            `}
            uniforms={smokeMap ? { uSmokeTex: { value: smokeMap } } : undefined}
            transparent
            depthWrite={false}
            depthTest={false}
          />
        </points>
      )}
    </group>
  );
}
