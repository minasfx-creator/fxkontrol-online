/**
 * FestivalStageModel — procedural festival main-stage in R3F.
 *
 * Zero binary assets: deck, truss (instanced bars), LED wall (single
 * PlaneGeometry + DataTexture pulse), PA hangs, movers (instanced),
 * mine + CO₂ anchor markers (only visible when `showAnchors`).
 *
 * Performance budget: target ≤ 4 extra draw calls vs an empty scene.
 *  - 1 deck mesh
 *  - 1 InstancedMesh truss bars
 *  - 1 LED wall plane (DataTexture)
 *  - 1 InstancedMesh movers
 *  - 1 plane for ground (audience)
 */

import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FESTIVAL_STAGE_ANCHORS } from '@/data/stage/stageAnchors';

export interface FestivalStageModelProps {
  variant?: 'arch' | 'festival' | 'festival-small' | 'minimal' | 'none';
  showAnchors?: boolean;
  ledPulseHz?: number;
}

const TRUSS_BAR_W = 0.06;

export function FestivalStageModel({
  variant = 'festival',
  showAnchors = false,
  ledPulseHz = 2,
}: FestivalStageModelProps) {
  if (variant === 'none') return null;
  const small = variant === 'festival-small';

  // ── LED wall: 224×128 RGBA DataTexture pulses on uniform "time".
  const { ledTex, ledMat, ledData } = useMemo(() => {
    const w = small ? 112 : 224;
    const h = small ? 64 : 128;
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 6; data[i + 1] = 24; data[i + 2] = 64; data[i + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    return { ledTex: tex, ledMat: mat, ledData: data };
  }, [small]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const phase = (Math.sin(t * Math.PI * 2 * ledPulseHz) * 0.5 + 0.5);
    const r = Math.floor(20 + 60 * phase);
    const g = Math.floor(40 + 100 * phase);
    const b = Math.floor(120 + 135 * phase);
    for (let i = 0; i < ledData.length; i += 4) {
      ledData[i] = r;
      ledData[i + 1] = g;
      ledData[i + 2] = b;
    }
    ledTex.needsUpdate = true;
  });

  // ── Truss bars: instanced rectangular pillars + lintels (procedural)
  const trussRef = useRef<THREE.InstancedMesh>(null);
  const trussCount = small ? 6 : 12;
  useEffect(() => {
    if (!trussRef.current) return;
    const dummy = new THREE.Object3D();
    const halfW = small ? 8 : 10;
    const top = small ? 8 : 12;
    let idx = 0;
    // 4 vertical columns (corners of the portal)
    [[-halfW, 0], [halfW, 0], [-halfW, -6], [halfW, -6]].forEach(([x, z]) => {
      dummy.position.set(x, top / 2, z);
      dummy.scale.set(TRUSS_BAR_W, top, TRUSS_BAR_W);
      dummy.updateMatrix();
      trussRef.current!.setMatrixAt(idx++, dummy.matrix);
    });
    // 2 lintels (front & back)
    [-6, 0].forEach((z) => {
      dummy.position.set(0, top, z);
      dummy.scale.set(halfW * 2, TRUSS_BAR_W, TRUSS_BAR_W);
      dummy.updateMatrix();
      trussRef.current!.setMatrixAt(idx++, dummy.matrix);
    });
    // Filler diagonals (visual richness, fixed pattern)
    while (idx < trussCount) {
      dummy.position.set((idx % 2 ? 1 : -1) * halfW, top - (idx * 0.4), -3);
      dummy.scale.set(TRUSS_BAR_W * 1.5, TRUSS_BAR_W, halfW * 0.8);
      dummy.rotation.set(0, 0, (idx % 2 ? 0.3 : -0.3));
      dummy.updateMatrix();
      trussRef.current!.setMatrixAt(idx++, dummy.matrix);
      dummy.rotation.set(0, 0, 0);
    }
    trussRef.current.instanceMatrix.needsUpdate = true;
  }, [trussCount, small]);

  // ── Movers (instanced)
  const moverRef = useRef<THREE.InstancedMesh>(null);
  const moverCount = small ? 6 : 14;
  useEffect(() => {
    if (!moverRef.current) return;
    const dummy = new THREE.Object3D();
    const halfW = small ? 7 : 9;
    for (let i = 0; i < moverCount; i++) {
      const t = (i / (moverCount - 1)) * 2 - 1;
      dummy.position.set(t * halfW, (small ? 7.8 : 11.6), -2.8);
      dummy.scale.set(0.3, 0.3, 0.3);
      dummy.updateMatrix();
      moverRef.current.setMatrixAt(i, dummy.matrix);
    }
    moverRef.current.instanceMatrix.needsUpdate = true;
  }, [moverCount, small]);

  return (
    <group>
      {/* Deck */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[small ? 12 : 18, 1.2, small ? 8 : 12]} />
        <meshStandardMaterial color="#0d1117" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Truss bars (instanced) */}
      <instancedMesh ref={trussRef} args={[undefined, undefined, trussCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.6} roughness={0.4} />
      </instancedMesh>

      {/* LED wall */}
      <mesh position={[0, small ? 4 : 5, small ? -3.5 : -5.5]}>
        <planeGeometry args={[small ? 8 : 14, small ? 5 : 8]} />
        <primitive object={ledMat} attach="material" />
      </mesh>

      {/* Movers (instanced) */}
      <instancedMesh ref={moverRef} args={[undefined, undefined, moverCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#202428" emissive="#163352" emissiveIntensity={0.6} />
      </instancedMesh>

      {/* Audience ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 30]} receiveShadow>
        <planeGeometry args={[small ? 50 : 80, small ? 40 : 60]} />
        <meshStandardMaterial color="#050810" roughness={1} metalness={0} />
      </mesh>

      {/* Anchor debug markers */}
      {showAnchors &&
        FESTIVAL_STAGE_ANCHORS.map((a) => (
          <mesh key={a.id} position={a.position}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial
              color={a.kind.startsWith('mine') ? '#ff7b3a' : a.kind.startsWith('co2') ? '#7adfff' : '#9aff7a'}
              toneMapped={false}
            />
          </mesh>
        ))}
    </group>
  );
}
