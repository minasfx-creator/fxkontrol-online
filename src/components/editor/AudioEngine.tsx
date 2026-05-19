/**
 * AudioEngine — headless owner of the project's <audio> element.
 *
 * Mounted ONCE at the editor page root (outside any conditional layout
 * branch) so audio playback survives:
 *   - Timeline collapse  (Index.tsx hides Timeline when timelineCollapsed)
 *   - Viewport maximize  (Index.tsx zeroes timeline height)
 *   - Mobile panel swaps
 *
 * Subscribes transiently to useProjectStore (no re-renders) and to
 * audioControl (volume + mute). Cleanup only runs on real page unmount.
 */
import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { subscribeAudioControl, getAudioControl } from '@/lib/audioControl';

const SEEK_TOLERANCE_S = 0.15;

export default function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const ensureAudio = (url: string | null) => {
      if (disposed) return;
      if (!url) {
        // No audio source — tear down any existing element.
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        }
        currentUrlRef.current = null;
        return;
      }
      if (currentUrlRef.current === url && audioRef.current) return;

      // URL changed (or first mount) — rebuild element.
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      const a = new Audio(url);
      a.preload = 'auto';
      const ctrl = getAudioControl();
      a.volume = ctrl.muted ? 0 : ctrl.volume;
      const st = useProjectStore.getState();
      a.playbackRate = st.playbackSpeed || 1;
      a.currentTime = st.currentTime || 0;
      audioRef.current = a;
      currentUrlRef.current = url;

      if (st.isPlaying) {
        a.play().catch(() => { /* user gesture not yet, ignored */ });
      }
    };

    // Initial sync
    ensureAudio(useProjectStore.getState().audioUrl);

    // ── Subscribe to store (transient, zero re-render) ──
    let lastUrl = useProjectStore.getState().audioUrl;
    let lastPlaying = useProjectStore.getState().isPlaying;
    let lastTime = useProjectStore.getState().currentTime;
    let lastRate = useProjectStore.getState().playbackSpeed;

    const unsubStore = useProjectStore.subscribe((state) => {
      // URL change
      if (state.audioUrl !== lastUrl) {
        lastUrl = state.audioUrl;
        ensureAudio(lastUrl);
      }
      const audio = audioRef.current;
      if (!audio) {
        lastPlaying = state.isPlaying;
        lastTime = state.currentTime;
        lastRate = state.playbackSpeed;
        return;
      }
      // Playback rate
      if (state.playbackSpeed !== lastRate) {
        lastRate = state.playbackSpeed;
        audio.playbackRate = lastRate || 1;
      }
      // Play / Pause
      if (state.isPlaying !== lastPlaying) {
        lastPlaying = state.isPlaying;
        if (state.isPlaying) {
          if (Math.abs(audio.currentTime - state.currentTime) > SEEK_TOLERANCE_S) {
            audio.currentTime = state.currentTime;
          }
          audio.play().catch(() => { /* autoplay blocked */ });
        } else {
          audio.pause();
        }
      }
      // Seek (only when paused — playing keeps natural drift)
      if (state.currentTime !== lastTime) {
        lastTime = state.currentTime;
        if (!state.isPlaying && Math.abs(audio.currentTime - state.currentTime) > SEEK_TOLERANCE_S) {
          audio.currentTime = state.currentTime;
        }
      }
    });

    // ── Subscribe to volume / mute ──
    const unsubCtrl = subscribeAudioControl((ctrl) => {
      const a = audioRef.current;
      if (a) a.volume = ctrl.muted ? 0 : ctrl.volume;
    });

    return () => {
      disposed = true;
      unsubStore();
      unsubCtrl();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      currentUrlRef.current = null;
    };
  }, []);

  return null;
}
