import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * LaserFX Pro — Volumetric ILDA-style laser beams.
 * Patterns: fan, harp, tunnel, cone, wave, grid, single.
 * Features: galvo scanning, atmospheric scattering, volumetric glow,
 * RGB color modulation, beam divergence simulation.
 */

const BEAM_SEGMENTS = 2;

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
  const beamLength = pattern === 'single' ? 120 : pattern === 'tunnel' || pattern === 'cone' ? 60 : 80;

  // Create volumetric beam geometry (tapered cylinder for divergence)
  const beamGeo = useMemo(() => {
    return new THREE.CylinderGeometry(0.006, 0.025, beamLength, 4, 1);
  }, [beamLength]);

  // Glow plane for each beam (billboard sprite for volumetric look)
  const glowGeo = useMemo(() => new THREE.PlaneGeometry(0.15, beamLength), [beamLength]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.getElapsedTime();
    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    const children = groupRef.current.children;
    const totalBeams = pattern === 'grid' ? beamCount * beamCount : beamCount;

    for (let idx = 0; idx < totalBeams; idx++) {
      // Each beam has 3 children: core cylinder, glow plane, glow plane rotated
      const beamGroup = children[idx] as THREE.Group;
      if (!beamGroup) continue;

      const core = beamGroup.children[0] as THREE.Mesh;
      const glow1 = beamGroup.children[1] as THREE.Mesh;
      const glow2 = beamGroup.children[2] as THREE.Mesh;
      if (!core) continue;

      let angle: number, tilt: number, ox = 0, oz = 0;
      let beamIntensity = 1;

      switch (pattern) {
        case 'fan': {
          const t = beamCount === 1 ? 0 : (idx / (beamCount - 1)) - 0.5;
          angle = t * Math.PI * 0.7 + Math.sin(time * 0.3) * 0.08;
          beamGroup.position.set(0, 0, 0);
          beamGroup.rotation.set(0, 0, angle);
          beamIntensity = 1 - Math.abs(t) * 0.25;
          break;
        }
        case 'harp': {
          ox = ((idx / beamCount) - 0.5) * 8;
          beamGroup.position.set(ox, 0, 0);
          beamGroup.rotation.set(0, 0, Math.sin(time * 0.5 + idx * 0.3) * 0.03);
          break;
        }
        case 'tunnel': {
          angle = (idx / beamCount) * Math.PI * 2 + time * 1.5;
          tilt = 0.22 + Math.sin(time * 0.8) * 0.05;
          beamGroup.position.set(0, 0, 0);
          beamGroup.rotation.set(Math.cos(angle) * tilt, 0, Math.sin(angle) * tilt);
          beamIntensity = 0.8 + Math.sin(angle * 3 + time) * 0.2;
          break;
        }
        case 'cone': {
          angle = (idx / beamCount) * Math.PI * 2 + time * 0.5;
          tilt = 0.3 + Math.sin(time * 2 + idx) * 0.08;
          beamGroup.position.set(0, 0, 0);
          beamGroup.rotation.set(Math.cos(angle) * tilt, 0, Math.sin(angle) * tilt);
          break;
        }
        case 'wave': {
          const phase = (idx / beamCount) * Math.PI * 2;
          const waveAngle = Math.sin(time * 1.5 + phase) * 0.35;
          ox = ((idx / beamCount) - 0.5) * 8;
          beamGroup.position.set(ox, 0, 0);
          beamGroup.rotation.set(0, 0, waveAngle);
          beamIntensity = 0.7 + Math.sin(phase + time * 2) * 0.3;
          break;
        }
        case 'grid': {
          const cols = beamCount;
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          const spacing = 1.5;
          ox = (col - (cols - 1) / 2) * spacing;
          oz = (row - (cols - 1) / 2) * spacing;
          const pulse = Math.sin(time * 3 + col * 0.5 + row * 0.7) * 0.5 + 0.5;
          beamGroup.position.set(ox, 0, oz);
          beamGroup.rotation.set(0, 0, 0);
          beamIntensity = pulse;
          break;
        }
        default: { // single
          beamGroup.position.set(0, 0, 0);
          beamGroup.rotation.set(
            Math.sin(time * 0.8) * 0.15,
            0,
            Math.cos(time * 0.5) * 0.12,
          );
          break;
        }
      }

      const finalOpacity = intensity * beamIntensity;

      // Core beam — thin bright line
      const coreMat = core.material as THREE.MeshBasicMaterial;
      coreMat.opacity = 0.35 * finalOpacity;

      // Volumetric glow planes
      if (glow1) {
        const g1Mat = glow1.material as THREE.MeshBasicMaterial;
        g1Mat.opacity = 0.08 * finalOpacity;
      }
      if (glow2) {
        const g2Mat = glow2.material as THREE.MeshBasicMaterial;
        g2Mat.opacity = 0.08 * finalOpacity;
      }
    }

    // Source glow
    const sourceGlow = children[totalBeams] as THREE.Mesh;
    if (sourceGlow) {
      const mat = sourceGlow.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 * intensity;
      const sc = 1 + Math.sin(time * 4) * 0.1;
      sourceGlow.scale.setScalar(sc);
    }

    // Ground scatter disc
    const scatter = children[totalBeams + 1] as THREE.Mesh;
    if (scatter) {
      const mat = scatter.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.04 * intensity;
    }
  });

  const totalBeams = pattern === 'grid' ? beamCount * beamCount : beamCount;

  return (
    <group position={position} ref={groupRef}>
      {/* Beam array */}
      {Array.from({ length: totalBeams }).map((_, i) => (
        <group key={i}>
          {/* Core beam — thin bright cylinder */}
          <mesh position={[0, beamLength / 2, 0]}>
            <cylinderGeometry args={[0.006, 0.02, beamLength, 4]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.35}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Volumetric glow plane 1 */}
          <mesh position={[0, beamLength / 2, 0]}>
            <planeGeometry args={[0.12, beamLength]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.08}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Volumetric glow plane 2 (perpendicular) */}
          <mesh position={[0, beamLength / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.12, beamLength]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.08}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Source glow — bright emitter point */}
      <mesh>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Ground scatter disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -position[1] + 0.05, 0]}>
        <circleGeometry args={[3, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.04}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
