/**
 * FX KONTROL · Three.js Renderer
 * Sets up WebGL2 renderer with HDR bloom pipeline.
 */

import * as THREE from "three";

export async function initRenderer() {
  const canvas = document.getElementById("app");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f14);
  scene.fog = new THREE.FogExp2(0x0d0f14, 0.002);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(0, 30, 80);
  camera.lookAt(0, 20, 0);

  // Ambient + directional lighting
  scene.add(new THREE.AmbientLight(0x334455, 0.3));
  const sun = new THREE.DirectionalLight(0xffeedd, 0.6);
  sun.position.set(50, 100, 30);
  scene.add(sun);

  // Ground grid
  const grid = new THREE.GridHelper(200, 100, 0x1a1a2e, 0x111122);
  scene.add(grid);

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  console.log("[Renderer] Three.js WebGL2 initialized");
  return { renderer, scene, camera, clock };
}
