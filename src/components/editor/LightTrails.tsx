import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const TRAIL_LENGTH = 32; // points per trail
const MAX_DRONES = 300;

const TRAIL_VERTEX = `
  attribute float aOpacity;
  attribute float aWidth;
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vOpacity = aOpacity;
    vColor = color;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aWidth * (600.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 60.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const TRAIL_FRAGMENT = `
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    float core = exp(-dist * dist * 22.0);
    float glow = exp(-dist * dist * 8.0);
    float alpha = (core * 0.6 + glow * 0.2) * vOpacity;
    vec3 col = vColor * (core * 0.8 + glow * 0.3);
    gl_FragColor = vec4(col, alpha * smoothstep(0.5, 0.0, dist));
  }
`;

interface DronePos {
  x: number;
  y: number;
  z: number;
  color: string;
}

/**
 * LightTrails — renders persistent luminous trails behind each drone.
 * Trails fade from bright core to transparent, creating cinematographic
 * long-exposure light painting effect during formation transitions.
 */
export default function LightTrails({
  dronePositions,
  enabled = true,
  intensity = 1.0,
}: {
  dronePositions: DronePos[] | null;
  enabled?: boolean;
  intensity?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const droneCount = dronePositions ? Math.min(dronePositions.length, MAX_DRONES) : 0;
  const totalPoints = droneCount * TRAIL_LENGTH;

  // Trail history ring buffer
  const historyRef = useRef<Float32Array | null>(null);
  const colorHistoryRef = useRef<Float32Array | null>(null);
  const headRef = useRef(0);
  const prevCountRef = useRef(0);

  // Allocate buffers
  const { positions, colors, opacities, widths } = useMemo(() => {
    const maxPts = Math.max(totalPoints, 1);
    return {
      positions: new Float32Array(maxPts * 3),
      colors: new Float32Array(maxPts * 3),
      opacities: new Float32Array(maxPts),
      widths: new Float32Array(maxPts),
    };
  }, [totalPoints]);

  // Track previous positions to detect static drones (ghost trail prevention)
  const prevPositionsRef = useRef<string>('');

  useFrame(() => {
    if (!pointsRef.current || !dronePositions || droneCount === 0 || !enabled) {
      if (pointsRef.current) pointsRef.current.visible = false;
      return;
    }

    // Ghost trail guard: skip rendering if all positions are identical to last frame
    const posKey = dronePositions.slice(0, Math.min(5, droneCount)).map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join('|');
    if (posKey === prevPositionsRef.current) {
      // Positions haven't moved — don't advance trail head (prevents phantom lines)
      return;
    }
    prevPositionsRef.current = posKey;

    // Reset history if drone count changed
    if (droneCount !== prevCountRef.current) {
      historyRef.current = new Float32Array(droneCount * TRAIL_LENGTH * 3);
      colorHistoryRef.current = new Float32Array(droneCount * TRAIL_LENGTH * 3);
      headRef.current = 0;
      prevCountRef.current = droneCount;
      // Initialize all trail positions to current drone positions
      for (let d = 0; d < droneCount; d++) {
        const dp = dronePositions[d];
        const c = new THREE.Color(dp.color);
        for (let t = 0; t < TRAIL_LENGTH; t++) {
          const idx = (d * TRAIL_LENGTH + t) * 3;
          historyRef.current![idx] = dp.x;
          historyRef.current![idx + 1] = dp.y;
          historyRef.current![idx + 2] = dp.z;
          colorHistoryRef.current![idx] = c.r;
          colorHistoryRef.current![idx + 1] = c.g;
          colorHistoryRef.current![idx + 2] = c.b;
        }
      }
    }

    if (!historyRef.current || !colorHistoryRef.current) return;

    pointsRef.current.visible = true;
    const head = headRef.current;

    // Write current positions at head
    const tmpColor = new THREE.Color();
    for (let d = 0; d < droneCount; d++) {
      const dp = dronePositions[d];
      const ringIdx = (d * TRAIL_LENGTH + head) * 3;
      historyRef.current[ringIdx] = dp.x;
      historyRef.current[ringIdx + 1] = dp.y;
      historyRef.current[ringIdx + 2] = dp.z;
      tmpColor.set(dp.color);
      colorHistoryRef.current[ringIdx] = tmpColor.r;
      colorHistoryRef.current[ringIdx + 1] = tmpColor.g;
      colorHistoryRef.current[ringIdx + 2] = tmpColor.b;
    }

    // Fill vertex buffers — oldest to newest
    for (let d = 0; d < droneCount; d++) {
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        const age = (TRAIL_LENGTH - 1 - t); // 0 = newest
        const ringT = (head - t + TRAIL_LENGTH) % TRAIL_LENGTH;
        const srcIdx = (d * TRAIL_LENGTH + ringT) * 3;
        const dstIdx = (d * TRAIL_LENGTH + t) * 3;

        positions[dstIdx] = historyRef.current[srcIdx];
        positions[dstIdx + 1] = historyRef.current[srcIdx + 1];
        positions[dstIdx + 2] = historyRef.current[srcIdx + 2];

        colors[dstIdx] = colorHistoryRef.current[srcIdx];
        colors[dstIdx + 1] = colorHistoryRef.current[srcIdx + 1];
        colors[dstIdx + 2] = colorHistoryRef.current[srcIdx + 2];

        // Fade from bright (newest) to transparent (oldest)
        const normAge = age / (TRAIL_LENGTH - 1);
        const fadeCurve = Math.pow(1 - normAge, 2.5);
        opacities[d * TRAIL_LENGTH + t] = fadeCurve * intensity;
        widths[d * TRAIL_LENGTH + t] = (1.2 + fadeCurve * 3.0) * intensity;
      }
    }

    headRef.current = (head + 1) % TRAIL_LENGTH;

    // Update GPU buffers
    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const opaAttr = geo.getAttribute('aOpacity') as THREE.BufferAttribute;
    const widAttr = geo.getAttribute('aWidth') as THREE.BufferAttribute;

    (posAttr.array as Float32Array).set(positions);
    (colAttr.array as Float32Array).set(colors);
    (opaAttr.array as Float32Array).set(opacities);
    (widAttr.array as Float32Array).set(widths);

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    opaAttr.needsUpdate = true;
    widAttr.needsUpdate = true;
  });

  if (totalPoints === 0) return null;

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
        <bufferAttribute attach="attributes-aWidth" args={[widths, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={TRAIL_VERTEX}
        fragmentShader={TRAIL_FRAGMENT}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
