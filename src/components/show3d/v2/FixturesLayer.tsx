/**
 * FixturesLayer — Renderiza fixtures importadas do MVR (UE5 5.7) como
 * InstancedMesh agrupadas por `kind`. Presentation only — não dispara
 * nada, não toca CommandBus.
 *
 * Performance:
 *  - 1 InstancedMesh por kind (≈13 kinds → ≤13 draw calls extra)
 *  - 838 fixtures totais → matrices pré-computadas no useMemo
 *  - Dispose determinístico (M5)
 *  - Pulse leve via useProjectStore.currentTime (sync com timeline)
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import mvrCatalog from '@/assets/ue5/mvrCatalog.json';
import { useShowTimeRef } from './useShowTimeRef';

type FixtureKind =
  | 'mover-spot' | 'mover-wash' | 'wash-static' | 'stadium-light'
  | 'strobe' | 'truss-toner' | 'audience-blinder' | 'audience-strip'
  | 'pixel-strip' | 'sphere' | 'laser' | 'pyro' | 'fireworks' | 'generic';

interface MvrFixture {
  name: string; uuid: string; gdtf: string;
  kind: FixtureKind; fixtureId: number | null;
  address: number | null; position: [number, number, number];
}

// Visual recipes per kind (geometry + base color + emissive intensity)
const RECIPES: Record<FixtureKind, {
  geom: () => THREE.BufferGeometry;
  color: number;
  emissive: number;
  scale: [number, number, number];
}> = {
  'mover-spot':       { geom: () => new THREE.CylinderGeometry(0.18, 0.22, 0.55, 12), color: 0xfff0c0, emissive: 1.4, scale: [1, 1, 1] },
  'mover-wash':       { geom: () => new THREE.CylinderGeometry(0.22, 0.28, 0.5, 12),  color: 0xc8e6ff, emissive: 1.2, scale: [1, 1, 1] },
  'wash-static':      { geom: () => new THREE.BoxGeometry(0.45, 0.3, 0.4),            color: 0xc8e6ff, emissive: 0.9, scale: [1, 1, 1] },
  'stadium-light':    { geom: () => new THREE.BoxGeometry(0.8, 0.4, 0.5),             color: 0xffffe0, emissive: 0.7, scale: [1, 1, 1] },
  'strobe':           { geom: () => new THREE.BoxGeometry(0.35, 0.35, 0.15),          color: 0xffffff, emissive: 2.0, scale: [1, 1, 1] },
  'truss-toner':      { geom: () => new THREE.BoxGeometry(0.6, 0.18, 0.18),           color: 0x7dd3fc, emissive: 0.8, scale: [1, 1, 1] },
  'audience-blinder': { geom: () => new THREE.BoxGeometry(0.5, 0.5, 0.2),             color: 0xfff7c8, emissive: 1.5, scale: [1, 1, 1] },
  'audience-strip':   { geom: () => new THREE.BoxGeometry(1.6, 0.12, 0.12),           color: 0xfff7c8, emissive: 0.6, scale: [1, 1, 1] },
  'pixel-strip':      { geom: () => new THREE.BoxGeometry(2.2, 0.08, 0.08),           color: 0x6cf0d0, emissive: 0.7, scale: [1, 1, 1] },
  'sphere':           { geom: () => new THREE.SphereGeometry(0.4, 16, 12),            color: 0x9ad6ff, emissive: 0.5, scale: [1, 1, 1] },
  'laser':            { geom: () => new THREE.ConeGeometry(0.18, 0.5, 10),            color: 0x52ff8a, emissive: 1.8, scale: [1, 1, 1] },
  'pyro':             { geom: () => new THREE.CylinderGeometry(0.1, 0.18, 0.35, 8),   color: 0xff8a3a, emissive: 0.4, scale: [1, 1, 1] },
  'fireworks':        { geom: () => new THREE.CylinderGeometry(0.12, 0.18, 0.4, 8),   color: 0xff5cad, emissive: 0.5, scale: [1, 1, 1] },
  'generic':          { geom: () => new THREE.BoxGeometry(0.3, 0.3, 0.3),             color: 0x808080, emissive: 0.2, scale: [1, 1, 1] },
};

// Bound the catalog used at render-time so we never explode draw count.
// MVR has 838 fixtures across the open-air pyrotechnic stadium; we render
// all of them as instanced meshes (cheap on modern GPUs).
const MAX_PER_KIND = 256; // cap for safety on weak iGPU

interface FixturesLayerProps {
  /** Override fixture list (otherwise uses bundled MVR catalog). */
  fixtures?: MvrFixture[];
  /** Multiply intensity of the emissive pulse (0 = static). Default 1. */
  pulseStrength?: number;
  /** Translate group XZ to recenter on stage. Default [0,0,0]. */
  origin?: [number, number, number];
}

export function FixturesLayer({
  fixtures,
  pulseStrength = 1,
  origin = [0, 0, 0],
}: FixturesLayerProps) {
  const list = useMemo<MvrFixture[]>(
    () => (fixtures ?? ((mvrCatalog as unknown) as { fixtures: MvrFixture[] }).fixtures),
    [fixtures],
  );

  // Re-center to stage origin: the MVR comes in stadium coords; we shift
  // mean(XZ) → origin so the cluster sits over the SkyCanvas2 stage.
  const groupedByKind = useMemo(() => {
    let cx = 0, cz = 0;
    for (const f of list) { cx += f.position[0]; cz += f.position[2]; }
    cx /= list.length; cz /= list.length;
    const groups = new Map<FixtureKind, MvrFixture[]>();
    for (const f of list) {
      const arr = groups.get(f.kind) ?? [];
      arr.push({
        ...f,
        position: [f.position[0] - cx + origin[0], f.position[1] + origin[1], f.position[2] - cz + origin[2]],
      });
      groups.set(f.kind, arr);
    }
    return groups;
  }, [list, origin]);

  return (
    <group>
      {Array.from(groupedByKind.entries()).map(([kind, items]) => (
        <KindInstanced key={kind} kind={kind} items={items.slice(0, MAX_PER_KIND)} pulseStrength={pulseStrength} />
      ))}
    </group>
  );
}

function KindInstanced({
  kind, items, pulseStrength,
}: { kind: FixtureKind; items: MvrFixture[]; pulseStrength: number }) {
  const recipe = RECIPES[kind] ?? RECIPES.generic;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useShowTimeRef();

  const { geometry, material } = useMemo(() => {
    const g = recipe.geom();
    const m = new THREE.MeshStandardMaterial({
      color: recipe.color,
      emissive: recipe.color,
      emissiveIntensity: recipe.emissive,
      roughness: 0.6,
      metalness: 0.2,
      toneMapped: true,
    });
    return { geometry: g, material: m };
  }, [recipe]);

  // Seed instance matrices once.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const obj = new THREE.Object3D();
    items.forEach((f, i) => {
      obj.position.set(f.position[0], Math.max(0.1, f.position[1] * 0.01), f.position[2]);
      // MVR Y was already mapped to height (m). Soften extreme stadium altitudes
      // (rigging at 340m+) → use 0.01 multiplier to keep within camera range.
      obj.rotation.set(0, (i * 0.31) % (Math.PI * 2), 0);
      obj.scale.set(...recipe.scale);
      obj.updateMatrix();
      mesh.setMatrixAt(i, obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, recipe.scale]);

  // Subtle deterministic emissive pulse (stagger by kind hash).
  useFrame(() => {
    if (pulseStrength <= 0 || !meshRef.current) return;
    const t = timeRef.current.time;
    const phase = kind.length * 0.7;
    const pulse = recipe.emissive * (0.85 + 0.15 * Math.sin(t * 1.3 + phase) * pulseStrength);
    (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
  });

  // M5 disposal
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, items.length]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled
    />
  );
}
