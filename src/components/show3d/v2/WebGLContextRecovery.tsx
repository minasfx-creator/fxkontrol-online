/**
 * WebGLContextRecovery — Internal canvas component (must be rendered
 * INSIDE <Canvas>) that hooks into the WebGLRenderer's DOM element to
 * intercept `webglcontextlost`/`restored`. Calls `onChange(lost)` so the
 * parent can pause useFrame work and show an overlay without remounting.
 *
 * Why intercept here?  R3F's <Canvas> auto-handles re-init on restore,
 * but during the gap (~1-3s on most GPUs) any useFrame that touches
 * geometry will throw. We use the lost flag in upstream layers to
 * early-return and avoid throws entirely.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function WebGLContextRecovery({
  onChange,
}: {
  onChange: (lost: boolean) => void;
}) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (e: Event) => {
      e.preventDefault(); // tell browser we want it back
      // eslint-disable-next-line no-console
      console.warn('[SkyCanvas2] webglcontextlost — pausing render');
      onChange(true);
    };
    const handleRestored = () => {
      // eslint-disable-next-line no-console
      console.info('[SkyCanvas2] webglcontextrestored — resuming render');
      onChange(false);
    };
    canvas.addEventListener('webglcontextlost', handleLost, false);
    canvas.addEventListener('webglcontextrestored', handleRestored, false);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, onChange]);

  return null;
}

export default WebGLContextRecovery;
