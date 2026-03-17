import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '@/store/useSceneStore';

/**
 * ShowSim-style vertical and horizontal rulers in 3D viewport.
 * Shows altitude markers (meters) and horizontal distance scale.
 * Scaled for expanded 300km² world.
 */

const VERTICAL_MARKS = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 5000];
const HORIZONTAL_MARKS = [25, 50, 100, 200, 300, 500, 1000, 2000, 5000];

function VerticalRuler() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    
    const targetDist = 400;
    const basePos = camera.position.clone().add(dir.multiplyScalar(targetDist));
    basePos.add(right.multiplyScalar(-40));
    basePos.y = 0;
    
    groupRef.current.position.set(basePos.x, 0, basePos.z);
  });

  return (
    <group ref={groupRef}>
      {/* Vertical line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, 0, 5000, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#00e5ff" transparent opacity={0.3} />
      </line>

      {/* Tick marks and labels */}
      {VERTICAL_MARKS.map(h => (
        <group key={h} position={[0, h, 0]}>
          {/* Tick line */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([-10, 0, 0, 10, 0, 0]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#00e5ff" transparent opacity={0.5} />
          </line>
          {/* Label */}
          <Html center position={[-30, 0, 0]} style={{ pointerEvents: 'none' }}>
            <div className="text-[9px] font-mono-code text-primary/70 whitespace-nowrap select-none">
              {h}m
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function HorizontalRuler() {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const targetDist = 400;
    const basePos = camera.position.clone().add(dir.clone().multiplyScalar(targetDist));
    basePos.y = 0.1;
    groupRef.current.position.set(basePos.x, 0.1, basePos.z);
  });

  return (
    <group ref={groupRef}>
      {/* Horizontal line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-2500, 0, 0, 2500, 0, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ff6b35" transparent opacity={0.25} />
      </line>

      {/* Symmetric distance markers */}
      {HORIZONTAL_MARKS.map(d => (
        <group key={d}>
          {/* Positive side */}
          <group position={[d, 0, 0]}>
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([0, 0, -7.5, 0, 0, 7.5]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ff6b35" transparent opacity={0.4} />
            </line>
            <Html center position={[0, 0.5, 15]} style={{ pointerEvents: 'none' }}>
              <div className="text-[8px] font-mono-code text-accent/60 whitespace-nowrap select-none">
                {d}m
              </div>
            </Html>
          </group>
          {/* Negative side */}
          <group position={[-d, 0, 0]}>
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([0, 0, -7.5, 0, 0, 7.5]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ff6b35" transparent opacity={0.4} />
            </line>
            <Html center position={[0, 0.5, 15]} style={{ pointerEvents: 'none' }}>
              <div className="text-[8px] font-mono-code text-accent/60 whitespace-nowrap select-none">
                -{d}m
              </div>
            </Html>
          </group>
        </group>
      ))}
    </group>
  );
}

export default function ViewportRulers() {
  const showRulers = useSceneStore(st => st.environment.showRulers);
  if (!showRulers) return null;

  return (
    <>
      <VerticalRuler />
      <HorizontalRuler />
    </>
  );
}
