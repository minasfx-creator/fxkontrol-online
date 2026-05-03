/**
 * /dev/skycanvas-3d — Public dev route to mount the new R3F SkyCanvas3D
 * in isolation (no auth, no hardware, no ARM, no FIRE).
 *
 * Use to QA: night sky, ground plane, OrbitControls 360°, Light Points
 * (drones) and Particle Explosions (pyro) bound to useProjectStore.
 */
import { useEffect } from 'react';
import SkyCanvas3D from '@/components/show3d/SkyCanvas3D';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

export default function SkyCanvas3DDemo() {
  // Seed a tiny demo plan so the layers have something to show.
  useEffect(() => {
    const s = useProjectStore.getState();
    if (s.positions.length > 0) return;

    const pyroEffect = EFFECT_LIBRARY.find((e) => e.type === 'firework') ?? EFFECT_LIBRARY[0];
    const droneEffect = EFFECT_LIBRARY.find((e) => e.type === 'drone' || e.type === 'light');

    const positions = [
      { id: 'pyro-L', name: 'Pyro L', type: 'pyro' as const, x: -20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ff7700' },
      { id: 'pyro-R', name: 'Pyro R', type: 'pyro' as const, x: 20, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ff7700' },
      { id: 'drone-A', name: 'Drone A', type: 'drone-pad' as const, x: -10, y: 12, z: -10, heading: 0, pitch: 0, roll: 0, color: '#2dd4ff' },
      { id: 'drone-B', name: 'Drone B', type: 'drone-pad' as const, x: 10, y: 12, z: -10, heading: 0, pitch: 0, roll: 0, color: '#22ee88' },
    ];

    const items = [
      { id: 'cue1', effectId: pyroEffect.id, startTime: 1, trackIndex: 0, position: { x: -20, y: 0, z: 0 }, positionId: 'pyro-L' },
      { id: 'cue2', effectId: pyroEffect.id, startTime: 2.5, trackIndex: 0, position: { x: 20, y: 0, z: 0 }, positionId: 'pyro-R' },
      ...(droneEffect
        ? [
            { id: 'cue3', effectId: droneEffect.id, startTime: 0, trackIndex: 1, position: { x: -10, y: 12, z: -10 }, positionId: 'drone-A' },
            { id: 'cue4', effectId: droneEffect.id, startTime: 0, trackIndex: 1, position: { x: 10, y: 12, z: -10 }, positionId: 'drone-B' },
          ]
        : []),
    ];

    useProjectStore.setState({
      positions,
      timelineItems: items,
      duration: 30,
      isPlaying: true,
    });

    // Drive currentTime locally for the demo.
    const start = performance.now();
    const id = window.setInterval(() => {
      const t = ((performance.now() - start) / 1000) % 12;
      useProjectStore.setState({ currentTime: t });
    }, 33);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050810] text-cyan-200 font-mono">
      <div className="absolute top-2 left-2 z-50 px-2 py-1 rounded border border-cyan-500/30 bg-black/60 text-[11px]">
        SKYCANVAS · 3D · R3F · drag=orbit · wheel=zoom · right=pan
      </div>
      <SkyCanvas3D />
    </div>
  );
}
