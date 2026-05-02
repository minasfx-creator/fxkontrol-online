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

/**
 * Snapshot emitted to playback subscribers each time the play state or
 * `showTime` changes meaningfully (state flip, end-of-show, or every
 * render tick while playing).
 */
export interface PlaybackSnapshot {
  time: number;
  duration: number;
  playing: boolean;
  rate: number;
  loop: boolean;
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
  private playing = false;
  private playRate = 1;
  private playLoop = false;
  private playbackListeners = new Set<(s: PlaybackSnapshot) => void>();

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

    // Clear all four layers (geometries, materials, textures).
    this.clearLayer(this.staticLayer);
    this.clearLayer(this.dynamicLayer);
    this.clearLayer(this.effectsLayer);
    this.clearLayer(this.debugLayer);

    // Drop scene-graph & timeline so we don't hold references to large
    // ShowPlan/CompiledTimeline/cue command arrays after teardown.
    this.compiled = null;
    this.graph = null;
    this.showTime = 0;
    this.lastFrameAt = 0;
    this.frameAcc = 0;
    this.frameCount = 0;

    if (this.renderer) {
      const canvas = this.renderer.domElement;
      // Free any pooled programs/textures/RTs and force the GPU context to
      // release immediately so a remount can request a fresh context.
      try { this.renderer.renderLists.dispose(); } catch { /* noop */ }
      try { this.renderer.setRenderTarget(null); } catch { /* noop */ }
      this.renderer.dispose();
      try {
        const ctx = this.renderer.getContext();
        const ext = ctx?.getExtension?.('WEBGL_lose_context');
        ext?.loseContext?.();
      } catch { /* noop */ }
      canvas.parentElement?.removeChild(canvas);
      this.renderer = null;
    }
    this.container = null;
    this.diagnostics.reset();
    this.viewport.set('booting');
  }

  // ─── Plan loading ───────────────────────────────────────────────────

  loadPlan(plan: ShowPlan): void {
    this.graph = adaptShowPlanToSceneGraph(plan);
    this.compiled = compileTimeline(plan);
    this.showTime = 0;
    this.playing = false;

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
    this.emitPlayback();
  }

  // ─── Playback ───────────────────────────────────────────────────────

  /**
   * Move show time. In `playback` mode (default), only newly-crossed cues
   * fire — this is what the auto-advance loop calls every frame so that
   * Particle Explosions / Light Points spawn exactly at their scheduled
   * `startTime`. In `scrub` mode the effects layer is wiped and all cues
   * active at `time` are re-spawned (idempotent state for timeline scrub).
   */
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
    this.emitPlayback();
  }

  /** Begin auto-advancing `showTime` at `rate` (1 = real-time). */
  play(opts: { rate?: number; loop?: boolean } = {}): void {
    if (!this.compiled) return;
    if (typeof opts.rate === 'number' && opts.rate > 0) this.playRate = opts.rate;
    if (typeof opts.loop === 'boolean') this.playLoop = opts.loop;
    if (this.showTime >= this.compiled.duration) this.showTime = 0;
    this.playing = true;
    this.emitPlayback();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.emitPlayback();
  }

  stop(): void {
    this.playing = false;
    if (this.compiled) {
      this.clearLayer(this.effectsLayer);
      this.showTime = 0;
    }
    this.emitPlayback();
  }

  setRate(rate: number): void {
    if (rate > 0) this.playRate = rate;
    this.emitPlayback();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getShowTime(): number {
    return this.showTime;
  }

  getDuration(): number {
    return this.compiled?.duration ?? 0;
  }

  subscribePlayback(listener: (s: PlaybackSnapshot) => void): () => void {
    this.playbackListeners.add(listener);
    listener(this.playbackSnapshot());
    return () => { this.playbackListeners.delete(listener); };
  }

  private playbackSnapshot(): PlaybackSnapshot {
    return {
      time: this.showTime,
      duration: this.compiled?.duration ?? 0,
      playing: this.playing,
      rate: this.playRate,
      loop: this.playLoop,
    };
  }

  private emitPlayback(): void {
    if (this.playbackListeners.size === 0) return;
    const snap = this.playbackSnapshot();
    for (const l of this.playbackListeners) {
      try { l(snap); } catch { /* listener errors are non-fatal */ }
    }
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

    // Auto-advance show time when playing. Driven by the same RAF that
    // renders, so cues fire on the very frame their startTime is crossed
    // — no separate timer, no drift.
    if (this.playing && this.compiled) {
      const next = this.showTime + delta * this.playRate;
      if (next >= this.compiled.duration) {
        if (this.playLoop) {
          // Wrap: fire any tail cues, then restart from 0.
          this.seek(this.compiled.duration);
          this.clearLayer(this.effectsLayer);
          this.showTime = 0;
        } else {
          this.seek(this.compiled.duration);
          this.playing = false;
          this.emitPlayback();
        }
      } else {
        this.seek(next);
      }
    }

    this.tickEffects(performance.now());
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
  /**
   * Visualise a compiled cue as a transient effect anchored to the
   * associated position marker. Strictly visual — no FieldBus / hardware
   * side-effects.
   *
   * Effect kinds:
   *   - `spawn-pyro` / `finale-burst` → Particle Explosion (radial Points
   *     burst with per-particle ballistic velocity, gravity, and fade).
   *   - `move-drone`                  → Light Point (pulsing emissive
   *     point sprite climbing slightly upward).
   *
   * Each cue produces ONE root mesh (the flash anchor) carrying
   * `userData.cueFlash`, with the particle/light system attached as a
   * child. This keeps the existing reaper contract (1 child per cue in
   * the effects layer) intact while delivering richer visuals.
   */
  private applyCue(cue: import('./timelineCompiler').CompiledCue): void {
    const ttlBase = (cue.endTime - cue.startTime) * 1000 || 1500;
    for (const cmd of cue.commands) {
      const anchor = cmd.positionId ? this.findPositionMarker(cmd.positionId) : null;
      const px = anchor?.position.x ?? 0;
      const py = anchor?.position.y ?? 1;
      const pz = anchor?.position.z ?? 0;

      const isPyro = cmd.kind === 'spawn-pyro' || cmd.kind === 'finale-burst';
      const isDrone = cmd.kind === 'move-drone';
      const baseColor = cmd.kind === 'spawn-pyro' ? 0xffaa44
        : cmd.kind === 'finale-burst' ? 0xff66cc
        : isDrone ? 0x66ccff
        : 0xffffff;
      const intensity = cmd.intensity === 'high' ? 1.6 : cmd.intensity === 'low' ? 0.6 : 1.0;
      const ttlMs = isPyro
        ? Math.max(900, ttlBase * (cmd.kind === 'finale-burst' ? 1.6 : 1.2))
        : Math.max(600, ttlBase);

      // Anchor: small invisible-ish flash sphere (preserves cueFlash
      // contract used by the reaper + tests). Kept very subtle — the real
      // visual punch comes from the particle system child.
      const flashR = 0.4 + intensity * 0.3;
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(flashR, 10, 10),
        new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.6 }),
      );
      flash.position.set(px, py + 0.5, pz);
      flash.userData.cueFlash = { spawnedAt: performance.now(), ttlMs, baseOpacity: 0.6 };

      if (isPyro) {
        flash.add(this.buildParticleExplosion(baseColor, intensity, ttlMs));
      } else if (isDrone) {
        flash.add(this.buildLightPoint(baseColor, intensity, ttlMs));
      }

      this.effectsLayer.add(flash);
    }
  }

  /**
   * Particle Explosion — N points launched on a unit sphere with random
   * speed, then advected each frame by `tickEffects` using v += g·dt and
   * p += v·dt. Cheap, self-contained, no GPGPU dependency.
   */
  private buildParticleExplosion(color: number, intensity: number, ttlMs: number): THREE.Points {
    const COUNT = Math.max(48, Math.round(96 * intensity));
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const speedBase = 6 + 4 * intensity;
    for (let i = 0; i < COUNT; i++) {
      // Uniform random direction on sphere (Marsaglia).
      let u: number, v: number, s: number;
      do {
        u = Math.random() * 2 - 1;
        v = Math.random() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const factor = 2 * Math.sqrt(1 - s);
      const dx = u * factor;
      const dy = v * factor;
      const dz = 1 - 2 * s;
      const speed = speedBase * (0.6 + Math.random() * 0.7);
      velocities[i * 3 + 0] = dx * speed;
      velocities[i * 3 + 1] = Math.abs(dy * speed) * 0.7 + speed * 0.3; // bias up
      velocities[i * 3 + 2] = dz * speed;
      // start near origin (offsets from the anchor flash)
      positions[i * 3 + 0] = dx * 0.2;
      positions[i * 3 + 1] = dy * 0.2;
      positions[i * 3 + 2] = dz * 0.2;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.6 + intensity * 0.5,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geom, mat);
    points.userData.particleBurst = {
      spawnedAt: performance.now(),
      ttlMs,
      velocities,
      gravity: -9.8,
      drag: 0.92,
      baseOpacity: 1,
    };
    return points;
  }

  /**
   * Light Point — single bright additive point sprite that pulses and
   * drifts upward, used to visualise `move-drone` cues.
   */
  private buildLightPoint(color: number, intensity: number, ttlMs: number): THREE.Points {
    const positions = new Float32Array(3); // single point
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 1.6 + intensity * 1.4,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geom, mat);
    points.userData.lightPoint = {
      spawnedAt: performance.now(),
      ttlMs,
      driftY: 1.4 + intensity * 1.6,
      baseOpacity: 1,
    };
    return points;
  }

  private findPositionMarker(positionId: string): THREE.Object3D | null {
    for (const child of this.staticLayer.children) {
      if (child.userData?.positionId === positionId) return child;
    }
    return null;
  }

  private tickEffects(now: number): void {
    // Walk effects layer top-level (cue flash anchors) and advect any
    // attached particle/light children. Reverse loop so splice is safe.
    const children = this.effectsLayer.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i] as THREE.Mesh;
      const meta = child.userData?.cueFlash as { spawnedAt: number; ttlMs: number; baseOpacity: number } | undefined;
      if (!meta) continue;
      const age = now - meta.spawnedAt;
      if (age >= meta.ttlMs) {
        children.splice(i, 1);
        this.disposeSubtree(child);
        continue;
      }
      const k = 1 - age / meta.ttlMs;
      (child.material as THREE.MeshBasicMaterial).opacity = meta.baseOpacity * k;
      // Gentle anchor pulse for the first 25% of life only.
      const pulseK = k > 0.75 ? (1 - k) / 0.25 : 1;
      child.scale.setScalar(1 + pulseK * 0.5);

      // Tick attached particle/light children.
      for (const sub of child.children) {
        this.tickEffectChild(sub, now);
      }
    }
  }

  /** Advance a single particle Points / light Points child by one frame. */
  private tickEffectChild(obj: THREE.Object3D, now: number): void {
    const burst = obj.userData?.particleBurst as
      | { spawnedAt: number; ttlMs: number; velocities: Float32Array; gravity: number; drag: number; baseOpacity: number }
      | undefined;
    if (burst) {
      const points = obj as THREE.Points;
      const geom = points.geometry as THREE.BufferGeometry;
      const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const last = (obj.userData._lastTick as number) ?? now;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      obj.userData._lastTick = now;
      const v = burst.velocities;
      for (let i = 0; i < positions.length; i += 3) {
        // gravity on Y component of velocity
        v[i + 1] += burst.gravity * dt;
        // light air drag (frame-rate-aware exp)
        const dragK = Math.pow(burst.drag, dt * 60);
        v[i] *= dragK; v[i + 1] *= dragK; v[i + 2] *= dragK;
        positions[i] += v[i] * dt;
        positions[i + 1] += v[i + 1] * dt;
        positions[i + 2] += v[i + 2] * dt;
      }
      posAttr.needsUpdate = true;
      const lifeK = 1 - (now - burst.spawnedAt) / burst.ttlMs;
      const mat = points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, burst.baseOpacity * Math.pow(lifeK, 1.4));
      return;
    }
    const lp = obj.userData?.lightPoint as
      | { spawnedAt: number; ttlMs: number; driftY: number; baseOpacity: number }
      | undefined;
    if (lp) {
      const points = obj as THREE.Points;
      const geom = points.geometry as THREE.BufferGeometry;
      const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const last = (obj.userData._lastTick as number) ?? now;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      obj.userData._lastTick = now;
      positions[1] += lp.driftY * dt;
      posAttr.needsUpdate = true;
      const lifeK = 1 - (now - lp.spawnedAt) / lp.ttlMs;
      // gentle 4 Hz pulse modulating opacity
      const pulse = 0.7 + 0.3 * Math.sin(((now - lp.spawnedAt) / 1000) * 2 * Math.PI * 4);
      const mat = points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, lp.baseOpacity * Math.pow(lifeK, 1.2) * pulse);
    }
  }

  private disposeSubtree(root: THREE.Object3D): void {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh & THREE.Points;
      if (mesh.geometry && typeof (mesh.geometry as THREE.BufferGeometry).dispose === 'function') {
        (mesh.geometry as THREE.BufferGeometry).dispose();
      }
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) for (const m of mat) this.disposeMaterial(m);
      else if (mat) this.disposeMaterial(mat);
    });
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
