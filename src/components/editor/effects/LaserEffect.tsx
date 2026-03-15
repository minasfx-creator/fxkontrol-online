import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * LaserFX Pro — Ultra-volumetric ILDA-style laser beams.
 * Enhanced with wider glow planes, brighter cores, atmospheric cone,
 * and source halo for concert-grade volumetric look.
 */

export default function LaserEffect({
  position,
  color,
  progress,
  pattern = 'fan',
  beamCount = 8,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  pattern?: 'fan' | 'harp' | 'tunnel' | 'cone' | 'single' | 'wave' | 'grid';
  beamCount?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const beamLength = pattern === 'single' ? 140 : pattern === 'tunnel' || pattern === 'cone' ? 70 : 90;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.getElapsedTime();
    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    const children = groupRef.current.children;
    const totalBeams = pattern === 'grid' ? beamCount * beamCount : beamCount;

    for (let idx = 0; idx < totalBeams; idx++) {
      const beamGroup = children[idx] as THREE.Group;
      if (!beamGroup || beamGroup.children.length < 3) continue;

      let beamIntensity = 1;

      switch (pattern) {
        case 'fan': {
          const t = beamCount === 1 ? 0 : (idx / (beamCount - 1)) - 0.5;
          const angle = t * Math.PI * 0.75 + Math.sin(time * 0.4) * 0.06;
          beamGroup.position.set(0, 0, 0);
          beamGroup.rotation.set(0, 0, angle);
          beamIntensity = 1 - Math.abs(t) * 0.2;
          break;
        }
        case 'harp': {
          const ox = ((idx / beamCount) - 0.5) * 10;
          beamGroup.position.set(ox, 0, 0);
          beamGroup.rotation.set(0, 0, Math.sin(time * 0.6 + idx * 0.4) * 0.02);
          break;
        }
        case 'tunnel': {
          const angle = (idx / beamCount) * Math.PI * 2 + time * 1.2;
          const tilt = 0.25 + Math.sin(time * 0.6) * 0.06;
          beamGroup.position.set(0, 0, 0);
          beamGroup.rotation.set(Math.cos(angle) * tilt, 0, Math.sin(angle) * tilt);
          beamIntensity = 0.75 + Math.sin(angle * 2 + time * 1.5) * 0.25;
          break;
        }
        case 'cone': {
          const angle = (idx / beamCount) * Math.PI * 2 + time * 0.7;
          const tilt = 0.35 + Math.sin(time * 1.5 + idx) * 0.1;
          beamGroup.position.set(0, 0, 0);
          beamGroup.rotation.set(Math.cos(angle) * tilt, 0, Math.sin(angle) * tilt);
          break;
        }
        case 'wave': {
          const phase = (idx / beamCount) * Math.PI * 2;
          const waveAngle = Math.sin(time * 1.2 + phase) * 0.4;
          const ox = ((idx / beamCount) - 0.5) * 10;
          beamGroup.position.set(ox, 0, 0);
          beamGroup.rotation.set(0, 0, waveAngle);
          beamIntensity = 0.6 + Math.sin(phase + time * 2.5) * 0.4;
          break;
        }
        case 'grid': {
          const cols = beamCount;
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          const spacing = 1.8;
          const ox = (col - (cols - 1) / 2) * spacing;
          const oz = (row - (cols - 1) / 2) * spacing;
          const pulse = Math.sin(time * 2.5 + col * 0.6 + row * 0.8) * 0.5 + 0.5;
          beamGroup.position.set(ox, 0, oz);
          beamGroup.rotation.set(0, 0, 0);
          beamIntensity = pulse;
          break;
        }
        default: {
          beamGroup.position.set(0, 0, 0);
          beamGroup.rotation.set(
            Math.sin(time * 0.6) * 0.18,
            0,
            Math.cos(time * 0.4) * 0.15,
          );
          break;
        }
      }

      const finalOpacity = intensity * beamIntensity;

      // Core — ultra-bright thin beam (pushes above 1.0 for HDR bloom catch)
      const core = beamGroup.children[0] as THREE.Mesh;
      if (core) {
        const mat = core.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.7 * finalOpacity;
        mat.color.copy(baseColor).multiplyScalar(2.5); // HDR push
      }

      // Inner glow
      const glow1 = beamGroup.children[1] as THREE.Mesh;
      if (glow1) (glow1.material as THREE.MeshBasicMaterial).opacity = 0.2 * finalOpacity;

      // Outer glow
      const glow2 = beamGroup.children[2] as THREE.Mesh;
      if (glow2) (glow2.material as THREE.MeshBasicMaterial).opacity = 0.09 * finalOpacity;

      // Wide atmospheric glow
      const atmo = beamGroup.children[3] as THREE.Mesh;
      if (atmo) (atmo.material as THREE.MeshBasicMaterial).opacity = 0.04 * finalOpacity;
    }

    // Source halo
    const haloIdx = totalBeams;
    const halo = children[haloIdx] as THREE.Mesh;
    if (halo) {
      const mat = halo.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 * intensity;
      const sc = 1.2 + Math.sin(time * 5) * 0.15;
      halo.scale.setScalar(sc);
    }

    // Ground scatter
    const scatter = children[haloIdx + 1] as THREE.Mesh;
    if (scatter) {
      (scatter.material as THREE.MeshBasicMaterial).opacity = 0.06 * intensity;
    }

    // Atmospheric cone
    const cone = children[haloIdx + 2] as THREE.Mesh;
    if (cone) {
      (cone.material as THREE.MeshBasicMaterial).opacity = 0.018 * intensity;
      cone.rotation.y = time * 0.1;
    }
  });

  const totalBeams = pattern === 'grid' ? beamCount * beamCount : beamCount;

  return (
    <group position={position} ref={groupRef}>
      {/* Beam array */}
      {Array.from({ length: totalBeams }).map((_, i) => (
        <group key={i}>
          {/* Core beam — bright thin cylinder */}
          <mesh position={[0, beamLength / 2, 0]}>
            <cylinderGeometry args={[0.004, 0.018, beamLength, 4]} />
            <meshBasicMaterial
              color={color}
              transparent opacity={0.55}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {/* Inner glow plane */}
          <mesh position={[0, beamLength / 2, 0]}>
            <planeGeometry args={[0.2, beamLength]} />
            <meshBasicMaterial
              color={color}
              transparent opacity={0.15}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {/* Outer glow plane (perpendicular) */}
          <mesh position={[0, beamLength / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.2, beamLength]} />
            <meshBasicMaterial
              color={color}
              transparent opacity={0.06}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {/* Wide atmospheric scatter plane */}
          <mesh position={[0, beamLength / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
            <planeGeometry args={[0.6, beamLength]} />
            <meshBasicMaterial
              color={color}
              transparent opacity={0.025}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Source halo — bright emitter */}
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Ground scatter disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -position[1] + 0.05, 0]}>
        <circleGeometry args={[4, 32]} />
        <meshBasicMaterial
          color={color}
          transparent opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Atmospheric cone — wide volumetric fill */}
      <mesh position={[0, beamLength * 0.4, 0]}>
        <coneGeometry args={[beamLength * 0.12, beamLength * 0.8, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent opacity={0.018}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
