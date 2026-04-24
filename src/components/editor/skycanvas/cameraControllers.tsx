/**
 * Camera controllers extracted from SkyCanvas.tsx.
 *
 * - FlyControls: WASD + mouse pointer-lock first-person camera.
 * - GroundControls: WASD walk mode with terrain altitude lock (1.7m eye height).
 * - CameraController: OrbitControls wrapper with cinematic intro, presets,
 *   focus-on-point, frame-all, gizmo-aware enabling, and select-mode mouse map.
 *
 * Behavior preserved 1:1 — only file location changes.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { useViewportStore } from '@/store/useViewportStore';
import { isFlyingTo } from '@/core/camera/geoCamera';

// Session-level flag: intro only plays once per browser session
let __cameraIntroPlayed = false;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** FlyControls — WASD + mouse pointer-lock first-person camera */
export function FlyControls({ onSpeedChange }: { onSpeedChange?: (speed: number) => void }) {
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const speed = useRef(15);
  const locked = useRef(false);
  const SENSITIVITY = 0.002;

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerLockChange = () => {
      locked.current = document.pointerLockElement === canvas;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current) return;
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= e.movementX * SENSITIVITY;
      euler.current.x -= e.movementY * SENSITIVITY;
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -Math.PI * 0.49, Math.PI * 0.49);
      camera.quaternion.setFromEuler(euler.current);
    };
    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const onWheel = (e: WheelEvent) => {
      if (!locked.current) return;
      e.preventDefault();
      speed.current = THREE.MathUtils.clamp(speed.current * (e.deltaY > 0 ? 0.85 : 1.18), 1, 500);
      onSpeedChange?.(speed.current);
    };

    canvas.requestPointerLock();
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      keys.current = {};
    };
  }, [camera, gl, onSpeedChange]);

  const dir = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!locked.current) return;
    const k = keys.current;
    const sprint = k['ShiftLeft'] || k['ShiftRight'] ? 3 : 1;
    const move = speed.current * sprint * delta;

    camera.getWorldDirection(dir.current);
    right.current.crossVectors(dir.current, camera.up).normalize();

    if (k['KeyW'] || k['ArrowUp']) camera.position.addScaledVector(dir.current, move);
    if (k['KeyS'] || k['ArrowDown']) camera.position.addScaledVector(dir.current, -move);
    if (k['KeyA'] || k['ArrowLeft']) camera.position.addScaledVector(right.current, -move);
    if (k['KeyD'] || k['ArrowRight']) camera.position.addScaledVector(right.current, move);
    if (k['KeyE'] || k['Space']) camera.position.y += move;
    if (k['KeyQ']) camera.position.y -= move;

    camera.position.y = Math.max(5, camera.position.y);
  });

  return null;
}

/** GroundControls — WASD walk mode with altitude locked to terrain + 1.7m */
export function GroundControls({ onSpeedChange }: { onSpeedChange?: (speed: number) => void }) {
  const { camera, gl, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const speed = useRef(5);
  const locked = useRef(false);
  const lastTerrainY = useRef<number | null>(null);
  const raycastFn = useRef<typeof import('@/core/geo/terrainQuery').raycastTerrainLocal | null>(null);
  const SENSITIVITY = 0.002;
  const EYE_HEIGHT = 1.7;
  const PITCH_LIMIT = Math.PI * 0.44; // ±80°

  useEffect(() => {
    import('@/core/geo/terrainQuery').then(mod => {
      raycastFn.current = mod.raycastTerrainLocal;
    });
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerLockChange = () => {
      locked.current = document.pointerLockElement === canvas;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current) return;
      euler.current.setFromQuaternion(camera.quaternion);
      euler.current.y -= e.movementX * SENSITIVITY;
      euler.current.x -= e.movementY * SENSITIVITY;
      euler.current.x = THREE.MathUtils.clamp(euler.current.x, -PITCH_LIMIT, PITCH_LIMIT);
      camera.quaternion.setFromEuler(euler.current);
    };
    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const onWheel = (e: WheelEvent) => {
      if (!locked.current) return;
      e.preventDefault();
      speed.current = THREE.MathUtils.clamp(speed.current * (e.deltaY > 0 ? 0.85 : 1.18), 0.5, 50);
      onSpeedChange?.(speed.current);
    };

    canvas.requestPointerLock();
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      keys.current = {};
    };
  }, [camera, gl, onSpeedChange]);

  const dir = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const flatDir = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!locked.current) return;
    const k = keys.current;
    const sprint = k['ShiftLeft'] || k['ShiftRight'] ? 2.5 : 1;
    const move = speed.current * sprint * delta;

    camera.getWorldDirection(dir.current);
    flatDir.current.set(dir.current.x, 0, dir.current.z).normalize();
    right.current.crossVectors(flatDir.current, camera.up).normalize();

    if (k['KeyW'] || k['ArrowUp']) camera.position.addScaledVector(flatDir.current, move);
    if (k['KeyS'] || k['ArrowDown']) camera.position.addScaledVector(flatDir.current, -move);
    if (k['KeyA'] || k['ArrowLeft']) camera.position.addScaledVector(right.current, -move);
    if (k['KeyD'] || k['ArrowRight']) camera.position.addScaledVector(right.current, move);

    if (raycastFn.current) {
      const terrainY = raycastFn.current(camera.position.x, camera.position.z, scene);
      if (terrainY !== null) {
        lastTerrainY.current = terrainY;
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, terrainY + EYE_HEIGHT, 0.15);
      } else if (lastTerrainY.current !== null) {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, lastTerrainY.current + EYE_HEIGHT, 0.15);
      } else {
        camera.position.y = Math.max(5, camera.position.y);
      }
    } else {
      camera.position.y = Math.max(5, camera.position.y);
    }
  });

  return null;
}

interface OrbitControlsHandle {
  target: THREE.Vector3;
  enabled: boolean;
  mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
  update: () => void;
}

export function CameraController({ targetPosition, targetLookAt, freeLook, flyMode }: {
  targetPosition: [number, number, number];
  targetLookAt: [number, number, number];
  freeLook: boolean;
  flyMode: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  const targetPos = useRef(new THREE.Vector3(...targetPosition));
  const targetLook = useRef(new THREE.Vector3(...targetLookAt));
  const animating = useRef(false);
  const focusAnimating = useRef(false);
  const initialized = useRef(false);
  const lastPresetKey = useRef('');
  const introPhase = useRef<'hold' | 'sweep' | 'done'>(__cameraIntroPlayed ? 'done' : 'hold');
  const introTimer = useRef(0);
  const userInteracted = useRef(__cameraIntroPlayed);

  const WORLD_HALF_EXTENT = 250000;
  const CAMERA_MIN_Y = 5;
  const CAMERA_MAX_Y = 40000;
  const _lastValidY = useRef(-1);

  const clampToWorldBounds = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (isFlyingTo()) return;

    const tx = THREE.MathUtils.clamp(controls.target.x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);
    const ty = THREE.MathUtils.clamp(controls.target.y, 0, 50000);
    const tz = THREE.MathUtils.clamp(controls.target.z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);

    const cy = THREE.MathUtils.clamp(camera.position.y, CAMERA_MIN_Y, CAMERA_MAX_Y);
    _lastValidY.current = cy;

    const cx = THREE.MathUtils.clamp(camera.position.x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);
    const cz = THREE.MathUtils.clamp(camera.position.z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);

    const targetChanged = tx !== controls.target.x || ty !== controls.target.y || tz !== controls.target.z;
    const cameraChanged = cx !== camera.position.x || cy !== camera.position.y || cz !== camera.position.z;

    if (targetChanged) controls.target.set(tx, ty, tz);
    if (cameraChanged) camera.position.set(cx, cy, cz);
  }, [camera]);

  // Pre-allocated vectors for intro animation
  const introStartPos = useRef(new THREE.Vector3(-80, 140, 320));
  const introStartLook = useRef(new THREE.Vector3(0, 5, 0));
  const introDuration = useRef({ hold: 1.8, sweep: 3.0 });
  const _sweepDefaultPos = useRef(new THREE.Vector3());
  const _sweepDefaultLook = useRef(new THREE.Vector3());
  const _sweepStartPos = useRef(new THREE.Vector3(60, 100, 220));
  const _sweepCurrentTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    if (__cameraIntroPlayed) {
      camera.position.set(...targetPosition);
      if (controlsRef.current) {
        controlsRef.current.target.set(...targetLookAt);
        controlsRef.current.update();
      }
      introPhase.current = 'done';
      return;
    }
    camera.position.copy(introStartPos.current);
    camera.lookAt(introStartLook.current);
    introPhase.current = 'hold';
    introTimer.current = 0;
  }, []);

  // Cancel intro on first manual interaction
  useEffect(() => {
    const cancelIntro = () => {
      if (userInteracted.current) return;
      userInteracted.current = true;
      if (introPhase.current !== 'done') {
        introPhase.current = 'done';
        __cameraIntroPlayed = true;
        camera.position.set(...targetPosition);
        if (controlsRef.current) {
          controlsRef.current.target.set(...targetLookAt);
          controlsRef.current.update();
        }
        animating.current = false;
      }
    };
    const canvas = document.querySelector('[data-sky-canvas] canvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', cancelIntro, { once: true });
      canvas.addEventListener('wheel', cancelIntro, { once: true });
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener('pointerdown', cancelIntro);
        canvas.removeEventListener('wheel', cancelIntro);
      }
    };
  }, [camera, targetPosition, targetLookAt]);

  // Gizmo dragging: disable/enable OrbitControls
  useEffect(() => {
    const handler = (e: Event) => {
      const isDragging = (e as CustomEvent).detail;
      if (controlsRef.current) {
        controlsRef.current.enabled = !isDragging;
        if (!isDragging) controlsRef.current.update();
      }
    };
    window.addEventListener('gizmo-dragging', handler as EventListener);
    return () => window.removeEventListener('gizmo-dragging', handler as EventListener);
  }, []);

  // View preset handler
  useEffect(() => {
    const handler = (e: Event) => {
      const { position, target } = (e as CustomEvent).detail as { position: [number, number, number]; target: [number, number, number] };
      targetPos.current.set(position[0], position[1], position[2]);
      targetLook.current.set(target[0], target[1], target[2]);
      animating.current = true;
    };
    window.addEventListener('viewport-set-view', handler as EventListener);
    return () => window.removeEventListener('viewport-set-view', handler as EventListener);
  }, []);

  // Cancel animation handler
  useEffect(() => {
    const handler = () => {
      animating.current = false;
      focusAnimating.current = false;
    };
    window.addEventListener('viewport-cancel-animation', handler);
    return () => window.removeEventListener('viewport-cancel-animation', handler);
  }, []);

  // Frame selection handler
  useEffect(() => {
    const handler = () => {
      const { selectedPositionId, positions } = useProjectStore.getState();
      if (selectedPositionId) {
        const pos = positions.find(p => p.id === selectedPositionId);
        if (pos) {
          window.dispatchEvent(new CustomEvent('focus-camera-on-point', { detail: { x: pos.x, y: pos.y || 0, z: pos.z } }));
        }
      }
    };
    window.addEventListener('viewport-frame-selection', handler);
    return () => window.removeEventListener('viewport-frame-selection', handler);
  }, []);

  // Frame all handler
  useEffect(() => {
    const handler = () => {
      const { positions } = useProjectStore.getState();
      if (positions.length === 0) {
        targetPos.current.set(...targetPosition);
        targetLook.current.set(...targetLookAt);
        animating.current = true;
        return;
      }
      let cx = 0, cy = 0, cz = 0;
      for (const p of positions) {
        cx += p.x; cy += (p.y || 0); cz += p.z;
      }
      cx /= positions.length; cy /= positions.length; cz /= positions.length;
      window.dispatchEvent(new CustomEvent('focus-camera-on-point', { detail: { x: cx, y: cy, z: cz } }));
    };
    window.addEventListener('viewport-frame-all', handler);
    return () => window.removeEventListener('viewport-frame-all', handler);
  }, [targetPosition, targetLookAt]);

  const presetKey = `${targetPosition.join(',')}_${targetLookAt.join(',')}`;

  useEffect(() => {
    if (freeLook) { animating.current = false; return; }
    if (!initialized.current) {
      initialized.current = true;
      lastPresetKey.current = presetKey;
      return;
    }
    if (presetKey === lastPresetKey.current) return;
    lastPresetKey.current = presetKey;
    targetPos.current.set(...targetPosition);
    targetLook.current.set(...targetLookAt);
    animating.current = true;
  }, [presetKey, freeLook]);

  useFrame((_, delta) => {
    if (introPhase.current !== 'done') {
      introTimer.current += delta;

      if (introPhase.current === 'hold') {
        const holdT = Math.min(1, introTimer.current / introDuration.current.hold);
        const eased = easeInOutCubic(holdT);
        const orbitRadius = 300;
        const orbitSpeed = 0.12;
        const altBase = 140 - eased * 60;
        const altWave = Math.sin(introTimer.current * 0.5) * 8;
        camera.position.set(
          Math.sin(introTimer.current * orbitSpeed) * orbitRadius,
          altBase + altWave,
          Math.cos(introTimer.current * orbitSpeed) * orbitRadius
        );
        camera.lookAt(0, 5, 0);
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 5, 0);
          controlsRef.current.update();
        }
        if (introTimer.current >= introDuration.current.hold) {
          introPhase.current = 'sweep';
          introTimer.current = 0;
          _sweepStartPos.current.copy(camera.position);
        }
      } else if (introPhase.current === 'sweep') {
        const sweepT = Math.min(1, introTimer.current / introDuration.current.sweep);
        const eased = easeInOutCubic(sweepT);

        _sweepDefaultPos.current.set(targetPosition[0], targetPosition[1], targetPosition[2]);
        _sweepDefaultLook.current.set(targetLookAt[0], targetLookAt[1], targetLookAt[2]);

        camera.position.lerpVectors(_sweepStartPos.current, _sweepDefaultPos.current, eased);

        if (controlsRef.current) {
          _sweepCurrentTarget.current.lerpVectors(introStartLook.current, _sweepDefaultLook.current, eased);
          controlsRef.current.target.copy(_sweepCurrentTarget.current);
          controlsRef.current.update();
        }

        if (sweepT >= 1) {
          introPhase.current = 'done';
          __cameraIntroPlayed = true;
          camera.position.copy(_sweepDefaultPos.current);
          if (controlsRef.current) {
            controlsRef.current.target.copy(_sweepDefaultLook.current);
            controlsRef.current.update();
          }
          animating.current = false;
        }
      }
      clampToWorldBounds();
      return;
    }

    if ((!animating.current && !focusAnimating.current) || !controlsRef.current || freeLook) {
      clampToWorldBounds();
      return;
    }
    camera.position.lerp(targetPos.current, focusAnimating.current ? 0.08 : 0.06);
    controlsRef.current.target.lerp(targetLook.current, focusAnimating.current ? 0.08 : 0.06);
    controlsRef.current.update();
    if (camera.position.distanceTo(targetPos.current) < 0.1) {
      animating.current = false;
      focusAnimating.current = false;
    }
    clampToWorldBounds();
  });

  const sensitivityScale = 0.7;

  // Broadcast OrbitControls ref to GeoCameraController
  useEffect(() => {
    if (controlsRef.current) {
      window.dispatchEvent(new CustomEvent('r3f-controls-ready', { detail: { controls: controlsRef.current } }));
    }
  }, [controlsRef.current]);

  // Disable OrbitControls while box-select is active
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !e.detail;
        if (e.detail) {
          useViewportStore.getState().setInteractionState('boxSelecting');
        } else {
          useViewportStore.getState().setInteractionState('idle');
        }
      }
    };
    window.addEventListener('box-select-active', handler as EventListener);
    return () => window.removeEventListener('box-select-active', handler as EventListener);
  }, []);

  // Double-click focus: fly camera to a 3D point
  useEffect(() => {
    const _focusCamDir = new THREE.Vector3();
    const handler = (e: Event) => {
      const { x, y, z } = (e as CustomEvent).detail;
      if (controlsRef.current) {
        targetLook.current.set(x, y, z);
        _focusCamDir.subVectors(camera.position, controlsRef.current.target).normalize();
        const dist = Math.max(20, camera.position.distanceTo(controlsRef.current.target) * 0.5);
        targetPos.current.set(x + _focusCamDir.x * dist, Math.max(y + 5, y + _focusCamDir.y * dist), z + _focusCamDir.z * dist);
        focusAnimating.current = true;
      }
    };
    window.addEventListener('focus-camera-on-point', handler);
    return () => window.removeEventListener('focus-camera-on-point', handler);
  }, [camera]);

  // In select mode: disable left-mouse orbit so box-select works
  const editorMode = useProjectStore(s => s.editorMode);
  const isSelectMode = editorMode === 'select';

  useEffect(() => {
    if (!controlsRef.current) return;
    if (isSelectMode) {
      controlsRef.current.mouseButtons = {
        LEFT: -1,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      };
    } else {
      controlsRef.current.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
  }, [isSelectMode]);

  if (flyMode) return null;

  return (
    <OrbitControls
      ref={controlsRef as unknown as React.Ref<unknown>}
      enableDamping={false}
      rotateSpeed={0.6 * sensitivityScale}
      panSpeed={0.8 * sensitivityScale}
      zoomSpeed={1.2 * sensitivityScale}
      minPolarAngle={Math.PI * 0.05}
      maxPolarAngle={Math.PI * 0.75}
      minDistance={2}
      maxDistance={90000}
      enablePan
    />
  );
}
