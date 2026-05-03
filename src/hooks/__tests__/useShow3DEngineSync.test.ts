/**
 * useShow3DEngineSync — verifies the bridge between useProjectStore (audio /
 * timelineClock master) and Show3DEngine. The engine must:
 *  - mirror `isPlaying` without auto-advancing internally
 *  - re-fire cues on small forward deltas (playback mode)
 *  - re-spawn cues on backward jumps (scrub mode)
 *  - forward `playbackSpeed` to setRate
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { Show3DEngine } from '@/lib/showEngine/Show3DEngine';
import { useProjectStore } from '@/store/useProjectStore';
import { useShow3DEngineSync } from '../useShow3DEngineSync';

function makeEngineMock() {
  return {
    setRate: vi.fn(),
    setPlayingMirror: vi.fn(),
    seek: vi.fn(),
  } as unknown as Show3DEngine;
}

describe('useShow3DEngineSync', () => {
  beforeEach(() => {
    useProjectStore.setState({
      isPlaying: false,
      currentTime: 0,
      playbackSpeed: 1,
    } as any);
  });

  it('seeds the engine with the current store state on mount', async () => {
    const engine = makeEngineMock();
    const ref = createRef<Show3DEngine>();
    (ref as any).current = engine;
    useProjectStore.setState({ currentTime: 5, playbackSpeed: 1.5 } as any);

    renderHook(() => useShow3DEngineSync(ref, true));
    await new Promise((r) => requestAnimationFrame(r));

    expect(engine.setRate).toHaveBeenCalledWith(1.5);
    expect(engine.seek).toHaveBeenCalledWith(5, { mode: 'scrub' });
    expect(engine.setPlayingMirror).toHaveBeenCalledWith(false);
  });

  it('forwards small forward deltas as playback seeks (cues fire)', async () => {
    const engine = makeEngineMock();
    const ref = createRef<Show3DEngine>();
    (ref as any).current = engine;
    renderHook(() => useShow3DEngineSync(ref, true));
    await new Promise((r) => requestAnimationFrame(r));
    (engine.seek as any).mockClear();

    act(() => {
      useProjectStore.setState({ currentTime: 0.1 } as any);
    });
    expect(engine.seek).toHaveBeenLastCalledWith(0.1, { mode: 'playback' });

    act(() => {
      useProjectStore.setState({ currentTime: 0.25 } as any);
    });
    expect(engine.seek).toHaveBeenLastCalledWith(0.25, { mode: 'playback' });
  });

  it('treats backward jumps and large forward jumps as scrubs', async () => {
    const engine = makeEngineMock();
    const ref = createRef<Show3DEngine>();
    (ref as any).current = engine;
    useProjectStore.setState({ currentTime: 10 } as any);
    renderHook(() => useShow3DEngineSync(ref, true));
    await new Promise((r) => requestAnimationFrame(r));
    (engine.seek as any).mockClear();

    act(() => {
      useProjectStore.setState({ currentTime: 3 } as any); // backward
    });
    expect(engine.seek).toHaveBeenLastCalledWith(3, { mode: 'scrub' });

    act(() => {
      useProjectStore.setState({ currentTime: 30 } as any); // big forward
    });
    expect(engine.seek).toHaveBeenLastCalledWith(30, { mode: 'scrub' });
  });

  it('mirrors isPlaying without calling play() on the engine', async () => {
    const engine = makeEngineMock();
    const ref = createRef<Show3DEngine>();
    (ref as any).current = engine;
    renderHook(() => useShow3DEngineSync(ref, true));
    await new Promise((r) => requestAnimationFrame(r));
    (engine.setPlayingMirror as any).mockClear();

    act(() => useProjectStore.setState({ isPlaying: true } as any));
    expect(engine.setPlayingMirror).toHaveBeenCalledWith(true);

    act(() => useProjectStore.setState({ isPlaying: false } as any));
    expect(engine.setPlayingMirror).toHaveBeenCalledWith(false);
  });

  it('is a no-op when disabled', async () => {
    const engine = makeEngineMock();
    const ref = createRef<Show3DEngine>();
    (ref as any).current = engine;
    renderHook(() => useShow3DEngineSync(ref, false));
    await new Promise((r) => requestAnimationFrame(r));

    act(() => useProjectStore.setState({ currentTime: 7, isPlaying: true } as any));
    expect(engine.seek).not.toHaveBeenCalled();
    expect(engine.setPlayingMirror).not.toHaveBeenCalled();
  });
});
