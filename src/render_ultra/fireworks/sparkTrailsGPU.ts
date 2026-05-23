/**
 * FX KONTROL · GPU Spark Trails
 * Incandescent spark trail system with history buffer + velocity stretching.
 * Uses instanced line segments for GPU-efficient rendering.
 */

import * as THREE from 'three';

const MAX_TRAIL_POINTS = 32;
const MAX_SPARKS = 2048;

export interface SparkState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  size: number;
  trailHistory: THREE.Vector3[];
}

/**
 * Create spark trail geometry — reusable buffer for GPU particle trails.
 * Now includes velocity attribute for Niagara-style velocity stretching.
 */
export function createSparkTrailSystem() {
  const totalVerts = MAX_SPARKS * MAX_TRAIL_POINTS;
  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const opacities = new Float32Array(totalVerts);
  const velocities = new Float32Array(totalVerts * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float opacity;
      attribute vec3 color;
      attribute vec3 aVelocity;

      uniform float uVelocityStretchFactor;

      varying float vOpacity;
      varying vec3 vColor;

      void main() {
        vOpacity = opacity;
        vColor = color;

        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPos;

        // Base point size — tapered: head thicker, tail thinner.
        // opacity already encodes (trailFade * lifeRatio), so size follows
        // a non-linear curve to keep the head punchy while the tail
        // pinches to a single pixel before vanishing.
        float baseSize = max(0.6, 4.5 * pow(opacity, 0.65));

        // Velocity stretching — elongate along velocity (Niagara-style).
        vec3 viewVel = (modelViewMatrix * vec4(aVelocity, 0.0)).xyz;
        float speed = length(viewVel);
        float stretchFactor = 1.0 + speed * uVelocityStretchFactor;

        // Distance attenuation: clamp so far sparks remain visible
        // without bloating near sparks.
        float distAtten = clamp(80.0 / max(0.001, -mvPos.z), 0.5, 1.4);

        gl_PointSize = baseSize * stretchFactor * distAtten;
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d2 = dot(uv, uv) * 4.0;
        // Sharper hot core + softer halo (two-lobe gaussian)
        float core = exp(-d2 * 6.0);
        float halo = exp(-d2 * 1.6) * 0.45;
        float glow = core + halo;
        // Hot core pushes color toward white at peak opacity
        vec3 hot = mix(vColor, vec3(1.0), core * vOpacity * 0.85);
        gl_FragColor = vec4(hot * (1.0 + vOpacity * 1.6), glow * vOpacity);
      }
    `,
    uniforms: {
      uVelocityStretchFactor: { value: 0.3 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return { points, geometry, positions, colors, opacities, velocities };
}

/**
 * Cheap pseudo-3D curl-like turbulence (no noise texture).
 * Uses interfering trig fields for divergence-free-ish swirl.
 * Cost: ~12 ops/spark/frame — safe at 2k sparks.
 */
function turbulence(p: THREE.Vector3, t: number, out: THREE.Vector3) {
  const f = 0.18; // spatial frequency
  const a = 0.65; // amplitude (m/s²)
  const x = p.x * f, y = p.y * f, z = p.z * f;
  out.x = a * (Math.sin(y + t * 1.3) - Math.cos(z * 1.7 - t * 0.9));
  out.y = a * (Math.sin(z + t * 1.1) - Math.cos(x * 1.5 + t * 0.7));
  out.z = a * (Math.sin(x + t * 0.8) - Math.cos(y * 1.3 + t * 1.2));
}

const _turb = new THREE.Vector3();
const _step = new THREE.Vector3();

/**
 * Update spark trail — pushes current position into history buffer.
 * Now models quadratic drag (more realistic at low Reynolds for embers)
 * and adds cheap curl-like turbulence so trails don't look ballistic.
 *
 * @param spark   the spark
 * @param dt      seconds since last update
 * @param drag    quadratic drag coefficient (try 0.04..0.12)
 * @param gravity m/s² (negative for downward in Y-up; e.g. -9.81)
 * @param time    elapsed seconds — used to advect turbulence over time
 * @param turbAmt 0..1 turbulence strength multiplier (0 disables)
 */
export function updateSparkTrail(
  spark: SparkState,
  dt: number,
  drag: number,
  gravity: number,
  time: number = 0,
  turbAmt: number = 1
) {
  // Quadratic drag: F_drag ∝ |v| · v  (more honest than linear damp)
  const speed = spark.velocity.length();
  const dragCoef = Math.min(0.95, drag * speed * dt);
  spark.velocity.multiplyScalar(1 - dragCoef);

  // Gravity
  spark.velocity.y += gravity * dt;

  // Turbulence — fades as the spark cools (using life ratio as proxy)
  if (turbAmt > 0) {
    turbulence(spark.position, time, _turb);
    const cool = Math.max(0, spark.life / spark.maxLife);
    spark.velocity.addScaledVector(_turb, turbAmt * cool * dt);
  }

  // Integrate position (no allocation)
  _step.copy(spark.velocity).multiplyScalar(dt);
  spark.position.add(_step);
  spark.life -= dt;

  spark.trailHistory.push(spark.position.clone());
  if (spark.trailHistory.length > MAX_TRAIL_POINTS) {
    spark.trailHistory.shift();
  }
}

/**
 * Write spark trail data into GPU buffers (now includes velocity data).
 */
export function writeSparkTrailsToBuffers(
  sparks: SparkState[],
  positions: Float32Array,
  colors: Float32Array,
  opacities: Float32Array,
  velocities?: Float32Array
) {
  let vertIdx = 0;
  for (let s = 0; s < sparks.length && s < MAX_SPARKS; s++) {
    const spark = sparks[s];
    const trail = spark.trailHistory;
    const lifeRatio = Math.max(0, spark.life / spark.maxLife);

    for (let t = 0; t < MAX_TRAIL_POINTS; t++) {
      const idx = vertIdx * 3;
      if (t < trail.length) {
        const pt = trail[trail.length - 1 - t];
        positions[idx] = pt.x;
        positions[idx + 1] = pt.y;
        positions[idx + 2] = pt.z;
        
        // Tail thins exponentially (Beer-Lambert-ish absorption along
        // the trail) instead of linearly — gives the "fading wick" look
        // and removes the chunky tail boundary.
        const u = t / trail.length;
        const trailFade = Math.exp(-u * 2.4);
        const alpha = trailFade * lifeRatio;
        // Color cools toward red as it ages (Newton + blackbody hint):
        // head keeps the source color, tail loses blue first then green.
        const cool = trailFade;
        colors[idx]     = spark.color.r * (1 + cool * 0.6);
        colors[idx + 1] = spark.color.g * (0.4 + cool * 0.6);
        colors[idx + 2] = spark.color.b * (cool * cool);
        opacities[vertIdx] = alpha;

        // Write velocity for stretching
        if (velocities) {
          velocities[idx] = spark.velocity.x;
          velocities[idx + 1] = spark.velocity.y;
          velocities[idx + 2] = spark.velocity.z;
        }
      } else {
        positions[idx] = 0;
        positions[idx + 1] = -1000;
        positions[idx + 2] = 0;
        opacities[vertIdx] = 0;
        if (velocities) {
          velocities[idx] = 0;
          velocities[idx + 1] = 0;
          velocities[idx + 2] = 0;
        }
      }
      vertIdx++;
    }
  }
  return vertIdx;
}
