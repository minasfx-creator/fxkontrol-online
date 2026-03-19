/**
 * LaserPreviewBeams — R3F component rendering volumetric laser beams
 * Reads from useLaserPreviewStore, renders in real-time in the viewport.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useLaserPreviewStore, type LaserSource } from '@/store/useLaserPreviewStore';

function generateBeamEndpoints(source: LaserSource, time: number): THREE.Vector3[] {
  const { pan, tilt, beamCount, pattern } = source;
  const panRad = (pan * Math.PI) / 180;
  const tiltRad = (tilt * Math.PI) / 180;
  const beamLength = 80 + source.intensity * 0.5;
  const endpoints: THREE.Vector3[] = [];

  if (pattern === 'single') {
    const dx = Math.sin(panRad) * Math.cos(tiltRad) * beamLength;
    const dy = Math.sin(tiltRad) * beamLength;
    const dz = -Math.cos(panRad) * Math.cos(tiltRad) * beamLength;
    endpoints.push(new THREE.Vector3(dx, dy, dz));
  } else if (pattern === 'fan' || pattern === 'harp') {
    const spread = Math.PI * 0.5;
    for (let i = 0; i < beamCount; i++) {
      const t = beamCount > 1 ? i / (beamCount - 1) - 0.5 : 0;
      const angle = t * spread + panRad;
      const sway = pattern === 'harp' ? 0 : Math.sin(time * 0.3 + i * 0.5) * 0.02;
      const dx = Math.sin(angle + sway) * Math.cos(tiltRad) * beamLength;
      const dy = Math.sin(tiltRad) * beamLength;
      const dz = -Math.cos(angle + sway) * Math.cos(tiltRad) * beamLength;
      endpoints.push(new THREE.Vector3(dx, dy, dz));
    }
  } else if (pattern === 'tunnel') {
    for (let i = 0; i < beamCount; i++) {
      const angle = (i / beamCount) * Math.PI * 2 + time * 0.2;
      const radius = 0.3;
      const dx = Math.cos(angle) * radius + Math.sin(panRad) * beamLength * 0.1;
      const dy = Math.sin(tiltRad) * beamLength;
      const dz = Math.sin(angle) * radius - Math.cos(panRad) * beamLength * 0.1;
      const endDx = Math.cos(angle) * beamLength * 0.4;
      const endDz = Math.sin(angle) * beamLength * 0.4;
      endpoints.push(new THREE.Vector3(endDx, dy, endDz));
    }
  } else if (pattern === 'cone') {
    for (let i = 0; i < beamCount; i++) {
      const angle = (i / beamCount) * Math.PI * 2 + time * 0.5;
      const coneRadius = beamLength * 0.35;
      endpoints.push(new THREE.Vector3(
        Math.cos(angle) * coneRadius,
        Math.sin(tiltRad) * beamLength,
        Math.sin(angle) * coneRadius,
      ));
    }
  } else if (pattern === 'wave') {
    for (let i = 0; i < beamCount; i++) {
      const t = beamCount > 1 ? i / (beamCount - 1) - 0.5 : 0;
      const waveY = Math.sin(time * 1.5 + i * 0.8) * 0.15;
      const angle = t * Math.PI * 0.5 + panRad;
      const dx = Math.sin(angle) * Math.cos(tiltRad + waveY) * beamLength;
      const dy = Math.sin(tiltRad + waveY) * beamLength;
      const dz = -Math.cos(angle) * Math.cos(tiltRad + waveY) * beamLength;
      endpoints.push(new THREE.Vector3(dx, dy, dz));
    }
  } else {
    // grid
    const side = Math.ceil(Math.sqrt(beamCount));
    for (let i = 0; i < beamCount; i++) {
      const gx = (i % side) / Math.max(side - 1, 1) - 0.5;
      const gz = Math.floor(i / side) / Math.max(side - 1, 1) - 0.5;
      endpoints.push(new THREE.Vector3(
        gx * beamLength * 0.5,
        Math.sin(tiltRad) * beamLength,
        gz * beamLength * 0.5,
      ));
    }
  }
  return endpoints;
}

function LaserSourceBeams({ source }: { source: LaserSource }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.BufferGeometry>(null);
  const glowRef = useRef<THREE.BufferGeometry>(null);
  const timeRef = useRef(0);

  const color = useMemo(() => new THREE.Color(source.color), [source.color]);

  const coreMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: (source.intensity / 100) * 0.9,
    linewidth: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [color, source.intensity]);

  const glowMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: (source.intensity / 100) * 0.25,
    linewidth: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [color, source.intensity]);

  // Fog cone material
  const fogMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: source.hazeLevel * 0.06 * (source.intensity / 100),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [color, source.hazeLevel, source.intensity]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!groupRef.current || !source.enabled) return;

    const endpoints = generateBeamEndpoints(source, timeRef.current);
    const origin = new THREE.Vector3(0, 0, 0);

    // Update core beams
    const corePositions: number[] = [];
    const glowPositions: number[] = [];
    for (const ep of endpoints) {
      corePositions.push(origin.x, origin.y, origin.z, ep.x, ep.y, ep.z);
      // Slight offset for glow
      glowPositions.push(origin.x, origin.y + 0.02, origin.z, ep.x, ep.y + 0.02, ep.z);
    }

    if (coreRef.current) {
      coreRef.current.setAttribute('position', new THREE.Float32BufferAttribute(corePositions, 3));
    }
    if (glowRef.current) {
      glowRef.current.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
    }
  });

  if (!source.enabled) return null;

  return (
    <group ref={groupRef} position={source.position}>
      {/* Core beams */}
      <lineSegments material={coreMaterial}>
        <bufferGeometry ref={coreRef} />
      </lineSegments>
      {/* Glow beams */}
      <lineSegments material={glowMaterial}>
        <bufferGeometry ref={glowRef} />
      </lineSegments>
      {/* Atmospheric fog cone */}
      {source.hazeLevel > 0.05 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 20, 0]}>
          <coneGeometry args={[15, 40, 16, 1, true]} />
          <primitive object={fogMaterial} />
        </mesh>
      )}
      {/* Source halo */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.8 * (source.intensity / 100)} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

const LaserPreviewBeams = React.memo(function LaserPreviewBeams() {
  const globalEnabled = useLaserPreviewStore((s) => s.globalEnabled);
  const sources = useLaserPreviewStore((s) => s.sources);

  if (!globalEnabled) return null;

  return (
    <>
      {sources.filter((s) => s.enabled).map((source) => (
        <LaserSourceBeams key={source.id} source={source} />
      ))}
    </>
  );
});

export default LaserPreviewBeams;
