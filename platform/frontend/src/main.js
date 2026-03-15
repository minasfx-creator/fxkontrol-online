/**
 * FX KONTROL · Web Studio — Entry Point
 * Initializes Three.js renderer, show designer, and swarm viewer.
 * by Minas FX
 */

import { initRenderer } from "./renderer/renderer.js";
import { initShowDesigner } from "./visualDesigner/designer.js";
import { initCinematicRenderer } from "./cinematicRenderer/cinematic.js";
import { initFireworkEngine } from "./fireworks/fireworkEngine.js";
import { initSwarmViewer } from "./swarmViewer/swarmViewer.js";

async function start() {
  console.log("[FX KONTROL] Initializing Web Studio...");

  const renderer = await initRenderer();
  const { scene, camera, clock } = renderer;

  initShowDesigner(scene);
  initCinematicRenderer(scene, camera);
  initFireworkEngine(scene);
  initSwarmViewer(scene);

  console.log("[FX KONTROL] All modules loaded — Minas FX Platform Ready");
}

start().catch(err => console.error("[FX KONTROL] Boot failed:", err));
