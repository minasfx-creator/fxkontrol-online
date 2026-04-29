/**
 * Guardian tests — Show3DEngine.applyCue + clearLayer disposal.
 *
 * Covers H2 (applyCue stub) and M5 (texture leak on layer clear). Runs
 * headless against three.js without spinning up a real WebGL context — we
 * only exercise scene-graph mutation and disposal bookkeeping.
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Show3DEngine } from '@/lib/showEngine/Show3DEngine';

type CueCommand = { kind: 'spawn-pyro'; positionId: string; intensity?: 'high' };

function buildCue(positionId: string, kind: CueCommand['kind'] = 'spawn-pyro') {
  return {
    id: 'cue-1',
    startTime: 0,
    endTime: 1,
    commands: [{ kind, positionId } as CueCommand],
  };
}

describe('Show3DEngine.applyCue', () => {
  it('spawns a flash mesh into the effects layer and reaps it after TTL', () => {
    const engine = new Show3DEngine();

    // Seed a position marker so applyCue can anchor the flash.
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.5));
    marker.userData.positionId = 'p1';
    marker.position.set(10, 5, -3);
    engine.staticLayer.add(marker);

    expect(engine.effectsLayer.children.length).toBe(0);

    // Access the private method via an indirect call (test-only).
    (engine as unknown as { applyCue: (c: unknown) => void }).applyCue(buildCue('p1'));

    expect(engine.effectsLayer.children.length).toBe(1);
    const flash = engine.effectsLayer.children[0] as THREE.Mesh;
    expect(flash.userData.cueFlash).toBeDefined();
    expect(flash.position.x).toBeCloseTo(10);

    // Force-expire the flash and tick.
    flash.userData.cueFlash.spawnedAt = performance.now() - 10_000;
    (engine as unknown as { tickEffects: (n: number) => void }).tickEffects(performance.now());

    expect(engine.effectsLayer.children.length).toBe(0);
  });

  it('disposeMaterial disposes attached textures (M5 leak fix)', () => {
    const engine = new Show3DEngine();

    const tex = new THREE.Texture();
    const disposeSpy = vi.spyOn(tex, 'dispose');
    const mat = new THREE.MeshStandardMaterial({ map: tex });
    const matDispose = vi.spyOn(mat, 'dispose');
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    engine.staticLayer.add(mesh);

    // clearLayer should walk every material slot and dispose textures.
    (engine as unknown as { clearLayer: (g: THREE.Group) => void }).clearLayer(engine.staticLayer);

    expect(disposeSpy).toHaveBeenCalled();
    expect(matDispose).toHaveBeenCalled();
    expect(engine.staticLayer.children.length).toBe(0);
  });
});
