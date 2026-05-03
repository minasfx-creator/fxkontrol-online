/**
 * Guardian — Show3DEngine playback auto-advance.
 *
 * Locks in the contract that, while `playing`, calling `renderFrame(dt)`
 * crosses cue start times and fires them automatically (Particle
 * Explosion for pyro, Light Point for drone). No timer hooks beyond
 * the engine's own play loop are required.
 *
 * Headless: never calls `init()` so no WebGLRenderer is constructed.
 * We invoke `renderFrame` directly with a synthetic delta and bypass
 * the renderer guard via a stub.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Show3DEngine } from '@/lib/showEngine/Show3DEngine';
import type { ShowPlan } from '@/lib/aiShowBuilder/types';

function plan(): ShowPlan {
  return {
    id: 'test-playback',
    title: 'Playback Test',
    duration: 10,
    intent: '',
    style: 'cinematic',
    site: {
      name: 'site',
      width: 60,
      depth: 60,
      maxHeight: 80,
      safetyDistance: 20,
      audiencePosition: 'front',
      showType: 'pyro',
    },
    sections: [],
    positions: [
      { id: 'p-pyro', name: 'Pyro 1', type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#ffaa44' },
      { id: 'p-drone', name: 'Drone 1', type: 'drone', x: 5, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#66ccff' },
    ],
    timelineItems: [
      { id: 'cue-pyro', type: 'pyro_effect', label: 'M1:C1', effectId: 'fx', startTime: 1, duration: 1.2, positionId: 'p-pyro' },
      { id: 'cue-drone', type: 'drone_move', label: 'D1', startTime: 3, duration: 1.0, positionId: 'p-drone' },
    ],
    trajectories: [],
    safetyWarnings: [],
    assumptions: [],
  } as unknown as ShowPlan;
}

function patchRenderer(engine: Show3DEngine): void {
  // Inject a fake renderer so renderFrame() does not bail out.
  (engine as unknown as { renderer: unknown }).renderer = {
    render: () => {},
    info: { render: { calls: 0, triangles: 0 } },
  };
}

describe('Show3DEngine playback auto-advance', () => {
  it('does not advance when paused', () => {
    const engine = new Show3DEngine();
    engine.loadPlan(plan());
    patchRenderer(engine);
    engine.renderFrame(2);
    expect(engine.getShowTime()).toBe(0);
    expect(engine.effectsLayer.children.length).toBe(0);
  });

  it('auto-fires pyro cue as showTime crosses startTime → Particle Explosion', () => {
    const engine = new Show3DEngine();
    engine.loadPlan(plan());
    patchRenderer(engine);
    engine.play();
    // Step past t=1 (pyro cue at startTime=1).
    engine.renderFrame(1.5);
    expect(engine.getShowTime()).toBeCloseTo(1.5);
    expect(engine.effectsLayer.children.length).toBe(1);
    const flash = engine.effectsLayer.children[0] as THREE.Mesh;
    expect(flash.userData.cueFlash).toBeDefined();
    // Particle Explosion is attached as a Points child of the flash.
    const particles = flash.children.find((c) => (c as THREE.Points).isPoints) as THREE.Points | undefined;
    expect(particles).toBeDefined();
    expect(particles!.userData.particleBurst).toBeDefined();
    const geom = particles!.geometry as THREE.BufferGeometry;
    expect(geom.getAttribute('position').count).toBeGreaterThan(40);
  });

  it('auto-fires drone cue → Light Point', () => {
    const engine = new Show3DEngine();
    engine.loadPlan(plan());
    patchRenderer(engine);
    engine.play();
    engine.renderFrame(3.5); // crosses both pyro (1) and drone (3)
    expect(engine.effectsLayer.children.length).toBe(2);
    const droneFlash = engine.effectsLayer.children.find((c) => {
      const pts = c.children.find((cc) => (cc as THREE.Points).isPoints) as THREE.Points | undefined;
      return pts?.userData.lightPoint !== undefined;
    });
    expect(droneFlash).toBeDefined();
  });

  it('stops at duration when not looping and emits playing=false', () => {
    const engine = new Show3DEngine();
    engine.loadPlan(plan());
    patchRenderer(engine);
    let lastSnap = engine.subscribePlayback(() => {});
    lastSnap(); // unsubscribe immediately, we'll re-subscribe to capture
    let snap: { playing: boolean; time: number } | null = null;
    engine.subscribePlayback((s) => { snap = s; });
    engine.play();
    engine.renderFrame(20); // beyond duration=10
    expect(engine.isPlaying()).toBe(false);
    expect(engine.getShowTime()).toBeCloseTo(10);
    expect(snap?.playing).toBe(false);
  });

  it('seek(scrub) wipes effects and re-spawns the active cues', () => {
    const engine = new Show3DEngine();
    engine.loadPlan(plan());
    patchRenderer(engine);
    engine.seek(1.4); // playback mode → fires pyro cue
    expect(engine.effectsLayer.children.length).toBe(1);
    engine.seek(1.4, { mode: 'scrub' }); // re-spawn idempotent
    expect(engine.effectsLayer.children.length).toBe(1);
    engine.seek(0, { mode: 'scrub' });
    expect(engine.effectsLayer.children.length).toBe(0);
  });
});
