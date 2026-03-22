import { useRef, useState, useCallback, useEffect, useMemo, forwardRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { useProjectStore, type Position, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useUndoStore } from '@/store/useUndoStore';
import { useAddressingStore } from '@/store/useAddressingStore';
import * as THREE from 'three';

const PYRO_COLOR = '#FF6B35';
const DRONE_COLOR = '#00B4D8';
const SNAP_GRID = 0.5;
const SNAP_GUIDE_THRESHOLD = 0.4;

interface SnapGuide {
  axis: 'x' | 'z';
  value: number;
  sourceName: string;
}

interface IconProps {
  color: string;
  emissiveIntensity: number;
  isSelected: boolean;
}

/** Simple rack icon — a minimal mortar rack (3 tubes on a base plate) */
const MortarTubeIcon = forwardRef<THREE.Group, IconProps>(({ color, emissiveIntensity, isSelected }, ref) => {
  return (
    <group ref={ref}>
      {/* Base plate — compact */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.02]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Tube left */}
      <mesh position={[-0.08, 0.16, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.28, 6, 1, true]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.2} emissive={color} emissiveIntensity={emissiveIntensity * 0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Tube center */}
      <mesh position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.34, 6, 1, true]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.2} emissive={color} emissiveIntensity={emissiveIntensity * 0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Tube right */}
      <mesh position={[0.08, 0.16, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.28, 6, 1, true]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.2} emissive={color} emissiveIntensity={emissiveIntensity * 0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Color band at top of center tube */}
      <mesh position={[0, 0.36, 0]}>
        <torusGeometry args={[0.045, 0.008, 6, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Glow indicator when selected */}
      {isSelected && (
        <mesh position={[0, 0.38, 0]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshBasicMaterial color="#FFDD44" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  );
});
MortarTubeIcon.displayName = 'MortarTubeIcon';

/** Drone pad icon */
const DronePadIcon = forwardRef<THREE.Group, IconProps>(({ color, emissiveIntensity, isSelected }, ref) => {
  return (
    <group ref={ref}>
      {/* Landing pad disc */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.03, 16]} />
        <meshStandardMaterial color="#222" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* H marking */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Vertical beacon */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity * 0.5}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      {/* Top sphere */}
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.9 : 0.3}
        />
      </mesh>
    </group>
  );
});
DronePadIcon.displayName = 'DronePadIcon';

const DISTANCE_REF = 15;
const SCALE_MIN = 0.15;
const SCALE_MAX = 0.8;

/** Enhanced pulsing glow with shockwave + orbiting particles */
function LinkedGlowRing({ color }: { color: string }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Group>(null);
  const shockwaveMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Primary ring pulse
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 5) * 0.25;
      ringRef.current.scale.setScalar(s);
    }
    // Shockwave expanding ring (loops every 2s)
    if (shockwaveRef.current && shockwaveMaterialRef.current) {
      const cycle = (t % 2) / 2; // 0→1 over 2s
      const scale = 1 + cycle * 2.5;
      shockwaveRef.current.scale.setScalar(scale);
      shockwaveMaterialRef.current.opacity = 0.5 * (1 - cycle);
    }
    // Orbiting particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 2.5;
      particlesRef.current.children.forEach((child, i) => {
        const offset = (i / 8) * Math.PI * 2;
        const bob = Math.sin(t * 4 + offset) * 0.08;
        child.position.y = 0.15 + bob;
      });
    }
  });

  const particlePositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      positions.push([Math.cos(angle) * 0.7, 0.15, Math.sin(angle) * 0.7]);
    }
    return positions;
  }, []);

  return (
    <group>
      {/* Primary pulsing ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.7, 1.4, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Shockwave expanding ring */}
      <mesh ref={shockwaveRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshBasicMaterial ref={shockwaveMaterialRef} color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Orbiting particles */}
      <group ref={particlesRef}>
        {particlePositions.map((pos, i) => (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const Pin = forwardRef<THREE.Group, { position: Position; onRightClick: (pos: Position, screenPos: { x: number; y: number }) => void }>(function Pin({ position, onRightClick }, ref) {
  const { selectedPositionIds, selectPosition, selectPositionAndLinkedEvents, togglePositionSelection, editorMode, updatePosition, timelineItems, linkedTimelineItemIds } = useProjectStore();
  const isSelected = selectedPositionIds.includes(position.id);
  const color = position.type === 'pyro' ? PYRO_COLOR : (position.color || DRONE_COLOR);
  const glowRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const { camera, raycaster, gl } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const dragOffset = useRef(new THREE.Vector3());
  const otherStartPositions = useRef<Map<string, { x: number; z: number }>>(new Map());
  const dragStartPos = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const hasSavedCheckpoint = useRef(false);
  const _posVec = useRef(new THREE.Vector3());

  const linkedItemIds = useMemo(() =>
    timelineItems.filter(t => t.positionId === position.id || t.positionIds?.includes(position.id)).map(t => t.id),
    [timelineItems, position.id]
  );
  const linkedEffects = linkedItemIds.length;

  // Check if this position's linked events are highlighted from the timeline
  const hasLinkedGlow = useMemo(() =>
    linkedItemIds.some(id => linkedTimelineItemIds.includes(id)),
    [linkedItemIds, linkedTimelineItemIds]
  );

  // FireOne module badge
  const addresses = useAddressingStore(s => s.addresses);
  const moduleBadge = useMemo(() => {
    const addr = addresses.find(a => linkedItemIds.includes(a.timelineItemId));
    return addr ? `M${addr.module}` : null;
  }, [addresses, linkedItemIds]);

  useFrame(({ clock, camera: cam }) => {
    if (glowRef.current && isSelected) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.12 + 0.88;
      glowRef.current.scale.setScalar(pulse);
    }
    // Distance-based scaling — shrink pins when far from camera
    if (groupRef.current) {
      _posVec.current.set(position.x, position.y, position.z);
      const dist = cam.position.distanceTo(_posVec.current);
      const baseScale = isSelected ? 0.75 : isHovered ? 0.68 : 0.6;
      const distScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, baseScale * (DISTANCE_REF / Math.max(dist, 1))));
      groupRef.current.scale.setScalar(distScale);
    }
  });

  const computeSnapGuides = useCallback((x: number, z: number): { guides: SnapGuide[]; snappedX: number; snappedZ: number } => {
    const store = useProjectStore.getState();
    const others = store.positions.filter(p => !store.selectedPositionIds.includes(p.id));
    const guides: SnapGuide[] = [];
    let snappedX = x;
    let snappedZ = z;

    for (const other of others) {
      if (Math.abs(other.x - x) < SNAP_GUIDE_THRESHOLD) {
        guides.push({ axis: 'x', value: other.x, sourceName: other.name });
        snappedX = other.x;
      }
      if (Math.abs(other.z - z) < SNAP_GUIDE_THRESHOLD) {
        guides.push({ axis: 'z', value: other.z, sourceName: other.name });
        snappedZ = other.z;
      }
    }
    return { guides, snappedX, snappedZ };
  }, []);

  const onPointerDown = useCallback((e: any) => {
    if (editorMode !== 'select') return;
    e.stopPropagation();

    // Finale 3D: lock positions prevents dragging
    const lockPositions = useSceneStore.getState().environment.lockPositions;

    if (e.nativeEvent?.button === 2 || e.button === 2) {
      onRightClick(position, { x: e.clientX || e.nativeEvent?.clientX || 0, y: e.clientY || e.nativeEvent?.clientY || 0 });
      window.dispatchEvent(new CustomEvent('position-context-menu', {
        detail: { posId: position.id, x: e.clientX || e.nativeEvent?.clientX || 0, y: e.clientY || e.nativeEvent?.clientY || 0 }
      }));
      return;
    }

    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      togglePositionSelection(position.id);
      return;
    }

    if (!selectedPositionIds.includes(position.id)) {
      selectPositionAndLinkedEvents(position.id);
    }

    // If positions are locked, only allow selection, not dragging
    if (lockPositions) return;

    setIsDragging(true);
    hasSavedCheckpoint.current = false;
    dragStartPos.current = { x: position.x, z: position.z };
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';

    dragPlane.current.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(position.x, 0, position.z)
    );

    const rect = gl.domElement.getBoundingClientRect();
    const clientX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const clientY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(dragPlane.current, intersection.current);
    dragOffset.current.set(
      position.x - intersection.current.x,
      0,
      position.z - intersection.current.z
    );

    const store = useProjectStore.getState();
    otherStartPositions.current.clear();
    store.selectedPositionIds.forEach(id => {
      if (id !== position.id) {
        const p = store.positions.find(pp => pp.id === id);
        if (p) otherStartPositions.current.set(id, { x: p.x, z: p.z });
      }
    });
  }, [editorMode, position, selectPositionAndLinkedEvents, togglePositionSelection, selectedPositionIds, gl, camera, raycaster, onRightClick]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      if (!hasSavedCheckpoint.current) {
        useUndoStore.getState().checkpoint();
        hasSavedCheckpoint.current = true;
      }

      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(dragPlane.current, intersection.current);

      let newX = intersection.current.x + dragOffset.current.x;
      let newZ = intersection.current.z + dragOffset.current.z;

      if (e.ctrlKey || e.metaKey) {
        newX = Math.round(newX / SNAP_GRID) * SNAP_GRID;
        newZ = Math.round(newZ / SNAP_GRID) * SNAP_GRID;
        setSnapGuides([]);
      } else {
        const { guides, snappedX, snappedZ } = computeSnapGuides(
          Math.round(newX * 10) / 10,
          Math.round(newZ * 10) / 10
        );
        newX = snappedX;
        newZ = snappedZ;
        setSnapGuides(guides);
      }

      const store = useProjectStore.getState();
      updatePosition(position.id, { x: newX, z: newZ });

      if (store.selectedPositionIds.length > 1 && store.selectedPositionIds.includes(position.id)) {
        const dx = newX - dragStartPos.current.x;
        const dz = newZ - dragStartPos.current.z;
        otherStartPositions.current.forEach((startPos, id) => {
          updatePosition(id, {
            x: Math.round((startPos.x + dx) * 10) / 10,
            z: Math.round((startPos.z + dz) * 10) / 10,
          });
        });
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      setSnapGuides([]);
      (gl.domElement as HTMLElement).style.cursor = '';
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, position.id, updatePosition, camera, raycaster, gl, computeSnapGuides]);

  const onPointerOver = useCallback(() => {
    if (editorMode === 'select') {
      setIsHovered(true);
      (gl.domElement as HTMLElement).style.cursor = 'grab';
    }
  }, [editorMode, gl]);

  const onPointerOut = useCallback(() => {
    setIsHovered(false);
    if (!isDragging) (gl.domElement as HTMLElement).style.cursor = '';
  }, [isDragging, gl]);

  const onDoubleClick = useCallback((e: any) => {
    e.stopPropagation();
    selectPosition(position.id);
    window.dispatchEvent(new CustomEvent('position-double-click', { detail: { posId: position.id } }));
  }, [position.id, selectPosition]);

  const emissiveIntensity = isDragging ? 1.0 : isSelected ? 0.7 : isHovered ? 0.4 : 0.15;
  const labelsVisible = useSceneStore(s => s.environment.showPositionLabels);
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  const showLabel = labelsVisible && (isMobileView ? (isSelected || isDragging) : (isHovered || isSelected || isDragging));

  return (
    <group ref={(node) => { (groupRef as any).current = node; if (typeof ref === 'function') ref(node); else if (ref) (ref as any).current = node; }} position={[position.x, position.y, position.z]}>
      {/* Base disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[isSelected ? 0.65 : 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.5 : isHovered ? 0.3 : 0.2} />
      </mesh>

      {/* Drag crosshair guides */}
      {isDragging && (
        <>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 0.03]} />
            <meshBasicMaterial color="#ff4444" transparent opacity={0.25} />
          </mesh>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[200, 0.03]} />
            <meshBasicMaterial color="#4444ff" transparent opacity={0.25} />
          </mesh>
        </>
      )}

      {/* Snap alignment guides */}
      {snapGuides.map((guide, i) => (
        <mesh key={i} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, guide.axis === 'x' ? Math.PI / 2 : 0]}>
          <planeGeometry args={[300, 0.04]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* 3D Icon - Mortar or Drone Pad + invisible hitbox for easier clicking */}
      <group
        onPointerDown={onPointerDown}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onDoubleClick={onDoubleClick}
      >
        {/* Invisible hitbox sphere — makes clicking much easier */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.6, 8, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {position.type === 'pyro' ? (
          <group rotation={[
            (position.pitch || 85) * (Math.PI / 180) - Math.PI / 2,
            -position.heading * (Math.PI / 180),
            (position.roll || 0) * (Math.PI / 180),
          ]} /* Finale Euler: Pitch(X) → Roll(Z) → Heading(Y) order YZX */>
            <MortarTubeIcon color={color} emissiveIntensity={emissiveIntensity} isSelected={isSelected} />
          </group>
        ) : (
          <DronePadIcon color={color} emissiveIntensity={emissiveIntensity} isSelected={isSelected} />
        )}
      </group>

      {/* Always-on direction line — Finale 3D style */}
      <DirectionLine position={position} color={color} isSelected={isSelected} isHovered={isHovered} />

      {/* Selection ring */}
      {isSelected && (
        <group ref={glowRef}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[0.6, 0.75, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <ringGeometry args={[0.75, 1.0, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      )}

      {/* Linked glow ring — pulses when events are selected from timeline (visible even when selected) */}
      {hasLinkedGlow && (
        <LinkedGlowRing color={position.type === 'pyro' ? '#FF6B35' : '#00B4D8'} />
      )}

      {/* Hover ring */}
      {isHovered && !isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.55, 0.65, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} />
        </mesh>
      )}

      {/* FireOne module badge */}
      {moduleBadge && (
        <Html position={[0.5, position.type === 'pyro' ? 0.6 : 0.55, 0]} center distanceFactor={8}>
          <div className="px-1 py-0 rounded text-[7px] font-mono font-bold bg-green-600/80 text-white border border-green-400/40 shadow-sm whitespace-nowrap">
            {moduleBadge}
          </div>
        </Html>
      )}

      {/* Clickable Label Plate — visible on hover/select only */}
      {showLabel && (
        <Html position={[0, position.type === 'pyro' ? 1.1 : 0.75, 0]} center occlude distanceFactor={8}>
          <div
            className="px-1.5 py-0.5 rounded-md text-[9px] font-mono whitespace-nowrap flex items-center gap-1 backdrop-blur-md select-none cursor-pointer transition-all duration-150 hover:scale-105"
            style={{
              backgroundColor: isSelected ? `${color}66` : `${color}22`,
              border: `1px solid ${isSelected ? `${color}bb` : `${color}55`}`,
              color,
              boxShadow: isSelected ? `0 0 12px ${color}44, 0 1px 4px rgba(0,0,0,0.3)` : '0 1px 4px rgba(0,0,0,0.25)',
              pointerEvents: 'auto',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.button === 2) {
                onRightClick(position, { x: e.clientX, y: e.clientY });
                return;
              }
              if (e.shiftKey) {
                togglePositionSelection(position.id);
              } else {
                selectPosition(position.id);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              selectPosition(position.id);
              window.dispatchEvent(new CustomEvent('position-double-click', { detail: { posId: position.id } }));
            }}
          >
            <span className="font-bold">{position.name}</span>
            {isDragging && (
              <span className="opacity-80 font-mono text-[8px] bg-black/30 px-1 rounded">
                {position.x.toFixed(1)}, {position.z.toFixed(1)}
              </span>
            )}
          </div>
        </Html>
      )}

      {/* Safety ring for pyro */}
      {isSelected && position.type === 'pyro' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[9.5, 10, 48]} />
          <meshBasicMaterial color="#FF4500" transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
});
Pin.displayName = 'Pin';

/** Always-on direction line — shows launch vector from H/P/R Euler rotation */
function DirectionLine({ position, color, isSelected, isHovered }: { position: Position; color: string; isSelected: boolean; isHovered: boolean }) {
  const linePoints = useMemo((): [number, number, number][] => {
    if (position.type !== 'pyro') return [];
    const hRad = position.heading * (Math.PI / 180);
    const pRad = (position.pitch || 85) * (Math.PI / 180);
    const length = isSelected ? 3 : 2;
    const dx = Math.sin(hRad) * Math.cos(pRad) * length;
    const dy = Math.sin(pRad) * length;
    const dz = -Math.cos(hRad) * Math.cos(pRad) * length;
    return [[0, 0.15, 0], [dx, dy + 0.15, dz]];
  }, [position.heading, position.pitch, position.type, isSelected]);

  if (linePoints.length < 2) return null;

  const opacity = isSelected ? 0.7 : isHovered ? 0.3 : 0.15;
  const lineWidth = isSelected ? 2.5 : isHovered ? 1.5 : 1;

  return (
    <>
      <Line points={linePoints} color={isSelected ? color : '#aaaaaa'} lineWidth={lineWidth} transparent opacity={opacity} />
      {/* Small arrowhead at tip */}
      {(() => {
        const tip = linePoints[1];
        const dir = new THREE.Vector3(tip[0], tip[1] - 0.15, tip[2]).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const e = new THREE.Euler().setFromQuaternion(q);
        return (
          <mesh position={tip} rotation={[e.x, e.y, e.z]}>
            <coneGeometry args={[0.06, 0.18, 4]} />
            <meshBasicMaterial color={isSelected ? color : '#aaaaaa'} transparent opacity={opacity} />
          </mesh>
        );
      })()}
    </>
  );
}

/** Ground plane for placing new pins — continuous mode */
function GroundClickPlane() {
  const { editorMode, addPosition, setEditorMode, addWaypoint, selectedTrajectoryId, drawHeight } = useProjectStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (editorMode === 'add-pyro' || editorMode === 'add-drone' || editorMode === 'add-waypoint')) {
        setEditorMode('select');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorMode, setEditorMode]);

  const handleClick = useCallback((e: THREE.Event & { point: THREE.Vector3 }) => {
    if (editorMode === 'add-pyro' || editorMode === 'add-drone') {
      useUndoStore.getState().checkpoint();
      const type = editorMode === 'add-pyro' ? 'pyro' as const : 'drone-pad' as const;
      const prefix = type === 'pyro' ? 'POS' : 'PAD';
      const count = useProjectStore.getState().positions.filter(p => p.type === type).length + 1;
      const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      addPosition({
        id,
        name: `${prefix}-${count.toString().padStart(3, '0')}`,
        type,
        x: Math.round(e.point.x * 10) / 10,
        y: 0,
        z: Math.round(e.point.z * 10) / 10,
        heading: 0, pitch: 85, roll: 0,
        color: type === 'drone-pad' ? '#00B4D8' : '#FF6B35',
      });
      useProjectStore.getState().selectPosition(id);
      return;
    }

    if (editorMode === 'add-waypoint' && selectedTrajectoryId) {
      const store = useProjectStore.getState();
      const traj = store.trajectories.find((t) => t.id === selectedTrajectoryId);
      const sorted = traj ? [...traj.waypoints].sort((a, b) => a.time - b.time) : [];
      const lastWp = sorted[sorted.length - 1];
      const time = lastWp ? lastWp.time + 2 : 2;
      addWaypoint(selectedTrajectoryId, {
        id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        position: { x: Math.round(e.point.x * 10) / 10, y: drawHeight, z: Math.round(e.point.z * 10) / 10 },
        time,
      });
    }
  }, [editorMode, addPosition, setEditorMode, addWaypoint, selectedTrajectoryId, drawHeight]);

  if (editorMode !== 'add-pyro' && editorMode !== 'add-drone' && editorMode !== 'add-waypoint') return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onClick={handleClick}>
      <planeGeometry args={[20000, 20000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/** Click ground to deselect */
function GroundDeselectPlane() {
  const { editorMode, selectPosition } = useProjectStore();
  const handleClick = useCallback((e: any) => {
    if (e.nativeEvent?.shiftKey || e.shiftKey) return;
    if (editorMode === 'select') selectPosition(null);
  }, [editorMode, selectPosition]);

  if (editorMode !== 'select') return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={handleClick}>
      <planeGeometry args={[4000, 4000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export default function PositionPins() {
  const { positions } = useProjectStore();
  const [contextMenu, setContextMenu] = useState<{ pos: Position; screen: { x: number; y: number } } | null>(null);

  const handleRightClick = useCallback((pos: Position, screenPos: { x: number; y: number }) => {
    setContextMenu({ pos, screen: screenPos });
  }, []);

  return (
    <>
      <GroundDeselectPlane />
      <GroundClickPlane />
      {positions.map((pos) => (
        <Pin key={pos.id} position={pos} onRightClick={handleRightClick} />
      ))}
    </>
  );
}
