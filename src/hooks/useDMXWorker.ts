/**
 * useDMXWorker — Bridge between React UI and DMX Timing Web Worker.
 * Provides high-precision, thread-isolated timing for Art-Net/sACN dispatch.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';

interface WorkerTick {
  currentTime: number;
  fps: number;
  memoryPressure: boolean;
}

interface CueFire {
  id: string;
  effectId: string;
  actualTime: number;
  scheduledTime: number;
  drift: number; // ms
}

export function useDMXWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerFPS, setWorkerFPS] = useState(0);
  const [lastDrift, setLastDrift] = useState(0);
  const onCueFireRef = useRef<((fire: CueFire) => void) | null>(null);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/dmxTimingWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      switch (type) {
        case 'READY':
          setWorkerReady(true);
          break;
        case 'TICK':
          setWorkerFPS(Math.round((payload as WorkerTick).fps));
          break;
        case 'CUE_FIRE':
          setLastDrift((payload as CueFire).drift);
          onCueFireRef.current?.(payload as CueFire);
          break;
      }
    };

    workerRef.current = worker;
    return () => { worker.terminate(); workerRef.current = null; };
  }, []);

  const start = useCallback((fromTime = 0) => {
    workerRef.current?.postMessage({ type: 'START', payload: { fromTime } });
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ type: 'STOP' });
  }, []);

  const seek = useCallback((time: number) => {
    workerRef.current?.postMessage({ type: 'SEEK', payload: { time } });
  }, []);

  const updateCues = useCallback((cues: any[]) => {
    workerRef.current?.postMessage({
      type: 'UPDATE_CUES',
      payload: { cues: cues.map(c => ({
        id: c.id,
        startTime: c.startTime,
        effectId: c.effectId,
        trackIndex: c.trackIndex,
      }))},
    });
  }, []);

  const setBPM = useCallback((bpm: number) => {
    workerRef.current?.postMessage({ type: 'SET_BPM', payload: { bpm } });
  }, []);

  const setSpeed = useCallback((speed: number) => {
    workerRef.current?.postMessage({ type: 'SET_SPEED', payload: { speed } });
  }, []);

  const onCueFire = useCallback((cb: (fire: CueFire) => void) => {
    onCueFireRef.current = cb;
  }, []);

  return {
    workerReady,
    workerFPS,
    lastDrift,
    start, stop, seek,
    updateCues, setBPM, setSpeed,
    onCueFire,
  };
}
