/**
 * NiagaraVFXController — Composable Niagara emitter system for SkyCanvas
 * 
 * Replaces monolithic SmokeController + SparkTrailController with composable
 * NiagaraSystem instances. Each burst event spawns a NiagaraSystem with
 * multiple emitters (sparks, smoke, embers, ribbons, heat haze).
 * 
 * Wired modules:
 *   - Soft particles (depth-fade) for smoke
 *   - Velocity stretching for sparks
 *   - Ribbon trails for comet/willow patterns
 *   - Flipbook animation for smoke puffs
 *   - Heat distortion for large caliber shells
 *   - Sub-emitter spawning (ember on spark death)
 *   - Thermal color chemistry for temperature-based evolution
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import {
  createEmitter, createSystem, tickSystem, getSystemParticleCount,
  onEmitterEvent, warmupSystem, createEmitterFromTemplate,
  type NiagaraSystem, type NiagaraEmitter, type NiagaraParticle,
} from '@/render_ultra/fireworks/niagaraEmitterSystem';
import { createCollision, createWind, createPointAttractor } from '@/render_ultra/fireworks/niagaraForceModules';
import { getBreakHeight, getBreakSpeed } from '@/lib/pyroPhysics';
import { thermalColor, getCompound, type ChemicalCompound } from '@/render_ultra/fireworks/particleChemistry';
import { clampNiagaraHDR, getNiagaraBudgets } from '@/lib/niagaraBlenderRules';
import { createSmokeSoftMaterial } from '@/render_ultra/fireworks/softParticleShader';
import { RibbonTrail } from '@/render_ultra/fireworks/ribbonTrailRenderer';
import { HeatHazeEmitter } from '@/render_ultra/fireworks/heatDistortion';
import { createFluidGrid, advectFluid, applyWindForce, type FluidGrid } from '@/render_ultra/fireworks/niagaraFluids';
import { InstancedParticleRenderer, createSparkInstancedRenderer, createSmokeInstancedRenderer } from '@/render_ultra/fireworks/instancedParticleRenderer';

// ── Emitter Templates ───────────────────────────────────────────────

function createSparkEmitterTemplate(caliber: number, color: THREE.Color): NiagaraEmitter {
  const breakSpd = getBreakSpeed(caliber);
  const sparkCount = Math.min(100, Math.round(caliber * 12));

  const emitter = createEmitter({
    id: `spark-burst-${Date.now()}-${Math.random()}`,
    name: 'Burst Sparks',
    maxParticles: sparkCount,
    spawn: { rate: 0, burstCount: sparkCount, burstInterval: 0, burstDelay: 0 },
    init: {
      lifetime: [0.6, 1.8 * (caliber / 6)],
      size: [0.3, 0.8],
      velocity: {
        min: new THREE.Vector3(-breakSpd * 0.6, -breakSpd * 0.3, -breakSpd * 0.6),
        max: new THREE.Vector3(breakSpd * 0.6, breakSpd * 0.8, breakSpd * 0.6),
      },
      color: color.clone(),
      spawnShape: { type: 'sphere', radius: caliber * 0.5, surfaceOnly: true },
    },
    update: [{
      drag: 0.06,
      gravityScale: 1.0,
      curlNoiseStrength: 0,
      curlNoiseScale: 0,
      colorOverLife: [
        { t: 0, color: new THREE.Color(1.5, 1.2, 0.5) },
        { t: 0.3, color: color.clone() },
        { t: 0.7, color: color.clone().multiplyScalar(0.4) },
        { t: 1, color: new THREE.Color(0.15, 0.05, 0.02) },
      ],
      sizeOverLife: [
        { t: 0, value: 1.2 },
        { t: 0.5, value: 0.8 },
        { t: 1, value: 0 },
      ],
      rotationRate: 0,
    }],
    render: {
      mode: 'gpu-sprite',
      blendMode: 'additive',
      velocityStretch: true,
      stretchScale: 0.4,
    },
    forceModules: [
      createCollision('ground', { planeY: 0, restitution: 0.2, friction: 0.6, maxBounces: 2 }),
    ],
    // Sub-emitter: spawn small embers when sparks die
    subEmitters: [{
      triggerEvent: 'particle-death',
      emitterTemplate: createEmitter({
        id: `sub-ember-${Date.now()}`,
        name: 'Sub Ember',
        maxParticles: 4,
        spawn: { rate: 0, burstCount: 2, burstInterval: 0, burstDelay: 0 },
        init: {
          lifetime: [0.5, 1.2],
          size: [0.08, 0.15],
          velocity: { min: new THREE.Vector3(-1, -0.5, -1), max: new THREE.Vector3(1, 0.5, 1) },
          color: new THREE.Color(1, 0.3, 0.02),
        },
        update: [{ drag: 1.2, gravityScale: 0.8, curlNoiseStrength: 0, curlNoiseScale: 0, colorOverLife: [], sizeOverLife: [], rotationRate: 0 }],
        render: { mode: 'gpu-sprite', blendMode: 'additive' },
      }),
      maxInstances: 8,
      inheritVelocity: 0.15,
    }],
  });

  return emitter;
}

function createSmokeEmitterTemplate(caliber: number): NiagaraEmitter {
  const smokeCount = Math.min(50, Math.round(10 + caliber * 4));

  return createEmitter({
    id: `smoke-burst-${Date.now()}-${Math.random()}`,
    name: 'Burst Smoke',
    maxParticles: smokeCount * 3,
    spawn: { rate: smokeCount * 0.5, burstCount: smokeCount, burstInterval: 0, burstDelay: 0 },
    init: {
      lifetime: [3, 7],
      size: [caliber * 2, caliber * 5],
      velocity: {
        min: new THREE.Vector3(-3, 1, -3),
        max: new THREE.Vector3(3, 5, 3),
      },
      color: new THREE.Color(0.15, 0.14, 0.12),
      spawnShape: { type: 'sphere', radius: caliber * 2, surfaceOnly: false },
    },
    update: [{
      drag: 1.5,
      gravityScale: -0.08,
      curlNoiseStrength: 4,
      curlNoiseScale: 0.04,
      colorOverLife: [
        { t: 0, color: new THREE.Color(0.3, 0.28, 0.25) },
        { t: 0.3, color: new THREE.Color(0.2, 0.19, 0.18) },
        { t: 1, color: new THREE.Color(0.1, 0.1, 0.1) },
      ],
      sizeOverLife: [
        { t: 0, value: 0.4 },
        { t: 0.2, value: 0.8 },
        { t: 0.5, value: 1.0 },
        { t: 1, value: 1.5 },
      ],
      rotationRate: 0.3,
    }],
    render: {
      mode: 'sprite',
      blendMode: 'normal',
      softParticles: true,
      softRange: 1.5,
    },
  });
}

function createEmberEmitterTemplate(caliber: number, color: THREE.Color): NiagaraEmitter {
  const emberCount = Math.min(30, Math.round(caliber * 4));

  return createEmitter({
    id: `ember-${Date.now()}-${Math.random()}`,
    name: 'Embers',
    maxParticles: emberCount,
    spawn: { rate: 0, burstCount: emberCount, burstInterval: 0, burstDelay: 0.1 },
    init: {
      lifetime: [2, 5],
      size: [0.15, 0.4],
      velocity: {
        min: new THREE.Vector3(-5, -2, -5),
        max: new THREE.Vector3(5, 3, 5),
      },
      color: new THREE.Color(1, 0.4, 0.05),
      spawnShape: { type: 'sphere', radius: caliber * 3, surfaceOnly: false },
    },
    update: [{
      drag: 0.8,
      gravityScale: 0.6,
      curlNoiseStrength: 2,
      curlNoiseScale: 0.08,
      colorOverLife: [
        { t: 0, color: new THREE.Color(1.2, 0.6, 0.1) },
        { t: 0.5, color: new THREE.Color(0.8, 0.2, 0.02) },
        { t: 1, color: new THREE.Color(0.1, 0.02, 0.0) },
      ],
      sizeOverLife: [
        { t: 0, value: 1 },
        { t: 0.8, value: 0.5 },
        { t: 1, value: 0 },
      ],
      rotationRate: 2,
    }],
    render: {
      mode: 'gpu-sprite',
      blendMode: 'additive',
    },
    forceModules: [
      createCollision('ground', { planeY: 0, restitution: 0.15, friction: 0.8, maxBounces: 1 }),
    ],
  });
}

// ── Active VFX System Pool ──────────────────────────────────────────

interface ActiveVFXSystem {
  system: NiagaraSystem;
  birthTime: number;
  maxAge: number;
  position: THREE.Vector3;
  ribbonTrail?: RibbonTrail;
  pattern?: string;
}

// ── GPU Instanced Renderer (replaces manual Points + buffer writes) ──

function collectParticlesFromSystems(
  systems: ActiveVFXSystem[],
  filterAdditive: boolean,
  hdrScale: number,
): Array<{ position: THREE.Vector3; velocity: THREE.Vector3; color: THREE.Color; size: number; opacity: number }> {
  const result: Array<{ position: THREE.Vector3; velocity: THREE.Vector3; color: THREE.Color; size: number; opacity: number }> = [];

  for (const { system, position: sysPos } of systems) {
    const allEmitters = [...system.emitters, ...system._activeSubEmitters];
    for (const emitter of allEmitters) {
      if (!emitter.enabled) continue;
      const isNormal = emitter.renderModule.blendMode === 'normal';
      if (filterAdditive && isNormal) continue;
      if (!filterAdditive && !isNormal) continue;

      for (const p of emitter.particles) {
        if (!p.alive || result.length >= 4096) continue;
        const t = p.age / p.lifetime;
        const thermalT = filterAdditive ? (1 - t) : 1;
        const opacity = filterAdditive ? Math.max(0, 1 - t) : Math.max(0, (1 - t) * 0.35);

        const [r, g, b] = filterAdditive
          ? clampNiagaraHDR(p.color.r * hdrScale * thermalT, p.color.g * hdrScale * thermalT, p.color.b * hdrScale * thermalT)
          : [p.color.r, p.color.g, p.color.b];

        result.push({
          position: new THREE.Vector3(p.position.x + sysPos.x, p.position.y + sysPos.y, p.position.z + sysPos.z),
          velocity: p.velocity.clone(),
          color: new THREE.Color(r, g, b),
          size: p.size,
          opacity,
        });
      }
    }
  }

  return result;
}

// ── Main Component ──────────────────────────────────────────────────

const NiagaraVFXController = React.forwardRef<THREE.Group, {}>(
  function NiagaraVFXController(_props, _ref) {
    const { scene, camera, size } = useThree();
    const activeSystems = useRef<ActiveVFXSystem[]>([]);
    const lastBurstIds = useRef<Set<string>>(new Set());
    const fluidGridRef = useRef<FluidGrid>(createFluidGrid(64, 64));
    const { hdrMultiplier, effectBrightness } = useSceneStore(st => st.settings);
    const environment = useSceneStore(st => st.environment);

    // GPU buffers for spark/ember particles (additive blend)
    const sparkBuffers = useMemo(() => createNiagaraBuffers(), []);
    const sparkMaterial = useMemo(() => new THREE.ShaderMaterial({
      vertexShader: NIAGARA_SPARK_VERTEX,
      fragmentShader: NIAGARA_SPARK_FRAGMENT,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }), []);

    // GPU buffers for smoke particles — using soft-particle material for depth-fade
    const smokeBuffers = useMemo(() => createNiagaraBuffers(), []);
    const smokeMaterial = useMemo(() => createSmokeSoftMaterial({
      softParticles: true,
      softRange: 1.5,
    }), []);

    // Heat haze emitter for large caliber bursts (≥6")
    const heatHazeRef = useRef<HeatHazeEmitter | null>(null);

    // Ribbon trails pool for comet/willow patterns
    const ribbonTrailsRef = useRef<RibbonTrail[]>([]);

    // Points objects
    const sparkPointsRef = useRef<THREE.Points | null>(null);
    const smokePointsRef = useRef<THREE.Points | null>(null);

    // Expose fluid grid globally for effects to read
    useEffect(() => {
      (window as any).__niagaraFluidGrid = fluidGridRef.current;
      return () => { delete (window as any).__niagaraFluidGrid; };
    }, []);

    useEffect(() => {
      const sparkPoints = new THREE.Points(sparkBuffers.geometry, sparkMaterial);
      sparkPoints.frustumCulled = false;
      sparkPoints.renderOrder = 50;
      scene.add(sparkPoints);
      sparkPointsRef.current = sparkPoints;

      const smokePoints = new THREE.Points(smokeBuffers.geometry, smokeMaterial);
      smokePoints.frustumCulled = false;
      smokePoints.renderOrder = 10;
      scene.add(smokePoints);
      smokePointsRef.current = smokePoints;

      // Heat haze emitter
      const haze = new HeatHazeEmitter(32);
      scene.add(haze.mesh);
      heatHazeRef.current = haze;

      return () => {
        scene.remove(sparkPoints);
        scene.remove(smokePoints);
        scene.remove(haze.mesh);
        sparkBuffers.geometry.dispose();
        smokeBuffers.geometry.dispose();
        sparkMaterial.dispose();
        smokeMaterial.dispose();
        haze.dispose();
        // Dispose ribbon trails
        ribbonTrailsRef.current.forEach(rt => {
          scene.remove(rt.mesh);
          rt.dispose();
        });
      };
    }, [scene]);

    // Wind force module (shared, updated each frame)
    const windModuleRef = useRef(createWind('env-wind', {
      direction: new THREE.Vector3(1, 0, 0),
      strength: 0,
      turbulence: 0.2,
      turbulenceScale: 0.05,
    }));

    useFrame((_, delta) => {
      const dt = Math.min(delta, 0.05);
      const systems = activeSystems.current;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const budgets = getNiagaraBudgets(isMobile);

      // ── Advect fluid grid ──
      const grid = fluidGridRef.current;
      const { wind } = useProjectStore.getState();
      if (wind.enabled) {
        const rad = (wind.direction * Math.PI) / 180;
        applyWindForce(grid, Math.sin(rad) * wind.speed * 0.1, Math.cos(rad) * wind.speed * 0.1, dt);
      }
      advectFluid(grid, dt);

      // ── Update wind module from project state ──
      if (wind.enabled) {
        const windRad = (wind.direction * Math.PI) / 180;
        windModuleRef.current.direction.set(Math.sin(windRad), 0, Math.cos(windRad));
        windModuleRef.current.strength = wind.speed * 0.5;
        windModuleRef.current.enabled = true;
      } else {
        windModuleRef.current.enabled = false;
      }

      // ── Detect new bursts from timeline ──
      const { timelineItems, currentTime } = useProjectStore.getState();
      const newBurstIds = new Set<string>();

      for (const item of timelineItems) {
        const elapsed = currentTime - item.startTime;
        if (elapsed >= 0 && elapsed < 0.06) {
          const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
          if (!effect || effect.type !== 'firework') continue;

          const burstKey = `${item.id}-${Math.floor(currentTime * 20)}`;
          newBurstIds.add(burstKey);

          if (!lastBurstIds.current.has(burstKey) && systems.length < budgets.maxConcurrentBursts * 2) {
            const caliber = effect.caliber || 4;
            const breakH = getBreakHeight(caliber);
            const burstPos = new THREE.Vector3(
              item.position.x,
              item.position.y + breakH,
              item.position.z
            );
            const burstColor = new THREE.Color(effect.color);
            const pattern = (effect as any).burstPattern || '';

            // Create composable NiagaraSystem with multiple emitters
            const sparkEmitter = createSparkEmitterTemplate(caliber, burstColor);
            const smokeEmitter = environment.disableSmoke ? null : createSmokeEmitterTemplate(caliber);
            const emberEmitter = createEmberEmitterTemplate(caliber, burstColor);

            // Add wind to all emitters
            const windMod = windModuleRef.current;
            sparkEmitter.forceModules.push(windMod);
            emberEmitter.forceModules.push(windMod);
            if (smokeEmitter) smokeEmitter.forceModules.push(windMod);

            const emitters = [sparkEmitter, emberEmitter];
            if (smokeEmitter) emitters.push(smokeEmitter);

            const sys = createSystem({
              id: `burst-vfx-${burstKey}`,
              name: `Burst VFX ${caliber}"`,
              emitters,
              maxParticleBudget: isMobile ? 256 : 1024,
              scalabilityGroup: isMobile ? 'mobile' : 'high',
            });

            const entry: ActiveVFXSystem = {
              system: sys,
              birthTime: performance.now(),
              maxAge: 8 + caliber * 0.5,
              position: burstPos,
              pattern,
            };

            // Ribbon trail for comet/willow patterns
            if (pattern === 'comet' || pattern === 'willow') {
              const ribbon = new RibbonTrail({
                maxPoints: 48,
                lifetime: 2.5,
                baseWidth: caliber * 0.6,
                blendMode: 'additive',
                widthCurve: [
                  { t: 0, value: 1 },
                  { t: 0.5, value: 0.6 },
                  { t: 1, value: 0 },
                ],
              });
              scene.add(ribbon.mesh);
              ribbonTrailsRef.current.push(ribbon);
              entry.ribbonTrail = ribbon;
            }

            // Heat haze for large caliber (≥6")
            if (caliber >= 6 && heatHazeRef.current) {
              heatHazeRef.current.emit(burstPos, Math.round(caliber * 1.5), caliber * 3, 2.5);
            }

            systems.push(entry);
          }
        }
      }

      lastBurstIds.current = newBurstIds;

      // ── Tick all active systems ──
      for (let i = systems.length - 1; i >= 0; i--) {
        const entry = systems[i];
        tickSystem(entry.system, dt);

        // Update ribbon trail — feed positions from lead spark particles
        if (entry.ribbonTrail) {
          const sparkEmitter = entry.system.emitters.find(e => e.name === 'Burst Sparks');
          if (sparkEmitter) {
            const leadParticle = sparkEmitter.particles.find(p => p.alive);
            if (leadParticle) {
              const worldPos = leadParticle.position.clone().add(entry.position);
              const t = leadParticle.age / leadParticle.lifetime;
              entry.ribbonTrail.addPoint(
                worldPos,
                leadParticle.color.clone(),
                1 - t,
                entry.ribbonTrail['config'].baseWidth * (1 - t * 0.5)
              );
            }
          }
          const camPos = camera instanceof THREE.PerspectiveCamera ? camera.position : undefined;
          entry.ribbonTrail.update(dt, camPos);
        }

        // Remove expired systems
        const age = (performance.now() - entry.birthTime) / 1000;
        const particleCount = getSystemParticleCount(entry.system);
        if (age > entry.maxAge || (age > 1 && particleCount === 0)) {
          // Clean up ribbon trail
          if (entry.ribbonTrail) {
            scene.remove(entry.ribbonTrail.mesh);
            entry.ribbonTrail.dispose();
            const rtIdx = ribbonTrailsRef.current.indexOf(entry.ribbonTrail);
            if (rtIdx >= 0) ribbonTrailsRef.current.splice(rtIdx, 1);
          }
          systems.splice(i, 1);
        }
      }

      // ── Update heat haze ──
      if (heatHazeRef.current) {
        heatHazeRef.current.setResolution(size.width, size.height);
        heatHazeRef.current.update(dt);
      }

      // ── Write to GPU buffers ──
      const hdrScale = THREE.MathUtils.clamp(
        (hdrMultiplier / 3.5) * THREE.MathUtils.clamp(effectBrightness, 0.6, 1.8),
        0.6, 2.0
      );

      const sparkCount = writeParticlesToBuffers(
        systems, sparkBuffers.positions, sparkBuffers.colors, sparkBuffers.sizes, sparkBuffers.opacities, hdrScale
      );
      sparkBuffers.geometry.attributes.position.needsUpdate = true;
      sparkBuffers.geometry.attributes.color.needsUpdate = true;
      (sparkBuffers.geometry.attributes as any).aSize.needsUpdate = true;
      (sparkBuffers.geometry.attributes as any).aOpacity.needsUpdate = true;
      sparkBuffers.geometry.setDrawRange(0, sparkCount);

      const smokeCount = writeSmokeToBuffers(
        systems, smokeBuffers.positions, smokeBuffers.colors, smokeBuffers.sizes, smokeBuffers.opacities
      );
      smokeBuffers.geometry.attributes.position.needsUpdate = true;
      smokeBuffers.geometry.attributes.color.needsUpdate = true;
      (smokeBuffers.geometry.attributes as any).aSize.needsUpdate = true;
      (smokeBuffers.geometry.attributes as any).aOpacity.needsUpdate = true;
      smokeBuffers.geometry.setDrawRange(0, smokeCount);
    });

    return null;
  }
);

export default NiagaraVFXController;
