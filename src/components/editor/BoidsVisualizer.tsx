import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBoidsStore } from '@/store/useBoidsStore';
import { useProjectStore } from '@/store/useProjectStore';
import { stepBoids } from '@/lib/boidsEngine';
import InstancedDroneSwarm from './InstancedDroneSwarm';

/**
 * Renders Boids simulation agents in the 3D viewport.
 * Uses the shared BoidsStore to sync with the BoidsPanel UI.
 */
export default function BoidsVisualizer() {
  const { agents, running, config, seekTarget, setAgents } = useBoidsStore();
  const { droneFormations, currentTime } = useProjectStore();
  const lastTime = useRef(performance.now());

  useFrame(() => {
    if (!running || agents.length === 0) return;

    const now = performance.now();
    const dt = Math.min((now - lastTime.current) / 1000, 0.05);
    lastTime.current = now;

    // Find targets from active formation
    let targets: { x: number; y: number; z: number }[] | undefined;
    if (seekTarget && droneFormations.length > 0) {
      for (const f of droneFormations) {
        const holdEnd = f.startTime + f.transitionDuration + f.holdDuration;
        if (currentTime >= f.startTime && currentTime <= holdEnd) {
          targets = f.points.slice(0, f.droneCount).map(p => ({
            x: p.x, y: f.height, z: p.z,
          }));
          break;
        }
      }
    }

    setAgents(stepBoids(agents, dt, config, targets));
  });

  if (agents.length === 0) return null;

  const positions = agents.map(a => ({
    x: a.x, y: a.y, z: a.z,
    color: '#00FFAA',
  }));

  return <InstancedDroneSwarm positions={positions} scale={0.5} />;
}
