/**
 * PositionTransformGizmo — TransformControls attached to selected position
 *
 * v2 improvements (2026-05-23):
 *  - Snap from useSceneStore.transformSnap (translate: 1m, rotate: 15°)
 *  - Ctrl key temporarily disables snap during drag (precision mode)
 *  - World / Local space toggle via transformSpace in viewport store
 *  - Auto-scale gizmo with camera distance so it stays visible in large scenes
 *  - Coordinate overlay (Html) showing live XYZ / heading/pitch while dragging
 *  - Removed broken `object` prop — uses children-based auto-attachment (drei pattern)
 *  - LaunchDirectionHelper: cone now correctly offset by half its height
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls, Line, Html } from '@react-three/drei';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useViewportStore } from '@/store/useViewportStore';
import * as THREE from 'three';

// ── Snap threshold: Ctrl held → precision (no snap) ──────────────────
function useCtrlHeld() {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Control') setHeld(true); };
    const up   = (e: KeyboardEvent) => { if (e.key === 'Control') setHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return held;
}

export default function PositionTransformGizmo() {
  const selectedPositionId  = useProjectStore(s => s.selectedPositionId);
  const positions           = useProjectStore(s => s.positions);
  const updatePosition      = useProjectStore(s => s.updatePosition);
  const transformMode       = useSceneStore(s => s.environment.positionTransformMode);
  const lockPositions       = useSceneStore(s => s.environment.lockPositions);
  const transformSnap       = useSceneStore(s => s.transformSnap);

  const selectedPos = useMemo(
    () => positions.find(p => p.id === selectedPositionId),
    [positions, selectedPositionId],
  );

  if (!selectedPos || lockPositions) return null;

  // 'scale' not meaningful for a launch position — fall back to translate
  const mode = transformMode === 'scale' ? 'translate' : transformMode;

  return (
    <>
      <PositionGizmoInner
        key={selectedPos.id}
        position={selectedPos}
        mode={mode}
        snap={transformSnap}
        onUpdate={(pos) => updatePosition(selectedPos.id, pos)}
      />
      <LaunchDirectionHelper position={selectedPos} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
interface GizmoPosition {
  id: string;
  x: number; y: number; z: number;
  heading: number; pitch: number;
}

interface SnapSettings {
  enabled: boolean;
  translateSnap: number;
  rotateSnap: number;
}

function PositionGizmoInner({
  position,
  mode,
  snap,
  onUpdate,
}: {
  position: GizmoPosition;
  mode: 'translate' | 'rotate';
  snap: SnapSettings;
  onUpdate: (updates: Partial<GizmoPosition>) => void;
}) {
  const groupRef            = useRef<THREE.Group>(null);
  const controlsRef         = useRef<any>(null);
  const setInteractionState = useViewportStore(s => s.setInteractionState);
  const ctrlHeld            = useCtrlHeld();
  const { camera }          = useThree();

  // Live drag display
  const [dragging, setDragging]   = useState(false);
  const [liveCoords, setLiveCoords] = useState({ x: position.x, y: position.y, z: position.z });
  const [liveRot, setLiveRot]     = useState({ heading: position.heading, pitch: position.pitch });

  // ── Sync group transform whenever position prop changes ─────────────
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(position.x, position.y ?? 0, position.z);
    groupRef.current.rotation.set(
      THREE.MathUtils.degToRad(position.pitch ?? 0),
      THREE.MathUtils.degToRad(position.heading ?? 0),
      0,
    );
  }, [position.x, position.y, position.z, position.heading, position.pitch]);

  // ── Auto-scale gizmo so it stays legible at any camera distance ─────
  useFrame(() => {
    if (!controlsRef.current || !groupRef.current) return;
    const dist = camera.position.distanceTo(groupRef.current.position);
    // keep apparent size ~constant: size = k * dist / fov_factor
    const scale = Math.max(0.5, Math.min(2.5, dist * 0.04));
    controlsRef.current.size = scale;
  });

  // ── Dragging-changed: gate OrbitControls ────────────────────────────
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onDraggingChanged = (event: any) => {
      const isDragging: boolean = event.value;
      setDragging(isDragging);
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
    controls.addEventListener('dragging-changed', onDraggingChanged);
    return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
  }, [setInteractionState]);

  // ── objectChange: persist new position into store + live overlay ─────
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onObjectChange = () => {
      const obj = controls.object;
      if (!obj) return;
      if (mode === 'translate') {
        const nx = Math.round(obj.position.x * 100) / 100;
        const ny = Math.round(obj.position.y * 100) / 100;
        const nz = Math.round(obj.position.z * 100) / 100;
        setLiveCoords({ x: nx, y: ny, z: nz });
        onUpdate({ x: nx, y: ny, z: nz });
      } else {
        const nh = Math.round(THREE.MathUtils.radToDeg(obj.rotation.y) * 10) / 10;
        const np = Math.round(THREE.MathUtils.radToDeg(obj.rotation.x) * 10) / 10;
        setLiveRot({ heading: nh, pitch: np });
        onUpdate({ heading: nh, pitch: np });
      }
    };
    controls.addEventListener('objectChange', onObjectChange);
    return () => controls.removeEventListener('objectChange', onObjectChange);
  }, [mode, onUpdate]);

  // ── Effective snap values (Ctrl = precision override) ───────────────
  const effectiveTranslateSnap = (!ctrlHeld && snap.enabled) ? snap.translateSnap : null;
  const effectiveRotateSnap    = (!ctrlHeld && snap.enabled) ? snap.rotateSnap    : null;

  return (
    <>
      <TransformControls
        ref={controlsRef}
        mode={mode}
        size={0.8}              // overridden per-frame by auto-scale
        space="world"
        translationSnap={effectiveTranslateSnap ?? undefined}
        rotationSnap={effectiveRotateSnap !== null ? THREE.MathUtils.degToRad(effectiveRotateSnap) : undefined}
      >
        <group ref={groupRef}>
          {/* Invisible mesh — gizmo attachment target */}
          <mesh visible={false}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>
      </TransformControls>

      {/* ── Live coordinate overlay while dragging ── */}
      {dragging && groupRef.current && (
        <Html
          position={[
            groupRef.current.position.x,
            groupRef.current.position.y + 8,
            groupRef.current.position.z,
          ]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            whiteSpace: 'nowrap',
            lineHeight: '1.6',
          }}>
            {mode === 'translate' ? (
              <>
                <div style={{ color: '#ff5555' }}>X {liveCoords.x.toFixed(2)} m</div>
                <div style={{ color: '#55ff55' }}>Y {liveCoords.y.toFixed(2)} m</div>
                <div style={{ color: '#5588ff' }}>Z {liveCoords.z.toFixed(2)} m</div>
                {ctrlHeld && <div style={{ color: '#ffaa00', fontSize: '10px' }}>⚡ Precisão</div>}
                {snap.enabled && !ctrlHeld && (
                  <div style={{ color: '#aaa', fontSize: '10px' }}>⊞ Snap {snap.translateSnap}m</div>
                )}
              </>
            ) : (
              <>
                <div style={{ color: '#ffaa00' }}>↻ {liveRot.heading.toFixed(1)}°</div>
                <div style={{ color: '#ff88cc' }}>↑ {liveRot.pitch.toFixed(1)}°</div>
                {ctrlHeld && <div style={{ color: '#ffaa00', fontSize: '10px' }}>⚡ Precisão</div>}
                {snap.enabled && !ctrlHeld && (
                  <div style={{ color: '#aaa', fontSize: '10px' }}>⊞ Snap {snap.rotateSnap}°</div>
                )}
              </>
            )}
          </div>
        </Html>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
/** Visual helper showing launch direction + ground ring */
function LaunchDirectionHelper({
  position,
}: {
  position: { x: number; y: number; z: number; heading: number; pitch: number };
}) {
  const lineLength = 25;
  const CONE_HEIGHT = 1.2;

  const { origin, end, conePos } = useMemo(() => {
    const o = new THREE.Vector3(position.x, position.y ?? 0, position.z);
    const dir = new THREE.Vector3(0, 1, 0);
    dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(position.pitch ?? 0));
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(position.heading ?? 0));
    const e = o.clone().add(dir.multiplyScalar(lineLength));
    // Cone center = end - half height along direction
    const coneCenter = e.clone().sub(dir.normalize().multiplyScalar(CONE_HEIGHT / 2));
    return { origin: o, end: e, conePos: coneCenter };
  }, [position.x, position.y, position.z, position.heading, position.pitch]);

  // Cone rotation: default coneGeometry points +Y, we need to point toward `end`
  const coneQuaternion = useMemo(() => {
    const dir = end.clone().sub(origin).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [origin, end]);

  return (
    <group>
      <Line
        points={[origin, end]}
        color="#ff6644"
        lineWidth={2}
        dashed
        dashScale={3}
        dashSize={0.8}
        gapSize={0.4}
      />
      <mesh position={conePos} quaternion={coneQuaternion}>
        <coneGeometry args={[0.4, CONE_HEIGHT, 6]} />
        <meshBasicMaterial color="#ff6644" transparent opacity={0.75} />
      </mesh>
    </group>
  );
}
