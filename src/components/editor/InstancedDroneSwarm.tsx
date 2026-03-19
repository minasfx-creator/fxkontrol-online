import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createDroneMaterials } from '@/render_ultra/drones/droneMaterials';
import useGenerativeStore from '@/store/useGenerativeStore';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface DronePosition {
  x: number;
  y: number;
  z: number;
  color: string;
}

/**
 * InstancedDroneSwarm — ultra-realistic instanced drone rendering.
 * PBR carbon fiber bodies, HDR emissive LEDs, volumetric halos,
 * spinning translucent rotor discs, and navigation lights.
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
  const navRef = useRef<THREE.InstancedMesh>(null);
  const rotorAngle = useRef(0);

  // Geometries
  const bodyGeo = useMemo(() => new THREE.BoxGeometry(0.22, 0.07, 0.22), []);
  const ledGeo = useMemo(() => new THREE.SphereGeometry(0.04, 12, 12), []);
  const rotorGeo = useMemo(() => new THREE.CircleGeometry(0.09, 20), []);
  const glowGeo = useMemo(() => new THREE.RingGeometry(0.35, 0.5, 24), []);
  const haloGeo = useMemo(() => new THREE.SphereGeometry(0.07, 8, 8), []);
  const navGeo = useMemo(() => new THREE.SphereGeometry(0.012, 6, 6), []);

  // ═══ PBR Materials from render_ultra — carbon fiber calibrated ═══
  const pbrMaterials = useMemo(() => createDroneMaterials(), []);

  // Body — carbon fiber (metalness 0.3, roughness 0.6, envMapIntensity 0.8)
  const bodyMat = useMemo(() => pbrMaterials.body, [pbrMaterials]);

  // LED — solid color dot, no glow spill
  const ledMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#222222',
    emissive: '#ffffff',
    emissiveIntensity: 0.008,
    toneMapped: true,
    metalness: 0.0,
    roughness: 0.7,
  }), []);

  // Rotor disc — NO additive blending, just subtle transparent
  const rotorMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: '#888888',
      transparent: true,
      opacity: 0.006,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    return m;
  }, []);

  // Selection glow — NO additive
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.096,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  // LED halo — disabled (opacity near zero, no additive)
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.0016,
    depthWrite: false,
  }), []);

  // Nav lights
  const navMat = useMemo(() => new THREE.MeshBasicMaterial({
    toneMapped: true,
    transparent: true,
    opacity: 0.12,
  }), []);

  const armOffsets: [number, number, number][] = useMemo(() => [
    [0.3, 0.05, 0.3],
    [-0.3, 0.05, 0.3],
    [-0.3, 0.05, -0.3],
    [0.3, 0.05, -0.3],
  ], []);

  const navColors = useMemo(() => [
    new THREE.Color('#00ff44'),
    new THREE.Color('#00ff44'),
    new THREE.Color('#ff2200'),
    new THREE.Color('#ff2200'),
  ], []);

  useFrame((_, delta) => {
    if (!bodyRef.current || !ledRef.current || !rotorRef.current) return;

    rotorAngle.current += delta * 35;

    const body = bodyRef.current;
    const led = ledRef.current;
    const rotor = rotorRef.current;
    const glow = glowRef.current;
    const halo = haloRef.current;
    const nav = navRef.current;
    const t = Date.now() * 0.003;

    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const s = scale;
      const hover = Math.sin(t + p.x * 2 + p.z) * 0.015;

      // Body
      _dummy.position.set(p.x, p.y + hover, p.z);
      _dummy.scale.setScalar(s);
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      body.setMatrixAt(i, _dummy.matrix);

      // LED (on top)
      _dummy.position.set(p.x, p.y + 0.06 * s + hover, p.z);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      led.setMatrixAt(i, _dummy.matrix);
      _color.set(p.color);
      led.setColorAt(i, _color);

      // LED halo
      if (halo) {
        _dummy.position.set(p.x, p.y + 0.06 * s + hover, p.z);
        _dummy.scale.setScalar(s * 1.0);
        _dummy.updateMatrix();
        halo.setMatrixAt(i, _dummy.matrix);
        _color.set(p.color);
        halo.setColorAt(i, _color);
      }

      // 4 rotors + nav lights
      for (let r = 0; r < 4; r++) {
        const idx = i * 4 + r;
        const arm = armOffsets[r];
        _dummy.position.set(
          p.x + arm[0] * s,
          p.y + arm[1] * s + hover,
          p.z + arm[2] * s,
        );
        _dummy.scale.setScalar(s);
        _dummy.rotation.set(-Math.PI / 2, rotorAngle.current + r * 1.57, 0);
        _dummy.updateMatrix();
        rotor.setMatrixAt(idx, _dummy.matrix);
        _color.set(p.color);
        rotor.setColorAt(idx, _color);

        // Nav light
        if (nav) {
          _dummy.position.set(
            p.x + arm[0] * s,
            p.y - 0.01 * s + hover,
            p.z + arm[2] * s,
          );
          _dummy.scale.setScalar(s);
          _dummy.rotation.set(0, 0, 0);
          _dummy.updateMatrix();
          nav.setMatrixAt(idx, _dummy.matrix);
          nav.setColorAt(idx, navColors[r]);
        }
      }

      // Selection glow
      if (glow && i === selectedIndex) {
        _dummy.position.set(p.x, p.y - 0.06 * s + hover, p.z);
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
    if (nav) {
      nav.instanceMatrix.needsUpdate = true;
      if (nav.instanceColor) nav.instanceColor.needsUpdate = true;
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
      if (nav) nav.setMatrixAt(idx, _dummy.matrix);
    }

    if (glow && selectedIndex < 0) {
      glow.visible = false;
    }
  });

  const maxCount = Math.max(count, 2000);

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, maxCount]} frustumCulled={false} castShadow />
      <instancedMesh ref={ledRef} args={[ledGeo, ledMat, maxCount]} frustumCulled={false} />
      <instancedMesh ref={haloRef} args={[haloGeo, haloMat, maxCount]} frustumCulled={false} />
      <instancedMesh ref={rotorRef} args={[rotorGeo, rotorMat, maxCount * 4]} frustumCulled={false} />
      <instancedMesh ref={navRef} args={[navGeo, navMat, maxCount * 4]} frustumCulled={false} />
      <instancedMesh ref={glowRef} args={[glowGeo, glowMat, 1]} frustumCulled={false} visible={false} />
    </group>
  );
}
