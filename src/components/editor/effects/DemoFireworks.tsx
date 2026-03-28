/**
 * DemoFireworks — Auto-launches a looping firework demo when the timeline is empty,
 * so the 3D viewport isn't bare on first open.
 * Stops automatically when the user adds real timeline items.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useProjectStore } from '@/store/useProjectStore';
import RealisticFirework, { type StressTestFirework } from './RealisticFirework';

const DEMO_COLORS = [
  '#ff4444', '#44ff44', '#4488ff', '#ffcc00',
  '#ff44ff', '#44ffff', '#ff8822', '#ffffff',
  '#ff6699', '#88ff44', '#aa44ff', '#ffaa00',
];
const DEMO_CALIBERS = [75, 100, 125, 75, 150, 100, 75, 125];
const LAUNCH_INTERVAL = 1.8; // seconds between volleys
const VOLLEY_SIZE = 3;       // shells per volley
const SPREAD = 200;          // horizontal spread (meters)
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 220;

export default function DemoFireworks() {
  const timelineItems = useProjectStore(s => s.timelineItems);
  const [fireworks, setFireworks] = useState<StressTestFirework[]>([]);
  const timerRef = useRef(0);
  const volleyRef = useRef(0);
  const activeRef = useRef(true);

  // Stop demo when real content exists
  const hasContent = timelineItems.length > 0;

  useEffect(() => {
    if (hasContent) {
      activeRef.current = false;
      setFireworks([]);
    } else {
      activeRef.current = true;
      timerRef.current = 0;
      volleyRef.current = 0;
    }
  }, [hasContent]);

  useFrame((_, delta) => {
    if (!activeRef.current || hasContent) return;

    timerRef.current += delta;
    if (timerRef.current >= LAUNCH_INTERVAL) {
      timerRef.current -= LAUNCH_INTERVAL;
      const clock = performance.now() / 1000;
      const volley = volleyRef.current++;
      const newFw: StressTestFirework[] = [];

      for (let i = 0; i < VOLLEY_SIZE; i++) {
        const idx = (volley * VOLLEY_SIZE + i);
        newFw.push({
          id: `demo-${volley}-${i}`,
          position: [
            (Math.random() - 0.5) * SPREAD,
            MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT),
            (Math.random() - 0.5) * SPREAD,
          ],
          color: DEMO_COLORS[idx % DEMO_COLORS.length],
          caliber: DEMO_CALIBERS[idx % DEMO_CALIBERS.length],
          startTime: clock + i * 0.15,
        });
      }

      setFireworks(prev => {
        // Keep pool manageable — max 30 active
        const trimmed = prev.length > 27 ? prev.slice(-18) : prev;
        return [...trimmed, ...newFw];
      });
    }
  });

  const handleComplete = useCallback((id: string) => {
    setFireworks(prev => prev.filter(f => f.id !== id));
  }, []);

  if (hasContent) return null;

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
