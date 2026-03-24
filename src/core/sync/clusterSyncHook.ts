/**
 * ─── useClusterSync Hook ────────────────────────────────────────────
 * Consumed by SkyCanvas useFrame loop.
 * Master: broadcasts camera/time/physics each frame.
 * Client: overrides camera/time from master state (interpolated).
 */

import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { clusterSync, type ClusterFrame } from './clusterSyncEngine';
import { useProjectStore } from '@/store/useProjectStore';

/** Pre-allocated refs for Zero-GC frame loop */
interface ClusterSyncRefs {
  frameCount: number;
  broadcastInterval: number; // broadcast every N frames (60fps → 30fps = every 2)
}

export function useClusterSync() {
  const { camera } = useThree();
  const refs = useRef<ClusterSyncRefs>({ frameCount: 0, broadcastInterval: 2 });

  /** Call from useFrame — handles both master and client */
  const tick = (currentTime: number) => {
    const role = clusterSync.getRole();
    if (role === 'standalone') return;

    refs.current.frameCount++;

    if (role === 'master') {
      // Broadcast at reduced rate (30 FPS)
      if (refs.current.frameCount % refs.current.broadcastInterval !== 0) return;

      const wind = useProjectStore.getState().wind;
      clusterSync.broadcastFrame(
        {
          px: camera.position.x,
          py: camera.position.y,
          pz: camera.position.z,
          rx: camera.rotation.x,
          ry: camera.rotation.y,
          rz: camera.rotation.z,
          fov: 'fov' in camera ? (camera as any).fov : 60,
        },
        currentTime,
        {
          windX: wind[0],
          windY: wind[1],
          windZ: wind[2],
          drag: 0.03,
          turbulence: 0,
        },
        0,
      );
    }

    if (role === 'client') {
      const frame = clusterSync.getInterpolatedFrame();
      if (!frame) return;

      // Override camera from master — smooth interpolation (never snap)
      camera.position.set(frame.camera.px, frame.camera.py, frame.camera.pz);
      camera.rotation.set(frame.camera.rx, frame.camera.ry, frame.camera.rz);
      if ('fov' in camera) {
        (camera as any).fov = frame.camera.fov;
        (camera as any).updateProjectionMatrix();
      }
    }
  };

  return { tick };
}
