import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface DronePosition {
  x: number;
  y: number;
  z: number;
  color: string;
}

/**
 * InstancedDroneSwarm — renders up to thousands of drones with only a few draw calls
 * using THREE.InstancedMesh. Each drone = body instance + LED instance + rotor disc instances.
 */
export default function InstancedDroneSwarm({
  positions,
  selectedIndex = -1,
  scale = 0.6,
}: {
  positions: DronePosition[];
  selectedIndex?: number;
  scale?: number;
}) {
  const count = positions.length;

  // Refs for instanced meshes
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);
  const rotorRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const rotorAngle = useRef(0);

  // Geometries (created once)
  const bodyGeo = useMemo(() => new THREE.BoxGeometry(0.2, 0.08, 0.2), []);
  const ledGeo = useMemo(() => new THREE.SphereGeometry(0.04, 6, 6), []);
  const rotorGeo = useMemo(() => new THREE.CircleGeometry(0.08, 12), []);
  const glowGeo = useMemo(() => new THREE.RingGeometry(0.35, 0.45, 16), []);

  // Materials
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1a1a2e',
    metalness: 0.8,
    roughness: 0.3,
  }), []);

  const ledMat = useMemo(() => new THREE.MeshBasicMaterial({
    toneMapped: false,
  }), []);

  const rotorMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // Arm offsets for 4 rotors
  const armOffsets: [number, number, number][] = useMemo(() => [
    [0.3, 0.04, 0.3],
    [-0.3, 0.04, 0.3],
    [-0.3, 0.04, -0.3],
    [0.3, 0.04, -0.3],
  ], []);

  // Update instances every frame
  useFrame((_, delta) => {
    if (!bodyRef.current || !ledRef.current || !rotorRef.current) return;

    rotorAngle.current += delta * 25;

    const body = bodyRef.current;
    const led = ledRef.current;
    const rotor = rotorRef.current;
    const glow = glowRef.current;

    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const s = scale;

      // Body
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.setScalar(s);
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      body.setMatrixAt(i, _dummy.matrix);

      // LED (on top of body)
      _dummy.position.set(p.x, p.y + 0.06 * s, p.z);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      led.setMatrixAt(i, _dummy.matrix);
      _color.set(p.color);
      led.setColorAt(i, _color);

      // 4 rotors per drone
      for (let r = 0; r < 4; r++) {
        const idx = i * 4 + r;
        const arm = armOffsets[r];
        _dummy.position.set(
          p.x + arm[0] * s,
          p.y + arm[1] * s,
          p.z + arm[2] * s,
        );
        _dummy.scale.setScalar(s);
        _dummy.rotation.set(-Math.PI / 2, rotorAngle.current + r * 1.57, 0);
        _dummy.updateMatrix();
        rotor.setMatrixAt(idx, _dummy.matrix);
        _color.set(p.color);
        rotor.setColorAt(idx, _color);
      }

      // Selection glow ring
      if (glow && i === selectedIndex) {
        _dummy.position.set(p.x, p.y - 0.05 * s, p.z);
        _dummy.scale.setScalar(s);
        _dummy.rotation.set(-Math.PI / 2, 0, 0);
        _dummy.updateMatrix();
        glow.setMatrixAt(0, _dummy.matrix);
        _color.set(p.color);
        glow.setColorAt(0, _color);
        glow.instanceMatrix.needsUpdate = true;
        if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
        glow.visible = true;
      }
    }

    body.instanceMatrix.needsUpdate = true;
    led.instanceMatrix.needsUpdate = true;
    if (led.instanceColor) led.instanceColor.needsUpdate = true;
    rotor.instanceMatrix.needsUpdate = true;
    if (rotor.instanceColor) rotor.instanceColor.needsUpdate = true;

    // Hide unused instances by scaling to 0
    for (let i = count; i < body.count; i++) {
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      body.setMatrixAt(i, _dummy.matrix);
      led.setMatrixAt(i, _dummy.matrix);
    }
    for (let idx = count * 4; idx < rotor.count; idx++) {
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      rotor.setMatrixAt(idx, _dummy.matrix);
    }

    if (glow && selectedIndex < 0) {
      glow.visible = false;
    }
  });

  // Max instance count (allocate for up to 2000 drones)
  const maxCount = Math.max(count, 2000);

  return (
    <group>
      {/* Bodies — 1 draw call */}
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, maxCount]} frustumCulled={false} />

      {/* LEDs — 1 draw call with per-instance color */}
      <instancedMesh ref={ledRef} args={[ledGeo, ledMat, maxCount]} frustumCulled={false} />

      {/* Rotors — 1 draw call (4 per drone) */}
      <instancedMesh ref={rotorRef} args={[rotorGeo, rotorMat, maxCount * 4]} frustumCulled={false} />

      {/* Selection glow — only 1 instance needed */}
      <instancedMesh ref={glowRef} args={[glowGeo, glowMat, 1]} frustumCulled={false} visible={false} />
    </group>
  );
}
