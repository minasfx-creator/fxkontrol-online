/**
 * PositionTransformGizmo — TransformControls attached to selected position
 * Includes trajectory line helper showing launch direction.
 */
import { useRef, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls, Line } from '@react-three/drei';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import * as THREE from 'three';

export default function PositionTransformGizmo() {
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);
  const positions = useProjectStore(s => s.positions);
  const updatePosition = useProjectStore(s => s.updatePosition);
  const transformMode = useSceneStore(s => s.environment.positionTransformMode);
  const lockPositions = useSceneStore(s => s.environment.lockPositions);

  const selectedPos = useMemo(() =>
    positions.find(p => p.id === selectedPositionId),
    [positions, selectedPositionId]
  );

  if (!selectedPos || lockPositions) return null;

  const mode = transformMode === 'scale' ? 'translate' : transformMode;

  return (
    <>
      <PositionGizmoInner
        key={selectedPos.id}
        position={selectedPos}
        mode={mode}
        onUpdate={(pos) => updatePosition(selectedPos.id, pos)}
      />
      <LaunchDirectionHelper position={selectedPos} />
    </>
  );
}

function PositionGizmoInner({
  position,
  mode,
  onUpdate,
}: {
  position: { id: string; x: number; y: number; z: number; heading: number; pitch: number };
  mode: 'translate' | 'rotate';
  onUpdate: (updates: Partial<{ x: number; y: number; z: number; heading: number; pitch: number }>) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(position.x, position.y || 0, position.z);
      groupRef.current.rotation.set(
        THREE.MathUtils.degToRad(position.pitch || 0),
        THREE.MathUtils.degToRad(position.heading || 0),
        0,
      );
    }
  }, [position.x, position.y, position.z, position.heading, position.pitch]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleChange = () => {
      const obj = controls.object;
      if (!obj) return;

      if (mode === 'translate') {
        onUpdate({
          x: Math.round(obj.position.x * 100) / 100,
          y: Math.round(obj.position.y * 100) / 100,
          z: Math.round(obj.position.z * 100) / 100,
        });
      } else {
        onUpdate({
          heading: Math.round(THREE.MathUtils.radToDeg(obj.rotation.y) * 10) / 10,
          pitch: Math.round(THREE.MathUtils.radToDeg(obj.rotation.x) * 10) / 10,
        });
      }
    };

    controls.addEventListener('objectChange', handleChange);
    return () => controls.removeEventListener('objectChange', handleChange);
  }, [mode, onUpdate]);

  return (
    <TransformControls
      ref={controlsRef}
      object={groupRef.current || undefined}
      mode={mode}
      size={0.8}
      space="local"
    >
      <group ref={groupRef}>
        {/* Invisible target mesh for gizmo attachment */}
        <mesh visible={false}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>
    </TransformControls>
  );
}

/** Visual helper showing launch direction from position */
function LaunchDirectionHelper({
  position,
}: {
  position: { x: number; y: number; z: number; heading: number; pitch: number };
}) {
  const lineLength = 25;

  const points = useMemo(() => {
    const origin = new THREE.Vector3(position.x, position.y || 0, position.z);
    const dir = new THREE.Vector3(0, 1, 0);

    // Apply pitch (rotation around X) then heading (rotation around Y)
    dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(position.pitch || 0));
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(position.heading || 0));

    const end = origin.clone().add(dir.multiplyScalar(lineLength));
    return [origin, end] as [THREE.Vector3, THREE.Vector3];
  }, [position.x, position.y, position.z, position.heading, position.pitch]);

  return (
    <group>
      <Line
        points={points}
        color="#ff6644"
        lineWidth={2}
        dashed
        dashScale={3}
        dashSize={0.8}
        gapSize={0.4}
      />
      {/* Cone at the tip */}
      <mesh position={points[1]}>
        <coneGeometry args={[0.4, 1.2, 6]} />
        <meshBasicMaterial color="#ff6644" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}
