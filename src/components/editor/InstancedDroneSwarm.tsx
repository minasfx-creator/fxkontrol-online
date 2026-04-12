import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createDroneMaterials } from '@/render_ultra/drones/droneMaterials';
import { getNavLights } from '@/render_ultra/drones/droneLights';
import useGenerativeStore from '@/store/useGenerativeStore';

// ── Pre-allocated scratch objects (zero GC in hot path) ────────────
const _pos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _rotMat = new THREE.Matrix4();
const _scaleVec = new THREE.Vector3();
const _color = new THREE.Color();

// ── LOD thresholds (squared for fast comparison) ──────────────────
const COLOR_CACHE_MAX = 256;
const _colorCache = new Map<string, [number, number, number]>();
function hexToRGB(hex: string): [number, number, number] {
  let cached = _colorCache.get(hex);
  if (cached) return cached;
  _color.set(hex);
  cached = [_color.r, _color.g, _color.b];
  if (_colorCache.size >= COLOR_CACHE_MAX) {
    // Evict oldest entry
    const firstKey = _colorCache.keys().next().value;
    if (firstKey !== undefined) _colorCache.delete(firstKey);
  }
  _colorCache.set(hex, cached);
  return cached;
}

interface DronePosition {
  x: number;
  y: number;
  z: number;
  color: string;
}

/**
 * InstancedDroneSwarm — optimized instanced drone rendering for 2000+ drones.
 * 
 * Optimizations vs. previous version:
 * - Removed halo mesh (opacity 0.0016 = invisible, was wasting 2000 setMatrixAt/frame)
 * - Removed hide-unused loop (uses mesh.count instead of zero-scaling unused instances)
 * - Pre-cached hex→RGB color conversion (avoids 2000 string parses per frame)
 * - LOD-based rotor/nav skip (rotors only rendered for drones <150m from camera)
 * - Direct Float32Array writes for body/led matrices (bypasses Object3D overhead)
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
  const maxCount = Math.max(count, 2000);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const ledRef = useRef<THREE.InstancedMesh>(null);
  const rotorRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const navRef = useRef<THREE.InstancedMesh>(null);
  const rotorAngle = useRef(0);

  // Geometries
  const bodyGeo = useMemo(() => new THREE.BoxGeometry(0.22, 0.07, 0.22), []);
  const ledGeo = useMemo(() => new THREE.SphereGeometry(0.04, 12, 12), []);
  const rotorGeo = useMemo(() => new THREE.CircleGeometry(0.09, 20), []);
  const glowGeo = useMemo(() => new THREE.RingGeometry(0.35, 0.5, 24), []);
  const navGeo = useMemo(() => new THREE.SphereGeometry(0.012, 6, 6), []);

  // PBR Materials
  const pbrMaterials = useMemo(() => createDroneMaterials(), []);
  const bodyMat = useMemo(() => pbrMaterials.body, [pbrMaterials]);

  const ledMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#222222',
    emissive: '#ffffff',
    emissiveIntensity: 0.008,
    toneMapped: true,
    metalness: 0.0,
    roughness: 0.7,
  }), []);

  const rotorMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#888888',
    transparent: true,
    opacity: 0.006,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.096,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

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

  const navLightsCfg = useMemo(() => getNavLights(), []);
  const navColors = useMemo(() => [
    new THREE.Color(navLightsCfg.front.color),
    new THREE.Color(navLightsCfg.front.color),
    new THREE.Color(navLightsCfg.rear.color),
    new THREE.Color(navLightsCfg.rear.color),
  ], [navLightsCfg]);

  useFrame((state, delta) => {
    const body = bodyRef.current;
    const led = ledRef.current;
    const rotor = rotorRef.current;
    const glow = glowRef.current;
    const nav = navRef.current;
    if (!body?.instanceMatrix || !led?.instanceMatrix || !rotor?.instanceMatrix) return;

    rotorAngle.current += delta * 35;

    // Generative engine tick
    const genStore = useGenerativeStore.getState();
    if (genStore.enabled) genStore.tick(delta, count);
    const genColors = genStore.enabled ? genStore.outputColors : null;

    // Camera position for LOD
    _camPos.copy(state.camera.position);

    const t = Date.now() * 0.003;
    const s = scale;
    let rotorCount = 0;

    // ═══ Main loop — body + led always, rotors/nav only for LOD_FULL ═══
    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const ledColor = (genColors && genColors[i]) ? genColors[i] : p.color;
      const hover = Math.sin(t + p.x * 2 + p.z) * 0.015;
      const py = p.y + hover;

      // ── Body matrix (direct Float32Array write) ──
      // Translation-only matrix: [s,0,0,0, 0,s,0,0, 0,0,s,0, px,py,pz,1]
      _mat4.makeScale(s, s, s);
      _mat4.setPosition(p.x, py, p.z);
      body.setMatrixAt(i, _mat4);

      // ── LED (on top of body) ──
      _mat4.setPosition(p.x, py + 0.06 * s, p.z);
      led.setMatrixAt(i, _mat4);

      // LED color (pre-cached RGB)
      const rgb = hexToRGB(ledColor);
      if (led.instanceColor) {
        const colorArr = led.instanceColor.array as Float32Array;
        const ci = i * 3;
        colorArr[ci] = rgb[0];
        colorArr[ci + 1] = rgb[1];
        colorArr[ci + 2] = rgb[2];
      }

      // ── LOD check: rotors + nav only for close drones ──
      _pos.set(p.x, p.y, p.z);
      const dist2 = _pos.distanceToSquared(_camPos);

      if (dist2 < LOD_FULL_DIST2) {
        // Full detail: 4 rotors + 4 nav lights
        for (let r = 0; r < 4; r++) {
          const arm = armOffsets[r];
          const rx = p.x + arm[0] * s;
          const ry = py + arm[1] * s;
          const rz = p.z + arm[2] * s;

          // Rotor (zero-alloc: reuse _rotMat and _scaleVec)
          _mat4.makeRotationX(-Math.PI / 2);
          _rotMat.makeRotationY(rotorAngle.current + r * 1.57);
          _mat4.premultiply(_rotMat);
          _scaleVec.set(s, s, s);
          _mat4.scale(_scaleVec);
          _mat4.setPosition(rx, ry, rz);
          rotor.setMatrixAt(rotorCount, _mat4);
          // Reuse cached RGB to avoid string parse
          const rotorRgb = hexToRGB(ledColor);
          _color.setRGB(rotorRgb[0], rotorRgb[1], rotorRgb[2]);
          rotor.setColorAt(rotorCount, _color);

          // Nav light
          if (nav) {
            _mat4.makeScale(s, s, s);
            _mat4.setPosition(rx, py - 0.01 * s, rz);
            nav.setMatrixAt(rotorCount, _mat4);
            nav.setColorAt(rotorCount, navColors[r]);
          }

          rotorCount++;
        }
      }
    }

    // ── Set actual counts (eliminates hide-unused loop) ──
    body.count = count;
    led.count = count;
    rotor.count = rotorCount;
    if (nav) nav.count = rotorCount;

    // ── Flag updates ──
    body.instanceMatrix.needsUpdate = true;
    led.instanceMatrix.needsUpdate = true;
    if (led.instanceColor) led.instanceColor.needsUpdate = true;
    rotor.instanceMatrix.needsUpdate = true;
    if (rotor.instanceColor) rotor.instanceColor.needsUpdate = true;
    if (nav) {
      nav.instanceMatrix.needsUpdate = true;
      if (nav.instanceColor) nav.instanceColor.needsUpdate = true;
    }

    // ── Selection glow (single instance) ──
    if (glow) {
      if (selectedIndex >= 0 && selectedIndex < count) {
        const sp = positions[selectedIndex];
        const sHover = Math.sin(t + sp.x * 2 + sp.z) * 0.015;
        _mat4.makeScale(s, s, s);
        _mat4.setPosition(sp.x, sp.y - 0.06 * s + sHover, sp.z);
        // Apply -PI/2 rotation for ring facing up (reuse _rotMat)
        _rotMat.makeRotationX(-Math.PI / 2);
        _mat4.multiply(_rotMat);
        _mat4.setPosition(sp.x, sp.y - 0.06 * s + sHover, sp.z);
        glow.setMatrixAt(0, _mat4);
        _color.set(sp.color);
        glow.setColorAt(0, _color);
        glow.instanceMatrix.needsUpdate = true;
        if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
        glow.visible = true;
      } else {
        glow.visible = false;
      }
    }
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, maxCount]} frustumCulled={false} castShadow />
      <instancedMesh ref={ledRef} args={[ledGeo, ledMat, maxCount]} frustumCulled={false} />
      <instancedMesh ref={rotorRef} args={[rotorGeo, rotorMat, maxCount * 4]} frustumCulled={false} />
      <instancedMesh ref={navRef} args={[navGeo, navMat, maxCount * 4]} frustumCulled={false} />
      <instancedMesh ref={glowRef} args={[glowGeo, glowMat, 1]} frustumCulled={false} visible={false} />
    </group>
  );
}
