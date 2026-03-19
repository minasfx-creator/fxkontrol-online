import { forwardRef, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TechnicianCharacterProps {
  targetPosition?: [number, number, number] | null;
  isInteracting?: boolean;
  onReachTarget?: () => void;
  walkSpeed?: number;
}

const TechnicianCharacter = forwardRef<THREE.Group, TechnicianCharacterProps>(function TechnicianCharacter(
  { targetPosition = null, isInteracting = false, onReachTarget, walkSpeed = 2.8 },
  ref
) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const lastReachedTargetRef = useRef<string | null>(null);

  const setGroupRef = useCallback(
    (node: THREE.Group | null) => {
      groupRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) return;

    const t = clock.elapsedTime;
    const breathing = Math.sin(t * 1.5) * 0.015;
    let isMoving = false;

    if (targetPosition) {
      const target = new THREE.Vector3(targetPosition[0], 0.3, targetPosition[2]);
      const toTarget = target.clone().sub(group.position);
      const distance = toTarget.length();
      const targetKey = `${targetPosition[0].toFixed(2)}:${targetPosition[2].toFixed(2)}`;

      if (distance > 0.06) {
        isMoving = true;
        toTarget.normalize();
        group.position.addScaledVector(toTarget, Math.min(distance, walkSpeed * delta));

        const yaw = Math.atan2(toTarget.x, toTarget.z);
        group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, yaw, 0.18);
      } else {
        group.position.lerp(target, 0.25);
        if (lastReachedTargetRef.current !== targetKey) {
          lastReachedTargetRef.current = targetKey;
          onReachTarget?.();
        }
      }
    } else {
      lastReachedTargetRef.current = null;
    }

    body.scale.y = 1 + breathing;
    body.position.y = Math.sin(t * 1.5) * 0.02;

    const walkCycle = isMoving ? Math.sin(t * 10) * 0.7 : 0;
    const idleArm = Math.sin(t * 1.2) * 0.06;

    if (leftLegRef.current) {
      const targetRot = isMoving ? walkCycle : 0;
      leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, targetRot, 0.25);
    }
    if (rightLegRef.current) {
      const targetRot = isMoving ? -walkCycle : 0;
      rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, targetRot, 0.25);
    }

    if (leftArmRef.current) {
      const targetRot = isMoving ? -walkCycle * 0.7 : idleArm;
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, targetRot, 0.25);
    }

    if (rightArmRef.current) {
      let targetRot = isMoving ? walkCycle * 0.7 : -idleArm;
      if (isInteracting) targetRot = -1 + Math.sin(t * 14) * 0.25;
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, targetRot, 0.25);
    }

    const interactionLean = isInteracting ? -0.22 + Math.sin(t * 8) * 0.04 : 0;
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, interactionLean, 0.2);
  });

  return (
    <group ref={setGroupRef} position={[5, 0.3, 2]}>
      <group ref={bodyRef}>
        {/* Legs — cargo pants, dark stained */}
        <mesh ref={leftLegRef} position={[-0.12, 0.35, 0]}>
          <boxGeometry args={[0.15, 0.7, 0.15]} />
          <meshStandardMaterial color="hsl(58 18% 14%)" roughness={0.9} />
        </mesh>
        <mesh ref={rightLegRef} position={[0.12, 0.35, 0]}>
          <boxGeometry args={[0.15, 0.7, 0.15]} />
          <meshStandardMaterial color="hsl(58 18% 14%)" roughness={0.9} />
        </mesh>

        {/* Cargo pockets */}
        <mesh position={[-0.18, 0.35, 0]}>
          <boxGeometry args={[0.04, 0.12, 0.1]} />
          <meshStandardMaterial color="hsl(57 18% 19%)" roughness={0.95} />
        </mesh>
        <mesh position={[0.18, 0.4, 0]}>
          <boxGeometry args={[0.04, 0.12, 0.1]} />
          <meshStandardMaterial color="hsl(57 18% 19%)" roughness={0.95} />
        </mesh>

        {/* Torso — greasy black crew shirt */}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.42, 0.52, 0.26]} />
          <meshStandardMaterial color="hsl(0 0% 10%)" roughness={0.95} />
        </mesh>

        {/* Grease stains on shirt */}
        <mesh position={[0.1, 0.88, 0.135]}>
          <planeGeometry args={[0.12, 0.08]} />
          <meshStandardMaterial color="hsl(58 30% 12%)" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.08, 1.0, 0.135]}>
          <planeGeometry args={[0.08, 0.06]} />
          <meshStandardMaterial color="hsl(59 24% 16%)" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>

        {/* CREW patch */}
        <mesh position={[0, 0.98, -0.135]}>
          <planeGeometry args={[0.28, 0.1]} />
          <meshStandardMaterial color="hsl(0 0% 25%)" side={THREE.DoubleSide} />
        </mesh>

        {/* Tool belt */}
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.44, 0.06, 0.28]} />
          <meshStandardMaterial color="hsl(30 40% 22%)" roughness={0.8} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.7, 0.145]}>
          <boxGeometry args={[0.06, 0.05, 0.01]} />
          <meshStandardMaterial color="hsl(0 0% 53%)" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Tools on belt */}
        <mesh position={[0.2, 0.65, 0.12]} rotation={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
          <meshStandardMaterial color="hsl(8 78% 56%)" metalness={0.3} />
        </mesh>
        <mesh position={[-0.22, 0.62, 0.08]} rotation={[0.2, 0, 0.4]}>
          <boxGeometry args={[0.03, 0.15, 0.02]} />
          <meshStandardMaterial color="hsl(0 0% 53%)" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[-0.22, 0.58, 0.1]}>
          <torusGeometry args={[0.02, 0.006, 6, 12]} />
          <meshStandardMaterial color="hsl(0 0% 60%)" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Arms */}
        <mesh ref={leftArmRef} position={[-0.3, 0.9, 0]}>
          <boxGeometry args={[0.14, 0.45, 0.14]} />
          <meshStandardMaterial color="hsl(28 41% 59%)" roughness={0.85} />
        </mesh>
        <mesh ref={rightArmRef} position={[0.3, 0.9, 0]}>
          <boxGeometry args={[0.14, 0.45, 0.14]} />
          <meshStandardMaterial color="hsl(28 41% 59%)" roughness={0.85} />
        </mesh>

        {/* Work gloves */}
        <mesh position={[-0.3, 0.66, 0]}>
          <boxGeometry args={[0.15, 0.1, 0.15]} />
          <meshStandardMaterial color="hsl(31 23% 44%)" roughness={0.9} />
        </mesh>
        <mesh position={[0.3, 0.66, 0]}>
          <boxGeometry args={[0.15, 0.1, 0.15]} />
          <meshStandardMaterial color="hsl(31 23% 44%)" roughness={0.9} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.38, 0]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshStandardMaterial color="hsl(28 41% 59%)" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.3, 0.08]}>
          <sphereGeometry args={[0.1, 8, 6, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.3]} />
          <meshStandardMaterial color="hsl(27 27% 43%)" transparent opacity={0.4} />
        </mesh>

        {/* Backwards cap */}
        <mesh position={[0, 1.48, 0]}>
          <sphereGeometry args={[0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="hsl(0 0% 10%)" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.44, -0.12]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.18, 0.015, 0.12]} />
          <meshStandardMaterial color="hsl(0 0% 10%)" roughness={0.9} />
        </mesh>

        {/* Boots */}
        <mesh position={[-0.12, 0.06, 0.03]}>
          <boxGeometry args={[0.17, 0.12, 0.24]} />
          <meshStandardMaterial color="hsl(30 31% 12%)" roughness={0.85} />
        </mesh>
        <mesh position={[0.12, 0.06, 0.03]}>
          <boxGeometry args={[0.17, 0.12, 0.24]} />
          <meshStandardMaterial color="hsl(30 31% 12%)" roughness={0.85} />
        </mesh>
        <mesh position={[-0.12, 0.06, 0.14]}>
          <boxGeometry args={[0.16, 0.08, 0.04]} />
          <meshStandardMaterial color="hsl(0 0% 40%)" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.12, 0.06, 0.14]}>
          <boxGeometry args={[0.16, 0.08, 0.04]} />
          <meshStandardMaterial color="hsl(0 0% 40%)" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Shoulder radio */}
        <mesh position={[-0.25, 1.1, 0.05]}>
          <boxGeometry args={[0.05, 0.1, 0.03]} />
          <meshStandardMaterial color="hsl(0 0% 13%)" metalness={0.5} />
        </mesh>
        <mesh position={[-0.25, 1.17, 0.05]}>
          <cylinderGeometry args={[0.005, 0.005, 0.08, 4]} />
          <meshStandardMaterial color="hsl(0 0% 20%)" metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
});

export default TechnicianCharacter;
