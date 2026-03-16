import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useProjectStore, CameraKeyframe } from '@/store/useProjectStore';
import * as THREE from 'three';

/**
 * Catmull-Rom spline interpolation for camera keyframes.
 * Runs inside the R3F render loop—smoothly animates position, lookAt, FOV.
 */

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function interpolateVec3(
  kfs: CameraKeyframe[],
  time: number,
  accessor: (kf: CameraKeyframe) => [number, number, number]
): [number, number, number] {
  if (kfs.length === 0) return [0, 8, 25];
  if (kfs.length === 1) return accessor(kfs[0]);

  // Clamp to range
  if (time <= kfs[0].time) return accessor(kfs[0]);
  if (time >= kfs[kfs.length - 1].time) return accessor(kfs[kfs.length - 1]);

  // Find segment
  let i = 0;
  for (; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) break;
  }

  const t = (time - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);

  const p0 = accessor(kfs[Math.max(0, i - 1)]);
  const p1 = accessor(kfs[i]);
  const p2 = accessor(kfs[i + 1]);
  const p3 = accessor(kfs[Math.min(kfs.length - 1, i + 2)]);

  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], t),
    catmullRom(p0[1], p1[1], p2[1], p3[1], t),
    catmullRom(p0[2], p1[2], p2[2], p3[2], t),
  ];
}

function interpolateFov(kfs: CameraKeyframe[], time: number): number {
  if (kfs.length === 0) return 60;
  if (kfs.length === 1) return kfs[0].fov;
  if (time <= kfs[0].time) return kfs[0].fov;
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].fov;

  let i = 0;
  for (; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) break;
  }

  const t = (time - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
  const p0 = kfs[Math.max(0, i - 1)].fov;
  const p1 = kfs[i].fov;
  const p2 = kfs[i + 1].fov;
  const p3 = kfs[Math.min(kfs.length - 1, i + 2)].fov;
  return catmullRom(p0, p1, p2, p3, t);
}

const CameraAnimator = React.forwardRef<any>(function CameraAnimator(_props, _ref) {
  const { camera } = useThree();
  const lookAtTarget = useRef(new THREE.Vector3());

  useFrame(() => {
    const { cameraKeyframes, cameraAnimationEnabled, currentTime, isPlaying } = useProjectStore.getState();
    if (!cameraAnimationEnabled || cameraKeyframes.length < 2 || !isPlaying) return;

    const pos = interpolateVec3(cameraKeyframes, currentTime, (kf) => kf.position);
    const look = interpolateVec3(cameraKeyframes, currentTime, (kf) => kf.lookAt);
    const fov = interpolateFov(cameraKeyframes, currentTime);

    camera.position.set(pos[0], pos[1], pos[2]);
    lookAtTarget.current.set(look[0], look[1], look[2]);
    camera.lookAt(lookAtTarget.current);

    if ((camera as THREE.PerspectiveCamera).fov !== fov) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });

  return null;
});

export default CameraAnimator;

/** Visualize the camera path as a 3D spline in the scene */
export function CameraPathPreview() {
  const keyframes = useProjectStore((s) => s.cameraKeyframes);
  const enabled = useProjectStore((s) => s.cameraAnimationEnabled);

  if (!enabled || keyframes.length < 2) return null;

  // Sample 100 points along the path
  const points: THREE.Vector3[] = [];
  const startT = keyframes[0].time;
  const endT = keyframes[keyframes.length - 1].time;
  const steps = 100;

  for (let i = 0; i <= steps; i++) {
    const t = startT + (endT - startT) * (i / steps);
    const p = interpolateVec3(keyframes, t, (kf) => kf.position);
    points.push(new THREE.Vector3(p[0], p[1], p[2]));
  }

  return (
    <group>
      {/* Path line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#00ffff" transparent opacity={0.4} linewidth={1} />
      </line>

      {/* Keyframe markers */}
      {keyframes.map((kf) => (
        <mesh key={kf.id} position={kf.position}>
          <octahedronGeometry args={[0.3, 0]} />
          <meshBasicMaterial color="#00ffff" transparent opacity={0.6} wireframe />
        </mesh>
      ))}
    </group>
  );
}
