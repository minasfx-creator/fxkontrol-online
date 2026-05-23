import { describe, expect, it } from 'vitest';
import { CameraController, type CameraSink, type CameraTarget } from '@/lib/showEngine/CameraController';

function makeSink() {
  const log: CameraTarget[] = [];
  const sink: CameraSink = {
    apply: (t) => log.push(t),
    setAspect: () => {},
  };
  return { sink, log };
}

describe('CameraController', () => {
  it('frameSite produces a finite target enclosing the site', () => {
    const { sink, log } = makeSink();
    const cc = new CameraController(sink);
    cc.frameSite({ width: 200, depth: 100, maxHeight: 60, center: { x: 0, y: 0, z: 0 } });
    const last = log[log.length - 1];
    expect(Number.isFinite(last.position.x)).toBe(true);
    expect(Number.isFinite(last.position.y)).toBe(true);
    expect(Number.isFinite(last.position.z)).toBe(true);
    // Far enough to see the site
    const dist = Math.hypot(last.position.x, last.position.y, last.position.z);
    expect(dist).toBeGreaterThan(100);
  });

  it('resetView returns to a stable canonical pose', () => {
    const { sink, log } = makeSink();
    const cc = new CameraController(sink);
    cc.resetView();
    cc.resetView();
    expect(log[0]).toEqual(log[1]);
  });
});
