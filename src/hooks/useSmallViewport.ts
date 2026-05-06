/**
 * useSmallViewport — true when viewport width < threshold (default 900px).
 * Pure UI hook; SSR-safe.
 */
import { useEffect, useState } from 'react';

export function useSmallViewport(threshold = 900): boolean {
  const get = () => (typeof window !== 'undefined' ? window.innerWidth < threshold : false);
  const [small, setSmall] = useState<boolean>(get);
  useEffect(() => {
    const onResize = () => setSmall(get());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return small;
}
