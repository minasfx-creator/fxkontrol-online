/**
 * <PlaybackProfilerProvider> — wraps children in a React.Profiler
 * boundary that streams render samples to PlaybackProfiler. Also
 * installs the timeline auto-arm so Play / Scrub start capture
 * automatically. Safe to mount once near the app root.
 */
import { Profiler, type ReactNode, useEffect } from 'react';
import {
  recordRender,
  installPlaybackAutoArm,
  exposePlaybackProfilerOnWindow,
} from './PlaybackProfiler';

interface Props {
  id?: string;
  children: ReactNode;
}

export function PlaybackProfilerProvider({ id = 'app', children }: Props) {
  useEffect(() => {
    installPlaybackAutoArm();
    exposePlaybackProfilerOnWindow();
  }, []);

  return (
    <Profiler id={id} onRender={recordRender}>
      {children}
    </Profiler>
  );
}

/**
 * Hook for components that want to declare which store they consume,
 * improving the per-store report attribution beyond name heuristics.
 */
import { tagComponentStore, untagComponentStore, type StoreBucket } from './PlaybackProfiler';

export function useProfiledStoreTag(componentId: string, store: StoreBucket): void {
  useEffect(() => {
    tagComponentStore(componentId, store);
    return () => untagComponentStore(componentId);
  }, [componentId, store]);
}
