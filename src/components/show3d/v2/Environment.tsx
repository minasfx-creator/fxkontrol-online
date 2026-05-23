/**
 * SkyCanvas 2.0 — Environment (sky + ground).
 *
 * Vantablack canônico (#050810) + grid cyan-dessat conforme paleta operacional.
 * Round 16: hemisphere dome (BackSide) + hemiLight + 8k stars + emissive ground.
 */
import { Stars, Grid } from '@react-three/drei';
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

const VANTABLACK = '#050810';
const CYAN_DESSAT = '#2dd4ff';
const GRID_CELL = '#1a3550';
const GROUND = '#0a0f1a';

/** Hemisphere dome — gradiente vertical Vantablack→cyan-dessat 6%, custo 1 draw. */
function SkyDome() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(VANTABLACK) },
        uHorizon: { value: new THREE.Color('#0a1628') },
      },
      vertexShader: /* glsl */ `
        varying float vY;
        void main() {
          vY = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vY;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        void main() {
          float t = smoothstep(-0.05, 0.55, vY);
          vec3 col = mix(uHorizon, uTop, t);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);
  useEffect(() => () => { material.dispose(); }, [material]);
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[800, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export function NightSky({ stars = true }: { stars?: boolean }) {
  return (
    <>
      <color attach="background" args={[VANTABLACK]} />
      <fog attach="fog" args={[VANTABLACK, 140, 950]} />
      <SkyDome />
      {stars && (
        <Stars
          radius={400}
          depth={80}
          count={8000}
          factor={4}
          saturation={0}
          fade
          speed={0.25}
        />
      )}
      <ambientLight intensity={0.1} />
      <hemisphereLight args={[CYAN_DESSAT, GROUND, 0.22]} />
      <directionalLight position={[40, 80, 40]} intensity={0.18} color="#9ec6ff" />
    </>
  );
}

export function GroundPlane({ grid = true }: { grid?: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color={GROUND}
          roughness={0.95}
          metalness={0.05}
          emissive={'#040810'}
          emissiveIntensity={0.4}
        />
      </mesh>
      {grid && (
        <Grid
          args={[200, 200]}
          cellSize={5}
          cellThickness={0.5}
          cellColor={GRID_CELL}
          sectionSize={25}
          sectionThickness={1}
          sectionColor={CYAN_DESSAT}
          fadeDistance={250}
          fadeStrength={1.2}
          infiniteGrid={false}
          position={[0, 0.01, 0]}
        />
      )}
    </group>
  );
}
