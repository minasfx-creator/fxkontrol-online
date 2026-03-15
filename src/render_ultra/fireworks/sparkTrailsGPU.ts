/**
 * FX KONTROL · GPU Spark Trails
 * Incandescent spark trail system with history buffer.
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
 */
export function createSparkTrailSystem() {
  // Trail line geometry — each spark gets MAX_TRAIL_POINTS vertices
  const totalVerts = MAX_SPARKS * MAX_TRAIL_POINTS;
  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const opacities = new Float32Array(totalVerts);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float opacity;
      attribute vec3 color;
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        vOpacity = opacity;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, 4.0 * opacity);
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float glow = exp(-d * d * 3.0);
        gl_FragColor = vec4(vColor * (1.0 + vOpacity * 2.0), glow * vOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return { points, geometry, positions, colors, opacities };
}

/**
 * Update spark trail — pushes current position into history buffer.
 */
export function updateSparkTrail(spark: SparkState, dt: number, drag: number, gravity: number) {
  // Physics
  spark.velocity.y += gravity * dt;
  spark.velocity.multiplyScalar(1 - drag * dt);
  spark.position.add(spark.velocity.clone().multiplyScalar(dt));
  spark.life -= dt;

  // Trail history
  spark.trailHistory.push(spark.position.clone());
  if (spark.trailHistory.length > MAX_TRAIL_POINTS) {
    spark.trailHistory.shift();
  }
}

/**
 * Write spark trail data into GPU buffers.
 */
export function writeSparkTrailsToBuffers(
  sparks: SparkState[],
  positions: Float32Array,
  colors: Float32Array,
  opacities: Float32Array
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
        
        const trailFade = 1 - t / trail.length;
        const alpha = trailFade * lifeRatio;
        colors[idx] = spark.color.r * (1 + trailFade);
        colors[idx + 1] = spark.color.g * (1 + trailFade * 0.5);
        colors[idx + 2] = spark.color.b * trailFade;
        opacities[vertIdx] = alpha;
      } else {
        positions[idx] = 0;
        positions[idx + 1] = -1000;
        positions[idx + 2] = 0;
        opacities[vertIdx] = 0;
      }
      vertIdx++;
    }
  }
  return vertIdx;
}
