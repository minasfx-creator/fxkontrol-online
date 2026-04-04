/**
 * ARDistanceMarkers — R3F <Html> labels showing camera-to-position distances
 * Only visible when arMode is active
 */
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useRef, useState } from 'react';
import * as THREE from 'three';

interface MarkerData {
  id: string;
  name: string;
  position: [number, number, number];
  distance: number;
  opacity: number;
}

export default function ARDistanceMarkers() {
  const arMode = useSceneStore(s => s.environment.arMode);
  const positions = useProjectStore(s => s.positions);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const tmpVec = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useFrame(() => {
    if (!arMode || positions.length === 0) {
      if (markers.length > 0) setMarkers([]);
      return;
    }

    const camPos = camera.position;
    const updated = positions.slice(0, 20).map(pos => {
      tmpVec.current.set(pos.x ?? 0, 0, pos.z ?? 0);
      const dist = camPos.distanceTo(tmpVec.current);
      const opacity = dist < 500 ? Math.min(1, (500 - dist) / 400) : 0;
      return {
        id: pos.id,
        name: pos.name,
        position: [pos.x ?? 0, 2, pos.z ?? 0] as [number, number, number],
        distance: Math.round(dist / 100),
        opacity,
      };
    }).filter(m => m.opacity > 0.05);

    setMarkers(updated);
  });

  if (!arMode) return null;

  return (
    <>
      {markers.map(m => (
        <group key={m.id} position={m.position}>
          <Html
            center
            distanceFactor={200}
            style={{ opacity: m.opacity, pointerEvents: 'none', transition: 'opacity 0.3s' }}
          >
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/70 backdrop-blur-sm border border-[hsl(var(--fxk-cyan)/0.3)]">
              <span className="text-[8px] font-mono font-bold" style={{ color: 'hsl(var(--fxk-cyan))' }}>
                ↕ {m.distance}m
              </span>
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}
