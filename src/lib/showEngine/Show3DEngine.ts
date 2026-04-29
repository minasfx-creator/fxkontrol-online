/**
 * Show3DEngine — sole façade between React and Three.js for the AI Show
 * Builder preview pipeline.
 *
 * Responsibilities:
 *  - Owns the renderer, camera, scene, four layers (static/dynamic/effects/debug).
 *  - Owns the viewport state machine and diagnostics bus.
 *  - Handles webglcontextlost / webglcontextrestored centrally.
 *  - Loads a SceneGraph from a ShowPlan via SceneAdapter.
 *  - Exposes deterministic `seek(time, mode)` and frame-paced `renderFrame(delta)`.
 *
 * NB: this is a *preview* engine, intentionally lightweight. The full
 * cinematic pipeline lives in SkyCanvas; we wrap it later. For now we
 * draw site bounds + position markers so the viewport is never black.
 */

import * as THREE from 'three';

import type { ShowPlan } from '@/lib/aiShowBuilder/types';
import { adaptShowPlanToSceneGraph, type SceneGraph } from './SceneAdapter';
import { CameraController, type CameraSink, type CameraTarget } from './CameraController';
import { engineDiagnostics, EngineDiagnosticsBus } from './EngineDiagnostics';
import { ViewportStateMachine } from './viewportState';
import {
  compileTimeline,
  cuesActivatedBetween,
  cuesAt,
  type CompiledTimeline,
} from './timelineCompiler';
import { validateSceneGraph, validateViewportRenderable } from './validateSceneGraph';

export interface Show3DEngineOptions {
  diagnostics?: EngineDiagnosticsBus;
}

export class Show3DEngine {
  readonly viewport = new ViewportStateMachine();
  readonly diagnostics: EngineDiagnosticsBus;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000);
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafHandle = 0;
  // Named handlers so we can cleanly remove them on dispose() — prevents
  // listener leaks across hot-reload and host re-mount.
  private onContextLost: ((e: Event) => void) | null = null;
  private onContextRestored: (() => void) | null = null;
  private listenerCanvas: HTMLCanvasElement | null = null;

  readonly staticLayer = new THREE.Group();
  readonly dynamicLayer = new THREE.Group();
  readonly effectsLayer = new THREE.Group();
  readonly debugLayer = new THREE.Group();

  readonly cameraController: CameraController;

  private compiled: CompiledTimeline | null = null;
  private graph: SceneGraph | null = null;
  private showTime = 0;

  // Frame metrics
  private lastFrameAt = 0;
  private frameAcc = 0;
  private frameCount = 0;

  constructor(opts: Show3DEngineOptions = {}) {
    this.diagnostics = opts.diagnostics ?? engineDiagnostics;
    this.staticLayer.name = 'staticLayer';
    this.dynamicLayer.name = 'dynamicLayer';
    this.effectsLayer.name = 'effectsLayer';
    this.debugLayer.name = 'debugLayer';
    this.scene.add(this.staticLayer, this.dynamicLayer, this.effectsLayer, this.debugLayer);

    const sink: CameraSink = {
      apply: (t: CameraTarget) => {
        this.camera.position.set(t.position.x, t.position.y, t.position.z);
        this.camera.lookAt(t.lookAt.x, t.lookAt.y, t.lookAt.z);
        this.camera.aspect = t.aspect;
        this.camera.updateProjectionMatrix();
      },
      setAspect: (a: number) => {
        this.camera.aspect = a;
        this.camera.updateProjectionMatrix();
      },
    };
    this.cameraController = new CameraController(sink);
    this.cameraController.resetView();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  init(container: HTMLElement): void {
    if (this.renderer) return;
    this.container = container;
    this.viewport.set('booting');

    try {
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      container.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(new THREE.Color(0x050810), 1);
      this.renderer = renderer;

      this.attachContextHandlers(canvas);
      this.attachResizeObserver(container);
      this.applyContainerSize();

      this.diagnostics.update({ webglAvailable: true, contextLost: false });
      this.ensureMinimalScene();
      this.viewport.set('empty');
      this.startLoop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.diagnostics.update({ webglAvailable: false, lastError: msg });
      this.viewport.set('error');
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.rafHandle);
    this.rafHandle = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.detachContextHandlers();

    this.clearLayer(this.staticLayer);
    this.clearLayer(this.dynamicLayer);
    this.clearLayer(this.effectsLayer);
    this.clearLayer(this.debugLayer);

    if (this.renderer) {
      const canvas = this.renderer.domElement;
      this.renderer.dispose();
      canvas.parentElement?.removeChild(canvas);
      this.renderer = null;
    }
    this.container = null;
    this.diagnostics.reset();
  }

  // ─── Plan loading ───────────────────────────────────────────────────

  loadPlan(plan: ShowPlan): void {
    this.graph = adaptShowPlanToSceneGraph(plan);
    this.compiled = compileTimeline(plan);
    this.showTime = 0;

    const sg = validateSceneGraph(this.graph);
    if (!sg.ok) {
      this.diagnostics.reportError(sg.errors.join('; '));
      this.viewport.set('error');
      return;
    }

    this.buildStaticLayer(this.graph);
    this.cameraController.frameSite(this.graph.site);

    const renderable = this.snapshotRenderability();
    if (!renderable.ok) {
      this.diagnostics.reportError(renderable.errors.join('; '));
      this.viewport.set('error');
      return;
    }

    this.viewport.set('ready');
  }

  // ─── Playback ───────────────────────────────────────────────────────

  seek(time: number, opts: { mode: 'playback' | 'scrub' } = { mode: 'playback' }): void {
    if (!this.compiled) return;
    const next = Math.max(0, Math.min(time, this.compiled.duration));

    if (opts.mode === 'scrub') {
      this.clearLayer(this.effectsLayer);
      const active = cuesAt(this.compiled, next);
      for (const cue of active) this.applyCue(cue);
    } else {
      const newly = cuesActivatedBetween(this.compiled, this.showTime, next);
      for (const cue of newly) this.applyCue(cue);
    }
    this.showTime = next;
  }

  recoverContext(): void {
    if (!this.renderer || !this.container) return;
    // Force a renderer re-init by disposing and re-running init on the
    // same container.
    const container = this.container;
    this.dispose();
    this.init(container);
    if (this.graph) {
      // Rebuild layers from the cached graph.
      this.buildStaticLayer(this.graph);
      this.cameraController.frameSite(this.graph.site);
      this.viewport.set('ready');
    }
  }

  // ─── Internals ──────────────────────────────────────────────────────

  private startLoop(): void {
    const loop = (now: number) => {
      this.rafHandle = requestAnimationFrame(loop);
      const delta = this.lastFrameAt === 0 ? 0 : (now - this.lastFrameAt) / 1000;
      this.lastFrameAt = now;
      this.renderFrame(delta);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  renderFrame(delta: number): void {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);

    this.frameAcc += delta;
    this.frameCount++;
    if (this.frameAcc >= 0.5) {
      const fps = this.frameCount / this.frameAcc;
      const info = this.renderer.info.render;
      this.diagnostics.update({
        fps,
        drawCalls: info.calls,
        triangles: info.triangles,
        sceneObjects: this.scene.children.reduce(
          (acc, g) => acc + (g as THREE.Group).children.length,
          0,
        ),
      });
      this.frameAcc = 0;
      this.frameCount = 0;
    }
  }

  private snapshotRenderability() {
    const size = new THREE.Vector2();
    this.renderer?.getSize(size);
    const total = this.scene.children.reduce(
      (acc, g) => acc + (g as THREE.Group).children.length,
      0,
    );
    return validateViewportRenderable({
      rendererWidth: size.x,
      rendererHeight: size.y,
      cameraAspect: this.camera.aspect,
      cameraPosition: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      sceneChildrenCount: total,
    });
  }

  private ensureMinimalScene(): void {
    // Always have *something* in the scene so the viewport is never black
    // even before a plan loads.
    this.clearLayer(this.debugLayer);
    const grid = new THREE.GridHelper(200, 20, 0x224466, 0x112233);
    this.debugLayer.add(grid);
    const axes = new THREE.AxesHelper(20);
    this.debugLayer.add(axes);
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.staticLayer.add(ambient);
  }

  private buildStaticLayer(graph: SceneGraph): void {
    this.clearLayer(this.staticLayer);
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(40, 80, 40);
    this.staticLayer.add(ambient, dir);

    // Site footprint
    const footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(graph.site.width, graph.site.depth),
      new THREE.MeshBasicMaterial({ color: 0x0a1a2a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.set(graph.site.center.x, 0, graph.site.center.z);
    this.staticLayer.add(footprint);

    // Position markers
    for (const p of graph.positions) {
      const color = parseColor(p.color);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 12, 12),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }),
      );
      marker.position.set(p.position.x, p.position.y + 0.5, p.position.z);
      marker.userData.positionId = p.id;
      this.staticLayer.add(marker);
    }
  }

  /**
   * Visualise a compiled cue as a transient flash on the associated
   * position marker. Strictly visual — no FieldBus / hardware side-effects.
   *
   * Spawns a short-lived emissive sphere into the effects layer and
   * registers it for automatic cleanup once its TTL expires. The render
   * loop ticks the active flashes each frame.
   */
  private applyCue(cue: import('./timelineCompiler').CompiledCue): void {
    const ttlMs = Math.max(150, (cue.endTime - cue.startTime) * 1000 || 1500);
    for (const cmd of cue.commands) {
      const anchor = cmd.positionId ? this.findPositionMarker(cmd.positionId) : null;
      const px = anchor?.position.x ?? 0;
      const py = anchor?.position.y ?? 1;
      const pz = anchor?.position.z ?? 0;
      const baseColor = cmd.kind === 'spawn-pyro' ? 0xffaa44
        : cmd.kind === 'finale-burst' ? 0xff66cc
        : cmd.kind === 'move-drone' ? 0x66ccff
        : 0xffffff;
      const intensity = cmd.intensity === 'high' ? 1.6 : cmd.intensity === 'low' ? 0.6 : 1.0;

      const geom = new THREE.SphereGeometry(0.8 + intensity * 0.6, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.85 });
      const flash = new THREE.Mesh(geom, mat);
      flash.position.set(px, py + 0.5, pz);
      flash.userData.cueFlash = { spawnedAt: performance.now(), ttlMs, baseOpacity: 0.85 };
      this.effectsLayer.add(flash);
    }
  }

  private findPositionMarker(positionId: string): THREE.Object3D | null {
    for (const child of this.staticLayer.children) {
      if (child.userData?.positionId === positionId) return child;
    }
    return null;
  }

  private tickEffects(now: number): void {
    // Fade and reap transient cue flashes. Reverse loop so splice is safe.
    const children = this.effectsLayer.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i] as THREE.Mesh;
      const meta = child.userData?.cueFlash as { spawnedAt: number; ttlMs: number; baseOpacity: number } | undefined;
      if (!meta) continue;
      const age = now - meta.spawnedAt;
      if (age >= meta.ttlMs) {
        children.splice(i, 1);
        child.geometry?.dispose();
        const m = child.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach(x => x.dispose()); else m?.dispose();
        continue;
      }
      const k = 1 - age / meta.ttlMs;
      (child.material as THREE.MeshBasicMaterial).opacity = meta.baseOpacity * k;
      child.scale.setScalar(1 + (1 - k) * 0.8);
    }
  }

  private clearLayer(group: THREE.Group): void {
    while (group.children.length) {
      const child = group.children.pop() as THREE.Object3D;
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) {
        for (const m of mat) this.disposeMaterial(m);
      } else if (mat) {
        this.disposeMaterial(mat);
      }
    }
  }

  private disposeMaterial(m: THREE.Material): void {
    // Dispose any textures attached to common material slots before the
    // material itself, so GPU resources are not leaked across reloads.
    const anyMat = m as unknown as Record<string, { dispose?: () => void } | null | undefined>;
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap']) {
      const tex = anyMat[key];
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    }
    m.dispose();
  }

  private attachContextHandlers(canvas: HTMLCanvasElement): void {
    this.detachContextHandlers();
    this.listenerCanvas = canvas;
    this.onContextLost = (e: Event) => {
      e.preventDefault();
      this.diagnostics.update({ contextLost: true });
      this.viewport.set('contextLost');
    };
    this.onContextRestored = () => {
      this.diagnostics.update({ contextLost: false });
      this.viewport.set('ready');
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private detachContextHandlers(): void {
    if (this.listenerCanvas) {
      if (this.onContextLost) {
        this.listenerCanvas.removeEventListener('webglcontextlost', this.onContextLost);
      }
      if (this.onContextRestored) {
        this.listenerCanvas.removeEventListener('webglcontextrestored', this.onContextRestored);
      }
    }
    this.onContextLost = null;
    this.onContextRestored = null;
    this.listenerCanvas = null;
  }

  private attachResizeObserver(container: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.applyContainerSize());
    this.resizeObserver.observe(container);
  }

  private applyContainerSize(): void {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.cameraController.updateAspect(w, h);
  }
}

function parseColor(hex: string): number {
  if (!hex) return 0x66ccff;
  try {
    return new THREE.Color(hex).getHex();
  } catch {
    return 0x66ccff;
  }
}
