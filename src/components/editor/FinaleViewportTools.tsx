/**
 * FinaleViewportTools — Finale 3D-style viewport toolbar
 * Axes helper, transform gizmo mode switcher, grid snap resolution
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '@/store/useSceneStore';
import { Move, RotateCw, Maximize2, Grid3X3, Axis3D, Magnet } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// R3F: AxesHelper — XYZ colored axes at world origin (Finale 3D style)
// ═══════════════════════════════════════════════════════════════════════
export function FinaleAxesHelper() {
  const show = useSceneStore(st => st.environment.showAxesHelper);
  const groupRef = useRef<THREE.Group>(null);

  // Axes with labels and arrow cones
  const axisLength = 15;

  if (!show) return null;

  return (
    <group ref={groupRef} position={[0, 0.05, 0]}>
      {/* X Axis — Red */}
      <mesh position={[axisLength / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, axisLength, 6]} />
        <meshBasicMaterial color="#ff3333" />
      </mesh>
      <mesh position={[axisLength + 0.3, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.2, 0.6, 8]} />
        <meshBasicMaterial color="#ff3333" />
      </mesh>
      {/* Rotate cylinder to lie along X */}
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh position={[0, -axisLength / 2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, axisLength, 6]} />
          <meshBasicMaterial color="#ff3333" transparent opacity={0} />
        </mesh>
      </group>

      {/* Y Axis — Green */}
      <mesh position={[0, axisLength / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, axisLength, 6]} />
        <meshBasicMaterial color="#33ff33" />
      </mesh>
      <mesh position={[0, axisLength + 0.3, 0]}>
        <coneGeometry args={[0.2, 0.6, 8]} />
        <meshBasicMaterial color="#33ff33" />
      </mesh>

      {/* Z Axis — Blue */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, axisLength / 2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, axisLength, 6]} />
          <meshBasicMaterial color="#3388ff" />
        </mesh>
        <mesh position={[0, axisLength + 0.3, 0]}>
          <coneGeometry args={[0.2, 0.6, 8]} />
          <meshBasicMaterial color="#3388ff" />
        </mesh>
      </group>

      {/* Origin sphere */}
      <mesh>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// R3F: Double-click to focus camera on clicked position
// ═══════════════════════════════════════════════════════════════════════
export function DoubleClickFocus() {
  const { camera, gl, raycaster, scene } = useThree();
  const lastClick = useRef(0);
  const _intersection = useMemo(() => new THREE.Vector3(), []);

  useMemo(() => {
    const canvas = gl.domElement;

    const handleClick = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastClick.current < 350) {
        // Double click detected
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);

        // Intersect scene objects (skip ground planes > 1000 units)
        const intersects = raycaster.intersectObjects(scene.children, true);
        for (const hit of intersects) {
          // Skip huge ground planes
          const mesh = hit.object as THREE.Mesh;
          if (mesh.geometry && mesh.geometry instanceof THREE.PlaneGeometry) {
            const params = mesh.geometry.parameters;
            if (params.width > 500 || params.height > 500) continue;
          }

          _intersection.copy(hit.point);

          // Dispatch event for CameraController to smoothly fly to target
          window.dispatchEvent(new CustomEvent('focus-camera-on-point', {
            detail: {
              x: _intersection.x,
              y: _intersection.y,
              z: _intersection.z,
            },
          }));
          break;
        }
      }
      lastClick.current = now;
    };

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [camera, gl, raycaster, scene, _intersection]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// HTML: Transform Gizmo Mode Toolbar (Finale 3D style)
// ═══════════════════════════════════════════════════════════════════════
const GIZMO_MODES = [
  { id: 'translate' as const, icon: Move, label: 'Move (W)', key: 'w' },
  { id: 'rotate' as const, icon: RotateCw, label: 'Rotate (E)', key: 'e' },
  { id: 'scale' as const, icon: Maximize2, label: 'Scale (R)', key: 'r' },
];

const SNAP_RESOLUTIONS = [0.1, 0.25, 0.5, 1, 2, 5, 10];

export function FinaleToolbar() {
  const env = useSceneStore(st => st.environment);
  const updateEnvironment = useSceneStore(st => st.updateEnvironment);
  const mode = env.positionTransformMode;
  const snap = env.gridSnapResolution;
  const showAxes = env.showAxesHelper;

  return (
    <div className="absolute bottom-14 right-3 z-40 flex flex-col items-end gap-1.5">
      {/* Transform Gizmo Mode */}
      <div className="flex items-center gap-0.5 bg-card/85 backdrop-blur-xl border border-border/25 rounded-xl px-1 py-0.5 shadow-lg">
        {GIZMO_MODES.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => updateEnvironment({ positionTransformMode: id })}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              mode === id
                ? "bg-primary/20 text-primary shadow-md shadow-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            )}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        <div className="w-px h-5 bg-border/30 mx-0.5" />

        {/* Axes toggle */}
        <button
          onClick={() => updateEnvironment({ showAxesHelper: !showAxes })}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            showAxes
              ? "bg-accent/20 text-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
          )}
          title="Axes Helper (XYZ)"
        >
          <Axis3D className="w-4 h-4" />
        </button>
      </div>

      {/* Grid Snap Resolution */}
      <div className="flex items-center gap-1 bg-card/85 backdrop-blur-xl border border-border/25 rounded-xl px-2 py-1 shadow-lg">
        <Magnet className="w-3 h-3 text-muted-foreground/50" />
        <span className="text-[8px] font-mono text-muted-foreground/50 uppercase mr-1">Snap</span>
        {SNAP_RESOLUTIONS.map(res => (
          <button
            key={res}
            onClick={() => updateEnvironment({ gridSnapResolution: res })}
            className={cn(
              "text-[9px] font-mono px-1.5 py-0.5 rounded transition-all",
              snap === res
                ? "bg-primary/15 text-primary font-bold"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            {res >= 1 ? `${res}m` : `${res * 100}cm`}
          </button>
        ))}
      </div>
    </div>
  );
}
