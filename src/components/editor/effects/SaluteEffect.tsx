import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SaluteEffect — Intense white flash + expanding shockwave ring.
 * No visible stars, just pure concussive flash and camera shake.
 * Modeled after real salute/report charges.
 */

interface SaluteEffectProps {
  position: [number, number, number];
  progress: number; // 0 = detonation, 1 = fully faded
  caliber?: number;
  intensity?: number;
}

export default function SaluteEffect({
  position,
  progress,
  caliber = 4,
  intensity = 1,
}: SaluteEffectProps) {
  const flashRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const shakeOffset = useRef(new THREE.Vector3());

  const flashSize = 2 + caliber * 1.2;
  const flashDuration = 0.15; // Salute flash is ~0.1-0.15s

  // Camera shake — subtle displacement
  useFrame(() => {
    if (progress < 0.2 && progress > 0) {
      const shakeMag = 0.02 * intensity * (1 - progress / 0.2) * caliber * 0.5;
      const newOffset = new THREE.Vector3(
        (Math.random() - 0.5) * shakeMag,
        (Math.random() - 0.5) * shakeMag,
        (Math.random() - 0.5) * shakeMag
      );
      camera.position.add(newOffset.sub(shakeOffset.current));
      shakeOffset.current.copy(newOffset);
    } else if (shakeOffset.current.lengthSq() > 0.0001) {
      camera.position.sub(shakeOffset.current);
      shakeOffset.current.set(0, 0, 0);
    }
  });

  if (progress < 0 || progress > 1) return null;

  const flashOpacity = progress < flashDuration
    ? intensity * (1 - progress / flashDuration) * 0.9
    : 0;

  const ringProgress = Math.min(1, progress * 3);
  const ringRadius = flashSize * (1 + ringProgress * 6);
  const ringOpacity = Math.max(0, 0.5 * (1 - ringProgress) * intensity);

  return (
    <group position={position}>
      {/* Central flash sphere */}
      {flashOpacity > 0.01 && (
        <mesh ref={flashRef} scale={flashSize * (1 + progress * 2)}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color="#FFFAF0"
            transparent
            opacity={flashOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Expanding shockwave ring */}
      {ringOpacity > 0.01 && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ringRadius * 0.85, ringRadius, 48]} />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={ringOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Ground flash illumination */}
      {progress < 0.3 && (
        <pointLight
          color="#FFFAF0"
          intensity={caliber * 3 * intensity * (1 - progress / 0.3)}
          distance={50 + caliber * 10}
          decay={2}
        />
      )}
    </group>
  );
}
