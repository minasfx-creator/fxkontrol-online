/**
 * Training v2.1 — AmbientNPCLayer.
 *
 * Renders ambient NPCs that walk loops in the background while the
 * scripted mission runs. Pure visual; never affects the runner.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import HumanoidCharacter from '../humanoid/HumanoidCharacter';
import { getNPC } from '../npcs/npcCatalog';
import type { AmbientPreset } from '../missions/types';
import { pickAmbientHints, sampleHintPosition, type AmbientHint } from './ambientChoreographer';

interface Props {
  preset: AmbientPreset;
  /** Cap on simultaneous ambient NPCs. */
  maxNpcs?: number;
  /** Exclude these NPC ids (used for scripted NPCs, avoid duplicates). */
  exclude?: string[];
}

export default function AmbientNPCLayer({ preset, maxNpcs = 4, exclude = [] }: Props) {
  const hints = useMemo(
    () =>
      pickAmbientHints({ preset, seed: 13 })
        .filter((h) => !exclude.includes(h.npcId) && h.npcId !== 'eletricista-radio')
        .slice(0, maxNpcs),
    [preset, maxNpcs, exclude],
  );

  return (
    <>
      {hints.map((h) => (
        <AmbientWalker key={h.id} hint={h} />
      ))}
    </>
  );
}

function AmbientWalker({ hint }: { hint: AmbientHint }) {
  const persona = getNPC(hint.npcId);
  const groupRef = useRef<THREE.Group>(null);
  const pos = useRef<[number, number, number]>(hint.waypoints[0] ?? [0, 0.3, 0]);
  const yawRef = useRef(0);

  useFrame(({ clock }) => {
    const tMs = clock.elapsedTime * 1000;
    const next = sampleHintPosition(hint, tMs);
    if (groupRef.current) {
      // facing direction
      const dx = next[0] - pos.current[0];
      const dz = next[2] - pos.current[2];
      if (dx * dx + dz * dz > 1e-5) {
        yawRef.current = Math.atan2(dx, dz);
      }
      groupRef.current.position.set(next[0], next[1], next[2]);
      groupRef.current.rotation.y = yawRef.current;
    }
    pos.current = next;
  });

  if (!persona) return null;
  return (
    <group ref={groupRef}>
      <HumanoidCharacter persona={persona} position={[0, 0, 0]} rotationY={0} />
    </group>
  );
}
