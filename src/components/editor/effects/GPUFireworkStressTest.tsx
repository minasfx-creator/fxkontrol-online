/**
 * GPUFireworkStressTest — Scene component + UI button for stress testing
 * the GPU-driven RealisticFirework particle system.
 * 
 * Launches 10 simultaneous GPU fireworks to validate 60 FPS performance.
 */

import { useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import RealisticFirework, { type StressTestFirework } from './RealisticFirework';

/**
 * R3F scene component: renders active stress-test fireworks
 */
export function StressTestFireworks() {
  const [fireworks, setFireworks] = useState<StressTestFirework[]>([]);

  // Listen for launch events from the UI button
  const handleLaunch = useCallback(() => {
    const clock = performance.now() / 1000;
    const colors = ['#ff3030', '#30ff30', '#3060ff', '#ffff30', '#ff30ff', '#30ffff', '#ff8020', '#ffffff', '#ff6090', '#80ff40'];
    const calibers = [75, 100, 125, 150, 100, 75, 200, 125, 100, 150];
    const patterns = ['peony', 'chrysanthemum', 'willow', 'palm', 'dahlia', 'peony', 'kamuro', 'chrysanthemum', 'ring', 'peony'];
    
    const newFw: StressTestFirework[] = [];
    for (let i = 0; i < 10; i++) {
      newFw.push({
        id: `stress-${Date.now()}-${i}`,
        position: [
          (Math.random() - 0.5) * 300,
          100 + Math.random() * 200,
          (Math.random() - 0.5) * 300,
        ],
        color: colors[i],
        caliber: calibers[i],
        startTime: clock + i * 0.12,
      });
    }
    setFireworks(prev => [...prev, ...newFw]);
  }, []);

  // Register the handler globally so the HTML button can call it
  if (typeof window !== 'undefined') {
    (window as any).__stressTestLaunch = handleLaunch;
  }

  const handleComplete = useCallback((id: string) => {
    setFireworks(prev => prev.filter(f => f.id !== id));
  }, []);

  return (
    <>
      {fireworks.map(fw => (
        <RealisticFirework
          key={fw.id}
          position={fw.position}
          color={fw.color}
          caliber={fw.caliber}
          startTime={fw.startTime}
          onComplete={() => handleComplete(fw.id)}
        />
      ))}
    </>
  );
}

/**
 * HTML overlay button — placed outside Canvas
 */
export function StressTestButton() {
  const [launching, setLaunching] = useState(false);

  const handleClick = () => {
    setLaunching(true);
    const fn = (window as any).__stressTestLaunch;
    if (fn) fn();
    setTimeout(() => setLaunching(false), 600);
  };

  return (
    <button
      onClick={handleClick}
      disabled={launching}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all border backdrop-blur-md bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30 hover:shadow-lg hover:shadow-destructive/10 disabled:opacity-50"
      title="Disparar 10 explosões GPU simultâneas para stress test de FPS"
    >
      <span className="text-sm">🎆</span>
      <span>Stress Test (10x GPU)</span>
    </button>
  );
}
