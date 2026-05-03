/**
 * SkyCanvas 2.0 — Environment (sky + ground).
 *
 * Vantablack canônico (#050810) + grid cyan-dessat conforme paleta operacional.
 */
import { Stars, Grid } from '@react-three/drei';

const VANTABLACK = '#050810';
const CYAN_DESSAT = '#2dd4ff';
const GRID_CELL = '#1a3550';
const GROUND = '#0a0f1a';

export function NightSky({ stars = true }: { stars?: boolean }) {
  return (
    <>
      <color attach="background" args={[VANTABLACK]} />
      <fog attach="fog" args={[VANTABLACK, 120, 900]} />
      {stars && (
        <Stars
          radius={400}
          depth={80}
          count={6000}
          factor={4}
          saturation={0}
          fade
          speed={0.4}
        />
      )}
      <ambientLight intensity={0.12} />
      <directionalLight position={[40, 80, 40]} intensity={0.18} color="#9ec6ff" />
    </>
  );
}

export function GroundPlane({ grid = true }: { grid?: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color={GROUND} roughness={1} metalness={0} />
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
