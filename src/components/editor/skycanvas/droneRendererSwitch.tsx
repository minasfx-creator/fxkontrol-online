/**
 * DroneRendererSwitch — picks PBR vs Tactical drone engine, bridging
 * project-store droneFormations into the SwarmPlaybackEngine agent shape.
 *
 * Extracted from SkyCanvas.tsx; behavior is byte-identical.
 */
import React from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { SwarmPlaybackEngine } from '../SwarmPlaybackEngine';
import DroneChoreography from '../DroneChoreography';

export default function DroneRendererSwitch() {
  const mode = useSceneStore(s => s.environment.droneRendererMode);
  const droneFormations = useProjectStore(s => s.droneFormations);
  const currentTime = useProjectStore(s => s.currentTime);

  const agents = React.useMemo(() => {
    if (!droneFormations.length) return [];
    const count = droneFormations[0].droneCount;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      path: droneFormations.flatMap(f => {
        const p = f.points[i];
        if (!p) return [];
        return [{ x: p.x, y: f.height - p.z, z: 0, time: f.startTime + f.transitionDuration }];
      }),
      colors: droneFormations.map(f => {
        const hex = f.color || '#ffffff';
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return { r, g, b, time: f.startTime, duration: f.transitionDuration + f.holdDuration };
      }),
      duration: droneFormations[droneFormations.length - 1].startTime + droneFormations[droneFormations.length - 1].transitionDuration + droneFormations[droneFormations.length - 1].holdDuration,
    }));
  }, [droneFormations]);

  if (mode === 'swarm') {
    if (!agents.length) return null;
    return <SwarmPlaybackEngine agents={agents} manualTime={currentTime} isPlaying={false} />;
  }
  return <DroneChoreography />;
}
