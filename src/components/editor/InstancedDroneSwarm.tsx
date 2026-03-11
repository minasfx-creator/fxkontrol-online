import { useRef, useMemo } from 'react';
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
 * InstancedDroneSwarm — ultra-realistic drone rendering with PBR bodies,
 * emissive LEDs with HDR color, and translucent rotor discs.
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

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);
  const rotorRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);
  const rotorAngle = useRef(0);

  // Geometries
  const bodyGeo = useMemo(() => new THREE.BoxGeometry(0.2, 0.08, 0.2), []);
  const ledGeo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 8), []);
  const rotorGeo = useMemo(() => new THREE.CircleGeometry(0.08, 16), []);
  const glowGeo = useMemo(() => new THREE.RingGeometry(0.35, 0.45, 16), []);
  const haloGeo = useMemo(() => new THREE.SphereGeometry(0.18, 8, 8), []);

  // PBR body — carbon fiber look
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0d0d1a',
    metalness: 0.9,
    roughness: 0.15,
    envMapIntensity: 0.5,
  }), []);

  // LED — emissive HDR material (toneMapped=false for bloom to catch)
  const ledMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: 8,
    toneMapped: false,
    metalness: 0.0,
    roughness: 0.1,
  }), []);

  // Rotor disc — subtle translucent spin
  const rotorMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  // Selection glow
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // LED volumetric halo — additive sphere around each LED
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const armOffsets: [number, number, number][] = useMemo(() => [
    [0.3, 0.04, 0.3],
    [-0.3, 0.04, 0.3],
    [-0.3, 0.04, -0.3],
    [0.3, 0.04, -0.3],
  ], []);

  useFrame((_, delta) => {
    if (!bodyRef.current || !ledRef.current || !rotorRef.current) return;

    rotorAngle.current += delta * 30;

    const body = bodyRef.current;
    const led = ledRef.current;
    const rotor = rotorRef.current;
    const glow = glowRef.current;
    const halo = haloRef.current;

    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const s = scale;

      // Body
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.setScalar(s);
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      body.setMatrixAt(i, _dummy.matrix);

      // LED (on top)
      _dummy.position.set(p.x, p.y + 0.06 * s, p.z);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      led.setMatrixAt(i, _dummy.matrix);
      _color.set(p.color);
      led.setColorAt(i, _color);

      // LED volumetric halo
      if (halo) {
        _dummy.position.set(p.x, p.y + 0.06 * s, p.z);
        _dummy.scale.setScalar(s * 1.5);
        _dummy.updateMatrix();
        halo.setMatrixAt(i, _dummy.matrix);
        _color.set(p.color);
        halo.setColorAt(i, _color);
      }

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

    if (halo) {
      halo.instanceMatrix.needsUpdate = true;
      if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    }

    // Hide unused
    for (let i = count; i < body.count; i++) {
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      body.setMatrixAt(i, _dummy.matrix);
      led.setMatrixAt(i, _dummy.matrix);
      if (halo) halo.setMatrixAt(i, _dummy.matrix);
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

  const maxCount = Math.max(count, 2000);

  return (
    <group>
      {/* Bodies — PBR carbon fiber */}
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, maxCount]} frustumCulled={false} castShadow />

      {/* LEDs — HDR emissive for bloom catch */}
      <instancedMesh ref={ledRef} args={[ledGeo, ledMat, maxCount]} frustumCulled={false} />

      {/* LED halos — volumetric glow spheres */}
      <instancedMesh ref={haloRef} args={[haloGeo, haloMat, maxCount]} frustumCulled={false} />

      {/* Rotors — translucent spin discs */}
      <instancedMesh ref={rotorRef} args={[rotorGeo, rotorMat, maxCount * 4]} frustumCulled={false} />

      {/* Selection glow */}
      <instancedMesh ref={glowRef} args={[glowGeo, glowMat, 1]} frustumCulled={false} visible={false} />
    </group>
  );
}
