import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  computeFixtureLayout,
  type LayoutPreset,
  type LayoutOverrides,
  type LayoutableFixture,
} from '@/lib/fixtureAutoLayout';

interface Props {
  fixtures: LayoutableFixture[];
  layoutPreset: LayoutPreset;
  categoryOverrides?: Record<string, LayoutOverrides>;
  selected?: Set<number>;
}

const CATEGORY_COLORS: Record<string, string> = {
  spot: '#f59e0b',
  wash: '#3b82f6',
  beam: '#a855f7',
  'led-bar': '#22c55e',
  strobe: '#eab308',
  sfx: '#ef4444',
  laser: '#10b981',
  drone: '#06b6d4',
};

function FixtureDots({ fixtures, positions, selected }: {
  fixtures: LayoutableFixture[];
  positions: { x: number; y: number; z: number }[];
  selected?: Set<number>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { matrix, colors } = useMemo(() => {
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const matrices: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];

    for (let i = 0; i < fixtures.length; i++) {
      const pos = positions[i];
      if (!pos) continue;
      const isSelected = !selected || selected.has(i);
      m.makeTranslation(pos.x, pos.y, pos.z);
      matrices.push(m.clone());
      const hex = CATEGORY_COLORS[fixtures[i].category] || '#888888';
      color.set(hex);
      if (!isSelected) color.multiplyScalar(0.3);
      cols.push(color.clone());
    }
    return { matrix: matrices, colors: cols };
  }, [fixtures, positions, selected]);

  useMemo(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < matrix.length; i++) {
      mesh.setMatrixAt(i, matrix[i]);
      mesh.setColorAt(i, colors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrix, colors]);

  if (fixtures.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, fixtures.length]}>
      <sphereGeometry args={[0.3, 8, 6]} />
      <meshStandardMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function GroundGrid() {
  return (
    <gridHelper args={[60, 30, '#333333', '#222222']} rotation={[0, 0, 0]} />
  );
}

export default function FixtureLayoutPreview({ fixtures, layoutPreset, categoryOverrides, selected }: Props) {
  const positions = useMemo(() => {
    if (fixtures.length === 0) return [];
    return computeFixtureLayout(fixtures, layoutPreset, categoryOverrides);
  }, [fixtures, layoutPreset, categoryOverrides]);

  const center = useMemo(() => {
    if (positions.length === 0) return new THREE.Vector3(0, 4, 0);
    const avg = positions.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
      { x: 0, y: 0, z: 0 }
    );
    return new THREE.Vector3(
      avg.x / positions.length,
      avg.y / positions.length,
      avg.z / positions.length
    );
  }, [positions]);

  if (fixtures.length === 0) return null;

  return (
    <div className="w-full h-[180px] rounded-md overflow-hidden border border-border bg-black/80">
      <Canvas
        camera={{ position: [20, 18, 20], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} />
        <FixtureDots fixtures={fixtures} positions={positions} selected={selected} />
        <GroundGrid />
        <OrbitControls
          target={center}
          enablePan={false}
          enableZoom={true}
          maxDistance={80}
          minDistance={5}
          makeDefault
        />
      </Canvas>
    </div>
  );
}
