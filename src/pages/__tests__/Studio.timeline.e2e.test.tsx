/**
 * ─── Studio Route · Timeline E2E Suite ──────────────────────────────
 *
 * End-to-end coverage for the operational surfaces wired to the
 * `/studio` route (Index.tsx) — without mounting WebGL/R3F.
 *
 * Why no full route render?
 *   The Studio mounts SkyCanvas + Google 3D Tiles + GPGPU pipelines
 *   that depend on a real WebGL/WebGPU context. jsdom can't provide
 *   that, and stubbing the entire stack would test the stubs instead
 *   of the system. Instead, we drive the **same controllers and
 *   stores the Studio binds to**:
 *
 *     - useTimelineClock / useEditorUI (the hooks Studio components consume)
 *     - timelineTransport (the single entry point for play/pause/seek)
 *     - useProjectStore (the mirror Studio reads for time/playing)
 *     - TimelineScrubber (real component, drives ROLLBACK via CommandBus)
 *
 * Together this exercises the full UI → transport → clock → store
 * round-trip that the Studio route depends on.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { useTimelineClock } from '@/hooks/useTimelineClock';
import { usePlaybackState, useEditorMode } from '@/hooks/useEditorUI';
import { timelineTransport } from '@/core/transport/timelineTransport';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { useProjectStore } from '@/store/useProjectStore';
import { commandBus } from '@/core/command/CommandBus';
import TimelineScrubber from '@/components/editor/TimelineScrubber';

function resetTimeline(duration = 60) {
  timelineClock.reset();
  timelineClock.setDuration(duration);
  timelineClock.setSpeed(1);
  timelineClock.setLoop(false);
  timelineClock.pause();
  timelineClock.seek(0);
}

describe('Studio · timeline transport (E2E, no GPU)', () => {
  beforeEach(() => {
    resetTimeline(60);
  });

  it('hook → transport → store: play() advances both clock and store mirror', () => {
    const { result } = renderHook(() => useTimelineClock());

    expect(result.current.playing).toBe(false);

    act(() => result.current.play());
    act(() => timelineClock.tick(0.5));

    expect(result.current.playing).toBe(true);
    expect(result.current.time).toBeGreaterThan(0);
    // Store mirror must agree — Studio components read this.
    const store = useProjectStore.getState();
    expect(store.isPlaying).toBe(true);
    expect(store.currentTime).toBeGreaterThan(0);
  });

  it('pause() halts time progression and mirrors to store', () => {
    const { result } = renderHook(() => useTimelineClock());

    act(() => result.current.play());
    act(() => timelineClock.tick(0.25));
    const tAtPause = result.current.time;
    act(() => result.current.pause());
    act(() => timelineClock.tick(1.0));

    expect(result.current.playing).toBe(false);
    expect(result.current.time).toBe(tAtPause);
    expect(useProjectStore.getState().isPlaying).toBe(false);
  });

  it('seek() jumps to an absolute time on both clock and store', () => {
    const { result } = renderHook(() => useTimelineClock());

    act(() => result.current.seek(12.5));

    expect(result.current.time).toBe(12.5);
    expect(useProjectStore.getState().currentTime).toBe(12.5);
  });

  it('toggle() flips playing state deterministically', () => {
    const { result } = renderHook(() => useTimelineClock());

    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
  });

  it('stop() pauses and rewinds to 0 (Studio "Stop" button contract)', () => {
    const { result } = renderHook(() => useTimelineClock());

    act(() => result.current.seek(30));
    act(() => result.current.play());
    act(() => result.current.stop());

    expect(result.current.playing).toBe(false);
    expect(result.current.time).toBe(0);
    const s = useProjectStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.currentTime).toBe(0);
  });

  it('play() at end-of-duration auto-rewinds (no frozen-at-end UX)', () => {
    const { result } = renderHook(() => useTimelineClock());

    act(() => result.current.seek(60));
    act(() => result.current.play());

    expect(result.current.playing).toBe(true);
    expect(result.current.time).toBe(0);
  });

  it('play() with persisted speed=0 auto-restores a playable speed', () => {
    const { result } = renderHook(() => useTimelineClock());

    act(() => result.current.setSpeed(2));
    act(() => result.current.setSpeed(0)); // simulate corrupted persistence
    act(() => result.current.play());
    act(() => timelineClock.tick(0.2));

    expect(result.current.playing).toBe(true);
    expect(result.current.speed).toBeGreaterThan(0);
    expect(result.current.time).toBeGreaterThan(0);
  });

  it('setSpeed() scales tick advancement and mirrors to store', () => {
    const { result } = renderHook(() => useTimelineClock());

    act(() => result.current.setSpeed(2));
    act(() => result.current.play());
    act(() => timelineClock.tick(0.5));

    // 2× speed for 0.5s ≈ 1.0s of timeline time.
    expect(result.current.time).toBeGreaterThanOrEqual(0.9);
    expect(useProjectStore.getState().playbackSpeed).toBe(2);
  });

  it('useEditorUI facade exposes the same playback state as useTimelineClock', () => {
    const { result: clockHook } = renderHook(() => useTimelineClock());
    const { result: facade } = renderHook(() => usePlaybackState());

    act(() => clockHook.current.seek(7));
    act(() => clockHook.current.play());
    act(() => timelineClock.tick(0.1));

    expect(facade.current.currentTime).toBe(clockHook.current.time);
    expect(facade.current.isPlaying).toBe(true);
    expect(facade.current.duration).toBe(60);
  });

  it('useEditorMode reflects changes through the project store', () => {
    const { result } = renderHook(() => useEditorMode());

    expect(result.current.editorMode).toBeDefined();
    act(() => result.current.setEditorMode('add-pyro'));
    expect(result.current.editorMode).toBe('add-pyro');
    expect(result.current.isPlacingMode).toBe(true);

    act(() => result.current.setEditorMode('select'));
    expect(result.current.isPlacingMode).toBe(false);
  });
});

describe('Studio · TimelineScrubber (real component, no GPU)', () => {
  beforeEach(() => {
    resetTimeline(60);
  });

  it('renders tick markers and the current playhead label', () => {
    render(<TimelineScrubber snapshots={[]} />);
    expect(screen.getByText('Tick 0')).toBeInTheDocument();
    expect(screen.getByText(/Tick \d+/)).toBeInTheDocument();
  });

  it('renders one DOM marker per snapshot', () => {
    const snapshots = [
      { tick: 1, state: {}, hash: 'a' } as any,
      { tick: 2, state: {}, hash: 'b' } as any,
      { tick: 3, state: {}, hash: 'c' } as any,
    ];
    const { container } = render(<TimelineScrubber snapshots={snapshots} />);
    const markers = container.querySelectorAll('[title^="Snapshot @ tick"]');
    expect(markers.length).toBe(3);
  });

  it('does not dispatch ROLLBACK when no drag occurs (idle render)', () => {
    const spy = vi.spyOn(commandBus, 'dispatch');
    render(<TimelineScrubber snapshots={[]} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('Studio · transport ↔ store cross-component sync', () => {
  beforeEach(() => resetTimeline(60));

  it('two independent consumers stay in sync after a transport action', () => {
    const a = renderHook(() => useTimelineClock());
    const b = renderHook(() => usePlaybackState());

    act(() => timelineTransport.play());
    act(() => timelineClock.tick(0.3));

    expect(a.result.current.time).toBe(b.result.current.currentTime);
    expect(a.result.current.playing).toBe(b.result.current.isPlaying);
  });

  it('store-side seek is observed by hook subscribers', () => {
    const { result } = renderHook(() => useTimelineClock());

    act(() => useProjectStore.getState().setCurrentTime(15));

    // setCurrentTime routes through timelineClock; hook must reflect it.
    expect(result.current.time).toBe(15);
  });
});
