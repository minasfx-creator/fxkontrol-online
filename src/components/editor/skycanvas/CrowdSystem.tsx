/**
 * CrowdSystem — Procedural audience silhouettes in FOH area
 * Uses InstancedMesh for ~200 human figures with animated reactions:
 * idle sway, arms up, jumping, clapping — synced to show energy
 * Refs: AS_LevitatingMagicAttack, AS_MagicStrike, AS_ManaCastShot animations
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

const CROWD_COUNT = 200;
const FOH_START_Z = 15;
const FOH_DEPTH = 30;
const FOH_WIDTH = 35;

type CrowdReaction = 'idle' | 'arms-up' | 'jumping' | 'clapping';

interface CrowdPerson {
  x: number;
  z: number;
  height: number;
  shade: number;
  phase: number;
  reaction: CrowdReaction;
  reactionTimer: number;
  jumpPhase: number;
}

export default function CrowdSystem() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const crowdRef = useRef<CrowdPerson[]>([]);

  // Seeded RNG
  const rng = useMemo(() => {
    let s = 42;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }, []);

  // Generate crowd positions
  const crowdData = useMemo(() => {
    const rand = rng;
    const data: CrowdPerson[] = [];

    for (let i = 0; i < CROWD_COUNT; i++) {
      const row = Math.floor(i / 20);
      const col = i % 20;
      const rowZ = FOH_START_Z + row * (FOH_DEPTH / 10) + rand() * 2;
      const spread = FOH_WIDTH * (0.6 + row * 0.04);
      const rowX = (col / 19 - 0.5) * spread * 2 + (rand() - 0.5) * 1.5;

      data.push({
        x: rowX,
        z: rowZ,
        height: 1.6 + rand() * 0.3,
        shade: 0.04 + rand() * 0.06,
        phase: rand() * Math.PI * 2,
        reaction: 'idle',
        reactionTimer: rand() * 5,
        jumpPhase: 0,
      });
    }
    crowdRef.current = data;
    return data;
  }, [rng]);

  // Merged geometry: body capsule + head + arms
  const geometry = useMemo(() => {
    const bodyH = 1.0;
    const bodyR = 0.13;
    const headR = 0.09;
    const body = new THREE.CylinderGeometry(bodyR, bodyR * 0.85, bodyH, 6, 1);
    body.translate(0, bodyH / 2, 0);
    const head = new THREE.SphereGeometry(headR, 6, 4);
    head.translate(0, bodyH + headR + 0.02, 0);
    // Arms as thin boxes
    const armL = new THREE.BoxGeometry(0.04, 0.45, 0.04);
    armL.translate(-bodyR - 0.04, bodyH * 0.6, 0);
    const armR = new THREE.BoxGeometry(0.04, 0.45, 0.04);
    armR.translate(bodyR + 0.04, bodyH * 0.6, 0);

    const allGeos = [body, head, armL, armR];
    const totalVerts = allGeos.reduce((s, g) => s + g.getAttribute('position').count, 0);
    const totalIdx = allGeos.reduce((s, g) => s + (g.getIndex()?.count || 0), 0);
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const indices = new Uint16Array(totalIdx);
    let vOff = 0, iOff = 0;

    for (const g of allGeos) {
      const pos = g.getAttribute('position');
      const norm = g.getAttribute('normal');
      const idx = g.getIndex()!;
      for (let i = 0; i < pos.count; i++) {
        positions[(vOff + i) * 3] = pos.getX(i);
        positions[(vOff + i) * 3 + 1] = pos.getY(i);
        positions[(vOff + i) * 3 + 2] = pos.getZ(i);
        normals[(vOff + i) * 3] = norm.getX(i);
        normals[(vOff + i) * 3 + 1] = norm.getY(i);
        normals[(vOff + i) * 3 + 2] = norm.getZ(i);
      }
      for (let i = 0; i < idx.count; i++) {
        indices[iOff + i] = idx.array[i] + vOff;
      }
      vOff += pos.count;
      iOff += idx.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeBoundingSphere();
    allGeos.forEach(g => g.dispose());
    return merged;
  }, []);

  // Set initial transforms
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < CROWD_COUNT; i++) {
      const d = crowdData[i];
      dummy.position.set(d.x, 0, d.z);
      dummy.scale.set(1, d.height / 1.6, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setRGB(d.shade, d.shade, d.shade + 0.01);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [crowdData]);

  // Animated reactions
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    const dt = Math.min(delta, 0.05);
    const t = performance.now() * 0.001;
    const crowd = crowdRef.current;

    // Check if show is playing (energy level)
    const { currentTime, timelineItems } = useProjectStore.getState();
    const activeCues = timelineItems.filter(item => {
      const elapsed = currentTime - item.startTime;
      return elapsed >= -0.5 && elapsed < 3;
    }).length;
    const energy = Math.min(activeCues / 5, 1); // 0-1 show energy

    for (let i = 0; i < CROWD_COUNT; i++) {
      const d = crowd[i];
      d.reactionTimer -= dt;

      // Switch reactions based on energy
      if (d.reactionTimer <= 0) {
        if (energy > 0.7) {
          const r = Math.random();
          d.reaction = r < 0.4 ? 'arms-up' : r < 0.7 ? 'jumping' : 'clapping';
        } else if (energy > 0.3) {
          d.reaction = Math.random() < 0.3 ? 'arms-up' : 'idle';
        } else {
          d.reaction = 'idle';
        }
        d.reactionTimer = 1.5 + Math.random() * 3;
      }

      let yOffset = 0;
      let rotY = 0;
      let scaleY = d.height / 1.6;

      switch (d.reaction) {
        case 'idle':
          rotY = Math.sin(t * 0.4 + d.phase) * 0.05;
          break;
        case 'arms-up':
          rotY = Math.sin(t * 0.6 + d.phase) * 0.03;
          scaleY *= 1.08; // arms up = slightly taller silhouette
          break;
        case 'jumping':
          d.jumpPhase += dt * 6;
          yOffset = Math.abs(Math.sin(d.jumpPhase)) * 0.3;
          rotY = Math.sin(t * 1.2 + d.phase) * 0.04;
          break;
        case 'clapping':
          rotY = Math.sin(t * 3 + d.phase) * 0.06; // faster sway
          scaleY *= 1 + Math.sin(t * 6 + d.phase) * 0.02; // subtle pulse
          break;
      }

      dummy.position.set(d.x, yOffset, d.z);
      dummy.scale.set(1, scaleY, 1);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, CROWD_COUNT]}
      frustumCulled
    >
      <meshStandardMaterial
        color="#111111"
        roughness={0.95}
        metalness={0}
        vertexColors
      />
    </instancedMesh>
  );
}
