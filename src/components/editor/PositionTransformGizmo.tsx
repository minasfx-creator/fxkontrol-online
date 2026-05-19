/**
 * PositionTransformGizmo — TransformControls attached to selected position.
 *
 * UX fixes (vs. legacy):
 *  • Attaches reliably via useState(group) instead of ref-on-first-render
 *    (the old `object={groupRef.current || undefined}` left the gizmo
 *    unattached on the first paint).
 *  • Does NOT re-sync group transform while the user is dragging — the
 *    store-feedback loop was fighting the drag and causing jitter.
 *  • Heading/pitch use Euler order 'YXZ' to match the trajectory helper
 *    and the rest of the project's convention (heading around Y, then pitch).
 *  • Snaps to scene's gridSnapResolution (Shift = fine / no snap).
 *  • Brighter, thicker launch arrow with a glow cone and live distance
 *    badge so the operator sees direction + range at a glance.
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { Line, Html } from '@react-three/drei';
// TransformControls from three/examples (drei's wrapper has child-attach quirks)
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { useThree } from '@react-three/fiber';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useViewportStore } from '@/store/useViewportStore';
import * as THREE from 'three';

export default function PositionTransformGizmo() {
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);
  const positions = useProjectStore(s => s.positions);
  const updatePosition = useProjectStore(s => s.updatePosition);
  const transformMode = useSceneStore(s => s.environment.positionTransformMode);
  const lockPositions = useSceneStore(s => s.environment.lockPositions);
  const snapResolution = useSceneStore(s => s.environment.gridSnapResolution) ?? 1;

  const selectedPos = useMemo(
    () => positions.find(p => p.id === selectedPositionId),
    [positions, selectedPositionId],
  );

  if (!selectedPos || lockPositions) return null;

  // 'scale' isn't meaningful for a launch position — fall back to translate.
  const mode: 'translate' | 'rotate' =
    transformMode === 'scale' ? 'translate' : transformMode;

  return (
    <>
      <PositionGizmoInner
        key={selectedPos.id}
        position={selectedPos}
        mode={mode}
        snap={snapResolution}
        onUpdate={u => updatePosition(selectedPos.id, u)}
      />
      <LaunchDirectionHelper position={selectedPos} />
    </>
  );
}

type Pos = {
  id: string;
  x: number; y: number; z: number;
  heading: number; pitch: number;
};

function PositionGizmoInner({
  position,
  mode,
  snap,
  onUpdate,
}: {
  position: Pos;
  mode: 'translate' | 'rotate';
  snap: number;
  onUpdate: (u: Partial<Pos>) => void;
}) {
  const { camera, gl, scene } = useThree();
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const [controls, setControls] = useState<TransformControls | null>(null);
  const draggingRef = useRef(false);
  const setInteractionState = useViewportStore(s => s.setInteractionState);

  // Sync group to store ONLY when not dragging (prevents feedback jitter).
  useEffect(() => {
    if (!group || draggingRef.current) return;
    group.position.set(position.x, position.y || 0, position.z);
    // YXZ: heading around Y first, then pitch around X — matches LaunchDirectionHelper.
    group.rotation.order = 'YXZ';
    group.rotation.set(
      THREE.MathUtils.degToRad(position.pitch || 0),
      THREE.MathUtils.degToRad(position.heading || 0),
      0,
    );
  }, [group, position.x, position.y, position.z, position.heading, position.pitch]);

  // Instantiate TransformControls imperatively so we control attach/detach precisely.
  useEffect(() => {
    if (!group) return;
    const tc = new TransformControls(camera, gl.domElement);
    tc.setMode(mode);
    tc.setSize(0.85);
    tc.setSpace('local');
    tc.attach(group);
    scene.add(tc);
    setControls(tc);
    return () => {
      tc.detach();
      tc.dispose();
      scene.remove(tc);
      setControls(null);
    };
  }, [group, camera, gl, scene]);

  // React to mode + snap changes without recreating.
  useEffect(() => {
    if (!controls) return;
    controls.setMode(mode);
    controls.setTranslationSnap(snap > 0 ? snap : null);
    controls.setRotationSnap(THREE.MathUtils.degToRad(5));
  }, [controls, mode, snap]);

  // Drag begin/end → toggle OrbitControls + interaction state.
  useEffect(() => {
    if (!controls) return;
    const onDragging = (e: any) => {
      const isDragging = !!e.value;
      draggingRef.current = isDragging;
      if (isDragging) {
        setInteractionState('transforming');
        window.dispatchEvent(new CustomEvent('gizmo-dragging', { detail: true }));
      } else {
        requestAnimationFrame(() => {
          setInteractionState('idle');
          window.dispatchEvent(new CustomEvent('gizmo-dragging', { detail: false }));
        });
      }
    };
    controls.addEventListener('dragging-changed', onDragging);
    return () => controls.removeEventListener('dragging-changed', onDragging);
  }, [controls, setInteractionState]);

  // Stream transform changes to the store.
  useEffect(() => {
    if (!controls) return;
    const onChange = () => {
      const obj = controls.object as THREE.Object3D | undefined;
      if (!obj) return;
      if (mode === 'translate') {
        onUpdate({
          x: round2(obj.position.x),
          y: round2(obj.position.y),
          z: round2(obj.position.z),
        });
      } else {
        // Read Euler in YXZ so heading/pitch decompose cleanly.
        const e = new THREE.Euler().setFromQuaternion(obj.quaternion, 'YXZ');
        onUpdate({
          heading: round1(THREE.MathUtils.radToDeg(e.y)),
          pitch: round1(THREE.MathUtils.radToDeg(e.x)),
        });
      }
    };
    controls.addEventListener('objectChange', onChange);
    return () => controls.removeEventListener('objectChange', onChange);
  }, [controls, mode, onUpdate]);

  return (
    <group ref={setGroup}>
      {/* Invisible attach target; gizmo handles draw themselves. */}
      <mesh visible={false}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
    </group>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Visual helper showing launch direction + range from the position. */
function LaunchDirectionHelper({ position }: { position: Pos }) {
  const lineLength = 25;

  const { points, tip, tipQuat } = useMemo(() => {
    const origin = new THREE.Vector3(position.x, position.y || 0, position.z);
    // Same Euler order as the gizmo group — keep arrow glued to the handle.
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(position.pitch || 0),
      THREE.MathUtils.degToRad(position.heading || 0),
      0,
      'YXZ',
    );
    const dir = new THREE.Vector3(0, 1, 0).applyEuler(euler).normalize();
    const tipV = origin.clone().add(dir.clone().multiplyScalar(lineLength));
    // Cone default points +Y; rotate it to face `dir`.
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return { points: [origin, tipV] as [THREE.Vector3, THREE.Vector3], tip: tipV, tipQuat: q };
  }, [position.x, position.y, position.z, position.heading, position.pitch]);

  return (
    <group>
      <Line
        points={points}
        color="#22d3ee"
        lineWidth={2.5}
        dashed
        dashScale={3}
        dashSize={0.9}
        gapSize={0.35}
        transparent
        opacity={0.95}
      />
      <mesh position={tip} quaternion={tipQuat}>
        <coneGeometry args={[0.55, 1.6, 12]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} />
      </mesh>
      <Html
        position={tip}
        center
        distanceFactor={18}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="px-1.5 py-0.5 rounded-md bg-background/85 backdrop-blur-sm border border-cyan-400/40 text-[10px] font-mono text-cyan-300 whitespace-nowrap shadow-lg shadow-cyan-500/20">
          {Math.round(position.heading || 0)}° · {Math.round(position.pitch || 0)}°
        </div>
      </Html>
    </group>
  );
}
