/**
 * useFullscreenState — Tracks document.fullscreenElement.
 * Returns boolean indicating whether the document (or a target) is fullscreen.
 */
import { useEffect, useState } from 'react';

export function useFullscreenState(target?: Element | null): boolean {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return target ? document.fullscreenElement === target : !!document.fullscreenElement;
  });

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(target ? document.fullscreenElement === target : !!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [target]);

  return isFullscreen;
}
