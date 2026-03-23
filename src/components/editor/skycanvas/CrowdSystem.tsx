/**
 * CrowdSystem — Procedural audience silhouettes in FOH area
 * Uses InstancedMesh for ~200 human figures with idle sway animation
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CROWD_COUNT = 200;
const FOH_START_Z = 15; // audience starts past stage front
const FOH_DEPTH = 30;
const FOH_WIDTH = 35;

export default function CrowdSystem() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const phasesRef = useRef<Float32Array>(new Float32Array(CROWD_COUNT));

  // Generate crowd positions + attributes
  const crowdData = useMemo(() => {
    const data: { x: number; z: number; height: number; shade: number }[] = [];
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    };
    const rand = rng(42);

    for (let i = 0; i < CROWD_COUNT; i++) {
      // Semicircular distribution weighted toward center
      const row = Math.floor(i / 20);
      const col = i % 20;
      const rowZ = FOH_START_Z + row * (FOH_DEPTH / 10) + rand() * 2;
      const spread = FOH_WIDTH * (0.6 + row * 0.04);
      const rowX = (col / 19 - 0.5) * spread * 2 + (rand() - 0.5) * 1.5;

      data.push({
        x: rowX,
        z: rowZ,
        height: 1.6 + rand() * 0.3,
        shade: 0.04 + rand() * 0.06, // dark clothing
      });
      phasesRef.current[i] = rand() * Math.PI * 2;
    }
    return data;
  }, []);

  // Build geometry: capsule-like shape (cylinder body + sphere head)
  const geometry = useMemo(() => {
    const bodyH = 1.2;
    const bodyR = 0.15;
    const headR = 0.1;
    const body = new THREE.CylinderGeometry(bodyR, bodyR * 0.9, bodyH, 6, 1);
    body.translate(0, bodyH / 2, 0);
    const head = new THREE.SphereGeometry(headR, 6, 4);
    head.translate(0, bodyH + headR, 0);

    const merged = new THREE.BufferGeometry();
    // Merge manually
    const bodyPos = body.getAttribute('position');
    const headPos = head.getAttribute('position');
    const totalVerts = bodyPos.count + headPos.count;
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);

    for (let i = 0; i < bodyPos.count; i++) {
      positions[i * 3] = bodyPos.getX(i);
      positions[i * 3 + 1] = bodyPos.getY(i);
      positions[i * 3 + 2] = bodyPos.getZ(i);
    }
    const bodyNorm = body.getAttribute('normal');
    for (let i = 0; i < bodyNorm.count; i++) {
      normals[i * 3] = bodyNorm.getX(i);
      normals[i * 3 + 1] = bodyNorm.getY(i);
      normals[i * 3 + 2] = bodyNorm.getZ(i);
    }
    const offset = bodyPos.count;
    for (let i = 0; i < headPos.count; i++) {
      positions[(offset + i) * 3] = headPos.getX(i);
      positions[(offset + i) * 3 + 1] = headPos.getY(i);
      positions[(offset + i) * 3 + 2] = headPos.getZ(i);
    }
    const headNorm = head.getAttribute('normal');
    for (let i = 0; i < headNorm.count; i++) {
      normals[(offset + i) * 3] = headNorm.getX(i);
      normals[(offset + i) * 3 + 1] = headNorm.getY(i);
      normals[(offset + i) * 3 + 2] = headNorm.getZ(i);
    }

    // Merge indices
    const bodyIdx = body.getIndex()!;
    const headIdx = head.getIndex()!;
    const indices = new Uint16Array(bodyIdx.count + headIdx.count);
    for (let i = 0; i < bodyIdx.count; i++) indices[i] = bodyIdx.array[i];
    for (let i = 0; i < headIdx.count; i++) indices[bodyIdx.count + i] = headIdx.array[i] + offset;

    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeBoundingSphere();

    body.dispose();
    head.dispose();
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

  // Idle sway animation
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    const t = performance.now() * 0.001;

    for (let i = 0; i < CROWD_COUNT; i++) {
      const d = crowdData[i];
      const phase = phasesRef.current[i];
      const sway = Math.sin(t * 0.4 + phase) * 0.05; // ±3° subtle sway
      dummy.position.set(d.x, 0, d.z);
      dummy.scale.set(1, d.height / 1.6, 1);
      dummy.rotation.set(0, sway, 0);
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
