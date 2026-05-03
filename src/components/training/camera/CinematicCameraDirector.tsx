/**
 * Training v2.1 — CinematicCameraDirector.
 *
 * Subscribes to the MissionRunner event stream. When a `beat:start`
 * fires, it pushes a queued shot. The camera lerps from the player's
 * OrbitControls position to the shot, holds for `durationMs`, then
 * releases back to the player.
 *
 * Mounted INSIDE the existing <Canvas> (sibling to OrbitControls).
 * Disables OrbitControls while a shot is active by toggling its
 * `enabled` prop via the `onActiveChange` callback on the parent.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicBeat } from '../missions/types';
import { SHOT_LIBRARY } from './shotLibrary';

interface QueueItem {
  beat: CinematicBeat;
  startedAt: number;
  endsAt: number;
}

interface Props {
  /** Pulled from runner.onEvent('beat:start'). */
  pendingBeat: CinematicBeat | null;
  /** Resolve world position of an NPC by id (for close-up shots). */
  resolveNpcPosition?: (npcId: string) => [number, number, number] | null;
  /** Notify parent so it can disable OrbitControls. */
  onActiveChange?: (active: boolean) => void;
}

export default function CinematicCameraDirector({
  pendingBeat,
  resolveNpcPosition,
  onActiveChange,
}: Props) {
  const camera = useThree((s) => s.camera);
  const queue = useRef<QueueItem[]>([]);
  const lastBeatId = useRef<string | null>(null);
  const [active, setActive] = useState(false);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLook = useMemo(() => new THREE.Vector3(), []);
  const tmpFocus = useMemo(() => new THREE.Vector3(), []);

  // Push beat into queue when prop changes
  useEffect(() => {
    if (!pendingBeat || pendingBeat.id === lastBeatId.current) return;
    lastBeatId.current = pendingBeat.id;
    const def = SHOT_LIBRARY[pendingBeat.shot];
    const now = performance.now();
    const dur = pendingBeat.durationMs ?? def.durationMs;
    queue.current.push({ beat: pendingBeat, startedAt: now, endsAt: now + dur });
  }, [pendingBeat]);

  useFrame(() => {
    const now = performance.now();
    // Drop expired
    while (queue.current.length && queue.current[0].endsAt <= now) {
      queue.current.shift();
    }
    const head = queue.current[0];
    const isActive = !!head;
    if (isActive !== active) {
      setActive(isActive);
      onActiveChange?.(isActive);
    }
    if (!head) return;

    const def = SHOT_LIBRARY[head.beat.shot];
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
    if ('fov' in camera && (camera as THREE.PerspectiveCamera).fov !== def.fov) {
      const pc = camera as THREE.PerspectiveCamera;
      pc.fov = THREE.MathUtils.lerp(pc.fov, def.fov, def.ease);
      pc.updateProjectionMatrix();
    }
  });

  return null;
}
