/**
 * FX KONTROL · Cinematic Renderer
 * Camera animation system for show previews and client presentations.
 */

export function initCinematicRenderer(scene, camera) {
  const cameraKeyframes = [];
  let isPlaying = false;
  let currentTime = 0;

  function addKeyframe(time, position, lookAt, fov = 60) {
    cameraKeyframes.push({ time, position: [...position], lookAt: [...lookAt], fov });
    cameraKeyframes.sort((a, b) => a.time - b.time);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function evaluate(time) {
    if (cameraKeyframes.length < 2) return null;
    let i = 0;
    while (i < cameraKeyframes.length - 1 && cameraKeyframes[i + 1].time < time) i++;
    const a = cameraKeyframes[i];
    const b = cameraKeyframes[Math.min(i + 1, cameraKeyframes.length - 1)];
    const t = (time - a.time) / Math.max(b.time - a.time, 0.001);
    return {
      position: a.position.map((v, j) => lerp(v, b.position[j], t)),
      lookAt: a.lookAt.map((v, j) => lerp(v, b.lookAt[j], t)),
      fov: lerp(a.fov, b.fov, t),
    };
  }

  console.log("[Cinematic] Camera system initialized");
  return { addKeyframe, evaluate, cameraKeyframes };
}
