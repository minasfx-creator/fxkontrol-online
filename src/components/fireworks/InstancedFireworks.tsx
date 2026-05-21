/**
 * InstancedFireworks — single-mesh additive spark renderer with optional
 * ribbon trails and smoke plumes. Pool-based, zero realloc.
 *
 * Architecture
 * ────────────
 *  • Cores    : Points (one BufferGeometry, additive shader) — N = caps.particleCount
 *  • Trails   : Points clones at past positions (4-step ringbuffer) — toggled per tier
 *  • Smoke    : InstancedMesh of camera-facing quads, dark/soft — toggled per tier
 *
 *  All three live under one <group> and are driven by `fireworksBurstBus.fire(...)`.
 *  Tier comes from `useRenderQualityTier` so the RenderStabilityController can
 *  downgrade in real time without remounting.
 *
 * SAFETY
 * ──────
 * Pure presentation. Never touches uiCommandGateway / CommandBus / SafetyStateMachine
 * / FieldBus / workMode. Cannot arm or fire physical pyro.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRenderQualityTier } from '@/render_ultra/stability/useRenderQualityTier';
import { capsForTier } from '@/render_ultra/fireworks/fireworksTierConfig';
import { fireworksBurstBus, type BurstRequest } from '@/render_ultra/fireworks/fireworksBurstBus';

interface InstancedFireworksProps {
  /** Hard upper bound (clamped by tier caps). Defaults to tier max. */
  maxParticles?: number;
  /** Gravity in m/s² (positive = down). Default 9.8. */
  gravity?: number;
  /** Drag coefficient applied per second. Default 0.55. */
  drag?: number;
  /** Trail length in samples (1..6). Default 4. */
  trailSamples?: number;
}

const PI2 = Math.PI * 2;

function makeSparkShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1 },
      uSize: { value: 26.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aLife;     // 0..1 remaining
      attribute float aSize;     // base size
      uniform float uPixelRatio;
      uniform float uSize;
      varying vec3 vColor;
      varying float vLife;
      void main() {
        vColor = aColor;
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float atten = 320.0 / max(0.001, -mv.z);
        gl_PointSize = aSize * uSize * uPixelRatio * atten * (0.4 + 0.6 * aLife);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vLife;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * 7.0);
        float glow = exp(-d * 2.4) * 0.35;
        vec3 col = vColor * (core + glow);
        // thermal cool-down: hotter while life > 0.6, ember as life decays
        float ember = smoothstep(0.0, 0.35, 1.0 - vLife);
        col = mix(col, col * vec3(1.0, 0.55, 0.25), ember * 0.6);
        gl_FragColor = vec4(col, (core + glow) * smoothstep(0.0, 0.18, vLife));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function makeSmokeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.32 } },
    vertexShader: /* glsl */ `
      attribute float aLife;
      attribute float aSize;
      varying float vLife;
      void main() {
        vLife = aLife;
        vec3 transformed = position * (aSize * (1.4 + (1.0 - aLife) * 2.2));
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
        // billboard
        mv.xyz += vec3(0.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      uniform float uOpacity;
      void main() {
        float a = smoothstep(0.0, 0.25, vLife) * smoothstep(1.0, 0.7, 1.0 - vLife);
        gl_FragColor = vec4(vec3(0.12, 0.12, 0.13), a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

export default function InstancedFireworks({
  maxParticles,
  gravity = 9.8,
  drag = 0.55,
  trailSamples = 4,
}: InstancedFireworksProps) {
  const tier = useRenderQualityTier();
  const caps = useMemo(() => capsForTier(tier), [tier]);
  const N = Math.min(maxParticles ?? caps.particleCount, caps.particleCount);
  const TRAIL_K = caps.trails ? Math.max(1, Math.min(6, trailSamples)) : 0;
  const SMOKE_N = caps.smokeCount;

  // ── Core buffers (SoA, zero-GC) ──
  const buffers = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const velocities = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const life = new Float32Array(N);        // 0..1 remaining, 0 = dead
    const lifeMax = new Float32Array(N);     // initial life span for ramps
    const sizes = new Float32Array(N);
    // Trail ringbuffer of past positions per particle.
    const trailPos = TRAIL_K > 0 ? new Float32Array(N * 3 * TRAIL_K) : null;
    return { positions, velocities, colors, life, lifeMax, sizes, trailPos };
  }, [N, TRAIL_K]);

  const cursorRef = useRef(0); // round-robin allocator

  // ── Geometry / Material for cores ──
  const coreGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(buffers.colors, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(buffers.life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(buffers.sizes, 1));
    g.setDrawRange(0, N);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
    return g;
  }, [buffers, N]);

  const coreMat = useMemo(makeSparkShader, []);

  // ── Trail geometry (separate Points per ring slot) ──
  const trailGeoms = useMemo(() => {
    if (!buffers.trailPos) return [];
    const arr: THREE.BufferGeometry[] = [];
    for (let k = 0; k < TRAIL_K; k++) {
      const g = new THREE.BufferGeometry();
      const offset = N * 3 * k;
      const view = buffers.trailPos!.subarray(offset, offset + N * 3);
      g.setAttribute('position', new THREE.BufferAttribute(view, 3));
      g.setAttribute('aColor', new THREE.BufferAttribute(buffers.colors, 3));
      // fade life by ring depth
      const lifeAttr = new Float32Array(N);
      g.setAttribute('aLife', new THREE.BufferAttribute(lifeAttr, 1));
      g.setAttribute('aSize', new THREE.BufferAttribute(buffers.sizes, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
      arr.push(g);
    }
    return arr;
  }, [buffers, N, TRAIL_K]);

  // ── Smoke ──
  const smokeMesh = useRef<THREE.InstancedMesh | null>(null);
  const smokeData = useMemo(() => {
    if (SMOKE_N === 0) return null;
    return {
      positions: new Float32Array(SMOKE_N * 3),
      velocities: new Float32Array(SMOKE_N * 3),
      life: new Float32Array(SMOKE_N),
      lifeMax: new Float32Array(SMOKE_N),
      size: new Float32Array(SMOKE_N),
      cursor: { v: 0 },
    };
  }, [SMOKE_N]);

  const smokeGeom = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const smokeMat = useMemo(makeSmokeMaterial, []);

  // attach instance attributes once mesh exists
  useEffect(() => {
    if (!smokeMesh.current || !smokeData) return;
    const m = smokeMesh.current;
    const lifeAttr = new THREE.InstancedBufferAttribute(smokeData.life, 1);
    const sizeAttr = new THREE.InstancedBufferAttribute(smokeData.size, 1);
    lifeAttr.setUsage(THREE.DynamicDrawUsage);
    sizeAttr.setUsage(THREE.DynamicDrawUsage);
    m.geometry.setAttribute('aLife', lifeAttr);
    m.geometry.setAttribute('aSize', sizeAttr);
    // hide all initially
    const tmp = new THREE.Object3D();
    for (let i = 0; i < SMOKE_N; i++) {
      tmp.position.set(0, -10000, 0);
      tmp.scale.setScalar(0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [smokeData, SMOKE_N]);

  // ── Burst dispatcher ──
  useEffect(() => {
    const off = fireworksBurstBus.on((req: BurstRequest) => {
      // Tier-aware intensity: stability controller degrades the tier and the
      // burstIntensityScale shrinks count/speed/smoke proportionally.
      const requested = Math.max(0.2, Math.min(2, req.intensity ?? 1));
      const intensity = requested * caps.burstIntensityScale;
      const rawCount = Math.floor(420 * intensity);
      const count = Math.min(
        caps.maxParticlesPerBurst,
        Math.max(caps.minParticlesPerBurst, rawCount),
      );
      const [cx, cy, cz] = req.position;
      const [r, g, b] = req.color ?? [1.0, 0.85, 0.55];

      for (let i = 0; i < count; i++) {
        const idx = cursorRef.current;
        cursorRef.current = (cursorRef.current + 1) % N;
        const i3 = idx * 3;

        buffers.positions[i3]     = cx;
        buffers.positions[i3 + 1] = cy;
        buffers.positions[i3 + 2] = cz;

        // spherical-ish ejection (mine = upward bias, shell = uniform)
        const upBias = req.kind === 'mine' ? 0.7 : 0.0;
        const theta = Math.random() * PI2;
        const u = Math.random() * 2 - 1;
        const sp = Math.sqrt(1 - u * u);
        const speed = (10 + Math.random() * 22) * intensity;
        buffers.velocities[i3]     = speed * sp * Math.cos(theta);
        buffers.velocities[i3 + 1] = speed * (u + upBias);
        buffers.velocities[i3 + 2] = speed * sp * Math.sin(theta);

        // color jitter for richness
        const j = 0.85 + Math.random() * 0.3;
        buffers.colors[i3]     = r * j;
        buffers.colors[i3 + 1] = g * j;
        buffers.colors[i3 + 2] = b * j;

        const lifespan = 0.9 + Math.random() * 1.4;
        buffers.life[idx] = 1.0;
        buffers.lifeMax[idx] = lifespan;
        buffers.sizes[idx] = 0.6 + Math.random() * 0.9;
      }

      // smoke puff at origin
      if (smokeData && SMOKE_N > 0 && caps.maxSmokePerBurst > 0) {
        const sCount = Math.min(
          caps.maxSmokePerBurst,
          Math.max(2, Math.floor(8 * intensity)),
        );
        for (let i = 0; i < sCount; i++) {
          const sIdx = smokeData.cursor.v;
          smokeData.cursor.v = (smokeData.cursor.v + 1) % SMOKE_N;
          const s3 = sIdx * 3;
          smokeData.positions[s3]     = cx + (Math.random() - 0.5) * 1.5;
          smokeData.positions[s3 + 1] = cy + Math.random() * 1.0;
          smokeData.positions[s3 + 2] = cz + (Math.random() - 0.5) * 1.5;
          smokeData.velocities[s3]     = (Math.random() - 0.5) * 0.8;
          smokeData.velocities[s3 + 1] = 0.4 + Math.random() * 0.6;
          smokeData.velocities[s3 + 2] = (Math.random() - 0.5) * 0.8;
          smokeData.life[sIdx] = 1.0;
          smokeData.lifeMax[sIdx] = 2.6 + Math.random() * 2.2;
          smokeData.size[sIdx] = 1.2 + Math.random() * 1.4;
        }
      }
    });
    return off;
  }, [buffers, N, caps.minParticlesPerBurst, smokeData, SMOKE_N]);

  // ── Per-frame integrator ──
  useFrame((_state, deltaRaw) => {
    const dt = Math.min(0.066, Math.max(0.001, deltaRaw));
    const dragFactor = Math.exp(-drag * dt);

    // 1) integrate cores
    const { positions, velocities, life, lifeMax } = buffers;
    for (let i = 0; i < N; i++) {
      const l = life[i];
      if (l <= 0) continue;
      const i3 = i * 3;
      velocities[i3]     *= dragFactor;
      velocities[i3 + 1] = (velocities[i3 + 1] * dragFactor) - gravity * dt;
      velocities[i3 + 2] *= dragFactor;
      positions[i3]     += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;
      const newLife = l - dt / Math.max(0.2, lifeMax[i]);
      life[i] = newLife > 0 ? newLife : 0;
    }
    (coreGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (coreGeom.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;

    // 2) shift trail ring (copy current → slot k, decay older slots' life)
    if (buffers.trailPos && TRAIL_K > 0) {
      const tp = buffers.trailPos;
      // rotate: slot[K-1] = slot[K-2] ... slot[1] = slot[0]; slot[0] = positions
      for (let k = TRAIL_K - 1; k > 0; k--) {
        tp.copyWithin(N * 3 * k, N * 3 * (k - 1), N * 3 * k);
      }
      tp.set(positions, 0);
      for (let k = 0; k < TRAIL_K; k++) {
        const g = trailGeoms[k];
        const lifeAttr = g.getAttribute('aLife') as THREE.BufferAttribute;
        const arr = lifeAttr.array as Float32Array;
        const fade = 1.0 - (k + 1) / (TRAIL_K + 1);
        for (let i = 0; i < N; i++) arr[i] = life[i] * fade;
        lifeAttr.needsUpdate = true;
        (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      }
    }

    // 3) integrate smoke
    if (smokeData && smokeMesh.current && SMOKE_N > 0) {
      const sm = smokeMesh.current;
      const tmp = new THREE.Object3D();
      const { positions: sp, velocities: sv, life: sl, lifeMax: slm, size: ss } = smokeData;
      let dirty = false;
      for (let i = 0; i < SMOKE_N; i++) {
        const l = sl[i];
        if (l <= 0) {
          // park out of frustum
          tmp.position.set(0, -10000, 0);
          tmp.scale.setScalar(0);
          tmp.updateMatrix();
          sm.setMatrixAt(i, tmp.matrix);
          continue;
        }
        const i3 = i * 3;
        sv[i3]     *= 0.985;
        sv[i3 + 1]  = sv[i3 + 1] * 0.985 + 0.18 * dt; // gentle buoyancy
        sv[i3 + 2] *= 0.985;
        sp[i3]     += sv[i3] * dt;
        sp[i3 + 1] += sv[i3 + 1] * dt;
        sp[i3 + 2] += sv[i3 + 2] * dt;
        const nl = l - dt / Math.max(0.5, slm[i]);
        sl[i] = nl > 0 ? nl : 0;
        tmp.position.set(sp[i3], sp[i3 + 1], sp[i3 + 2]);
        tmp.scale.setScalar(ss[i]);
        tmp.updateMatrix();
        sm.setMatrixAt(i, tmp.matrix);
        dirty = true;
      }
      if (dirty) {
        sm.instanceMatrix.needsUpdate = true;
        (sm.geometry.getAttribute('aLife') as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
    }
  });

  // cleanup
  useEffect(() => () => {
    coreGeom.dispose();
    coreMat.dispose();
    trailGeoms.forEach((g) => g.dispose());
    smokeGeom.dispose();
    smokeMat.dispose();
  }, [coreGeom, coreMat, trailGeoms, smokeGeom, smokeMat]);

  return (
    <group name="InstancedFireworks">
      {trailGeoms.map((g, k) => (
        <points key={`trail-${k}`} geometry={g} material={coreMat} frustumCulled={false} />
      ))}
      <points geometry={coreGeom} material={coreMat} frustumCulled={false} />
      {SMOKE_N > 0 && (
        <instancedMesh
          ref={smokeMesh}
          args={[smokeGeom, smokeMat, SMOKE_N]}
          frustumCulled={false}
        />
      )}
    </group>
  );
}
