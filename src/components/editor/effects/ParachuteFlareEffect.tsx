import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBreakHeight, getMortarVelocity, GRAVITY } from '@/lib/pyroPhysics';

/**
 * ParachuteFlareEffect — Aerial shell deploying a slow-descending illumination star.
 * Manual de Pirotecnia: bomba de paracaídas. Military and civilian signaling.
 * Lift → apogee → parachute deploys → slow descent with bright illumination + wind drift.
 */
export default function ParachuteFlareEffect({
  position,
  color,
  progress,
  caliber = 4,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const apogee = useMemo(() => getBreakHeight(caliber), [caliber]);

  // Phases: lift 0..0.15, deploy 0.15..0.2, descent 0.2..1.0
  const liftEnd = 0.15;
  const deployEnd = 0.2;

  const getFlarePosition = (p: number): [number, number, number] => {
    if (p < liftEnd) {
      // Lift phase
      const t = p / liftEnd;
      return [0, t * t * apogee, 0];
    }
    if (p < deployEnd) {
      return [0, apogee, 0];
    }
    // Descent phase — slow fall with wind drift
    const descentProgress = (p - deployEnd) / (1 - deployEnd);
    const descentRate = 1.5; // m/s descent
    const y = Math.max(0, apogee - descentProgress * apogee * 0.7);
    const driftX = Math.sin(descentProgress * 3) * descentProgress * 3;
    const driftZ = Math.cos(descentProgress * 2) * descentProgress * 2;
    return [driftX, y, driftZ];
  };

  useFrame(() => {
    if (lightRef.current && progress > deployEnd && progress < 1) {
      const descentProgress = (progress - deployEnd) / (1 - deployEnd);
      const fadeOut = Math.max(0, 1 - descentProgress * 1.1);
      lightRef.current.intensity = caliber * 5 * fadeOut;
    }
  });

  if (progress <= 0 || progress > 1) return null;

  const [fx, fy, fz] = getFlarePosition(progress);
  const isLifting = progress < liftEnd;
  const isDescending = progress > deployEnd;
  const descentProgress = isDescending ? (progress - deployEnd) / (1 - deployEnd) : 0;
  const fadeOut = Math.max(0, 1 - descentProgress * 1.1);

  return (
    <group position={position}>
      {/* Lift trail */}
      {isLifting && (
        <>
          <mesh position={[fx, fy, fz]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshBasicMaterial color="#FFFFCC" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {Array.from({ length: 6 }).map((_, j) => {
            const t = (progress / liftEnd) * (1 - j * 0.12);
            return (
              <mesh key={j} position={[0, t * t * apogee, 0]}>
                <sphereGeometry args={[0.025, 4, 4]} />
                <meshBasicMaterial color="#FFCC66" transparent opacity={0.3 * (1 - j / 6)} blending={THREE.AdditiveBlending} depthWrite={false} />
              </mesh>
            );
          })}
        </>
      )}

      {/* Parachute + illumination star during descent */}
      {isDescending && fadeOut > 0 && (
        <group position={[fx, fy, fz]}>
          {/* Parachute canopy (simple cone) */}
          <mesh position={[0, 0.5, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.4, 0.3, 8, 1, true]} />
            <meshBasicMaterial color="#DDDDCC" transparent opacity={0.4 * fadeOut} side={THREE.DoubleSide} />
          </mesh>
          {/* Suspension lines (thin cylinders) */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
            <mesh key={i} position={[Math.cos(angle) * 0.15, 0.25, Math.sin(angle) * 0.15]} rotation={[0.15 * Math.cos(angle), 0, 0.15 * Math.sin(angle)]}>
              <cylinderGeometry args={[0.003, 0.003, 0.5, 3]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.3 * fadeOut} />
            </mesh>
          ))}
          {/* Illumination star */}
          <mesh>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.9 * fadeOut} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* Outer glow */}
          <mesh>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.15 * fadeOut} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* Scene illumination */}
          <pointLight ref={lightRef} color={color} intensity={caliber * 5 * fadeOut} distance={80 + caliber * 15} decay={2} />
        </group>
      )}
    </group>
  );
}
