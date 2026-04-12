/**
 * GoogleTilesFallback — R3F fallback visuals (grid + horizon disc)
 * shown when Google 3D Tiles fail to load or timeout.
 */
import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import {
  subscribeTilesLoading,
  getTilesDebugInfo,
  type TilesLoadingState,
  type TilesDebugInfo,
} from '@/core/geo/GoogleTilesEngine';

const TIMEOUT_MS = 15_000;
const HORIZON_RADIUS = 5000;

/** Shader for radial gradient horizon disc */
const horizonVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const horizonFragmentShader = `
  varying vec2 vUv;
  uniform float uOpacity;
  void main() {
    float dist = distance(vUv, vec2(0.5));
    // Dark center → subtle blue edge
    vec3 center = vec3(0.02, 0.03, 0.06);
    vec3 edge = vec3(0.08, 0.12, 0.22);
    vec3 color = mix(center, edge, smoothstep(0.0, 0.5, dist));
    float alpha = smoothstep(0.5, 0.48, dist) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

export default function GoogleTilesFallback() {
  const [debug, setDebug] = useState<TilesDebugInfo>(getTilesDebugInfo);
  useEffect(() => subscribeTilesLoading(() => setDebug(getTilesDebugInfo())), []);
  const [timedOut, setTimedOut] = useState(false);
  const loadingStartRef = useRef<number | null>(null);
  const opacityRef = useRef(0);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Track loading timeout
  useEffect(() => {
    if (debug.state === 'loading-tiles') {
      if (!loadingStartRef.current) loadingStartRef.current = Date.now();
      const id = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
      return () => clearTimeout(id);
    }
    if (debug.state === 'ready') {
      loadingStartRef.current = null;
      setTimedOut(false);
    }
  }, [debug.state]);

  const shouldShow = debug.state === 'error' || timedOut;

  // Animate opacity
  useFrame((_, delta) => {
    const target = shouldShow ? 1 : 0;
    opacityRef.current += (target - opacityRef.current) * Math.min(delta * 3, 1);
    if (matRef.current) {
      matRef.current.uniforms.uOpacity.value = opacityRef.current;
    }
  });

  const uniforms = useMemo(() => ({
    uOpacity: { value: 0 },
  }), []);

  // Always render but control visibility via opacity for smooth transitions
  return (
    <group>
      {/* Enhanced grid */}
      {shouldShow && (
        <Grid
          infiniteGrid
          fadeDistance={3000}
          fadeStrength={2}
          cellSize={20}
          sectionSize={200}
          cellColor="#1e2a42"
          sectionColor="#2a4070"
          position={[0, -0.5, 0]}
        />
      )}

      {/* Horizon disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <circleGeometry args={[HORIZON_RADIUS, 128]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={horizonVertexShader}
          fragmentShader={horizonFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Horizon ring — luminous edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
        <ringGeometry args={[HORIZON_RADIUS - 5, HORIZON_RADIUS, 128]} />
        <meshBasicMaterial
          color="#3a5a9a"
          transparent
          opacity={shouldShow ? 0.4 : 0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle ambient light so fallback isn't pitch black */}
      {shouldShow && <ambientLight intensity={0.15} color="#4a6a9a" />}
    </group>
  );
}
