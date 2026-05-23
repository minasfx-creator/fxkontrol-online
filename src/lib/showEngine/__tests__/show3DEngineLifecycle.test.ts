/**
 * Guardian — Show3DEngine listener cleanup (Fase 1, item C3).
 * Verifica que dispose() remove os listeners webglcontextlost/restored
 * que init() registrou — evita leak em hot-reload e re-mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Show3DEngine } from '../Show3DEngine';

// jsdom não tem WebGL real → init() vai cair no catch e setar viewport='error',
// mas o que queremos validar é o ciclo attach/detach de listeners no canvas.
// Por isso testamos os métodos privados via instância isolada com canvas mock.

class FakeCanvas {
  listeners: Record<string, Set<EventListener>> = {};
  addEventListener(type: string, fn: EventListener) {
    (this.listeners[type] ||= new Set()).add(fn);
  }
  removeEventListener(type: string, fn: EventListener) {
    this.listeners[type]?.delete(fn);
  }
  count(type: string) { return this.listeners[type]?.size ?? 0; }
}

describe('Show3DEngine — listener lifecycle', () => {
  let engine: Show3DEngine;
  let canvas: FakeCanvas;

  beforeEach(() => {
    engine = new Show3DEngine();
    canvas = new FakeCanvas();
    // call private via cast — it's a controlled internal contract
    (engine as any).attachContextHandlers(canvas);
  });

  it('attaches both webgl context listeners', () => {
    expect(canvas.count('webglcontextlost')).toBe(1);
    expect(canvas.count('webglcontextrestored')).toBe(1);
  });

  it('detachContextHandlers removes both listeners', () => {
    (engine as any).detachContextHandlers();
    expect(canvas.count('webglcontextlost')).toBe(0);
    expect(canvas.count('webglcontextrestored')).toBe(0);
  });

  it('re-attaching does not duplicate listeners (detaches previous canvas)', () => {
    const second = new FakeCanvas();
    (engine as any).attachContextHandlers(second);
    expect(canvas.count('webglcontextlost')).toBe(0);
    expect(second.count('webglcontextlost')).toBe(1);
  });

  it('dispose() invokes detach (no listener leak)', () => {
    const spy = vi.spyOn(canvas, 'removeEventListener');
    engine.dispose();
    expect(spy).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
    expect(spy).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function));
  });
});

describe('Show3DEngine — cooldown-style cleanup is idempotent', () => {
  it('detach without prior attach is a noop (no throws)', () => {
    const engine = new Show3DEngine();
    expect(() => (engine as any).detachContextHandlers()).not.toThrow();
    expect(() => engine.dispose()).not.toThrow();
  });
});
