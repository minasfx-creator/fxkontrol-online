/**
 * Training v2.1 — CinematicCameraDirector.
 *
 * Imperative camera director driven by MissionRunner cinematic beats.
 *
 * Pipeline:
 *   runner.onEvent('beat:start') → director.enqueue(beat)
 *
 * Behaviour:
 *   • Each enqueued beat reserves a slot in a FIFO queue (no dedup —
 *     beats with same id can stack legitimately).
 *   • While the head beat is active, the camera lerps from its current
 *     pose toward the shot's offset/lookOffset around the resolved
 *     focus, with FOV interpolation. Ease is shot-defined.
 *   • When the queue drains, the director records a return pose
 *     (the OrbitControls target snapshot it captured) and lerps back
 *     to it for `RETURN_MS`, then releases full control to OrbitControls.
 *   • `onActiveChange(true)` fires the moment the first beat becomes
 *     head (so parent can disable OrbitControls). `onActiveChange(false)`
 *     fires AFTER the return-lerp completes — never mid-flight.
 *
 * Mounted INSIDE <Canvas>, sibling to <OrbitControls />.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicBeat } from '../missions/types';
import { SHOT_LIBRARY } from './shotLibrary';

const RETURN_MS = 650;

interface QueueItem {
  beat: CinematicBeat;
  startedAt: number;
  endsAt: number;
}

export interface CinematicCameraDirectorHandle {
  enqueue: (beat: CinematicBeat) => void;
  /** Drop everything; release control immediately on next frame. */
  clear: () => void;
  /** True while a beat is active OR the return-lerp is running. */
  isActive: () => boolean;
}

interface Props {
  /** Resolve world position of an NPC by id (close-up shots). */
  resolveNpcPosition?: (npcId: string) => [number, number, number] | null;
  /** Notify parent so it can disable OrbitControls / dim HUD. */
  onActiveChange?: (active: boolean) => void;
  /** Notify per-beat lifecycle (debug / HUD letterbox sync). */
  onBeatEnd?: (beat: CinematicBeat) => void;
}

const CinematicCameraDirector = forwardRef<CinematicCameraDirectorHandle, Props>(
  function CinematicCameraDirector({ resolveNpcPosition, onActiveChange, onBeatEnd }, ref) {
    const camera = useThree((s) => s.camera);
    const queue = useRef<QueueItem[]>([]);
    const [active, setActive] = useState(false);
    const activeRef = useRef(false);
    const targetPos = useMemo(() => new THREE.Vector3(), []);
    const targetLook = useMemo(() => new THREE.Vector3(), []);
    const tmpFocus = useMemo(() => new THREE.Vector3(), []);
    const lookCurrent = useMemo(() => new THREE.Vector3(), []);
    const returnPos = useMemo(() => new THREE.Vector3(), []);
    const returnLook = useMemo(() => new THREE.Vector3(), []);
    const returnFov = useRef<number | null>(null);
    const returnStartedAt = useRef<number | null>(null);
    const captured = useRef(false);

    useImperativeHandle(ref, () => ({
      enqueue(beat: CinematicBeat) {
        const def = SHOT_LIBRARY[beat.shot] ?? SHOT_LIBRARY['medium-2shot'];
        const now = performance.now();
        const dur = beat.durationMs ?? def.durationMs;
        queue.current.push({ beat, startedAt: now, endsAt: now + dur });
      },
      clear() {
        queue.current.length = 0;
        returnStartedAt.current = null;
        captured.current = false;
      },
      isActive() {
        return activeRef.current;
      },
    }), []);

    const setActiveBoth = (next: boolean) => {
      activeRef.current = next;
      setActive(next);
      onActiveChange?.(next);
    };

    useEffect(() => {
      // Sync ref with state (defensive — should already match).
      activeRef.current = active;
    }, [active]);

    useFrame(() => {
      const now = performance.now();

      // Expire & emit beat:end
      while (queue.current.length && queue.current[0].endsAt <= now) {
        const finished = queue.current.shift()!;
        try { onBeatEnd?.(finished.beat); } catch { /* swallow */ }
      }

      const head = queue.current[0];

      // ── Active beat path ───────────────────────────────────
      if (head) {
        if (!activeRef.current) {
          // Capture the player's pose so we can restore later.
          returnPos.copy(camera.position);
          camera.getWorldDirection(lookCurrent);
          returnLook.copy(camera.position).add(lookCurrent.multiplyScalar(8));
          returnFov.current = (camera as THREE.PerspectiveCamera).fov ?? 50;
          captured.current = true;
          setActiveBoth(true);
        }

        const def = SHOT_LIBRARY[head.beat.shot] ?? SHOT_LIBRARY['medium-2shot'];

        // Resolve focus
        if (head.beat.focus) {
          tmpFocus.set(head.beat.focus[0], head.beat.focus[1], head.beat.focus[2]);
        } else if (head.beat.npcId && resolveNpcPosition) {
          const p = resolveNpcPosition(head.beat.npcId);
          if (p) tmpFocus.set(p[0], p[1], p[2]);
          else tmpFocus.set(0, 1.5, 0);
        } else {
          tmpFocus.set(0, 1.5, 0);
        }

        targetPos.set(
          tmpFocus.x + def.offset[0],
          tmpFocus.y + def.offset[1],
          tmpFocus.z + def.offset[2],
        );
        targetLook.set(
          tmpFocus.x + def.lookOffset[0],
          tmpFocus.y + def.lookOffset[1],
          tmpFocus.z + def.lookOffset[2],
        );
        camera.position.lerp(targetPos, def.ease);
        camera.lookAt(targetLook);
        if ('fov' in camera) {
          const pc = camera as THREE.PerspectiveCamera;
          if (pc.fov !== def.fov) {
            pc.fov = THREE.MathUtils.lerp(pc.fov, def.fov, def.ease);
            pc.updateProjectionMatrix();
          }
        }
        return;
      }

      // ── Return path (queue drained) ────────────────────────
      if (activeRef.current && captured.current) {
        if (returnStartedAt.current === null) returnStartedAt.current = now;
        const elapsed = now - returnStartedAt.current;
        const t = Math.min(1, elapsed / RETURN_MS);
        // Smooth (cosine ease-in-out)
        const k = 0.5 - 0.5 * Math.cos(Math.PI * t);
        camera.position.lerp(returnPos, Math.min(1, k * 0.85));
        camera.lookAt(returnLook);
        if ('fov' in camera && returnFov.current != null) {
          const pc = camera as THREE.PerspectiveCamera;
          pc.fov = THREE.MathUtils.lerp(pc.fov, returnFov.current, Math.min(1, k * 0.6));
          pc.updateProjectionMatrix();
        }
        if (t >= 1) {
          // Fully restored — release.
          captured.current = false;
          returnStartedAt.current = null;
          returnFov.current = null;
          setActiveBoth(false);
        }
      }
    });

    return null;
  },
);

export default CinematicCameraDirector;
